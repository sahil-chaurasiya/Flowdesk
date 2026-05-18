const express = require('express');
const router = express.Router();
const CalendarEvent = require('../models/CalendarEvent');
const Client = require('../models/Client');
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { logActivity } = require('../utils/activityLog');

const ALL_INTERNAL = ['admin', 'manager', ...TEAM_ROLES];

// ── Visibility filter helper ──────────────────────────────────────────────────
// An event is visible to a user if ANY of:
//   1. visibility === 'all'
//   2. visibility === 'private' AND createdBy === userId
//   3. visibility === 'specific' AND (visibleTo contains userId OR createdBy === userId)
//   4. assignedTo contains userId (always visible to assignees)
function buildVisibilityFilter(userId) {
  return [
    { visibility: 'all' },
    { visibility: { $exists: false } },          // legacy docs with no field
    { visibility: 'private', createdBy: userId },
    { visibility: 'specific', visibleTo: userId },
    { visibility: 'specific', createdBy: userId },
    { assignedTo: userId },
  ];
}

// @route  GET /api/calendar
router.get('/', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const { from, to, client } = req.query;
  const userId = req.user._id;
  const role   = req.user.role;

  const dateFilter = {};
  if (from || to) {
    dateFilter.startDate = {};
    if (from) dateFilter.startDate.$gte = new Date(from);
    if (to)   dateFilter.startDate.$lte = new Date(to);
  }

  const visOr = buildVisibilityFilter(userId);

  // ── Scope by role ───────────────────────────────────────────────────────
  let clientScope = null; // null = no extra restriction

  if (role === 'admin') {
    if (client) clientScope = { client };
  } else if (role === 'manager') {
    const managedClients = await Client.find({
      $or: [{ accountManager: userId }, { teamMembers: userId }],
    }).select('_id');
    const managedIds = managedClients.map(c => c._id);
    if (client) {
      const manages = managedIds.some(id => String(id) === String(client));
      if (!manages) return res.json({ success: true, events: [] });
      clientScope = { client };
    } else {
      clientScope = { $or: [{ client: null }, { client: { $in: managedIds } }] };
    }
  } else {
    // Team members
    const assignedClients = await Client.find({
      $or: [{ accountManager: userId }, { teamMembers: userId }],
    }).select('_id');
    const assignedIds = assignedClients.map(c => c._id);
    if (client) {
      const isAssigned = assignedIds.some(id => String(id) === String(client));
      if (!isAssigned) return res.json({ success: true, events: [] });
      clientScope = { client };
    } else {
      clientScope = { $or: [{ client: null }, { client: { $in: assignedIds } }] };
    }
  }

  // Build final query using $and to combine scope + visibility
  const andClauses = [{ $or: visOr }];
  if (clientScope) {
    if (clientScope.$or) {
      andClauses.push({ $or: clientScope.$or });
    } else {
      andClauses.push(clientScope);
    }
  }

  const query = { ...dateFilter, $and: andClauses };

  const events = await CalendarEvent.find(query)
    .populate('client', 'company')
    .populate('task', 'title')
    .populate('createdBy', 'name')
    .populate('assignedTo', 'name avatar')
    .populate('visibleTo', 'name avatar')
    .sort({ startDate: 1 })
    .lean();

  res.json({ success: true, events });
}));

// @route  POST /api/calendar
router.post('/', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const { visibility = 'all', visibleTo = [], ...rest } = req.body;

  if (visibility === 'specific' && (!Array.isArray(visibleTo) || visibleTo.length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'Please select at least one person when using "Specific people" visibility.',
    });
  }

  const event = await CalendarEvent.create({
    ...rest,
    createdBy: req.user._id,
    visibility,
    visibleTo: visibility === 'specific' ? visibleTo : [],
  });

  const populated = await CalendarEvent.findById(event._id)
    .populate('client', 'company')
    .populate('assignedTo', 'name avatar')
    .populate('visibleTo', 'name avatar')
    .lean();

  logActivity({
    req,
    action: 'task.created',
    entity: { type: 'calendar_event', id: event._id, name: event.title },
  });

  res.status(201).json({ success: true, event: populated });
}));

// @route  PUT /api/calendar/:id
router.put('/:id', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const existing = await CalendarEvent.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });

  const isManager = ['admin', 'manager'].includes(req.user.role);
  const isOwner   = String(existing.createdBy) === String(req.user._id);
  if (!isManager && !isOwner) {
    return res.status(403).json({ success: false, message: 'Not authorised to edit this event' });
  }

  const newVisibility = req.body.visibility ?? existing.visibility;
  const newVisibleTo  = req.body.visibleTo  ?? existing.visibleTo;
  if (newVisibility === 'specific' && (!Array.isArray(newVisibleTo) || newVisibleTo.length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'Please select at least one person when using "Specific people" visibility.',
    });
  }
  // Clear visibleTo list when switching away from 'specific'
  if (req.body.visibility && req.body.visibility !== 'specific') {
    req.body.visibleTo = [];
  }

  const event = await CalendarEvent.findByIdAndUpdate(
    req.params.id, req.body, { new: true, runValidators: true },
  )
    .populate('client', 'company')
    .populate('assignedTo', 'name avatar')
    .populate('visibleTo', 'name avatar')
    .lean();

  res.json({ success: true, event });
}));

// @route  DELETE /api/calendar/:id
router.delete('/:id', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const existing = await CalendarEvent.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });

  const isManager = ['admin', 'manager'].includes(req.user.role);
  const isOwner   = String(existing.createdBy) === String(req.user._id);
  if (!isManager && !isOwner) {
    return res.status(403).json({ success: false, message: 'Not authorised to delete this event' });
  }

  await CalendarEvent.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Event deleted' });
}));

module.exports = router;

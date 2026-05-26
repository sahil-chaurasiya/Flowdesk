const express = require('express');
const router = express.Router();
const CalendarEvent = require('../models/CalendarEvent');
const Client = require('../models/Client');
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { logActivity } = require('../utils/activityLog');

const ALL_INTERNAL = ['admin', 'manager', ...TEAM_ROLES];

// ── Visibility filter helper ──────────────────────────────────────────────────
function buildVisibilityFilter(userId) {
  return [
    { visibility: 'all' },
    { visibility: { $exists: false } },          // legacy docs
    { visibility: 'private', createdBy: userId },
    { visibility: 'specific', visibleTo: userId },
    { visibility: 'specific', createdBy: userId },
    { assignedTo: userId },
  ];
}

// ── Helper: get client IDs scoped to the requesting user ─────────────────────
async function getScopedClientIds(userId, role) {
  if (role === 'admin') return null; // null = no restriction

  const clients = await Client.find({
    $or: [{ accountManager: userId }, { teamMembers: userId }],
  }).select('_id');
  return clients.map(c => c._id);
}

// @route  GET /api/calendar
// Query params: from, to, client (ObjectId), type, status
router.get('/', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const { from, to, client, type, status } = req.query;
  const userId = req.user._id;
  const role   = req.user.role;

  const dateFilter = {};
  if (from || to) {
    dateFilter.startDate = {};
    if (from) dateFilter.startDate.$gte = new Date(from);
    if (to)   dateFilter.startDate.$lte = new Date(to);
  }

  const visOr = buildVisibilityFilter(userId);

  // ── Role-based client scoping ───────────────────────────────────────────
  let clientScope = null;
  const scopedIds = await getScopedClientIds(userId, role);

  if (scopedIds === null) {
    // Admin: can see anything; optionally filter by a specific client
    if (client) clientScope = { client };
  } else {
    // Manager / team: scope to their clients only
    if (client) {
      const manages = scopedIds.some(id => String(id) === String(client));
      if (!manages) return res.json({ success: true, events: [] });
      clientScope = { client };
    } else {
      clientScope = { $or: [{ client: null }, { client: { $in: scopedIds } }] };
    }
  }

  // ── Build final query ───────────────────────────────────────────────────
  const andClauses = [{ $or: visOr }];
  if (clientScope) {
    if (clientScope.$or) {
      andClauses.push({ $or: clientScope.$or });
    } else {
      andClauses.push(clientScope);
    }
  }
  if (type)   andClauses.push({ type });
  if (status) andClauses.push({ status });

  const query = { ...dateFilter, $and: andClauses };

  const events = await CalendarEvent.find(query)
    .populate('client', 'company name')
    .populate('task', 'title')
    .populate('createdBy', 'name')
    .populate('assignedTo', 'name avatar')
    .populate('visibleTo', 'name avatar')
    .sort({ startDate: 1 })
    .lean();

  // Compute overdue flag on lean results
  const now = new Date();
  const enriched = events.map(ev => ({
    ...ev,
    isOverdue: ev.status !== 'done' && ev.status !== 'cancelled' && new Date(ev.endDate) < now,
  }));

  res.json({ success: true, events: enriched });
}));

// @route  GET /api/calendar/clients  — returns clients scoped to the current user
router.get('/clients', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const { role, _id: userId } = req.user;

  let clients;
  if (role === 'admin') {
    clients = await Client.find({ status: { $ne: 'churned' } })
      .select('_id name company')
      .sort('company')
      .lean();
  } else {
    clients = await Client.find({
      $or: [{ accountManager: userId }, { teamMembers: userId }],
    })
      .select('_id name company')
      .sort('company')
      .lean();
  }

  res.json({ success: true, clients });
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

  // Non-admins: validate they actually manage this client
  if (req.user.role !== 'admin' && rest.client) {
    const scopedIds = await getScopedClientIds(req.user._id, req.user.role);
    const manages = scopedIds && scopedIds.some(c => String(c) === String(rest.client));
    if (!manages) {
      return res.status(403).json({ success: false, message: 'Not authorised to create events for this client' });
    }
  }

  const event = await CalendarEvent.create({
    ...rest,
    createdBy: req.user._id,
    visibility,
    visibleTo: visibility === 'specific' ? visibleTo : [],
    visibleToClient: rest.visibleToClient || false,
    status: rest.status || 'pending',
  });

  const populated = await CalendarEvent.findById(event._id)
    .populate('client', 'company name')
    .populate('assignedTo', 'name avatar')
    .populate('visibleTo', 'name avatar')
    .lean();

  const now = new Date();
  populated.isOverdue = populated.status !== 'done' && populated.status !== 'cancelled' && new Date(populated.endDate) < now;

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

  const isAdmin    = req.user.role === 'admin';
  const isOwner    = String(existing.createdBy) === String(req.user._id);
  const isAssigned = existing.assignedTo.map(String).includes(String(req.user._id));

  // Status-only updates (mark done/pending etc.) allowed for assigned users
  const isStatusOnlyUpdate = Object.keys(req.body).length === 1 && 'status' in req.body;

  // Admin can edit anything; everyone else only their own events (or status-only if assigned)
  if (!isAdmin && !isOwner && !(isAssigned && isStatusOnlyUpdate)) {
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
  if (req.body.visibility && req.body.visibility !== 'specific') {
    req.body.visibleTo = [];
  }

  // Sync isCompleted with status for backward compat
  if (req.body.status) {
    req.body.isCompleted = req.body.status === 'done';
  }

  const event = await CalendarEvent.findByIdAndUpdate(
    req.params.id, req.body, { new: true, runValidators: true },
  )
    .populate('client', 'company name')
    .populate('assignedTo', 'name avatar')
    .populate('visibleTo', 'name avatar')
    .lean();

  const now = new Date();
  event.isOverdue = event.status !== 'done' && event.status !== 'cancelled' && new Date(event.endDate) < now;

  res.json({ success: true, event });
}));

// @route  DELETE /api/calendar/:id
router.delete('/:id', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const existing = await CalendarEvent.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });

  const isAdmin = req.user.role === 'admin';
  const isOwner = String(existing.createdBy) === String(req.user._id);
  if (!isAdmin && !isOwner) {
    return res.status(403).json({ success: false, message: 'Not authorised to delete this event' });
  }

  await CalendarEvent.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Event deleted' });
}));

// @route  GET /api/calendar/client-portal
// Returns events marked visibleToClient=true for the authenticated client's linked Client record
router.get('/client-portal', protect, authorize('client'), asyncHandler(async (req, res) => {
  const clientId = req.user.clientId;
  if (!clientId) {
    return res.status(400).json({ success: false, message: 'No client record linked to this account.' });
  }

  const { from, to } = req.query;
  const dateFilter = {};
  if (from || to) {
    dateFilter.startDate = {};
    if (from) dateFilter.startDate.$gte = new Date(from);
    if (to)   dateFilter.startDate.$lte = new Date(to);
  }

  const events = await CalendarEvent.find({
    ...dateFilter,
    client: clientId,
    visibleToClient: true,
  })
    .populate('client', 'company name')
    .populate('createdBy', 'name')
    .select('-visibleTo -assignedTo')
    .sort({ startDate: 1 })
    .lean();

  const now = new Date();
  const enriched = events.map(ev => ({
    ...ev,
    isOverdue: ev.status !== 'done' && ev.status !== 'cancelled' && new Date(ev.endDate) < now,
  }));

  res.json({ success: true, events: enriched });
}));

module.exports = router;
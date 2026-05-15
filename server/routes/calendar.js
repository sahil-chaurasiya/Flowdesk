const express = require('express');
const router = express.Router();
const CalendarEvent = require('../models/CalendarEvent');
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { logActivity } = require('../utils/activityLog');

const ALL_INTERNAL = ['admin', 'manager', ...TEAM_ROLES];

// @route  GET /api/calendar
// @desc   Fetch events in a date range
router.get('/', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const { from, to, client } = req.query;

  const query = {};
  if (from || to) {
    query.startDate = {};
    if (from) query.startDate.$gte = new Date(from);
    if (to)   query.startDate.$lte = new Date(to);
  }
  if (client) query.client = client;

  // Non-managers only see their own events or events assigned to them
  const isManager = ['admin', 'manager'].includes(req.user.role);
  if (!isManager) {
    query.$or = [
      { createdBy: req.user._id },
      { assignedTo: req.user._id },
    ];
  }

  const events = await CalendarEvent.find(query)
    .populate('client', 'company')
    .populate('task', 'title')
    .populate('createdBy', 'name')
    .populate('assignedTo', 'name avatar')
    .sort({ startDate: 1 })
    .lean();

  res.json({ success: true, events });
}));

// @route  POST /api/calendar
router.post('/', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const event = await CalendarEvent.create({ ...req.body, createdBy: req.user._id });
  const populated = await CalendarEvent.findById(event._id)
    .populate('client', 'company')
    .populate('assignedTo', 'name avatar')
    .lean();

  logActivity({
    req,
    action: 'task.created', // reuse closest enum; extend later if needed
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

  const event = await CalendarEvent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('client', 'company')
    .populate('assignedTo', 'name avatar')
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

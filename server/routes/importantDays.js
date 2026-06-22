const express = require('express');
const router  = express.Router();
const ImportantDay = require('../models/ImportantDay');
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const ALL_INTERNAL  = ['admin', 'manager', ...TEAM_ROLES];
const CAN_MANAGE    = ['admin', 'manager']; // only these can create / edit / delete

// @route  GET /api/important-days
// Returns all important days (visible to every internal user)
// Accepts optional `from` and `to` query params (ISO strings) to filter by date range
router.get('/', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to)   filter.date.$lte = new Date(to);
  }
  const days = await ImportantDay.find(filter)
    .populate('createdBy', 'name')
    .sort({ date: 1 })
    .lean();
  res.json({ success: true, days });
}));

// @route  POST /api/important-days
// Admin / manager only
router.post('/', protect, authorize(...CAN_MANAGE), asyncHandler(async (req, res) => {
  const { name, date, emoji, notes } = req.body;
  if (!name || !date) {
    return res.status(400).json({ success: false, message: 'Name and date are required' });
  }
  const day = await ImportantDay.create({
    name,
    date: new Date(date),
    emoji: emoji || '🎉',
    notes,
    createdBy: req.user._id,
  });
  const populated = await ImportantDay.findById(day._id).populate('createdBy', 'name').lean();
  res.status(201).json({ success: true, day: populated });
}));

// @route  PUT /api/important-days/:id
router.put('/:id', protect, authorize(...CAN_MANAGE), asyncHandler(async (req, res) => {
  const existing = await ImportantDay.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Not found' });

  const { name, date, emoji, notes } = req.body;
  const updated = await ImportantDay.findByIdAndUpdate(
    req.params.id,
    { name, date: date ? new Date(date) : existing.date, emoji, notes },
    { new: true, runValidators: true },
  ).populate('createdBy', 'name').lean();
  res.json({ success: true, day: updated });
}));

// @route  DELETE /api/important-days/:id
router.delete('/:id', protect, authorize(...CAN_MANAGE), asyncHandler(async (req, res) => {
  const existing = await ImportantDay.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
  await ImportantDay.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

module.exports = router;
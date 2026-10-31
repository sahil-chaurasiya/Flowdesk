const express = require('express');
const router = express.Router();
const ClientTarget = require('../models/ClientTarget');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// ── GET /api/targets?client=:id&month=YYYY-MM ────────────────────────────────
// Returns the target document for a client+month (creates empty one if missing)
router.get('/', protect, asyncHandler(async (req, res) => {
  const { client, month } = req.query;
  if (!client || !month) {
    return res.status(400).json({ success: false, message: 'client and month are required' });
  }

  // Access control: clients can only see their own
  if (req.user.role === 'client' && String(req.user.clientId) !== client) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  let target = await ClientTarget.findOne({ client, month })
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name');

  if (!target) {
    // Return an empty shell so the frontend always has a document shape to work with
    target = { client, month, visibleFields: [], customFields: [] };
  }

  res.json({ success: true, target });
}));

// ── GET /api/targets/months?client=:id ───────────────────────────────────────
// Returns list of months that have target data
router.get('/months', protect, asyncHandler(async (req, res) => {
  const { client } = req.query;
  if (!client) return res.status(400).json({ success: false, message: 'client required' });

  if (req.user.role === 'client' && String(req.user.clientId) !== client) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const months = await ClientTarget.find({ client })
    .sort({ month: -1 })
    .select('month -_id');

  res.json({ success: true, months: months.map(m => m.month) });
}));

// ── PUT /api/targets ─────────────────────────────────────────────────────────
// Upsert a target for client + month. Admin/manager only.
router.put('/', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { client, month, ...rest } = req.body;
  if (!client || !month) {
    return res.status(400).json({ success: false, message: 'client and month are required' });
  }

  const update = {
    ...rest,
    updatedBy: req.user._id,
  };

  const target = await ClientTarget.findOneAndUpdate(
    { client, month },
    { $set: update, $setOnInsert: { createdBy: req.user._id } },
    { upsert: true, new: true, runValidators: true }
  ).populate('createdBy', 'name').populate('updatedBy', 'name');

  res.json({ success: true, target });
}));

// ── DELETE /api/targets?client=:id&month=YYYY-MM ─────────────────────────────
router.delete('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { client, month } = req.query;
  await ClientTarget.findOneAndDelete({ client, month });
  res.json({ success: true, message: 'Target deleted' });
}));

module.exports = router;
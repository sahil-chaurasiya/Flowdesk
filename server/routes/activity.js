const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route  GET /api/activity
// @desc   Paginated admin timeline with optional filters
// @access admin, manager
router.get('/', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 40,
    action,
    actor,
    entityType,
    entityId,
    search,
    from,
    to,
  } = req.query;

  const query = {};

  if (action)     query.action            = { $regex: action, $options: 'i' };
  if (actor)      query.actor             = actor;
  if (entityType) query['entity.type']    = entityType;
  if (entityId)   query['entity.id']      = entityId;
  if (search) {
    query.$or = [
      { actorName: { $regex: search, $options: 'i' } },
      { 'entity.name': { $regex: search, $options: 'i' } },
      { action: { $regex: search, $options: 'i' } },
    ];
  }
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to)   query.createdAt.$lte = new Date(to);
  }

  const total = await ActivityLog.countDocuments(query);
  const logs  = await ActivityLog.find(query)
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .populate('actor', 'name avatar role')
    .lean();

  res.json({
    success: true,
    logs,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
}));

// @route  GET /api/activity/entity/:type/:id
// @desc   History for a specific entity (task, lead, client, etc.)
// @access admin, manager
router.get('/entity/:type/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const logs = await ActivityLog.find({
    'entity.type': req.params.type,
    'entity.id':   req.params.id,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('actor', 'name avatar role')
    .lean();

  res.json({ success: true, logs });
}));

module.exports = router;

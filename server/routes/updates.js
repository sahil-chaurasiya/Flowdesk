const express = require('express');
const router = express.Router();
const Update = require('../models/Update');
const Client = require('../models/Client');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createNotification } = require('../utils/notifications');

// @route GET /api/updates
router.get('/', protect, asyncHandler(async (req, res) => {
  const { clientId, type, page = 1, limit = 20 } = req.query;
  const query = { isVisible: true };

  if (req.user.role === 'client') {
    query.client = req.user.clientId;
  } else if (clientId) {
    query.client = clientId;
  }

  if (type) query.type = type;

  const total = await Update.countDocuments(query);
  const updates = await Update.find(query)
    .populate('author', 'name avatar jobTitle')
    .populate('client', 'name company')
    .sort({ isPinned: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, updates, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route POST /api/updates
router.post('/', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  const update = await Update.create({ ...req.body, author: req.user._id });
  const populated = await Update.findById(update._id)
    .populate('author', 'name avatar jobTitle')
    .populate('client', 'name company');

  // Notify client
  const client = await Client.findById(update.client);
  if (client?.linkedUserId) {
    await createNotification(client.linkedUserId, {
      type: 'update',
      title: 'New Update Posted',
      body: update.title,
      link: `/updates`
    });
  }

  res.status(201).json({ success: true, update: populated });
}));

// @route GET /api/updates/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const update = await Update.findById(req.params.id)
    .populate('author', 'name avatar jobTitle')
    .populate('client', 'name company');

  if (!update) return res.status(404).json({ success: false, message: 'Update not found' });

  if (req.user.role === 'client' && String(update.client._id) !== String(req.user.clientId)) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.json({ success: true, update });
}));

// @route PUT /api/updates/:id
router.put('/:id', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  const update = await Update.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .populate('author', 'name avatar jobTitle')
    .populate('client', 'name company');

  if (!update) return res.status(404).json({ success: false, message: 'Update not found' });
  res.json({ success: true, update });
}));

// @route DELETE /api/updates/:id
router.delete('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  await Update.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Update deleted' });
}));

module.exports = router;

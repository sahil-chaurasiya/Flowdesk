const express = require('express');
const router = express.Router();
const Update = require('../models/Update');
const Client = require('../models/Client');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createNotification } = require('../utils/notifications');

const MANAGER_ROLES = ['admin', 'manager'];

// @route GET /api/updates
router.get('/', protect, asyncHandler(async (req, res) => {
  const { clientId, type, page = 1, limit = 20 } = req.query;
  const query = { isVisible: true };

  if (req.user.role === 'client') {
    // Client only sees their own client's updates
    query.client = req.user.clientId;
  } else if (MANAGER_ROLES.includes(req.user.role)) {
    // Admin/manager: optional clientId filter, otherwise all
    if (clientId) query.client = clientId;
  } else {
    // Team members: only see updates for clients they are assigned to
    const assignedClients = await Client.find({
      $or: [{ accountManager: req.user._id }, { teamMembers: req.user._id }],
    }).select('_id');
    const assignedIds = assignedClients.map(c => c._id);

    if (clientId) {
      const isAssigned = assignedIds.some(id => String(id) === String(clientId));
      if (!isAssigned) return res.json({ success: true, updates: [], total: 0, page: 1, pages: 0 });
      query.client = clientId;
    } else {
      query.client = { $in: assignedIds };
    }
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
  // Team members may only post updates for their assigned clients
  if (!MANAGER_ROLES.includes(req.user.role) && req.body.client) {
    const assignedClients = await Client.find({
      $or: [{ accountManager: req.user._id }, { teamMembers: req.user._id }],
    }).select('_id');
    const isAssigned = assignedClients.some(c => String(c._id) === String(req.body.client));
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'Not authorised to post updates for this client' });
    }
  }

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
      link: `/updates`,
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

  if (req.user.role === 'client') {
    if (String(update.client._id) !== String(req.user.clientId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
  } else if (!MANAGER_ROLES.includes(req.user.role)) {
    // Team member: check they are assigned to this client
    const assignedClients = await Client.find({
      $or: [{ accountManager: req.user._id }, { teamMembers: req.user._id }],
    }).select('_id');
    const isAssigned = assignedClients.some(c => String(c._id) === String(update.client._id));
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
  }

  res.json({ success: true, update });
}));

// @route PUT /api/updates/:id
router.put('/:id', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  const existing = await Update.findById(req.params.id).populate('client', '_id');
  if (!existing) return res.status(404).json({ success: false, message: 'Update not found' });

  // Team members may only edit updates for their assigned clients
  if (!MANAGER_ROLES.includes(req.user.role)) {
    const assignedClients = await Client.find({
      $or: [{ accountManager: req.user._id }, { teamMembers: req.user._id }],
    }).select('_id');
    const isAssigned = assignedClients.some(c => String(c._id) === String(existing.client._id));
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'Not authorised to edit this update' });
    }
  }

  const update = await Update.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .populate('author', 'name avatar jobTitle')
    .populate('client', 'name company');

  res.json({ success: true, update });
}));

// @route DELETE /api/updates/:id
router.delete('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  await Update.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Update deleted' });
}));

module.exports = router;

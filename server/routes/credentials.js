const express = require('express');
const router = express.Router();
const Credential = require('../models/Credential');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route GET /api/credentials?clientId=xxx
router.get('/', protect, asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const query = {};

  if (req.user.role === 'client') {
    query.client = req.user.clientId;
  } else if (req.user.role === 'manager') {
    query.visibleTo = req.user._id;
    if (clientId) query.client = clientId;
  } else if (req.user.role === 'admin') {
    if (clientId) query.client = clientId;
  } else {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const creds = await Credential.find(query)
    .populate('client', 'name company')
    .populate('visibleTo', 'name email role')
    .populate('addedBy', 'name')
    .sort({ createdAt: -1 });

  res.json({ success: true, credentials: creds });
}));

// @route POST /api/credentials
router.post('/', protect, authorize('admin', 'manager', 'client'), asyncHandler(async (req, res) => {
  const { clientId, platform, label, username, password, notes, visibleTo } = req.body;

  if (req.user.role === 'client' && String(clientId) !== String(req.user.clientId)) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const cred = await Credential.create({
    client: clientId,
    platform,
    label,
    username,
    password,
    notes,
    visibleTo: visibleTo || [],
    addedBy: req.user._id,
  });

  const populated = await Credential.findById(cred._id)
    .populate('client', 'name company')
    .populate('visibleTo', 'name email role')
    .populate('addedBy', 'name');

  res.status(201).json({ success: true, credential: populated });
}));

// @route PUT /api/credentials/:id
router.put('/:id', protect, authorize('admin', 'manager', 'client'), asyncHandler(async (req, res) => {
  const cred = await Credential.findById(req.params.id);
  if (!cred) return res.status(404).json({ success: false, message: 'Not found' });

  const { platform, label, username, password, notes, visibleTo } = req.body;
  if (platform  !== undefined) cred.platform  = platform;
  if (label     !== undefined) cred.label     = label;
  if (username  !== undefined) cred.username  = username;
  if (password  !== undefined) cred.password  = password;
  if (notes     !== undefined) cred.notes     = notes;
  if (visibleTo !== undefined) cred.visibleTo = visibleTo;

  await cred.save();

  const populated = await Credential.findById(cred._id)
    .populate('client', 'name company')
    .populate('visibleTo', 'name email role')
    .populate('addedBy', 'name');

  res.json({ success: true, credential: populated });
}));

// @route DELETE /api/credentials/:id
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  await Credential.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Credential deleted' });
}));

module.exports = router;
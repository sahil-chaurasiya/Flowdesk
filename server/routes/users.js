const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const TEAM_ONLY_ROLES = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

// @route GET /api/users
// Admin & managers get full list with all filters.
// Other internal team members may only fetch the team member list (e.g. for calendar visibility picker).
router.get('/', protect, asyncHandler(async (req, res) => {
  const isManagerOrAdmin = ['admin', 'manager'].includes(req.user.role);
  const isInternalTeam   = TEAM_ONLY_ROLES.includes(req.user.role);

  if (!isManagerOrAdmin && !isInternalTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const { role, isActive, search, page = 1, limit = 20 } = req.query;
  const query = {};

  // 'team' is a shorthand for all non-client internal roles
  if (role === 'team') {
    query.role = { $in: [...TEAM_ONLY_ROLES, 'manager', 'admin'] };
  } else if (role) {
    query.role = role;
  }

  // Non-managers may only query the team list; restrict if no role filter provided
  if (!isManagerOrAdmin && !query.role) {
    query.role = { $in: [...TEAM_ONLY_ROLES, 'manager', 'admin'] };
  }

  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search && isManagerOrAdmin) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await User.countDocuments(query);
  // Non-managers get minimal fields only (name, role, jobTitle, avatar, _id)
  const users = await User.find(query)
    .populate(isManagerOrAdmin ? { path: 'clientId', select: 'name company' } : '')
    .select(isManagerOrAdmin ? '' : 'name role jobTitle avatar')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, users, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route POST /api/users
router.post('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, jobTitle, department, clientId } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

  const user = await User.create({ name, email, password: password || 'Password123!', role, phone, jobTitle, department, clientId });
  res.status(201).json({ success: true, user });
}));

// @route GET /api/users/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('clientId', 'name company status');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user });
}));

// @route PUT /api/users/:id
router.put('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const allowed = ['name', 'email', 'role', 'phone', 'jobTitle', 'department', 'isActive', 'clientId', 'avatar'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user });
}));

// @route DELETE /api/users/:id
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  }
  await User.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'User deactivated successfully' });
}));

// @route GET /api/users/:id/notifications
router.get('/:id/notifications', protect, asyncHandler(async (req, res) => {
  if (String(req.params.id) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  const user = await User.findById(req.params.id).select('notifications');
  res.json({ success: true, notifications: user.notifications });
}));

// @route PUT /api/users/:id/notifications/read
router.put('/:id/notifications/read', protect, asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.params.id },
    { $set: { 'notifications.$[].read': true } }
  );
  res.json({ success: true, message: 'Notifications marked as read' });
}));

module.exports = router;

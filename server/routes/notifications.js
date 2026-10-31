const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route GET /api/notifications
router.get('/', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('notifications');
  res.json({ success: true, notifications: user.notifications });
}));

// @route PUT /api/notifications/read-all
router.put('/read-all', protect, asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { 'notifications.$[].read': true } });
  res.json({ success: true, message: 'All notifications marked as read' });
}));

// @route PUT /api/notifications/:notifId/read
router.put('/:notifId/read', protect, asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.user._id, 'notifications._id': req.params.notifId },
    { $set: { 'notifications.$.read': true } }
  );
  res.json({ success: true });
}));

// @route DELETE /api/notifications/clear
router.delete('/clear', protect, asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { notifications: [] } });
  res.json({ success: true, message: 'Notifications cleared' });
}));

module.exports = router;

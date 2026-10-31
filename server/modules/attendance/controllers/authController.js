const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get current attendance identity for the signed-in Flowdesk user
// @route   GET /api/attendance/auth/me
// @access  Private
// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  // Admins without an employee profile get a synthetic identity (no DB record).
  if (req.attUser.synthetic) {
    return res.json({ success: true, user: { name: req.attUser.name, email: req.attUser.email, role: 'admin', synthetic: true } });
  }
  const user = await User.findById(req.attUser._id);
  res.json({ success: true, user, linkSource: req.attIdentity?.source || null });
});

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, department } = req.body;

  const user = await User.findByIdAndUpdate(
    req.attUser._id,
    { name, phone, department },
    { new: true, runValidators: true }
  );

  res.json({ success: true, message: 'Profile updated', user });
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.attUser._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully' });
});

module.exports = { getMe, updateProfile, changePassword };

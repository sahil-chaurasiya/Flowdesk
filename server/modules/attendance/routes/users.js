const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all active employees (for admin dropdowns)
router.get('/', protect, adminOnly, asyncHandler(async (req, res) => {
  const users = await User.find({ isActive: true }).select('name email department role');
  res.json({ success: true, users });
}));

module.exports = router;

const express = require('express');
const router = express.Router();
const { getMe, updateProfile, changePassword } = require('../controllers/authController');
const { protect, protectEmployee } = require('../middleware/auth');

// NOTE: there is intentionally no POST /login here. Sign-in is handled once, by
// Flowdesk (/api/auth/login); the attendance module trusts that session and maps
// it to an attendance profile (see middleware/auth.js).
router.get('/me', protect, getMe);
router.put('/profile', protectEmployee, updateProfile);
router.put('/change-password', protectEmployee, changePassword);

module.exports = router;

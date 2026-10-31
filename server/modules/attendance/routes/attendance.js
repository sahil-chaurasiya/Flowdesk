const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getHistory,
  getStats,
} = require('../controllers/attendanceController');
const { protect, protectEmployee } = require('../middleware/auth');
const { validateAttendance } = require('../middleware/validation');

router.post('/checkin', protectEmployee, validateAttendance, checkIn);
router.post('/checkout', protectEmployee, validateAttendance, checkOut);
router.get('/today', protectEmployee, getTodayAttendance);
router.get('/history', protectEmployee, getHistory);
router.get('/stats', protectEmployee, getStats);

module.exports = router;

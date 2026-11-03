const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getHistory,
  getStats,
  getCL,
} = require('../controllers/attendanceController');
const { protect, protectEmployee } = require('../middleware/auth');
const { validateAttendance } = require('../middleware/validation');

router.post('/checkin', protectEmployee, validateAttendance, checkIn);
router.post('/checkout', protectEmployee, validateAttendance, checkOut);
router.get('/today', protectEmployee, getTodayAttendance);
router.get('/history', protectEmployee, getHistory);
router.get('/stats', protectEmployee, getStats);
router.get('/cl', protectEmployee, getCL);

module.exports = router;
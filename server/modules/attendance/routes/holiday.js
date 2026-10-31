const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getHolidays, createHoliday, deleteHoliday } = require('../controllers/holidayController');

// Any logged-in user can view holidays
router.get('/', protect, getHolidays);

// Only admins can add/remove holidays
router.post('/', protect, adminOnly, createHoliday);
router.delete('/:id', protect, adminOnly, deleteHoliday);

module.exports = router;
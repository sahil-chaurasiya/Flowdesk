const express = require('express');
const router = express.Router();
const { protect, protectEmployee, adminOnly } = require('../middleware/auth');
const {
  createLeaveRequest,
  getMyLeaves,
  cancelLeaveRequest,
  getAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  getEmployeeLeaveSummary,
} = require('../controllers/leaveController');

// Employee
router.post('/request', protectEmployee, createLeaveRequest);
router.get('/my-leaves', protectEmployee, getMyLeaves);
router.delete('/:id', protectEmployee, cancelLeaveRequest);

// Admin
router.get('/requests', protect, adminOnly, getAllLeaveRequests);
router.put('/requests/:id/approve', protect, adminOnly, approveLeaveRequest);
router.put('/requests/:id/reject', protect, adminOnly, rejectLeaveRequest);
router.get('/summary/:userId', protect, adminOnly, getEmployeeLeaveSummary);

module.exports = router;
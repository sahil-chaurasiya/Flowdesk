const express = require('express');
const router = express.Router();
const { protect, protectEmployee, adminOnly } = require('../middleware/auth');
const {
  createRequest,
  getMyStatus,
  getAllRequests,
  approveRequest,
  rejectRequest,
} = require('../controllers/wfhController');

// Employee
router.post('/request', protectEmployee, createRequest);
router.get('/my-status', protectEmployee, getMyStatus);

// Admin
router.get('/requests', protect, adminOnly, getAllRequests);
router.put('/requests/:id/approve', protect, adminOnly, approveRequest);
router.put('/requests/:id/reject', protect, adminOnly, rejectRequest);

module.exports = router;

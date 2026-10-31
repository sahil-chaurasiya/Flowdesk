const express = require('express');
const router  = express.Router();
const {
  createRequest,
  getMyRequests,
  cancelRequest,
  getAllRequests,
  approveRequest,
  rejectRequest,
  getPendingCount,
  adminDeleteRequest,
} = require('../controllers/regularizationController');
const { protect, protectEmployee, adminOnly } = require('../middleware/auth');

// ── Employee routes ───────────────────────────────────────────────────────────
router.post('/request',        protectEmployee, createRequest);
router.get('/my-requests',     protectEmployee, getMyRequests);
router.delete('/:id',          protectEmployee, cancelRequest);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/requests',                      protect, adminOnly, getAllRequests);
router.get('/requests/pending-count',        protect, adminOnly, getPendingCount);
router.put('/requests/:id/approve',          protect, adminOnly, approveRequest);
router.put('/requests/:id/reject',           protect, adminOnly, rejectRequest);
router.delete('/requests/:id',               protect, adminOnly, adminDeleteRequest);

module.exports = router;
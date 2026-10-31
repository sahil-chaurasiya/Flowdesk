const WFHRequest = require('../models/WFHRequest');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { haversineDistance } = require('../services/locationService');

// WFH location tolerance in meters (how close counts as "same location")
const WFH_LOCATION_TOLERANCE = 300;

// ─── Employee endpoints ───────────────────────────────────────────────────────

// @desc  Submit a WFH location request
// @route POST /api/wfh/request
// @access Private (employee)
const createRequest = asyncHandler(async (req, res) => {
  const { latitude, longitude, accuracy, comment, daysRequested } = req.body;

  if (!latitude || !longitude || !daysRequested) {
    return res.status(400).json({ success: false, message: 'latitude, longitude and daysRequested are required' });
  }

  // Check if there's already a pending request from this user
  const existingPending = await WFHRequest.findOne({ userId: req.attUser._id, status: 'pending' });
  if (existingPending) {
    return res.status(400).json({ success: false, message: 'You already have a pending WFH request' });
  }

  const request = await WFHRequest.create({
    userId: req.attUser._id,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    accuracy: accuracy ? parseFloat(accuracy) : null,
    comment: comment || '',
    daysRequested: parseInt(daysRequested),
  });

  res.status(201).json({ success: true, message: 'WFH request submitted successfully', request });
});

// @desc  Get current WFH status for the logged-in employee
// @route GET /api/wfh/my-status
// @access Private (employee)
const getMyStatus = asyncHandler(async (req, res) => {
  const pendingRequest = await WFHRequest.findOne({ userId: req.attUser._id, status: 'pending' }).sort({ createdAt: -1 });

  // Active permission: approved, not expired, days remaining
  const now = new Date();
  const activePermission = await WFHRequest.findOne({
    userId: req.attUser._id,
    status: 'approved',
    expiresAt: { $gt: now },
  }).sort({ approvedAt: -1 });

  let remainingDays = null;
  if (activePermission) {
    remainingDays = activePermission.daysApproved - activePermission.daysUsed;
  }

  res.json({
    success: true,
    pendingRequest: pendingRequest || null,
    activePermission: activePermission
      ? { ...activePermission.toJSON(), remainingDays }
      : null,
  });
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

// @desc  Get all WFH requests (admin)
// @route GET /api/wfh/requests
// @access Private (admin)
const getAllRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status) query.status = status;

  const requests = await WFHRequest.find(query)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });

  const formatted = requests.map(r => ({
    ...r.toJSON(),
    userName: r.userId?.name,
    userEmail: r.userId?.email,
  }));

  res.json({ success: true, requests: formatted });
});

// @desc  Approve a WFH request
// @route PUT /api/wfh/requests/:id/approve
// @access Private (admin)
const approveRequest = asyncHandler(async (req, res) => {
  const { daysApproved } = req.body;
  const request = await WFHRequest.findById(req.params.id);

  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request is not pending' });

  const days = parseInt(daysApproved) || request.daysRequested;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  request.status = 'approved';
  request.daysApproved = days;
  request.approvedBy = req.attUser._id;
  request.approvedAt = new Date();
  request.expiresAt = expiresAt;
  await request.save();

  res.json({ success: true, message: `WFH approved for ${days} day(s)`, request });
});

// @desc  Reject a WFH request
// @route PUT /api/wfh/requests/:id/reject
// @access Private (admin)
const rejectRequest = asyncHandler(async (req, res) => {
  const request = await WFHRequest.findById(req.params.id);

  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request is not pending' });

  request.status = 'rejected';
  await request.save();

  res.json({ success: true, message: 'Request rejected', request });
});

// ─── Helper exported for attendance controller ────────────────────────────────

// Check if a given lat/lng is covered by an active WFH permission for this user
const checkWFHPermission = async (userId, latitude, longitude) => {
  const now = new Date();
  const activePerms = await WFHRequest.find({
    userId,
    status: 'approved',
    expiresAt: { $gt: now },
  });

  for (const perm of activePerms) {
    const dist = haversineDistance(perm.latitude, perm.longitude, latitude, longitude);
    const remainingDays = perm.daysApproved - perm.daysUsed;
    if (dist <= WFH_LOCATION_TOLERANCE && remainingDays > 0) {
      return { allowed: true, permission: perm };
    }
  }
  return { allowed: false };
};

const incrementWFHDaysUsed = async (permissionId) => {
  await WFHRequest.findByIdAndUpdate(permissionId, { $inc: { daysUsed: 1 } });
};

module.exports = {
  createRequest,
  getMyStatus,
  getAllRequests,
  approveRequest,
  rejectRequest,
  checkWFHPermission,
  incrementWFHDaysUsed,
};

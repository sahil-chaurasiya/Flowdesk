const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const { asyncHandler } = require('../middleware/errorHandler');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Count Mon–Sat days between two YYYY-MM-DD strings (inclusive)
const countWorkingDays = (startStr, endStr) => {
  const start = new Date(startStr + 'T00:00:00');
  const end   = new Date(endStr   + 'T00:00:00');
  if (start > end) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// Return all YYYY-MM-DD strings (Mon–Sat) between two dates inclusive
const getWorkingDateRange = (startStr, endStr) => {
  const dates = [];
  const cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr   + 'T00:00:00');
  while (cur <= end) {
    if (cur.getDay() !== 0) {
      dates.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

// ─── Employee Endpoints ───────────────────────────────────────────────────────

// @desc  Submit a leave request
// @route POST /api/leave/request
// @access Private (employee)
const createLeaveRequest = asyncHandler(async (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body;

  if (!leaveType || !startDate || !endDate || !reason) {
    return res.status(400).json({ success: false, message: 'leaveType, startDate, endDate and reason are required' });
  }

  if (new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ success: false, message: 'startDate cannot be after endDate' });
  }

  const totalDays = countWorkingDays(startDate, endDate);
  if (totalDays === 0) {
    return res.status(400).json({ success: false, message: 'Selected range has no working days (Mon–Sat)' });
  }

  // Check for overlapping pending or approved leave
  const overlap = await LeaveRequest.findOne({
    userId: req.attUser._id,
    status: { $in: ['pending', 'approved'] },
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
    ],
  });
  if (overlap) {
    return res.status(400).json({
      success: false,
      message: `You already have a ${overlap.status} leave request overlapping these dates`,
    });
  }

  const leave = await LeaveRequest.create({
    userId: req.attUser._id,
    leaveType,
    startDate,
    endDate,
    totalDays,
    reason,
  });

  res.status(201).json({ success: true, message: 'Leave request submitted successfully', leave });
});

// @desc  Get own leave requests
// @route GET /api/leave/my-leaves
// @access Private (employee)
const getMyLeaves = asyncHandler(async (req, res) => {
  const { year, status } = req.query;
  const query = { userId: req.attUser._id };
  if (status) query.status = status;
  if (year) {
    query.$or = [
      { startDate: { $regex: `^${year}` } },
      { endDate:   { $regex: `^${year}` } },
    ];
  }

  const leaves = await LeaveRequest.find(query).sort({ createdAt: -1 });

  // Summary counts for the year (or all time if no year filter)
  const allLeaves = await LeaveRequest.find({
    userId: req.attUser._id,
    status: 'approved',
    ...(year ? { $or: [{ startDate: { $regex: `^${year}` } }, { endDate: { $regex: `^${year}` } }] } : {}),
  });
  const totalApprovedDays = allLeaves.reduce((sum, l) => sum + l.totalDays, 0);

  res.json({ success: true, leaves, totalApprovedDays });
});

// @desc  Cancel own pending leave
// @route DELETE /api/leave/:id
// @access Private (employee)
const cancelLeaveRequest = asyncHandler(async (req, res) => {
  const leave = await LeaveRequest.findOne({ _id: req.params.id, userId: req.attUser._id });
  if (!leave) return res.status(404).json({ success: false, message: 'Leave request not found' });
  if (leave.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending requests can be cancelled' });

  await leave.deleteOne();
  res.json({ success: true, message: 'Leave request cancelled' });
});

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

// @desc  Get all leave requests
// @route GET /api/leave/requests
// @access Private (admin)
const getAllLeaveRequests = asyncHandler(async (req, res) => {
  const { status, userId, year } = req.query;
  const query = {};
  if (status) query.status = status;
  if (userId) query.userId = userId;
  if (year) {
    query.$or = [
      { startDate: { $regex: `^${year}` } },
      { endDate:   { $regex: `^${year}` } },
    ];
  }

  const requests = await LeaveRequest.find(query)
    .populate('userId', 'name email')
    .populate('approvedBy', 'name')
    .sort({ createdAt: -1 });

  const formatted = requests.map(r => ({
    ...r.toJSON(),
    userName: r.userId?.name,
    userEmail: r.userId?.email,
    approvedByName: r.approvedBy?.name || null,
  }));

  res.json({ success: true, requests: formatted });
});

// @desc  Approve a leave request — also patches Attendance records to on_leave
// @route PUT /api/leave/requests/:id/approve
// @access Private (admin)
const approveLeaveRequest = asyncHandler(async (req, res) => {
  const { adminNote } = req.body;
  const leave = await LeaveRequest.findById(req.params.id);

  if (!leave) return res.status(404).json({ success: false, message: 'Request not found' });
  if (leave.status !== 'pending') return res.status(400).json({ success: false, message: 'Request is not pending' });

  const dates = getWorkingDateRange(leave.startDate, leave.endDate);

  // Patch or create attendance records for each leave date
  for (const date of dates) {
    await Attendance.findOneAndUpdate(
      { userId: leave.userId, date },
      {
        $set: {
          status: 'on_leave',
          notes: `Leave approved: ${leave.leaveType}`,
          checkInTime: null,
          checkOutTime: null,
          workHours: 0,
        },
      },
      { upsert: true, new: true }
    );
  }

  leave.status = 'approved';
  leave.approvedBy = req.attUser._id;
  leave.approvedAt = new Date();
  leave.adminNote = adminNote || '';
  leave.appliedToDates = dates;
  await leave.save();

  res.json({ success: true, message: `Leave approved for ${leave.totalDays} day(s)`, leave });
});

// @desc  Reject a leave request
// @route PUT /api/leave/requests/:id/reject
// @access Private (admin)
const rejectLeaveRequest = asyncHandler(async (req, res) => {
  const { adminNote } = req.body;
  const leave = await LeaveRequest.findById(req.params.id);

  if (!leave) return res.status(404).json({ success: false, message: 'Request not found' });
  if (leave.status !== 'pending') return res.status(400).json({ success: false, message: 'Request is not pending' });

  leave.status = 'rejected';
  leave.adminNote = adminNote || '';
  await leave.save();

  res.json({ success: true, message: 'Leave request rejected', leave });
});

// ─── Leave summary per employee (for admin dashboard / reports) ───────────────
// @desc  Get leave summary for a specific employee
// @route GET /api/leave/summary/:userId
// @access Private (admin)
const getEmployeeLeaveSummary = asyncHandler(async (req, res) => {
  const { year } = req.query;
  const curYear = year || new Date().getFullYear().toString();

  const leaves = await LeaveRequest.find({
    userId: req.params.userId,
    status: 'approved',
    $or: [
      { startDate: { $regex: `^${curYear}` } },
      { endDate:   { $regex: `^${curYear}` } },
    ],
  });

  const byType = {};
  let total = 0;
  for (const l of leaves) {
    byType[l.leaveType] = (byType[l.leaveType] || 0) + l.totalDays;
    total += l.totalDays;
  }

  res.json({ success: true, summary: { total, byType, year: curYear } });
});

module.exports = {
  createLeaveRequest,
  getMyLeaves,
  cancelLeaveRequest,
  getAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  getEmployeeLeaveSummary,
};
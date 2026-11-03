const Attendance = require('../models/Attendance');
const { isWithinOffice } = require('../services/locationService');
const { getAttendanceStatus, getTodayDate } = require('../services/attendanceService');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkWFHPermission, incrementWFHDaysUsed } = require('./wfhController');
const { sendPushToUser } = require('../services/pushService');
const { computeCLLedger } = require('../services/clService');

// @desc    Check in
// @route   POST /api/attendance/checkin
// @access  Private
const checkIn = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  const today = getTodayDate();

  const existing = await Attendance.findOne({ userId: req.attUser._id, date: today });
  if (existing && existing.checkInTime) {
    return res.status(400).json({ success: false, message: 'You have already checked in today' });
  }

  const locationCheck = isWithinOffice(parseFloat(latitude), parseFloat(longitude));
  let isWFH = false;
  let wfhPermission = null;

  if (!locationCheck.isValid) {
    const wfhCheck = await checkWFHPermission(req.attUser._id, parseFloat(latitude), parseFloat(longitude));
    if (!wfhCheck.allowed) {
      return res.status(400).json({
        success: false,
        outsideOffice: true,
        message: `You are outside office location. You are ${locationCheck.distance}m away (allowed: ${locationCheck.allowedRadius}m). Request WFH permission if working from home.`,
      });
    }
    isWFH = true;
    wfhPermission = wfhCheck.permission;
  }

  const now = new Date();
  const status = getAttendanceStatus(now);

  let attendance;
  if (existing) {
    existing.checkInTime = now;
    existing.status = status;
    existing.latitude = latitude;
    existing.longitude = longitude;
    existing.notes = isWFH ? 'Work From Home' : '';
    attendance = await existing.save();
  } else {
    attendance = await Attendance.create({
      userId: req.attUser._id,
      date: today,
      checkInTime: now,
      status,
      latitude,
      longitude,
      notes: isWFH ? 'Work From Home' : '',
    });
  }

  if (isWFH && wfhPermission) {
    await incrementWFHDaysUsed(wfhPermission._id);
  }

  // Send push notification to employee's device(s)
  sendPushToUser(req.attUser._id, {
    title: status === 'late' ? '⏰ Checked In — Late' : '✅ Checked In — On Time',
    body: status === 'late'
      ? `You're marked late today${isWFH ? ' (WFH)' : ''}. Give it your best!`
      : `Good morning! Checked in successfully${isWFH ? ' (WFH)' : ''}. Have a great day!`,
    tag: 'checkin',
    url: '/admin/attendance',
  }).catch(() => {});

  res.status(201).json({
    success: true,
    message: `Checked in successfully! Status: ${status}${isWFH ? ' (WFH)' : ''}`,
    attendance,
  });
});

// @desc    Check out
// @route   POST /api/attendance/checkout
// @access  Private
const checkOut = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  const today = getTodayDate();

  const attendance = await Attendance.findOne({ userId: req.attUser._id, date: today });

  if (!attendance || !attendance.checkInTime) {
    return res.status(400).json({ success: false, message: 'You have not checked in today' });
  }

  if (attendance.checkOutTime) {
    return res.status(400).json({ success: false, message: 'You have already checked out today' });
  }

  const locationCheck = isWithinOffice(parseFloat(latitude), parseFloat(longitude));
  if (!locationCheck.isValid) {
    const isCheckedInAsWFH = attendance.notes === 'Work From Home';
    if (!isCheckedInAsWFH) {
      const wfhCheck = await checkWFHPermission(req.attUser._id, parseFloat(latitude), parseFloat(longitude));
      if (!wfhCheck.allowed) {
        return res.status(400).json({
          success: false,
          outsideOffice: true,
          message: `You are outside office location. You are ${locationCheck.distance}m away (allowed: ${locationCheck.allowedRadius}m).`,
        });
      }
    }
  }

  const checkOutTime = new Date();
  attendance.checkOutTime = checkOutTime;
  attendance.checkOutLatitude = latitude;
  attendance.checkOutLongitude = longitude;

  const diffMs = checkOutTime - new Date(attendance.checkInTime);
  attendance.workHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

  await attendance.save();

  // Send push notification to employee's device(s)
  sendPushToUser(req.attUser._id, {
    title: '🏁 Day Complete!',
    body: `You worked ${Math.floor(attendance.workHours)}h ${Math.round((attendance.workHours % 1) * 60)}m today. Great job!`,
    tag: 'checkout',
    url: '/admin/attendance',
  }).catch(() => {});

  res.json({
    success: true,
    message: 'Checked out successfully!',
    attendance,
  });
});

// @desc    Get today's attendance
// @route   GET /api/attendance/today
// @access  Private
const getTodayAttendance = asyncHandler(async (req, res) => {
  const today = getTodayDate();
  const attendance = await Attendance.findOne({ userId: req.attUser._id, date: today });
  res.json({ success: true, attendance: attendance || null });
});

// @desc    Get attendance history
// @route   GET /api/attendance/history
// @access  Private
const getHistory = asyncHandler(async (req, res) => {
  const { month, year, page = 1, limit = 31 } = req.query;
  const DATA_START = '2026-04-01';

  let query = { userId: req.attUser._id };

  if (month && year) {
    const m = parseInt(month);
    const y = parseInt(year);
    const lastDay = new Date(y, m, 0).getDate();
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate   = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const effectiveStart = startDate < DATA_START ? DATA_START : startDate;
    query.date = { $gte: effectiveStart, $lte: endDate };
  } else {
    query.date = { $gte: DATA_START };
  }

  const attendance = await Attendance.find(query)
    .sort({ date: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Attendance.countDocuments(query);

  res.json({ success: true, attendance, total, page: parseInt(page) });
});

// @desc    Get Casual Leave (CL) balance for a month (1 CL/month, unused CL carries forward)
// @route   GET /api/attendance/cl
// @access  Private
const getCL = asyncHandler(async (req, res) => {
  const now = new Date();
  const month = parseInt(req.query.month) || now.getMonth() + 1;
  const year  = parseInt(req.query.year)  || now.getFullYear();

  if (!req.attUser._id) {
    return res.json({ success: true, cl: null });
  }

  const ledger = await computeCLLedger(req.attUser._id, req.attUser.createdAt, month, year);
  res.json({ success: true, cl: ledger[ledger.length - 1] });
});

// Helper: count working days (Mon-Sat) in a date range, capped at today IST
const countWorkingDays = (startStr, endStr) => {
  const DATA_START = '2026-04-01';
  const effectiveStart = startStr < DATA_START ? DATA_START : startStr;

  const todayIST = (() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  })();
  const effectiveEnd = endStr > todayIST ? todayIST : endStr;

  if (effectiveStart > effectiveEnd) return 0;

  let count = 0;
  const cur = new Date(effectiveStart + 'T00:00:00Z');
  const end = new Date(effectiveEnd + 'T00:00:00Z');

  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
};

// @desc    Get monthly stats for employee
// @route   GET /api/attendance/stats
// @access  Private
const getStats = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const currentDate = new Date();
  const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
  const targetYear  = parseInt(year)  || currentDate.getFullYear();

  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const endDate   = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const DATA_START = '2026-04-01';
  const effectiveStart = startDate < DATA_START ? DATA_START : startDate;

  const records = await Attendance.find({
    userId: req.attUser._id,
    date: { $gte: effectiveStart, $lte: endDate },
  });

  // A day only counts as present/late if BOTH check-in AND check-out exist
  // Records with check-in but no check-out are treated as absent (but record is still kept)
  const fullyCompleted = records.filter((r) => r.checkInTime && r.checkOutTime);
  const present = fullyCompleted.filter((r) => r.status === 'present').length;
  const late    = fullyCompleted.filter((r) => r.status === 'late').length;
  const totalDays = present + late;
  const totalWorkHours = fullyCompleted.reduce((acc, r) => acc + (r.workHours || 0), 0);
  const avgWorkHours = totalDays > 0 ? (totalWorkHours / totalDays).toFixed(2) : 0;

  const workingDaysElapsed = countWorkingDays(effectiveStart, endDate);
  const absent = Math.max(0, workingDaysElapsed - totalDays);
  const attendancePercent = workingDaysElapsed > 0
    ? Math.round((totalDays / workingDaysElapsed) * 100)
    : 0;

  // Streak: count consecutive fully-completed working days going backwards from today.
  // We must detect GAPS between records (absent days have no record at all),
  // not just bad records. Walk the calendar backwards from today (IST) and stop
  // as soon as we hit a working day with no completed record.
  const completedDates = new Set(
    records
      .filter((r) => r.checkInTime && r.checkOutTime)
      .map((r) => r.date)
  );

  const todayISTForStreak = (() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().split('T')[0];
  })();

  let streak = 0;
  const streakCursor = new Date(todayISTForStreak + 'T00:00:00Z');
  // Walk backwards up to the start of the effective window
  const streakFloor = new Date(effectiveStart + 'T00:00:00Z');
  while (streakCursor >= streakFloor) {
    const dow = streakCursor.getUTCDay();
    const dateStr = streakCursor.toISOString().split('T')[0];
    if (dow === 0) {
      // Sunday — skip without breaking
      streakCursor.setUTCDate(streakCursor.getUTCDate() - 1);
      continue;
    }
    // It's a working day — must have a completed record
    if (completedDates.has(dateStr)) {
      streak++;
    } else {
      // Gap found — stop
      break;
    }
    streakCursor.setUTCDate(streakCursor.getUTCDate() - 1);
  }

  res.json({
    success: true,
    stats: {
      present,
      late,
      absent,
      totalDays,
      workingDaysElapsed,
      attendancePercent,
      totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
      avgWorkHours: parseFloat(avgWorkHours),
      streak,
    },
  });
});

module.exports = { checkIn, checkOut, getTodayAttendance, getHistory, getStats, getCL };
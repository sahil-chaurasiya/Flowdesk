const Holiday = require('../models/Holiday');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { asyncHandler } = require('../middleware/errorHandler');
const { getAttendanceStatus } = require('../services/attendanceService');

// @desc    Get holidays (optionally filtered by month/year)
// @route   GET /api/holidays?month=&year=
// @access  Private (any logged-in user)
const getHolidays = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  let query = {};

  if (month && year) {
    const m = String(month).padStart(2, '0');
    query.date = { $regex: `^${year}-${m}` };
  } else if (year) {
    query.date = { $regex: `^${year}` };
  }

  const holidays = await Holiday.find(query).sort({ date: 1 });
  res.json({ success: true, holidays });
});

// @desc    Create a holiday — marks every active employee as present (status
//          'holiday') for that date so it never counts against them as absent
// @route   POST /api/holidays
// @access  Admin
const createHoliday = asyncHandler(async (req, res) => {
  const { date, name, label } = req.body;

  if (!date || !name) {
    return res.status(400).json({ success: false, message: 'date and name are required' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, message: 'date must be in YYYY-MM-DD format' });
  }

  const existing = await Holiday.findOne({ date });
  if (existing) {
    return res.status(400).json({ success: false, message: `A holiday ("${existing.name}") is already set for this date` });
  }

  const holiday = await Holiday.create({
    date,
    name: name.trim(),
    label: (label || '').trim(),
    createdBy: req.attUser._id,
  });

  // Apply to every active employee EXCEPT those who already have a real
  // check-in for the day — those employees are already present/late (i.e.
  // already "not absent"), so we leave their record completely untouched.
  // This is what makes holiday removal safe to fully reverse later: we only
  // ever create/modify synthetic 'holiday' records for people who had no
  // attendance data of their own to begin with.
  const employees = await User.find({ role: 'employee', isActive: true }).select('_id');
  const existingRecords = await Attendance.find({ userId: { $in: employees.map((e) => e._id) }, date })
    .select('userId checkInTime')
    .lean();
  const alreadyCheckedInIds = new Set(
    existingRecords.filter((r) => r.checkInTime).map((r) => r.userId.toString())
  );
  const employeesToStub = employees.filter((e) => !alreadyCheckedInIds.has(e._id.toString()));

  await Promise.all(
    employeesToStub.map((emp) =>
      Attendance.findOneAndUpdate(
        { userId: emp._id, date },
        {
          $set: {
            status: 'holiday',
            holidayName: name.trim(),
            notes: `Holiday: ${name.trim()}`,
            checkInTime: null,
            checkOutTime: null,
            workHours: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  res.status(201).json({
    success: true,
    message: `Holiday "${holiday.name}" added — applied to ${employeesToStub.length} employee(s)`
      + (alreadyCheckedInIds.size > 0 ? ` (${alreadyCheckedInIds.size} already checked in today and were left as-is)` : ''),
    holiday,
  });
});

// @desc    Delete a holiday — reverts the auto-marked attendance records
// @route   DELETE /api/holidays/:id
// @access  Admin
const deleteHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findById(req.params.id);
  if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });

  // Records with no check-in were purely synthetic (created only because of
  // this holiday) — safe to delete outright, reverting to "no record".
  await Attendance.deleteMany({ date: holiday.date, status: 'holiday', checkInTime: null });

  // Defensive cleanup: if any record for this date is still stuck on
  // status 'holiday' but DOES have a check-in (e.g. from data created
  // before this fix, or any other edge case), recompute what its status
  // should actually be from the check-in time rather than leaving it
  // wrongly stuck as 'holiday' forever.
  const stuck = await Attendance.find({ date: holiday.date, status: 'holiday', checkInTime: { $ne: null } });
  await Promise.all(
    stuck.map((rec) => {
      rec.status = getAttendanceStatus(rec.checkInTime);
      rec.holidayName = '';
      if (rec.notes && rec.notes.startsWith('Holiday:')) rec.notes = '';
      return rec.save();
    })
  );

  await holiday.deleteOne();
  res.json({ success: true, message: `Holiday "${holiday.name}" removed` });
});

module.exports = { getHolidays, createHoliday, deleteHoliday };
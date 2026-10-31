const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const WFHRequest = require('../models/WFHRequest');
const RegularizationRequest = require('../models/RegularizationRequest');
const Holiday = require('../models/Holiday');
const { asyncHandler } = require('../middleware/errorHandler');
const { getTodayDate } = require('../services/attendanceService');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const { getConnection } = require('../../../config/connections');

// Helper: get last day of month
const getLastDay = (month, year) => new Date(year, month, 0).getDate();

// @desc    Admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Admin
const getDashboard = asyncHandler(async (req, res) => {
  const today = getTodayDate();

  const totalEmployees = await User.countDocuments({ role: 'employee', isActive: true });
  const todayRecords = await Attendance.find({ date: today }).populate('userId', 'name email department');

  const present   = todayRecords.filter((r) => r.status === 'present').length;
  const late      = todayRecords.filter((r) => r.status === 'late').length;
  const onLeave   = todayRecords.filter((r) => r.status === 'on_leave').length;
  const onHoliday = todayRecords.filter((r) => r.status === 'holiday').length;
  const checkedIn = todayRecords.filter((r) => r.checkInTime).length;
  // Absent = everyone who hasn't checked in, is not on approved leave, and
  // isn't covered by a declared holiday
  const absent    = Math.max(0, totalEmployees - checkedIn - onLeave - onHoliday);

  const todayHoliday = await Holiday.findOne({ date: today });

  const totalWorkHours = todayRecords.reduce((acc, r) => acc + (r.workHours || 0), 0);
  const avgWorkHours = checkedIn > 0 ? (totalWorkHours / checkedIn).toFixed(2) : 0;

  const liveFeed = todayRecords
    .filter((r) => r.checkInTime)
    .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))
    .slice(0, 10)
    .map((r) => ({
      name: r.userId?.name,
      email: r.userId?.email,
      checkInTime: r.checkInTime,
      status: r.status,
    }));

  res.json({
    success: true,
    dashboard: {
      totalEmployees, present, late, onLeave, holiday: onHoliday, absent, checkedIn,
      avgWorkHours: parseFloat(avgWorkHours), liveFeed,
      todayIsHoliday: !!todayHoliday,
      todayHolidayName: todayHoliday?.name || null,
    },
  });
});

// @desc    Get all employees
// @route   GET /api/admin/employees
// @access  Admin
const getEmployees = asyncHandler(async (req, res) => {
  const { search, isActive, page = 1, limit = 20 } = req.query;
  let query = { role: 'employee' };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const employees = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await User.countDocuments(query);
  res.json({ success: true, employees, total });
});

// @desc    Create employee
// @route   POST /api/admin/employees
// @access  Admin
const createEmployee = asyncHandler(async (req, res) => {
  const { name, password, department, phone, role } = req.body;
  const email = (req.body.email || '').toLowerCase().trim();
  const user = await User.create({
    name, email,
    password: password || 'Welcome@123',
    role: role || 'employee',
    department, phone,
  });
  res.status(201).json({ success: true, message: 'Employee created successfully', user });
});

// @desc    Update employee
// @route   PUT /api/admin/employees/:id
// @access  Admin
const updateEmployee = asyncHandler(async (req, res) => {
  const { name, email, department, phone, isActive, role } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { name, email, department, phone, isActive, role },
    { new: true, runValidators: true }
  );
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, message: 'Employee updated', user });
});

// @desc    Toggle employee status
// @route   PATCH /api/admin/employees/:id/toggle
// @access  Admin
const toggleEmployeeStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, user });
});

// @desc    Get attendance records for a specific employee (admin view)
// @route   GET /api/admin/employees/:id/attendance
// @access  Admin
const getEmployeeAttendance = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const currentDate = new Date();
  const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
  const targetYear  = parseInt(year)  || currentDate.getFullYear();

  const lastDay   = getLastDay(targetMonth, targetYear);
  const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const endDate   = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const user = await User.findById(req.params.id).lean();
  if (!user) return res.status(404).json({ success: false, message: 'Employee not found' });

  const records = await Attendance.find({
    userId: req.params.id,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: 1 }).lean();

  res.json({ success: true, user, records });
});

// @desc    Get all attendance records (admin)
// @route   GET /api/admin/attendance
// @access  Admin
const getAttendanceRecords = asyncHandler(async (req, res) => {
  const { date, userId, month, year, page = 1, limit = 50 } = req.query;
  let query = {};

  if (date) {
    query.date = date;
  } else if (month && year) {
    const m = parseInt(month);
    const y = parseInt(year);
    const lastDay = getLastDay(m, y);
    query.date = {
      $gte: `${y}-${String(m).padStart(2, '0')}-01`,
      $lte: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  if (userId) query.userId = userId;

  // TEMP DIAGNOSTIC LOGGING — remove once the intermittent empty-results
  // issue on /api/admin/attendance is root-caused. readyState: 1 = connected,
  // 0 = disconnected, 2 = connecting, 3 = disconnecting.
  console.log(`[ADMIN-ATTENDANCE] readyState=${getConnection('attendance').readyState} query=${JSON.stringify(query)}`);

  const records = await Attendance.find(query)
    .populate('userId', 'name email department')
    .sort({ date: -1, checkInTime: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Attendance.countDocuments(query);
  console.log(`[ADMIN-ATTENDANCE] found=${records.length} total=${total}`);
  res.json({ success: true, records, total });
});

// @desc    Get monthly report
// @route   GET /api/admin/reports/monthly
// @access  Admin
const getMonthlyReport = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const currentDate = new Date();
  const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
  const targetYear  = parseInt(year)  || currentDate.getFullYear();

  const lastDay   = getLastDay(targetMonth, targetYear);
  const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const endDate   = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Compute working days elapsed (Mon–Sat) for the period
  const todayIST = (() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().split('T')[0];
  })();
  const effectiveEnd = endDate > todayIST ? todayIST : endDate;

  // Declared holidays in this period don't count as working days, so nobody
  // is marked absent for them
  const holidaysInPeriod = await Holiday.find({ date: { $gte: startDate, $lte: endDate } }).lean();
  const holidayDateSet = new Set(holidaysInPeriod.map((h) => h.date));

  let workingDaysInPeriod = 0;
  const cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(effectiveEnd + 'T00:00:00Z');
  while (cur <= end) {
    const dStr = cur.toISOString().split('T')[0];
    if (cur.getUTCDay() !== 0 && !holidayDateSet.has(dStr)) workingDaysInPeriod++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const records = await Attendance.find({ date: { $gte: startDate, $lte: endDate } })
    .populate('userId', 'name email department');

  // Seed employeeMap with ALL active employees so fully-absent ones still appear
  const allEmployees = await User.find({ role: 'employee', isActive: true }).lean();
  const employeeMap = {};
  for (const emp of allEmployees) {
    employeeMap[emp._id.toString()] = {
      user: { _id: emp._id, name: emp.name, email: emp.email, department: emp.department },
      present: 0,
      late: 0,
      absent: 0,
      holiday: 0,
      totalWorkHours: 0,
      records: [],
    };
  }

  for (const record of records) {
    if (!record.userId) continue;
    const uid = record.userId._id.toString();
    // Include deleted employees' records too (they won't be in the seeded map)
    if (!employeeMap[uid]) {
      employeeMap[uid] = { user: record.userId, present: 0, late: 0, absent: 0, holiday: 0, totalWorkHours: 0, records: [] };
    }
    if (record.status === 'present') employeeMap[uid].present++;
    else if (record.status === 'late') employeeMap[uid].late++;
    else if (record.status === 'holiday') employeeMap[uid].holiday++;
    employeeMap[uid].totalWorkHours += record.workHours || 0;
    employeeMap[uid].records.push(record);
  }

  // Calculate absent days for each employee
  for (const entry of Object.values(employeeMap)) {
    const attended = entry.present + entry.late;
    entry.absent = Math.max(0, workingDaysInPeriod - attended);
  }

  const dailyStats = {};
  for (const record of records) {
    if (!dailyStats[record.date]) {
      dailyStats[record.date] = { date: record.date, present: 0, late: 0, absent: 0 };
    }
    if (record.status === 'present') dailyStats[record.date].present++;
    else if (record.status === 'late') dailyStats[record.date].late++;
  }

  res.json({
    success: true,
    report: {
      employees: Object.values(employeeMap),
      dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
      workingDaysInMonth: lastDay,
    },
  });
});

// @desc    Export styled XLSX attendance report
// @route   GET /api/admin/attendance/export
// @access  Admin
const exportCSV = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const currentDate = new Date();
  const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
  const targetYear  = parseInt(year)  || currentDate.getFullYear();

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = MONTH_NAMES[targetMonth - 1];

  const lastDay   = getLastDay(targetMonth, targetYear);
  const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const endDate   = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const records = await Attendance.find({ date: { $gte: startDate, $lte: endDate } })
    .populate('userId', 'name email department')
    .sort({ date: 1, 'userId.name': 1 });

  // ── Build workbook ────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance System';
  workbook.created = new Date();

  // ── Palette ───────────────────────────────────────────────────────────────
  const COLOR = {
    headerBg:   '1E293B',
    headerFg:   'FFFFFF',
    titleBg:    '6366F1',
    titleFg:    'FFFFFF',
    present:    'D1FAE5',
    presentText:'065F46',
    late:       'FEF3C7',
    lateText:   '92400E',
    absent:     'FEE2E2',
    absentText: '991B1B',
    holiday:    'E0E7FF',
    holidayText:'3730A3',
    rowEven:    'F8FAFC',
    rowOdd:     'FFFFFF',
    border:     'CBD5E1',
    subHeader:  'E2E8F0',
    subHeaderTx:'1E293B',
    summaryBg:  'EEF2FF',
    summaryVal: '4338CA',
  };

  const border = (color = COLOR.border) => ({
    top:    { style: 'thin', color: { argb: color } },
    left:   { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right:  { style: 'thin', color: { argb: color } },
  });

  const logSheet = workbook.addWorksheet('Attendance Log', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  logSheet.columns = [
    { key: 'name',       width: 24 },
    { key: 'email',      width: 30 },
    { key: 'dept',       width: 18 },
    { key: 'date',       width: 14 },
    { key: 'status',     width: 12 },
    { key: 'checkIn',    width: 14 },
    { key: 'checkOut',   width: 14 },
    { key: 'workHours',  width: 13 },
    { key: 'autoLogout', width: 13 },
  ];

  logSheet.mergeCells('A1:I1');
  const titleCell = logSheet.getCell('A1');
  titleCell.value = `📋  Attendance Report — ${monthName} ${targetYear}`;
  titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: COLOR.titleFg } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  logSheet.getRow(1).height = 36;

  logSheet.mergeCells('A2:I2');
  const genCell = logSheet.getCell('A2');
  genCell.value = `Generated on ${new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}   |   Total Records: ${records.length}`;
  genCell.font = { name: 'Calibri', italic: true, size: 10, color: { argb: '64748B' } };
  genCell.alignment = { horizontal: 'center', vertical: 'middle' };
  genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
  logSheet.getRow(2).height = 20;

  logSheet.getRow(3).height = 6;

  const headers = ['Employee Name', 'Email', 'Department', 'Date', 'Status', 'Check In', 'Check Out', 'Work Hours', 'Auto Logout'];
  const headerRow = logSheet.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: COLOR.headerFg } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border('374151');
  });
  headerRow.height = 28;

  records.forEach((r, idx) => {
    const rowNum = idx + 5;
    const row = logSheet.getRow(rowNum);
    const isEven = idx % 2 === 0;

    const checkIn  = r.checkInTime  ? new Date(r.checkInTime).toLocaleTimeString('en-IN',  { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—';
    const checkOut = r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—';
    const wh = r.workHours ? `${Math.floor(r.workHours)}h ${Math.round((r.workHours % 1) * 60)}m` : '—';

    const values = [
      r.userId?.name || '—',
      r.userId?.email || '—',
      r.userId?.department || '—',
      r.date,
      (r.status || '').toUpperCase(),
      checkIn,
      checkOut,
      wh,
      r.autoCheckout ? 'Yes' : 'No',
    ];

    let rowBg = isEven ? COLOR.rowEven : COLOR.rowOdd;
    let statusBg = rowBg;
    let statusFg = '1E293B';
    if (r.status === 'present') { statusBg = COLOR.present; statusFg = COLOR.presentText; }
    else if (r.status === 'late') { statusBg = COLOR.late; statusFg = COLOR.lateText; }
    else if (r.status === 'absent') { statusBg = COLOR.absent; statusFg = COLOR.absentText; }
    else if (r.status === 'holiday') { statusBg = COLOR.holiday; statusFg = COLOR.holidayText; }

    values.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 10, color: { argb: ci === 4 ? statusFg : '334155' }, bold: ci === 4 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ci === 4 ? statusBg : rowBg } };
      cell.alignment = { vertical: 'middle', horizontal: ci <= 2 ? 'left' : 'center' };
      cell.border = border();
    });

    row.height = 22;
  });

  logSheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 9 } };

  const sumSheet = workbook.addWorksheet('Employee Summary', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  sumSheet.columns = [
    { key: 'name',    width: 24 },
    { key: 'dept',    width: 18 },
    { key: 'present', width: 12 },
    { key: 'late',    width: 12 },
    { key: 'absent',  width: 12 },
    { key: 'total',   width: 12 },
    { key: 'hours',   width: 16 },
    { key: 'pct',     width: 14 },
  ];

  const todayDate = new Date();
  const isCurrentMonth = todayDate.getFullYear() === targetYear && todayDate.getMonth() + 1 === targetMonth;
  const countUpToDay = isCurrentMonth ? todayDate.getDate() : lastDay;

  // Declared holidays in this month don't count as working days
  const exportHolidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } }).lean();
  const exportHolidaySet = new Set(exportHolidays.map((h) => h.date));

  let workingDays = 0;
  for (let d = 1; d <= countUpToDay; d++) {
    const dStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (new Date(targetYear, targetMonth - 1, d).getDay() !== 0 && !exportHolidaySet.has(dStr)) workingDays++;
  }

  const allEmployees = await User.find({ role: 'employee', isActive: true }).lean();

  const empMap = {};
  for (const emp of allEmployees) {
    empMap[emp._id.toString()] = { name: emp.name, dept: emp.department, present: 0, late: 0, hours: 0 };
  }

  for (const r of records) {
    if (!r.userId) continue;
    const uid = r.userId._id.toString();
    if (!empMap[uid]) empMap[uid] = { name: r.userId.name, dept: r.userId.department, present: 0, late: 0, hours: 0 };
    if (r.status === 'present') empMap[uid].present++;
    else if (r.status === 'late') empMap[uid].late++;
    empMap[uid].hours += r.workHours || 0;
  }
  const empRows = Object.values(empMap).sort((a, b) => a.name.localeCompare(b.name));

  sumSheet.mergeCells('A1:H1');
  const sTitleCell = sumSheet.getCell('A1');
  sTitleCell.value = `👥  Employee Summary — ${monthName} ${targetYear}`;
  sTitleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: COLOR.titleFg } };
  sTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
  sTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sumSheet.getRow(1).height = 36;

  sumSheet.mergeCells('A2:H2');
  const sGenCell = sumSheet.getCell('A2');
  sGenCell.value = `Elapsed working days so far (Mon–Sat): ${workingDays}${isCurrentMonth ? " (month in progress)" : ""}   |   ${empRows.length} employee(s)`;
  sGenCell.font = { name: 'Calibri', italic: true, size: 10, color: { argb: '64748B' } };
  sGenCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sGenCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
  sumSheet.getRow(2).height = 20;

  sumSheet.getRow(3).height = 6;

  const sHeaders = ['Employee Name', 'Department', 'Present', 'Late', 'Absent', 'Total Days', 'Total Hours', 'Attendance %'];
  const sHeaderRow = sumSheet.getRow(4);
  sHeaders.forEach((h, i) => {
    const cell = sHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: COLOR.headerFg } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border('374151');
  });
  sHeaderRow.height = 28;

  empRows.forEach((e, idx) => {
    const rowNum = idx + 5;
    const row = sumSheet.getRow(rowNum);
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? COLOR.rowEven : COLOR.rowOdd;
    const total = e.present + e.late;
    const absent = Math.max(0, workingDays - total);
    const pct = workingDays > 0 ? Math.round((total / workingDays) * 100) : 0;
    const hStr = `${Math.floor(e.hours)}h ${Math.round((e.hours % 1) * 60)}m`;

    let pctBg = rowBg;
    let pctFg = '334155';
    if (pct >= 90) { pctBg = COLOR.present; pctFg = COLOR.presentText; }
    else if (pct >= 75) { pctBg = COLOR.late; pctFg = COLOR.lateText; }
    else if (pct < 75) { pctBg = COLOR.absent; pctFg = COLOR.absentText; }

    const values = [e.name, e.dept || '—', e.present, e.late, absent, total, hStr, `${pct}%`];
    values.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      const isLast = ci === 7;
      cell.font = { name: 'Calibri', size: 10, color: { argb: isLast ? pctFg : '334155' }, bold: isLast };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isLast ? pctBg : rowBg } };
      cell.alignment = { vertical: 'middle', horizontal: ci <= 1 ? 'left' : 'center' };
      cell.border = border();
    });
    row.height = 22;
  });

  if (empRows.length > 0) {
    const totRow = sumSheet.getRow(empRows.length + 5);
    const totValues = [
      'TOTAL / AVERAGE',
      '',
      empRows.reduce((a, e) => a + e.present, 0),
      empRows.reduce((a, e) => a + e.late, 0),
      empRows.reduce((a, e) => a + Math.max(0, workingDays - e.present - e.late), 0),
      empRows.reduce((a, e) => a + e.present + e.late, 0),
      (() => { const h = empRows.reduce((a, e) => a + e.hours, 0); return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`; })(),
      '',
    ];
    totValues.forEach((v, ci) => {
      const cell = totRow.getCell(ci + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: COLOR.summaryVal } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.summaryBg } };
      cell.alignment = { vertical: 'middle', horizontal: ci <= 1 ? 'left' : 'center' };
      cell.border = border('6366F1');
    });
    totRow.height = 24;
  }

  sumSheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 8 } };

  const filename = `attendance-${targetYear}-${String(targetMonth).padStart(2, '0')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

// @desc    Delete employee
// @route   DELETE /api/admin/employees/:id
// @access  Admin
const deleteEmployee = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot delete an admin account' });
  await User.findByIdAndDelete(req.params.id);
  await Attendance.deleteMany({ userId: req.params.id });
  await LeaveRequest.deleteMany({ userId: req.params.id });
  await WFHRequest.deleteMany({ userId: req.params.id });
  await RegularizationRequest.deleteMany({ userId: req.params.id });
  res.json({ success: true, message: `${user.name} deleted successfully` });
});

module.exports = {
  getDashboard, getEmployees, createEmployee, updateEmployee,
  toggleEmployeeStatus, deleteEmployee, getAttendanceRecords,
  getMonthlyReport, exportCSV, getEmployeeAttendance,
};
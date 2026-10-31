const SalaryPayment = require('../models/SalaryPayment');
const Employee = require('../models/Employee');
const { getLeaveSummaryForMonth } = require('../utils/attendanceClient');

// Absent days here match the attendance app's own Monthly Report / Excel
// export "Absent" definition (see attendanceClient.js): any working day
// (Mon–Sat, excluding declared holidays) whose attendance record isn't
// marked `present` or `late` — which includes approved leave days, since
// those carry status `on_leave`, not `present`/`late`. The first absent
// day per month is forgiven; every day beyond that is deducted.
const FORGIVEN_ABSENT_DAYS_PER_MONTH = 1;

// Resolves what an employee's monthly salary actually was for a given
// month/year, based on their salary history — so a later hike doesn't
// retroactively change what past (already-calculated/paid) months show.
function getSalaryForMonth(emp, year, month) {
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  if (!emp.salaryHistory || emp.salaryHistory.length === 0) return emp.monthlySalary;
  const applicable = emp.salaryHistory
    .filter((h) => new Date(h.effectiveFrom) <= monthEnd)
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
  return applicable.length > 0 ? applicable[0].amount : emp.monthlySalary;
}

// Is the given year/month strictly AFTER the month the employee left in?
// The leaving month itself still gets a (prorated, see below) salary —
// only months after it are cut off entirely. Same idea as a client's
// endDate in client.controller.js.
function hasLeftByMonth(leavingDate, year, month) {
  if (!leavingDate) return false;
  const left = new Date(leavingDate);
  const leftYear = left.getFullYear();
  const leftMonth = left.getMonth() + 1;
  return year > leftYear || (year === leftYear && month > leftMonth);
}

// What an employee was actually owed for a given month: their salary-history
// rate, prorated down if they left partway through the month. They're paid
// for the days 1..leavingDate (inclusive) at that rate's daily amount — the
// remaining days in the month aren't owed at all, same per-day rate the
// absence deduction below uses.
function getPayableSalaryForMonth(emp, year, month) {
  const base = getSalaryForMonth(emp, year, month);
  if (!emp.leavingDate) return base;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const left = new Date(emp.leavingDate);
  if (left < monthStart || left > monthEnd) return base;
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.round((base * left.getDate()) / daysInMonth);
}

exports.getSalaries = async (req, res) => {
  try {
    const { month, year, employeeId } = req.query;
    const filter = {};
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (employeeId) filter.employeeId = employeeId;
    const salaries = await SalaryPayment.find(filter).populate('employeeId', 'name monthlySalary').sort({ year: -1, month: -1 });
    res.json(salaries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMonthlySummary = async (req, res) => {
  try {
    const { month, year } = req.params;
    const m = parseInt(month);
    const y = parseInt(year);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
    // Only show employees who had actually joined by the end of this month,
    // and who hadn't already left before it started — no salary due (and
    // nothing to mark pending) for months before they existed or after they left.
    const allEmployees = await Employee.find({ isActive: true });
    const employees = allEmployees.filter((emp) => new Date(emp.joiningDate) <= monthEnd && !hasLeftByMonth(emp.leavingDate, y, m));
    const rawSalaries = await SalaryPayment.find({ month: m, year: y }).populate('employeeId', 'name monthlySalary');
    // A salary record can be orphaned if its employee was later deleted —
    // populate() then returns null for employeeId. Filter those out so we
    // don't crash trying to read .name/._id off null below.
    const salaries = rawSalaries.filter((s) => s.employeeId);

    const leaveData = await getLeaveSummaryForMonth(m, y);
    const daysInMonth = new Date(y, m, 0).getDate();

    const paidIds = new Set(salaries.map((s) => s.employeeId._id.toString()));
    const summary = employees.map((emp) => {
      const salaryRec = salaries.find((s) => s.employeeId._id.toString() === emp._id.toString());
      const email = (emp.email || '').trim().toLowerCase();
      // Use the salary that applied *for this specific month*, not whatever
      // the employee's current salary is today — so past hikes don't bleed
      // backwards into months that were already calculated. Already prorated
      // down if this is the month they left partway through.
      const baseSalary = getPayableSalaryForMonth(emp, y, m);

      let leavesTaken = null;
      let calculatedSalary = baseSalary;
      let attendanceSynced = false;
      let attendanceNote = null;

      if (!email) {
        attendanceNote = 'No email set for this employee — add one to sync attendance';
      } else if (!leaveData.synced) {
        attendanceNote = leaveData.error || 'Could not reach the attendance database';
      } else if (!leaveData.emails.has(email)) {
        attendanceNote = 'No matching attendance app profile found for this email';
      } else {
        attendanceSynced = true;
        leavesTaken = leaveData.leavesByEmail[email] || 0;
        const deductibleDays = Math.max(0, leavesTaken - FORGIVEN_ABSENT_DAYS_PER_MONTH);
        const perDaySalary = baseSalary / daysInMonth;
        const deduction = Math.round(deductibleDays * perDaySalary);
        calculatedSalary = Math.max(0, baseSalary - deduction);
      }

      return {
        employee: emp,
        // Salary as it stood for this month — used by the UI instead of the
        // employee's current/live monthlySalary so hikes don't rewrite history.
        monthlySalaryForMonth: baseSalary,
        status: salaryRec ? salaryRec.status : 'Pending',
        amountPaid: salaryRec ? salaryRec.amountPaid : 0,
        salaryRecord: salaryRec || null,
        leavesTaken,
        calculatedSalary,
        attendanceSynced,
        attendanceNote,
      };
    });

    const totalDue = employees.reduce((sum, e) => sum + getPayableSalaryForMonth(e, y, m), 0);
    const totalPaid = salaries.filter((s) => s.status === 'Paid').reduce((sum, s) => sum + s.amountPaid, 0);
    const totalPending = totalDue - totalPaid;

    res.json({ summary, totalDue, totalPaid, totalPending });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createSalaryPayment = async (req, res) => {
  try {
    const existing = await SalaryPayment.findOne({
      employeeId: req.body.employeeId,
      month: req.body.month,
      year: req.body.year,
    });
    if (existing) return res.status(400).json({ message: 'Salary already recorded for this month' });
    const salary = await SalaryPayment.create(req.body);
    res.status(201).json(salary);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateSalaryPayment = async (req, res) => {
  try {
    const salary = await SalaryPayment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!salary) return res.status(404).json({ message: 'Salary record not found' });
    res.json(salary);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Undo an accidental "Mark Paid" — puts the record back to Pending with no
// amount paid, so the month shows as owed again until marked paid for real.
exports.revertSalaryPayment = async (req, res) => {
  try {
    const salary = await SalaryPayment.findByIdAndUpdate(
      req.params.id,
      { status: 'Pending', amountPaid: 0, paidDate: null },
      { new: true }
    );
    if (!salary) return res.status(404).json({ message: 'Salary record not found' });
    res.json(salary);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
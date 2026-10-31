/**
 * Pulls attendance data straight out of the Attendance App's MongoDB database, so
 * the Salaries page can factor absences into the salary calc.
 *
 * UNIFIED-FLOWDESK NOTE: this used to open its own private connection from
 * ATTENDANCE_MONGODB_URI. It now reuses the shared, independently managed
 * attendance connection (config/connections.js, same ATTENDANCE_MONGODB_URI) via
 * the attendance module's models. It still only ever READS (find/lean) — never
 * writes — and still fails soft.
 *
 * Employees are matched by email (Employee.email <-> attendance app User.email).
 *
 * NOTE ON WHICH ATTENDANCE-APP FORMULA THIS MATCHES:
 * The attendance app itself is inconsistent — its live Dashboard and its
 * per-employee "Employee Attendance" detail page both EXEMPT approved leave
 * (on_leave) from the absent count, while its Monthly Report backend field
 * and its Excel export's "Absent" column do NOT exempt leave — a leave day
 * with no present/late status simply counts as absent there. Per explicit
 * instruction, THIS matches the latter (Monthly Report / Excel export)
 * definition, because leave is meant to reduce pay here. See
 * backend/controllers/adminController.js in the attendance app repo:
 * `getMonthlyReport`'s `entry.absent` calc and `exportCSV`'s "Employee
 * Summary" sheet absent calc — both compute:
 *
 *     absent = workingDays - (present + late)
 *
 * where:
 *   - workingDays = Mon–Sat days from the 1st of the month through today
 *     (inclusive), clamped to the app's data-start date (2026-04-01),
 *     EXCLUDING any date declared a holiday in the attendance app's Holiday
 *     collection. Sundays never count, and neither do holidays.
 *   - present + late = count of that employee's Attendance records in the
 *     month whose `status` field is exactly `present` or `late` — this is
 *     the status field, not check-in/check-out presence.
 *   - Approved leave (`on_leave`) records have status `on_leave`, not
 *     `present`/`late`, so they land on the absent side — same as the
 *     Monthly Report / Excel export.
 *
 * If it's missing/unreachable/misconfigured, this fails soft — callers get back
 * { synced: false, error } instead of a thrown exception, so a down/misconfigured
 * attendance DB never breaks the Salaries page itself.
 */

const { isReady, MODULES } = require('../../../config/connections');
const AttendanceUser = require('../../attendance/models/User');
const AttendanceRecord = require('../../attendance/models/Attendance');
const AttendanceHoliday = require('../../attendance/models/Holiday');

// The attendance app stores `date` as an IST wall-clock YYYY-MM-DD string
// (see its own attendanceService.js). We need "today" in that same
// timezone/format so we don't accidentally count IST-today as absent just
// because the accountant server itself runs in UTC.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
function getTodayDateString() {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return istNow.toISOString().split('T')[0];
}

/**
 * Fetches the count of absent days for a given month/year, per employee
 * email, from the Attendance App's DB. See the file header above for the
 * exact formula (matches the attendance app's Monthly Report / Excel
 * export "Absent" definition).
 *
 * Returns:
 *   {
 *     synced: boolean,         // false if the attendance DB couldn't be reached/isn't configured
 *     error: string|null,
 *     emails: Set<string>,     // lower-cased emails of every attendance-app user that has one
 *     leavesByEmail: { [lowerCasedEmail]: numberOfAbsentDaysInMonth }
 *   }
 */
const DATA_START = '2026-04-01'; // matches the attendance app's own data-retention start date

function pad(n) { return String(n).padStart(2, '0'); }

// Mon–Sat working days from the 1st of the month through today (inclusive),
// clamped to DATA_START, excluding any date present in holidayDateSet —
// computed with UTC date math (not local Date arithmetic) so the result
// doesn't depend on the accountant server's own timezone, only on the IST
// calendar date strings already stored.
function countWorkingDaysElapsed(month, year, holidayDateSet) {
  const lastDay = new Date(year, month, 0).getDate();
  const monthStartStr = `${year}-${pad(month)}-01`;
  const monthEndStr = `${year}-${pad(month)}-${pad(lastDay)}`;
  const effectiveStart = monthStartStr < DATA_START ? DATA_START : monthStartStr;
  const todayStr = getTodayDateString();
  const effectiveEnd = monthEndStr < todayStr ? monthEndStr : todayStr;
  if (effectiveStart > effectiveEnd) return 0;

  let count = 0;
  const cur = new Date(`${effectiveStart}T00:00:00Z`);
  const end = new Date(`${effectiveEnd}T00:00:00Z`);
  while (cur <= end) {
    const dStr = cur.toISOString().split('T')[0];
    if (cur.getUTCDay() !== 0 && !holidayDateSet.has(dStr)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

async function getLeaveSummaryForMonth(month, year) {
  const envVar = MODULES.attendance.envVar;
  if (!process.env[envVar] || !process.env[envVar].trim()) {
    return {
      synced: false,
      error: `${envVar} is not configured`,
      emails: new Set(),
      leavesByEmail: {},
    };
  }
  if (!isReady('attendance')) {
    return { synced: false, error: 'Attendance database is not connected', emails: new Set(), leavesByEmail: {} };
  }

  try {

    const users = await AttendanceUser.find({}, { email: 1 }).lean();
    const emailByUserId = {};
    const emails = new Set();
    for (const user of users) {
      const email = (user.email || '').trim().toLowerCase();
      if (!email) continue;
      emailByUserId[user._id.toString()] = email;
      emails.add(email);
    }

    const lastDay = new Date(year, month, 0).getDate();
    const monthStart = `${year}-${pad(month)}-01`;
    const monthEndStr = `${year}-${pad(month)}-${pad(lastDay)}`;

    // Declared holidays in this month don't count as working days — same
    // as the Monthly Report / Excel export.
    const holidays = await AttendanceHoliday.find(
      { date: { $gte: monthStart, $lte: monthEndStr } },
      { date: 1 }
    ).lean();
    const holidayDateSet = new Set(holidays.map((h) => h.date));

    const records = await AttendanceRecord.find(
      { date: { $gte: monthStart, $lte: monthEndStr } },
      { userId: 1, status: 1 }
    ).lean();

    // Attended = status is exactly `present` or `late` — the same status
    // field the Monthly Report / Excel export counts on. `on_leave` records
    // don't qualify, so they count as absent (leave reduces pay).
    const attendedByEmail = {};
    for (const record of records) {
      if (record.status !== 'present' && record.status !== 'late') continue;
      const uid = record.userId?.toString();
      const email = uid && emailByUserId[uid];
      if (!email) continue;
      attendedByEmail[email] = (attendedByEmail[email] || 0) + 1;
    }

    const workingDays = countWorkingDaysElapsed(month, year, holidayDateSet);

    const leavesByEmail = {};
    for (const email of emails) {
      const attended = attendedByEmail[email] || 0;
      const absentDays = Math.max(0, workingDays - attended);
      if (absentDays > 0) leavesByEmail[email] = absentDays;
    }

    return { synced: true, error: null, emails, leavesByEmail };
  } catch (err) {
    return { synced: false, error: err.message, emails: new Set(), leavesByEmail: {} };
  }
}

module.exports = { getLeaveSummaryForMonth };
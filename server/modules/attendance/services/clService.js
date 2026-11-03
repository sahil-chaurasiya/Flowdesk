/**
 * Casual Leave (CL) ledger.
 *
 *  - Every month grants 1 CL.
 *  - CL is spent automatically on absences: each absent day uses 1 CL (if any
 *    is available) and is therefore shown as "CL used" instead of "absent".
 *  - CL that is not used in a month carries forward to the next month.
 *
 * Example: 0 absences in a month  -> next month starts with 2 CL.
 *          4 absences in a month  -> 3 absent + 1 CL used, 0 CL left.
 *
 * "Absent" here is computed exactly like the History page does it
 * (elapsed Mon–Sat working days, minus declared holidays that have already
 * occurred, minus days with a full check-in + check-out) so the numbers on
 * screen always add up.
 */
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const { getTodayDate } = require('./attendanceService');

const DATA_START = '2026-04-01';
const MONTHLY_CL = 1;

const pad = (n) => String(n).padStart(2, '0');
const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const isoToIST = (d) => new Date(new Date(d).getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

// Count Mon–Sat days in [startStr, endStr] (inclusive)
const countWorkingDays = (startStr, endStr) => {
  if (startStr > endStr) return 0;
  let count = 0;
  const cur = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  while (cur <= end) {
    if (cur.getUTCDay() !== 0) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
};

/**
 * Returns the CL ledger for a user from their first tracked month up to and
 * including (month, year). The last element is the requested month.
 */
const computeCLLedger = async (userId, userCreatedAt, month, year) => {
  const targetKey = year * 12 + (month - 1);
  const today = getTodayDate();
  // Today is still in progress, so it is never counted as absent: only days
  // up to and including yesterday are evaluated.
  const yesterdayD = new Date(today + 'T00:00:00Z');
  yesterdayD.setUTCDate(yesterdayD.getUTCDate() - 1);
  const yesterday = yesterdayD.toISOString().split('T')[0];

  // Ledger starts at the later of app launch and the month the person joined
  // (or their first attendance record, whichever is earlier) so nobody is
  // "charged" for months before they were part of the team.
  const first = await Attendance.findOne({ userId }).sort({ date: 1 }).select('date').lean();
  let startStr = DATA_START;
  const candidates = [];
  if (userCreatedAt) candidates.push(isoToIST(userCreatedAt));
  if (first?.date) candidates.push(first.date);
  if (candidates.length) {
    const earliest = candidates.sort()[0];
    if (earliest > startStr) startStr = earliest;
  }
  const startKey = Number(startStr.slice(0, 4)) * 12 + (Number(startStr.slice(5, 7)) - 1);
  if (startKey > targetKey) {
    return [{ month, year, carriedIn: 0, granted: MONTHLY_CL, available: MONTHLY_CL, rawAbsent: 0, clUsed: 0, absent: 0, remaining: MONTHLY_CL }];
  }

  const rangeStart = `${Math.floor(startKey / 12)}-${pad((startKey % 12) + 1)}-01`;
  const rangeEnd = `${year}-${pad(month)}-${pad(lastDayOf(year, month))}`;

  const [records, holidays] = await Promise.all([
    Attendance.find({ userId, date: { $gte: rangeStart, $lte: rangeEnd } })
      .select('date status checkInTime checkOutTime').lean(),
    Holiday.find({ date: { $gte: rangeStart, $lte: rangeEnd } }).select('date').lean(),
  ]);

  const attendedByMonth = {};
  for (const r of records) {
    if (r.date <= yesterday && r.checkInTime && r.checkOutTime && (r.status === 'present' || r.status === 'late')) {
      const k = r.date.slice(0, 7);
      attendedByMonth[k] = (attendedByMonth[k] || 0) + 1;
    }
  }
  const holidaysByMonth = {};
  for (const h of holidays) {
    if (h.date <= yesterday && new Date(h.date + 'T00:00:00Z').getUTCDay() !== 0) {
      const k = h.date.slice(0, 7);
      holidaysByMonth[k] = (holidaysByMonth[k] || 0) + 1;
    }
  }

  const ledger = [];
  let carry = 0;
  for (let key = startKey; key <= targetKey; key++) {
    const y = Math.floor(key / 12);
    const m = (key % 12) + 1;
    const mk = `${y}-${pad(m)}`;
    const monthStart = `${mk}-01`;
    const monthEnd = `${mk}-${pad(lastDayOf(y, m))}`;
    const effStart = monthStart < startStr ? startStr : monthStart;
    const effEnd = monthEnd > yesterday ? yesterday : monthEnd;

    const workingDays = Math.max(0, countWorkingDays(effStart, effEnd) - (holidaysByMonth[mk] || 0));
    const rawAbsent = Math.max(0, workingDays - (attendedByMonth[mk] || 0));

    const available = carry + MONTHLY_CL;
    const clUsed = Math.min(rawAbsent, available);
    const remaining = available - clUsed;

    ledger.push({
      month: m, year: y,
      carriedIn: carry, granted: MONTHLY_CL, available,
      rawAbsent, clUsed, absent: rawAbsent - clUsed, remaining,
    });
    carry = remaining;
  }
  return ledger;
};

module.exports = { computeCLLedger, MONTHLY_CL };
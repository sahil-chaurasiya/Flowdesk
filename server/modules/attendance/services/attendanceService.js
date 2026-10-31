const { OFFICE_TIMING } = require('../config/office');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/**
 * Convert a Date to its IST equivalent (returns a new Date object whose
 * getUTC* methods give IST wall-clock values)
 */
const toIST = (date) => new Date(date.getTime() + IST_OFFSET_MS);

/**
 * Determine attendance status based on check-in time (IST-aware)
 * "present" = checked in at or before the start time
 * "late"    = checked in after the start time
 */
const getAttendanceStatus = (checkInTime) => {
  const dateIST = toIST(new Date(checkInTime));
  const dayOfWeek = dateIST.getUTCDay(); // 0=Sun, 6=Sat (in IST)

  let lateHour, lateMinute;

  if (dayOfWeek === 6) {
    // Saturday: late after 11:30 AM IST
    lateHour = OFFICE_TIMING.saturdayStartHour;
    lateMinute = OFFICE_TIMING.saturdayStartMinute;
  } else if (dayOfWeek === 0) {
    // Sunday: no work, treat as present (shouldn't happen)
    return 'present';
  } else {
    // Mon–Fri: late after 11:00 AM IST
    lateHour = OFFICE_TIMING.weekdayStartHour;
    lateMinute = OFFICE_TIMING.weekdayStartMinute;
  }

  const checkInHour = dateIST.getUTCHours();
  const checkInMinute = dateIST.getUTCMinutes();

  const checkInTotalMinutes = checkInHour * 60 + checkInMinute;
  const lateTotalMinutes = lateHour * 60 + lateMinute;

  return checkInTotalMinutes <= lateTotalMinutes ? 'present' : 'late';
};

/**
 * Get today's date string in YYYY-MM-DD format (India timezone)
 */
const getTodayDate = () => {
  const now = new Date();
  const istDate = toIST(now);
  return istDate.toISOString().split('T')[0];
};

/**
 * Get date string for a given Date object (IST)
 */
const getDateString = (date) => {
  const istDate = toIST(date);
  return istDate.toISOString().split('T')[0];
};

/**
 * Format work hours into human readable string
 */
const formatWorkHours = (hours) => {
  if (!hours || hours === 0) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};

module.exports = { getAttendanceStatus, getTodayDate, getDateString, formatWorkHours, toIST };

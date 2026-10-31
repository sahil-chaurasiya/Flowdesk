const cron = require('node-cron');
const http = require('http');
const https = require('https');
const Attendance = require('../models/Attendance');
const { getTodayDate } = require('./attendanceService');
const { sendPushToUser } = require('./pushService');

// ── 8-Hour Checkout Reminder ──────────────────────────────────────────────────
// Runs every minute. Finds all attendance records where:
//   - checkInTime exists
//   - checkOutTime is null
//   - checkInTime is exactly 8 hours ago (within a 1-minute window)
// Then sends a push notification to that user.
const checkEightHourReminders = async () => {
  try {
    const now = new Date();
    // Window: between 8h0m0s ago and 8h1m0s ago (to match 1-min cron cadence)
    const eightHoursAgo    = new Date(now.getTime() - 8 * 60 * 60 * 1000);

    // Find records checked-in between 8h1m ago and exactly 8h ago (1-min window)
    const windowStart = new Date(now.getTime() - (8 * 60 * 60 * 1000 + 60 * 1000)); // 8h1m ago
    const windowEnd   = new Date(now.getTime() -  8 * 60 * 60 * 1000);              // 8h0m ago

    const unique = await Attendance.find({
      checkInTime:  { $gte: windowStart, $lte: windowEnd },
      checkOutTime: null,
    }).populate('userId', 'name');

    if (unique.length === 0) return;

    console.log(`[8HR] Sending checkout reminders to ${unique.length} user(s)`);

    const checkoutMessages = [
      "You've been working for 8 hours! Time to wrap up and check out 🏁",
      "8 hours in — amazing effort! Don't forget to check out 🌙",
      "Your 8-hour shift is complete! Remember to clock out 🚪",
      "You've hit 8 hours today — head home and recharge! 🏠",
      "Great work today! 8 hours done. Check out before you leave 💪",
    ];

    await Promise.all(
      unique.map((record) => {
        const name = record.userId?.name || 'there';
        const msg  = checkoutMessages[Math.floor(Math.random() * checkoutMessages.length)];
        return sendPushToUser(record.userId._id || record.userId, {
          title: '⏰ 8 Hours Completed — Check Out!',
          body:  `Hey ${name}! ${msg}`,
          tag:   'checkout-8hr-reminder',
          url:   '/admin/attendance',
        }).catch((err) => {
          console.warn(`[8HR] Push failed for user ${record.userId}: ${err.message}`);
        });
      })
    );
  } catch (err) {
    console.error('[8HR] Error in checkout reminder job:', err.message);
  }
};

const DATA_START_DATE = '2026-04-01';

// Self-ping to keep Render alive — hits our own /api/health endpoint
const selfPing = () => {
  const url = process.env.BACKEND_URL;
  const fullUrl = `${url}/api/health`;

  const client = fullUrl.startsWith('https') ? https : http;

  const req = client.get(fullUrl, (res) => {
    console.log(`[PING] Self-ping → ${res.statusCode}`);
    res.resume(); // discard response body
  });

  req.on('error', (err) => {
    console.warn(`[PING] Self-ping failed: ${err.message}`);
  });

  req.setTimeout(10000, () => {
    req.destroy();
    console.warn('[PING] Self-ping timed out');
  });
};

let started = false;

const truthy = (v) => String(v).toLowerCase() === 'true';

const start = () => {
  // Guard: the unified server may call this from a (re)connect hook – register
  // the schedules exactly once per process.
  if (started) return;
  started = true;

  // ── Keep-alive self-ping every 10 minutes, 8AM–9PM IST (2:30–15:30 UTC) ──
  // IST = UTC+5:30, so:
  //   8:00 AM IST = 02:30 UTC
  //   9:00 PM IST = 15:30 UTC
  // Cron: every 10 mins, from minute 30 of hour 2 through hour 15 UTC
  // We use two cron expressions to cover the full window cleanly:
  //   */10 3-14 * * *   → every 10 min from 03:00–14:59 UTC
  //   30,40,50 2 * * *  → 02:30, 02:40, 02:50 UTC (8:00, 8:10, 8:20 AM IST)
  //   0,10,20,30 15 * * * → 15:00–15:30 UTC (8:30–9:00 PM IST)

  // OPT-IN (ATTENDANCE_KEEPALIVE_PING=true, needs BACKEND_URL). This existed only to
  // stop the standalone attendance backend from sleeping on a free Render plan. The
  // unified Flowdesk server has its own lifecycle, so it is OFF by default.
  if (truthy(process.env.ATTENDANCE_KEEPALIVE_PING) && process.env.BACKEND_URL) {
    cron.schedule('30,40,50 2 * * *', () => {
      console.log('[PING] Keep-alive ping (early morning window)');
      selfPing();
    });

    cron.schedule('*/10 3-14 * * *', () => {
      console.log('[PING] Keep-alive ping (main window)');
      selfPing();
    });

    cron.schedule('0,10,20,30 15 * * *', () => {
      console.log('[PING] Keep-alive ping (evening window)');
      selfPing();
    });
  }


  // ── Retention cleanup — DESTRUCTIVE, therefore OFF by default ──────────────
  // The standalone attendance app deleted every attendance record dated before
  // DATA_START_DATE each time it booted. Running a delete against an existing
  // production database automatically on every Flowdesk boot is not acceptable,
  // so it only runs when explicitly enabled with ATTENDANCE_RETENTION_CLEANUP=true.
  if (truthy(process.env.ATTENDANCE_RETENTION_CLEANUP)) {
    (async () => {
      try {
        const deleted = await Attendance.deleteMany({ date: { $lt: DATA_START_DATE } });
        if (deleted.deletedCount > 0) {
          console.log(`[CLEANUP] Removed ${deleted.deletedCount} records before ${DATA_START_DATE}`);
        }
      } catch (err) {
        console.error('[CLEANUP] Error removing old records:', err.message);
      }
    })();
  }

  // ── 8-Hour Checkout Reminder — runs every minute ──────────────────────────
  // Checks if any checked-in user crossed 8 hours without checking out
  // and fires a server-side push notification (works even if app is closed).
  cron.schedule('* * * * *', () => {
    checkEightHourReminders();
  });

  console.log('[CRON] Attendance jobs scheduled — 8hr checkout reminders active');
};

module.exports = { start, DATA_START_DATE };
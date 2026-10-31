// ============================================================
// Push Notification Service — browser-side
// ============================================================

import api from './api';

// IST offset: UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function makeISTTime(istHour, istMinute) {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const year   = istNow.getUTCFullYear();
  const month  = istNow.getUTCMonth();
  const date   = istNow.getUTCDate();
  return new Date(Date.UTC(year, month, date, istHour, istMinute, 0, 0) - IST_OFFSET_MS);
}

// ── Permission ───────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ── Real Push Subscription ───────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const { data } = await api.get('/notifications/vapid-public-key');
    const applicationServerKey = urlBase64ToUint8Array(data.publicKey);
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    }
    await api.post('/notifications/subscribe', { subscription: sub.toJSON() });
    console.log('[PUSH] Subscribed successfully');
    return true;
  } catch (err) {
    console.warn('[PUSH] Subscription failed:', err.message);
    return false;
  }
}

export async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.delete('/notifications/unsubscribe', { data: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
  } catch (err) {
    console.warn('[PUSH] Unsubscribe failed:', err.message);
  }
}

export async function enablePushNotifications() {
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  return await subscribeToPush();
}

// ── Local (foreground) notifications ────────────────────────

function showNotification(title, body, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const defaults = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    silent: false,
    tag: options.tag || 'attendance-app',
    renotify: true,
    requireInteraction: false,
  };
  const payload = { body, ...defaults, ...options };
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, payload))
      .catch(() => new Notification(title, payload));
  } else {
    new Notification(title, payload);
  }
}

// ── Check-In ─────────────────────────────────────────────────

export function notifyCheckIn(name, status) {
  const isLate = status === 'late';
  const emojis = isLate ? ['⏰', '🚀', '💨', '😅'] : ['✅', '🎯', '💪', '🌟', '🔥'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  const lateMessages = [
    `Better late than never, ${name}! Now let's crush it! 🚀`,
    `You made it, ${name}! Traffic was rough, huh? 😅`,
    `${name} has entered the chat (fashionably late) ⏰`,
    `Running on Indian Standard Time, ${name}? No judgment 😄`,
  ];
  const onTimeMessages = [
    `Morning, ${name}! You're early — the office respects it 🌟`,
    `${name} is IN! Let the productive chaos begin 💪`,
    `Boom! ${name} checked in. Today's gonna be legendary 🔥`,
    `Clock's ticking and ${name} is already ahead of it 🎯`,
  ];
  const msgs = isLate ? lateMessages : onTimeMessages;
  const body = msgs[Math.floor(Math.random() * msgs.length)];
  showNotification(`${emoji} Checked In — ${isLate ? 'Late' : 'On Time'}`, body, { tag: 'checkin' });
}

// ── Check-Out ────────────────────────────────────────────────

export function notifyCheckOut(name, workHours) {
  const hrs = Math.floor(workHours || 0);
  const min = Math.round(((workHours || 0) - hrs) * 60);
  const hoursStr = `${hrs}h ${min}m`;
  const messages = [
    `See you tomorrow, ${name}! You put in ${hoursStr} today 🎉`,
    `${name} has left the building after ${hoursStr}. Legend. 🏆`,
    `${hoursStr} of pure grind, ${name}! Go relax, you earned it 🛋️`,
    `Day complete! ${hoursStr} of work. Your pillow is calling 😴`,
    `${name} checked out after ${hoursStr}. Time to decompress! 🧘`,
  ];
  showNotification('🏁 Day Complete!', messages[Math.floor(Math.random() * messages.length)], { tag: 'checkout' });
}

// ── Reminders ────────────────────────────────────────────────

export function notifyCheckInReminder() {
  const messages = [
    "You haven't checked in yet! Don't let the day slip away 👀",
    'Psst… the office misses you. Check in already! 🏢',
    "Clock's ticking! Did you forget to check in? ⏰",
    'Hey! Your attendance is waiting for you to show up 😄',
  ];
  showNotification('⚠️ Check-In Reminder', messages[Math.floor(Math.random() * messages.length)], { tag: 'reminder-checkin' });
}

export function notifyCheckOutReminder() {
  const messages = [
    "Still at the office? Don't forget to check out! 🌙",
    "It's getting late — remember to clock out! 🌆",
    'Work hard, leave on time! Check out now 🚪',
    "Your checkout is pending — wrap up and head home! 🏠",
  ];
  showNotification('🌙 Check-Out Reminder', messages[Math.floor(Math.random() * messages.length)], { tag: 'reminder-checkout' });
}

// ── Sunday ───────────────────────────────────────────────────

export function notifySundayHoliday() {
  const messages = [
    "It's Sunday! You're marked present — go enjoy your day off ☀️",
    "Sunday = present! Now go touch some grass 🌿",
    "Happy Sunday! Attendance marked. Netflix time? 🎬",
    "Rest day auto-approved! Sunday blessings to you 🙏",
  ];
  showNotification('☀️ Sunday Holiday', messages[Math.floor(Math.random() * messages.length)], { tag: 'sunday' });
}

// ── Streaks ──────────────────────────────────────────────────

export function notifyStreakMilestone(streak) {
  const milestones = {
    3:  ['🔥 3-Day Streak!', "Three in a row! You're warming up 🔥"],
    5:  ['⚡ 5-Day Streak!', "Full work week — you absolute legend! ⚡"],
    7:  ['💎 7-Day Streak!', "A whole week of showing up. Incredible! 💎"],
    10: ['🏆 10-Day Streak!', "TEN DAYS! You're a machine 🤖💪"],
    15: ['👑 15-Day Streak!', "15 days of consistency. You're royalty 👑"],
    20: ['🚀 20-Day Streak!', "20 days! Someone's gunning for Employee of the Month 🎖️"],
    30: ['🌟 30-Day Streak!', "A FULL MONTH! Absolute unit of an employee 🌟"],
  };
  const entry = milestones[streak];
  if (entry) showNotification(entry[0], entry[1], { tag: 'streak', requireInteraction: true });
}

// ── Admin ────────────────────────────────────────────────────

export function notifyNewCheckIn(employeeName, status) {
  const isLate = status === 'late';
  showNotification(
    isLate ? '⏰ Late Check-In' : '✅ New Check-In',
    isLate ? `${employeeName} just checked in — marked late` : `${employeeName} is in the building!`,
    { tag: `admin-checkin-${Date.now()}`, renotify: true }
  );
}

export function notifyLowAttendance(percent) {
  if (percent < 50) {
    showNotification(
      '🚨 Low Attendance Alert',
      `Only ${percent}% of employees have checked in today. Time to investigate!`,
      { tag: 'low-attendance', requireInteraction: true }
    );
  }
}

// ── 8-Hour Checkout Reminder ─────────────────────────────────
// Called by the browser-side timer (fallback) AND fired by the
// service worker when the server sends a push notification.

export function notifyEightHourCheckout() {
  const messages = [
    "You've been working for 8 hours! Time to wrap up and check out 🏁",
    "8 hours in — amazing effort! Don't forget to check out 🌙",
    "Your 8-hour shift is complete! Remember to clock out 🚪",
    "You've hit 8 hours today — head home and recharge! 🏠",
    "Great work today! 8 hours done. Check out before you leave 💪",
  ];
  showNotification(
    '⏰ 8 Hours Completed — Check Out!',
    messages[Math.floor(Math.random() * messages.length)],
    { tag: 'checkout-8hr-reminder', requireInteraction: true, url: '/dashboard' }
  );
}

// ── Schedule browser-side reminders ─────────────────────────

let reminderTimers = [];

export function scheduleReminders(attendance) {
  reminderTimers.forEach(clearTimeout);
  reminderTimers = [];
  const now = Date.now();

  // ── Check-In reminder at 9:30 AM IST ─────────────────────
  if (!attendance?.checkInTime) {
    const t = makeISTTime(9, 30);
    const ms = t.getTime() - now;
    if (ms > 0 && ms < 86400000) {
      reminderTimers.push(setTimeout(notifyCheckInReminder, ms));
      console.log(`[Notif] Check-in reminder in ${Math.round(ms / 60000)}min (9:30 AM IST)`);
    }
  }

  // ── Check-Out reminder at 6:30 PM IST ────────────────────
  if (attendance?.checkInTime && !attendance?.checkOutTime) {
    const t = makeISTTime(18, 30);
    const ms = t.getTime() - now;
    if (ms > 0 && ms < 86400000) {
      reminderTimers.push(setTimeout(notifyCheckOutReminder, ms));
      console.log(`[Notif] Check-out reminder in ${Math.round(ms / 60000)}min (6:30 PM IST)`);
    }
  }

  // ── 8-Hour reminder — fires exactly 8h after check-in ────
  // This is a browser-side fallback. The server also sends a push
  // notification at the 8-hour mark (which works even when app is closed).
  if (attendance?.checkInTime && !attendance?.checkOutTime) {
    const checkInMs = new Date(attendance.checkInTime).getTime();
    const eightHourMs = checkInMs + 8 * 60 * 60 * 1000;
    const msUntil8hr = eightHourMs - now;
    if (msUntil8hr > 0 && msUntil8hr < 86400000) {
      reminderTimers.push(setTimeout(notifyEightHourCheckout, msUntil8hr));
      console.log(`[Notif] 8-hour checkout reminder in ${Math.round(msUntil8hr / 60000)}min`);
    }
  }
}
const webPush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// Lazy-initialize VAPID so it runs after dotenv.config() in server.js
let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error('[PUSH] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set in .env');
  }
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@attendance-app.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidReady = true;
}

/**
 * Send a push notification to a specific user (all their devices).
 * @param {string} userId  - MongoDB User _id
 * @param {object} payload - { title, body, icon?, tag?, url? }
 */
async function sendPushToUser(userId, payload) {
  ensureVapid();
  const subs = await PushSubscription.find({ userId });
  if (!subs.length) return;

  const data = JSON.stringify({
    title: payload.title || 'Attendance',
    body:  payload.body  || '',
    icon:  payload.icon  || '/icon-192.png',
    badge: '/icon-192.png',
    tag:   payload.tag   || `push-${Date.now()}`,
    url:   payload.url   || '/',
  });

  const results = await Promise.allSettled(
    subs.map((s) => webPush.sendNotification(s.subscription, data))
  );

  // Remove stale / expired subscriptions
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      const statusCode = results[i].reason?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await PushSubscription.deleteOne({ _id: subs[i]._id });
        console.log('[PUSH] Removed expired subscription');
      }
    }
  }
}

/**
 * Broadcast a push notification to ALL users (e.g. admin alerts).
 */
async function sendPushToAll(payload) {
  ensureVapid();
  const subs = await PushSubscription.find({});
  const data = JSON.stringify({
    title: payload.title || 'Attendance',
    body:  payload.body  || '',
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    tag:   payload.tag   || `push-${Date.now()}`,
    url:   payload.url   || '/',
  });

  await Promise.allSettled(
    subs.map((s) => webPush.sendNotification(s.subscription, data))
  );
}

module.exports = { sendPushToUser, sendPushToAll };
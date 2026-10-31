const express = require('express');
const router  = express.Router();
const { protect, protectEmployee } = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');

// GET /api/notifications/vapid-public-key
// Returns the VAPID public key so the frontend can subscribe
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/notifications/subscribe
// Saves (or updates) a push subscription for the logged-in user
router.post('/subscribe', protectEmployee, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object' });
    }

    await PushSubscription.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      { userId: req.attUser._id, subscription },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (err) {
    console.error('[PUSH] Subscribe error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to save subscription' });
  }
});

// DELETE /api/notifications/unsubscribe
// Removes a push subscription (called when user revokes permission or logs out)
router.delete('/unsubscribe', protectEmployee, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await PushSubscription.deleteOne({ 'subscription.endpoint': endpoint });
    } else {
      // Remove ALL subscriptions for this user
      await PushSubscription.deleteMany({ userId: req.attUser._id });
    }
    res.json({ success: true, message: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove subscription' });
  }
});

module.exports = router;

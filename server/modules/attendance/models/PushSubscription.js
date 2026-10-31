const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subscription: {
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth:   { type: String, required: true },
      },
    },
  },
  { timestamps: true }
);

// One subscription doc per endpoint — upsert keeps things clean
pushSubscriptionSchema.index({ 'subscription.endpoint': 1 }, { unique: true });

module.exports = bindModel('attendance', 'PushSubscription', pushSubscriptionSchema);

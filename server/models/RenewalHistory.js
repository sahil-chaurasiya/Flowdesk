const mongoose = require('mongoose');

const renewalHistorySchema = new mongoose.Schema({
  client:          { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  previousEndDate: { type: Date, required: true },
  newEndDate:      { type: Date, required: true },
  duration: {
    type: String,
    enum: ['3_months', '6_months', '1_year'],
    required: true,
  },
  approvedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedAt:          { type: Date, default: Date.now },
  paymentVerification: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentVerification' },
}, { timestamps: true });

renewalHistorySchema.index({ client: 1, approvedAt: -1 });

module.exports = mongoose.model('RenewalHistory', renewalHistorySchema);
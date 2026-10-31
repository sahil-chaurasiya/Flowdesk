const mongoose = require('mongoose');

const paymentVerificationSchema = new mongoose.Schema({
  client:      { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  amount:      { type: Number, required: [true, 'Amount is required'] },
  paymentDate: { type: Date,   required: [true, 'Payment date is required'] },
  transactionReference: { type: String, trim: true },
  screenshotUrl:        { type: String },
  notes:                { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  rejectionReason: { type: String, trim: true },
  verifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt:  { type: Date },
  // Set when approved
  extensionDuration: { type: String, enum: ['3_months', '6_months', '1_year'] },
  previousContractEndDate: Date,
  newContractEndDate:      Date,
}, { timestamps: true });

paymentVerificationSchema.index({ client: 1, status: 1 });
paymentVerificationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentVerification', paymentVerificationSchema);
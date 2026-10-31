const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

// Money we actually paid out to a freelancer against a specific job.
// These are real cash-out events, so they count as an expense in the month of
// `paymentDate` in Dashboard / Accounting / Reports (same rule as office
// expenses and EMI payments).
const freelancerPaymentSchema = new mongoose.Schema({
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Freelancer', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'FreelancerJob', required: true },
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'UPI', 'Cheque', 'Online'],
    default: 'Bank Transfer',
  },
  paymentType: { type: String, enum: ['Advance', 'Part Payment', 'Final Payment'], default: 'Part Payment' },
  // UPI / bank transaction id, cheque number, etc.
  reference: { type: String, default: '', trim: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });

freelancerPaymentSchema.index({ jobId: 1, paymentDate: -1 });
freelancerPaymentSchema.index({ paymentDate: 1 });

module.exports = bindModel('finance', 'FreelancerPayment', freelancerPaymentSchema);
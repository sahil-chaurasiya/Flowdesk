const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const paymentSchema = new mongoose.Schema({
  // Recurring/contract clients reference the Client collection.
  // One-time / walk-in collections leave this empty and use the custom* fields instead.
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: function () { return !this.isOneTime; } },
  isOneTime: { type: Boolean, default: false },
  customClientName: { type: String, default: '', trim: true },
  customClientPhone: { type: String, default: '', trim: true },
  // What this collection was for — e.g. "GST Filing", "ITR - One Time", "Consultation"
  purpose: { type: String, default: '', trim: true },
  // For one-time jobs: the total agreed value of the job (used to compute pending).
  // For recurring clients this is left at 0 and contractValue on the Client drives pending.
  totalAmount: { type: Number, default: 0, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year:  { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'UPI', 'Cheque', 'Online'],
    default: 'Bank Transfer'
  },
  remarks: { type: String, default: '' },
}, { timestamps: true });

module.exports = bindModel('finance', 'Payment', paymentSchema);
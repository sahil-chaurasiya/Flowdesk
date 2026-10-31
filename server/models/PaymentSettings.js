const mongoose = require('mongoose');

// Singleton — always upserted with key:'global'
const paymentSettingsSchema = new mongoose.Schema({
  key:             { type: String, default: 'global', unique: true },
  upiId:           { type: String, trim: true },
  bankAccountName: { type: String, trim: true },
  accountNumber:   { type: String, trim: true },
  ifscCode:        { type: String, trim: true },
  qrImageUrl:      { type: String },
  updatedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
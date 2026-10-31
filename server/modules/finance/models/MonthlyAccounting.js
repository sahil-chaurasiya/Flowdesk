const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const monthlyAccountingSchema = new mongoose.Schema({
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  openingBalance: { type: Number, default: 0 },
  reservedAmount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

monthlyAccountingSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = bindModel('finance', 'MonthlyAccounting', monthlyAccountingSchema);

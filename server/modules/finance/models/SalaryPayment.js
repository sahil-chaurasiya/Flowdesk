const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const salaryPaymentSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  amountPaid: { type: Number, required: true, min: 0 },
  paidDate: { type: Date },
  status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
}, { timestamps: true });

module.exports = bindModel('finance', 'SalaryPayment', salaryPaymentSchema);

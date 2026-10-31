const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const emiPaymentSchema = new mongoose.Schema({
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true },
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });

module.exports = bindModel('finance', 'EMIPayment', emiPaymentSchema);

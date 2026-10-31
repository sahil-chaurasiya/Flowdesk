const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['Rent', 'Internet', 'Electricity', 'Software', 'Marketing', 'Travel', 'Miscellaneous'],
    required: true
  },
  amount: { type: Number, required: true, min: 0 },
  expenseDate: { type: Date, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });

module.exports = bindModel('finance', 'Expense', expenseSchema);

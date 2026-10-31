const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, default: '' },
  joiningDate: { type: Date, required: true },
  monthlySalary: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true },
  // Date the employee left. Once set, they stop showing up in the monthly
  // salary run for any month AFTER the one this date falls in — the month
  // they actually left in still shows them, with their salary prorated to
  // the days they worked (see getPayableSalaryForMonth in
  // salary.controller.js). Clear it (set back to null) to undo.
  leavingDate: { type: Date, default: null },
  // Tracks salary over time so a hike only applies going forward, not to
  // months that already happened. `monthlySalary` above always mirrors the
  // most recent (current) entry here for quick display in the register.
  salaryHistory: [{
    amount: { type: Number, required: true, min: 0 },
    effectiveFrom: { type: Date, required: true },
  }],
}, { timestamps: true });

module.exports = bindModel('finance', 'Employee', employeeSchema);
const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  // 'monthly' (default) — contractValue is a recurring monthly retainer, billed every month.
  // 'fixed' — freelance / project clients: contractValue is ONE total fee for the whole
  // engagement, which covers `durationMonths` months of service. It is billed once (on the
  // start date), can be paid in instalments, and the client drops off the list once the
  // service window is over and everything is settled.
  billingType: { type: String, enum: ['monthly', 'fixed'], default: 'monthly' },
  // Only used when billingType === 'fixed': how many months the one-time fee covers.
  durationMonths: { type: Number, default: 0, min: 0 },
  contractValue: { type: Number, required: true, min: 0 },
  notes: { type: String, default: '' },
  accountManager: { type: String, default: '' },
  workStatus: { type: String, enum: ['On Time', 'Delayed', ''], default: '' },
  paymentStatus: { type: String, enum: ['Pending', 'Partially Paid', 'Paid', ''], default: 'Pending' },
  // Pause/deactivate support — a paused client stops accruing new monthly dues
  // from the moment it's paused, but everything billed while it was active stays intact.
  isActive: { type: Boolean, default: true },
  pauseHistory: [{
    pausedAt: { type: Date, required: true },
    resumedAt: { type: Date, default: null },
    _id: false,
  }],
  // Contract-completion support — a completed client stops being billed and
  // stops showing up in any month AFTER the month `endDate` falls in. Unlike
  // pause, this is meant to be permanent: if the client comes back, they're
  // re-added as a brand new client rather than reactivated.
  endDate: { type: Date, default: null },
  // Per-month overrides of the monthly contract value — e.g. a one-off
  // discount or a rate hike for a single month. Only the listed (year, month)
  // pair is affected; every other month keeps using `contractValue` above.
  contractValueOverrides: [{
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    value: { type: Number, required: true, min: 0 },
    _id: false,
  }],
  // Manual drag-and-drop position on the Clients page (lower = earlier).
  // New clients are appended to the end (see createClient).
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = bindModel('finance', 'Client', clientSchema);
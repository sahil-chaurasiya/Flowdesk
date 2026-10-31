const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

// One record per (client, month, year) monthly invoice. Its only real job is to
// hand out stable, never-reused invoice numbers like  tofly_oct_2026_001 :
//   • the serial (001, 002, ...) counts up per calendar month across ALL clients
//   • downloading the same client's invoice for the same month again always
//     returns the SAME number (it is created once, then looked up)
const invoiceSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  clientName: { type: String, default: '' },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  sequence: { type: Number, required: true, min: 1 },
  invoiceNumber: { type: String, required: true, unique: true },
  // Amount on the most recently generated copy (informational snapshot).
  amount: { type: Number, default: 0 },
}, { timestamps: true });

// A client can only ever have one invoice number per month...
invoiceSchema.index({ clientId: 1, year: 1, month: 1 }, { unique: true });
// ...and a serial can only be used once per month, even under concurrent requests.
invoiceSchema.index({ year: 1, month: 1, sequence: 1 }, { unique: true });

module.exports = bindModel('finance', 'Invoice', invoiceSchema);
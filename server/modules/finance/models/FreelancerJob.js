const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

// One engagement / gig with a freelancer — e.g. "Product shoot for TechCorp".
// It records WHAT was agreed (scope, rate, dates), HOW it went (status, on-time,
// rating, feedback) and which client it was for. The money actually paid against
// it lives in FreelancerPayment, so a job can be paid in advance / in instalments.
const freelancerJobSchema = new mongoose.Schema({
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Freelancer', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },

  // Optional: which client this work was done for (lets us see cost per client).
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  // Snapshot of the client name, or free text for work that isn't tied to a client record.
  clientName: { type: String, default: '', trim: true },

  startDate: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  completedDate: { type: Date, default: null },

  // How the fee is worked out:
  //   Fixed    -> `rate` IS the total fee
  //   Hourly / Daily / Per Unit -> total = rate x quantity
  //                (update quantity to the real hours/days/units once the work is done)
  rateType: { type: String, enum: ['Fixed', 'Hourly', 'Daily', 'Per Unit'], default: 'Fixed' },
  rate: { type: Number, required: true, min: 0 },
  quantity: { type: Number, default: 1, min: 0 },
  // What a "unit" is for Per Unit jobs — photos, reels, articles, ...
  unitLabel: { type: String, default: '', trim: true },
  // Always derived from rateType / rate / quantity (see pre-validate below).
  agreedAmount: { type: Number, default: 0, min: 0 },
  // Anything on top of the agreed fee — travel, equipment hire, bonus, ...
  extraCharges: { type: Number, default: 0, min: 0 },
  extraChargesNote: { type: String, default: '', trim: true },

  status: { type: String, enum: ['Planned', 'In Progress', 'Completed', 'Cancelled'], default: 'In Progress' },

  // How the work went — same idea as workStatus on a Client.
  workStatus: { type: String, enum: ['On Time', 'Delayed', ''], default: '' },
  // 1-5 stars, 0 = not rated yet.
  rating: { type: Number, default: 0, min: 0, max: 5 },
  feedback: { type: String, default: '' },
}, { timestamps: true });

// Keep the stored total in sync with how the fee is defined, however the job is saved.
freelancerJobSchema.pre('validate', function (next) {
  if (this.rateType === 'Fixed') {
    this.quantity = 1;
    this.agreedAmount = this.rate || 0;
  } else {
    this.agreedAmount = Math.round((this.rate || 0) * (this.quantity || 0) * 100) / 100;
  }
  next();
});

freelancerJobSchema.index({ freelancerId: 1, createdAt: -1 });

module.exports = bindModel('finance', 'FreelancerJob', freelancerJobSchema);
const mongoose = require('mongoose');

// A single piece of work a contact (freelancer / influencer / vendor) has been
// booked for — a shoot, a collab post, an edit, etc. Tracks the schedule, the
// client it was for, what we owe / have paid them, and how they performed.

const paymentSchema = new mongoose.Schema({
  amount:     { type: Number, required: [true, 'Payment amount is required'], min: [1, 'Amount must be greater than 0'] },
  paidAt:     { type: Date, default: Date.now },
  method:     { type: String, trim: true },    // UPI, Bank Transfer, Cash...
  reference:  { type: String, trim: true },    // UTR / transaction id
  note:       { type: String, trim: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const PROJECT_TYPES = [
  'photo_shoot', 'video_shoot', 'reel_shoot', 'product_shoot', 'event_shoot',
  'influencer_collab', 'editing', 'design', 'content_writing', 'other',
];

const contactProjectSchema = new mongoose.Schema({
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },

  title:       { type: String, required: [true, 'Project title is required'], trim: true, maxlength: 200 },
  type:        { type: String, enum: PROJECT_TYPES, default: 'other' },
  description: { type: String, trim: true },   // the brief — what was it for
  deliverables:{ type: String, trim: true },   // what they had to hand over

  // Who it was for. `client` resolves while the client exists; `clientName` is
  // a snapshot so history still reads properly if the client is deleted, or if
  // the work was for someone who isn't a client in the system.
  client:     { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  clientName: { type: String, trim: true },

  startDate: { type: Date, required: [true, 'Date is required'] },
  endDate:   { type: Date },
  location:  { type: String, trim: true },

  status: {
    type: String,
    enum: ['upcoming', 'in_progress', 'completed', 'cancelled'],
    default: 'upcoming',
  },
  completedAt: { type: Date },

  // Money
  fee:      { type: Number, default: 0, min: 0 },   // agreed amount (in the contact's currency)
  payments: [paymentSchema],

  // How did they do? (only set once the project is completed)
  rating:     { type: Number, min: 1, max: 5 },
  reviewNote: { type: String, trim: true },
  reviewTags: [{ type: String, trim: true }],
  wouldRehire:{ type: Boolean },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Optional link to the team calendar entry created for this project
  calendarEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'CalendarEvent', default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

contactProjectSchema.virtual('paidAmount').get(function () {
  return (this.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
});

// What we still owe. Cancelled work owes nothing.
contactProjectSchema.virtual('pendingAmount').get(function () {
  if (this.status === 'cancelled') return 0;
  return Math.max((this.fee || 0) - this.paidAmount, 0);
});

// none = no fee agreed and nothing paid · unpaid · partial · paid
contactProjectSchema.virtual('paymentStatus').get(function () {
  const paid = this.paidAmount;
  const fee = this.fee || 0;
  if (fee === 0 && paid === 0) return 'none';
  if (paid === 0) return 'unpaid';
  if (paid >= fee) return 'paid';
  return 'partial';
});

contactProjectSchema.index({ contact: 1, startDate: -1 });
contactProjectSchema.index({ client: 1 });
contactProjectSchema.index({ status: 1 });

const model = mongoose.model('ContactProject', contactProjectSchema);
model.PROJECT_TYPES = PROJECT_TYPES;
module.exports = model;
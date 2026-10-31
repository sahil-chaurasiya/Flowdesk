const mongoose = require('mongoose');

// Represents a single lead row from an uploaded Excel/CSV file
const leadSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Batch identifier — all leads from the same upload share a batchId
  batchId: {
    type: String,
    required: true
  },
  batchLabel: {
    type: String, // e.g. "July Meta Leads - Week 1"
    trim: true
  },
  // Campaign / source info
  campaign: {
    type: String,
    trim: true
  },
  source: {
    type: String, // e.g. 'Facebook Ads', 'Google Ads', 'TikTok'
    trim: true
  },
  // Lead details (flexible — mapped from Excel columns)
  name: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  company: { type: String, trim: true },
  location: { type: String, trim: true },

  // ─── Company-side status ────────────────────────────────────────────────────
  // Always 'new' — the company (us) generates leads and delivers them.
  // We do NOT qualify or update this. It is locked at 'new' from our end.
  status: {
    type: String,
    enum: ['new'],
    default: 'new'
  },

  // ─── Client-side tracking ───────────────────────────────────────────────────
  // Clients update these fields from their portal to track what happened
  // after they received the lead. We (the company) can read these to detect
  // if a client is mishandling leads and then blaming us for poor quality.
  clientStatus: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'not_interested', 'invalid'],
    default: 'new'
  },
  clientNotes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  // ─── Multi-note history (replaces single clientNotes for new clients) ────────
  clientNotesHistory: [{
    body: { type: String, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  }],
  // ─── Client follow-up ───────────────────────────────────────────────────────
  clientFollowUpDate: { type: Date },
  clientFollowUpNote: { type: String, trim: true, maxlength: 500 },
  clientUpdatedAt: {
    type: Date
  },
  // Timestamp of the very first time the client changed status away from 'new'
  // Used to detect response time — slow responders often blame bad leads
  clientFirstContactedAt: {
    type: Date
  },

  // ─── Company dispute flag ───────────────────────────────────────────────────
  // If a client marks a lead as 'invalid', we internally review it.
  // disputeFlag is set by admin if the invalid claim looks suspicious.
  disputeFlag: {
    type: Boolean,
    default: false
  },
  disputeNote: {
    type: String,
    trim: true
  },

  notes: { type: String, trim: true },
  // Extra columns from Excel stored as key-value pairs
  extra: {
    type: Map,
    of: String,
    default: {}
  },
  // Date the lead was actually generated (from ad platform), vs upload date
  leadDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

leadSchema.index({ client: 1, createdAt: -1 });
leadSchema.index({ client: 1, batchId: 1 });
leadSchema.index({ batchId: 1 });
leadSchema.index({ client: 1, clientStatus: 1 });
leadSchema.index({ disputeFlag: 1 });

module.exports = mongoose.model('Lead', leadSchema);
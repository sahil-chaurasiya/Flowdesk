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
  // Lead qualification
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new'
  },
  quality: {
    type: String,
    enum: ['hot', 'warm', 'cold', 'unqualified'],
    default: 'warm'
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

module.exports = mongoose.model('Lead', leadSchema);

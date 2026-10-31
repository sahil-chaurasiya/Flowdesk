const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Report title is required'],
    trim: true
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom'],
    default: 'monthly'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  metrics: {
    adSpend: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    roas: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    cpc: { type: Number, default: 0 },
    cpl: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    engagements: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
  },
  channels: [{
    name: String,
    spend: Number,
    revenue: Number,
    conversions: Number,
    leads: Number
  }],
  notes: String,
  highlights: [String],
  recommendations: [String],
  attachedFile: String,

  // ── Spreadsheet upload support ──────────────────────────────────────────
  // Lets a report be created by uploading an Excel/CSV export (e.g. Meta Ads
  // ad-set report) instead of (or in addition to) manually entered metrics.
  // Columns vary upload to upload — not every column is guaranteed to be
  // present — so we store whatever headers were actually found plus the raw
  // row data, and render both a "sheet" table and summary cards from it.
  sourceFile: {
    name: String,        // original uploaded filename
    uploadedAt: Date,
  },
  columns: [String],     // ordered column headers as found in the uploaded file
  sheetData: [mongoose.Schema.Types.Mixed], // one object per row, keyed by column header

  isPublished: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

reportSchema.index({ client: 1, startDate: -1 });

module.exports = mongoose.model('Report', reportSchema);
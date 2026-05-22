const mongoose = require('mongoose');

// Each document = one month's targets for one client
const clientTargetSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  // month stored as YYYY-MM string e.g. "2025-06"
  month: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/,
  },

  // ── Social Media ────────────────────────────────────────────────────────────
  instagramFollowers:    { type: Number, default: null },
  instagramReach:        { type: Number, default: null },
  instagramImpressions:  { type: Number, default: null },
  instagramEngagements:  { type: Number, default: null },
  instagramPosts:        { type: Number, default: null },
  instagramReels:        { type: Number, default: null },

  facebookFollowers:     { type: Number, default: null },
  facebookReach:         { type: Number, default: null },
  facebookImpressions:   { type: Number, default: null },
  facebookEngagements:   { type: Number, default: null },
  facebookPosts:         { type: Number, default: null },

  linkedinFollowers:     { type: Number, default: null },
  linkedinImpressions:   { type: Number, default: null },
  linkedinEngagements:   { type: Number, default: null },

  youtubeSubscribers:    { type: Number, default: null },
  youtubeViews:          { type: Number, default: null },
  youtubeVideos:         { type: Number, default: null },

  tiktokFollowers:       { type: Number, default: null },
  tiktokViews:           { type: Number, default: null },
  tiktokVideos:          { type: Number, default: null },

  // ── Paid Ads ────────────────────────────────────────────────────────────────
  adSpend:               { type: Number, default: null },
  adRevenue:             { type: Number, default: null },
  roas:                  { type: Number, default: null },
  cpc:                   { type: Number, default: null },
  ctr:                   { type: Number, default: null },
  impressions:           { type: Number, default: null },
  clicks:                { type: Number, default: null },

  // ── Lead Generation ─────────────────────────────────────────────────────────
  totalLeads:            { type: Number, default: null },
  qualifiedLeads:        { type: Number, default: null },
  costPerLead:           { type: Number, default: null },
  conversionRate:        { type: Number, default: null },

  // ── SEO / Website ───────────────────────────────────────────────────────────
  organicTraffic:        { type: Number, default: null },
  websiteSessions:       { type: Number, default: null },
  keywordRankings:       { type: Number, default: null },
  backlinks:             { type: Number, default: null },

  // ── GMB ─────────────────────────────────────────────────────────────────────
  gmbViews:              { type: Number, default: null },
  gmbClicks:             { type: Number, default: null },
  gmbCalls:              { type: Number, default: null },
  gmbReviews:            { type: Number, default: null },

  // ── Content ─────────────────────────────────────────────────────────────────
  blogPosts:             { type: Number, default: null },
  emailsSent:            { type: Number, default: null },
  emailOpenRate:         { type: Number, default: null },

  // ── Custom fields ───────────────────────────────────────────────────────────
  customFields: [{
    label: String,
    value: Number,
    unit: String,
  }],

  // which fields are visible on this client's portal (admin configures)
  visibleFields: {
    type: [String],
    default: [],
  },

  notes: String,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Unique index per client + month
clientTargetSchema.index({ client: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('ClientTarget', clientTargetSchema);
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
  isPublished: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

reportSchema.index({ client: 1, startDate: -1 });

module.exports = mongoose.model('Report', reportSchema);

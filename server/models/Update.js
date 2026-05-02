const mongoose = require('mongoose');

const updateSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Update title is required'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Update content is required']
  },
  type: {
    type: String,
    enum: ['general', 'milestone', 'report', 'alert', 'campaign_launch', 'optimization', 'meeting_notes'],
    default: 'general'
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  tags: [String],
  isVisible: {
    type: Boolean,
    default: true
  },
  metrics: {
    impressions: Number,
    clicks: Number,
    conversions: Number,
    spend: Number,
    roas: Number
  }
}, {
  timestamps: true
});

updateSchema.index({ client: 1, createdAt: -1 });

module.exports = mongoose.model('Update', updateSchema);

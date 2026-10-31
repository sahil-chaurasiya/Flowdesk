const mongoose = require('mongoose');

// ── Social Account ─────────────────────────────────────────────────────────────
const socialAccountSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['instagram', 'facebook', 'sharechat', 'youtube', 'linkedin', 'twitter', 'google_business', 'other'],
    required: true
  },
  // Only used when platform === 'other' — the custom platform name the user typed in
  customPlatform: { type: String, trim: true },
  accountName: { type: String, required: true, trim: true },
  accountUrl: { type: String, trim: true },
  profilePicture: String,
  // Follower / subscriber baseline (updated manually or via mock API)
  followers: { type: Number, default: 0 },
  followersChange: { type: Number, default: 0 }, // delta since last update
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

socialAccountSchema.index({ client: 1, platform: 1 });

// ── Social Post ────────────────────────────────────────────────────────────────
const socialPostSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  socialAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialAccount'
  },
  platform: {
    type: String,
    enum: ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'twitter', 'google_business'],
    required: true
  },
  contentType: {
    type: String,
    enum: ['post', 'reel', 'story', 'video', 'carousel', 'short'],
    default: 'post'
  },
  caption: { type: String, trim: true },
  mediaUrls: [String],   // uploaded image/video URLs
  thumbnail: String,     // for videos
  hashtags: [String],
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'failed', 'archived'],
    default: 'draft'
  },
  scheduledAt: Date,
  publishedAt: Date,

  // Internal workflow tracking
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Performance metrics (filled in manually or via mock API sync)
  metrics: {
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },   // (likes+comments+shares)/reach*100
    clicks: { type: Number, default: 0 },
    profileVisits: { type: Number, default: 0 }
  },

  // External post reference (if posted natively or via third-party tool)
  externalId: String,
  externalUrl: String,

  notes: String,
  isClientVisible: { type: Boolean, default: true }
}, {
  timestamps: true
});

socialPostSchema.index({ client: 1, publishedAt: -1 });
socialPostSchema.index({ client: 1, status: 1 });
socialPostSchema.index({ assignedTo: 1, status: 1 });

// Auto-calculate engagement rate before save
socialPostSchema.pre('save', function (next) {
  const m = this.metrics;
  if (m.reach > 0) {
    m.engagementRate = parseFloat(
      (((m.likes + m.comments + m.shares) / m.reach) * 100).toFixed(2)
    );
  }
  next();
});

const SocialAccount = mongoose.model('SocialAccount', socialAccountSchema);
const SocialPost = mongoose.model('SocialPost', socialPostSchema);

module.exports = { SocialAccount, SocialPost };
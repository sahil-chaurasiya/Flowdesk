const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  website: String,
  industry: String,
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zip: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'onboarding', 'paused', 'churned'],
    default: 'onboarding'
  },
  plan: {
    type: String,
    enum: ['3_month', '6_month', '1_year', 'starter', 'growth', 'professional', 'enterprise', 'custom'],
    default: '3_month'
  },
  services: [{
    type: String,
    enum: ['seo', 'ppc', 'social_media', 'content_marketing', 'email_marketing', 'web_design', 'analytics', 'branding', 'video_production', 'influencer_marketing']
  }],
  accountManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  teamMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  startDate: {
    type: Date,
    default: Date.now
  },
  contractEndDate: Date,
  monthlyBudget: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  notes: String,
  tags: [String],
  logo: String,
  portalAccess: {
    type: Boolean,
    default: true
  },
  linkedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  socialProfiles: {
    facebook: String,
    instagram: String,
    twitter: String,
    linkedin: String,
    google: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
clientSchema.virtual('tasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'client'
});

clientSchema.virtual('updates', {
  ref: 'Update',
  localField: '_id',
  foreignField: 'client'
});

clientSchema.virtual('files', {
  ref: 'File',
  localField: '_id',
  foreignField: 'client'
});

clientSchema.virtual('reports', {
  ref: 'Report',
  localField: '_id',
  foreignField: 'client'
});

clientSchema.index({ status: 1 });
clientSchema.index({ accountManager: 1 });

module.exports = mongoose.model('Client', clientSchema);
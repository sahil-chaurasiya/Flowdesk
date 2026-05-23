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
  // ── plan: keep original values + default so existing forms don't break ───────
  plan: {
    type: String,
    enum: ['3_month', '6_month', '1_year', 'starter', 'growth', 'professional', 'enterprise', 'custom'],
    default: '3_month'   // ← MUST stay '3_month' — ClientsPage form sends this value
  },
  // ── planDuration: new field added for contract renewal system ────────────────
  planDuration: {
    type: String,
    enum: ['3_months', '6_months', '1_year'],
    default: '3_months'
  },
  // ── services: NO enum — keys are managed dynamically via the Service model ──
  // A hardcoded enum here would reject any custom service added through Settings.
  services: [{ type: String, trim: true }],
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
  // ── contractStatus: explicit field (set by payments.js on renewal/approval) ──
  contractStatus: {
    type: String,
    enum: ['active', 'expiring_soon', 'expired'],
    default: 'active'
  },
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
  whatsappGroup: {
    type: String,
    trim: true,
    default: null,
  },
  whatsappPhone: {
    type: String,
    trim: true,
    default: null,
  },
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

// ── Existing virtuals (unchanged) ────────────────────────────────────────────
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

// ── New virtuals for contract system ─────────────────────────────────────────
clientSchema.virtual('daysRemaining').get(function () {
  if (!this.contractEndDate) return null;
  return Math.ceil((new Date(this.contractEndDate) - Date.now()) / 86400000);
});

clientSchema.virtual('expiryWarningLevel').get(function () {
  const d = this.daysRemaining;
  if (d === null) return null;
  if (d < 0)   return 'expired';
  if (d <= 3)  return 'critical';
  if (d <= 7)  return 'high';
  if (d <= 14) return 'medium';
  if (d <= 30) return 'low';
  return null;
});

// ── Indexes ──────────────────────────────────────────────────────────────────
clientSchema.index({ status: 1 });
clientSchema.index({ accountManager: 1 });
clientSchema.index({ contractEndDate: 1 });
clientSchema.index({ contractStatus: 1 });

module.exports = mongoose.model('Client', clientSchema);
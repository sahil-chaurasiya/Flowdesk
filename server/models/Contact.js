const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  field: {
    // e.g. 'videographer', 'photographer', 'graphic_designer', 'copywriter', 'web_developer', 'other'
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  location: {
    type: String,
    trim: true,
  },
  // Payment / rate info
  rateType: {
    type: String,
    enum: ['per_hour', 'per_project', 'per_day', 'monthly', 'other'],
    default: 'per_project',
  },
  rateAmount: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  // Payment method preference
  paymentMethod: {
    type: String,
    trim: true, // e.g. "UPI", "Bank Transfer", "Cash"
  },
  notes: {
    type: String,
    trim: true,
  },
  tags: [String],
  portfolio: {
    type: String,
    trim: true,
  },
  // Number of followers this contact has (e.g. for influencers/creators).
  followers: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

contactSchema.index({ field: 1 });
contactSchema.index({ isActive: 1 });
contactSchema.index({ addedBy: 1 });
contactSchema.index({ followers: 1 });

module.exports = mongoose.model('Contact', contactSchema);
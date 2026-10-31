const mongoose = require('mongoose');

const logEntrySchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null,
  },
  hoursSpent: {
    type: Number,
    min: 0,
    max: 24,
    default: null,
  },
  category: {
    type: String,
    enum: ['paid_ads', 'social_media', 'video_editing', 'graphic_design', 'copywriting', 'reporting', 'strategy', 'meetings', 'other'],
    default: 'other',
  },
  status: {
    type: String,
    enum: ['completed', 'in_progress', 'carried_over'],
    default: 'completed',
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: '',
  },
}, { _id: true });

const dailyLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // ISO date string YYYY-MM-DD — one log per user per day
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  entries: {
    type: [logEntrySchema],
    default: [],
  },
  blockers: {
    type: String,
    trim: true,
    maxlength: [1000, 'Blockers text too long'],
    default: '',
  },
  submittedAt: {
    type: Date,
    default: null,
  },
  isSubmitted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// One log per user per day
dailyLogSchema.index({ user: 1, date: 1 }, { unique: true });
dailyLogSchema.index({ date: 1 });

module.exports = mongoose.model('DailyLog', dailyLogSchema);
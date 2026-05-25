const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: 200,
  },
  description: { type: String, trim: true },

  // Timing
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },
  allDay:    { type: Boolean, default: false },

  // Type — drives colour coding in UI
  type: {
    type: String,
    enum: ['task_deadline', 'meeting', 'reminder', 'follow_up', 'campaign', 'shoot', 'other'],
    default: 'other',
  },

  // Shoot sub-type (only used when type === 'shoot')
  shootSubtype: {
    type: String,
    enum: ['photo_shoot', 'video_shoot', 'reel_shoot', 'product_shoot', 'event_shoot', 'interview', 'bts', 'other_shoot'],
    default: null,
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'done', 'cancelled'],
    default: 'pending',
  },

  // Client visibility — show this event on the client portal calendar
  visibleToClient: { type: Boolean, default: false },

  // Relations (all optional)
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  task:   { type: mongoose.Schema.Types.ObjectId, ref: 'Task',   default: null },
  lead:   { type: mongoose.Schema.Types.ObjectId, ref: 'Lead',   default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // ── Visibility ────────────────────────────────────────────────────────────
  visibility: {
    type: String,
    enum: ['private', 'specific', 'all'],
    default: 'all',
  },
  visibleTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Reminder
  reminder: {
    enabled:  { type: Boolean, default: false },
    minutesBefore: { type: Number, default: 30 },
    sent:     { type: Boolean, default: false },
  },

  color: { type: String, default: null }, // hex override
  // isCompleted kept for backward compat, status is the source of truth
  isCompleted: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// Virtual: overdue = endDate has passed AND status is not done/cancelled
calendarEventSchema.virtual('isOverdue').get(function () {
  return (
    this.status !== 'done' &&
    this.status !== 'cancelled' &&
    this.endDate < new Date()
  );
});

calendarEventSchema.set('toJSON', { virtuals: true });
calendarEventSchema.set('toObject', { virtuals: true });

calendarEventSchema.index({ startDate: 1, endDate: 1 });
calendarEventSchema.index({ createdBy: 1 });
calendarEventSchema.index({ 'assignedTo': 1 });
calendarEventSchema.index({ visibleTo: 1 });
calendarEventSchema.index({ client: 1 });
calendarEventSchema.index({ status: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
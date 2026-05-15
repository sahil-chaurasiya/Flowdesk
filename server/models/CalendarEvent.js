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
    enum: ['task_deadline', 'meeting', 'reminder', 'follow_up', 'campaign', 'other'],
    default: 'other',
  },

  // Relations (all optional)
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  task:   { type: mongoose.Schema.Types.ObjectId, ref: 'Task',   default: null },
  lead:   { type: mongoose.Schema.Types.ObjectId, ref: 'Lead',   default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Reminder
  reminder: {
    enabled:  { type: Boolean, default: false },
    minutesBefore: { type: Number, default: 30 },
    sent:     { type: Boolean, default: false },
  },

  color: { type: String, default: null }, // hex override
  isCompleted: { type: Boolean, default: false },
}, {
  timestamps: true,
});

calendarEventSchema.index({ startDate: 1, endDate: 1 });
calendarEventSchema.index({ createdBy: 1 });
calendarEventSchema.index({ 'assignedTo': 1 });
calendarEventSchema.index({ client: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);

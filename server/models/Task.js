const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: function () { return !this.isPersonal; }
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['today', 'pending', 'in_progress', 'review', 'completed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Category now includes To Fly Media specific disciplines
  category: {
    type: String,
    enum: [
      'paid_ads',           // Performance Marketer
      'social_media',       // Social Media Manager
      'video_editing',      // Video Editor
      'graphic_design',     // Graphic Designer
      'copywriting',        // Copywriter
      'reporting',          // Any team member
      'strategy',           // Manager / Admin
      'client_request',     // Created by client
      'other'
    ],
    default: 'other'
  },
  deadline: Date,
  completedAt: Date,
  estimatedHours: Number,
  actualHours: Number,
  tags: [String],
  attachments: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  // Revision tracking — incremented when a team member logs that the PM
  // asked for changes on this task (e.g. after a review rejection).
  revisionCount: {
    type: Number,
    default: 0
  },
  revisions: [{
    note: { type: String, trim: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who logged it (the team member)
    statusAtTime: String, // status the task was in when the revision was logged
    createdAt: { type: Date, default: Date.now }
  }],
  isClientVisible: {
    type: Boolean,
    default: false
  },
  // Personal task — created by an admin for themselves, not tied to any
  // client. Never visible to anyone other than the creator (see tasks.js
  // route scoping), regardless of role.
  isPersonal: {
    type: Boolean,
    default: false
  },
  // Client-created request
  isClientRequest: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

taskSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

taskSchema.index({ client: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ deadline: 1 });

module.exports = mongoose.model('Task', taskSchema);
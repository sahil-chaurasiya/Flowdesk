const mongoose = require('mongoose');

// WebsiteProject — a project tracked in the admin/developer-only
// "Website Work" section. Tasks (see models/Task.js, isWebsiteWork: true)
// are linked to a project via the `websiteProject` field.
const websiteProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [150, 'Project name cannot exceed 150 characters'],
  },
  description: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['planning', 'in_progress', 'on_hold', 'review', 'completed', 'cancelled'],
    default: 'planning',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  deadline: {
    type: Date,
  },
  // Optional link to a client, in case the website work is for a specific
  // client rather than an internal/company site. Not required.
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

websiteProjectSchema.index({ status: 1 });
websiteProjectSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WebsiteProject', websiteProjectSchema);
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
  // ── Quick-reference links ────────────────────────────────────────────────
  // Optional URLs surfaced on the project card/drawer and pulled into the
  // Developer Dashboard's "stack.env" panel. All optional — nothing breaks
  // if a project doesn't have them filled in.
  repoUrl: {
    type: String,
    trim: true,
    maxlength: [500, 'Repo URL cannot exceed 500 characters'],
  },
  adminUrl: {
    type: String,
    trim: true,
    maxlength: [500, 'Admin URL cannot exceed 500 characters'],
  },
  liveUrl: {
    type: String,
    trim: true,
    maxlength: [500, 'Live URL cannot exceed 500 characters'],
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
  // Freeform tagging — e.g. "office_project" (internal/company site) vs
  // "client_project" (built for a paying client). A project can carry more
  // than one tag.
  categories: {
    type: [String],
    enum: ['office_project', 'client_project'],
    default: [],
  },
  // ── Pinning ───────────────────────────────────────────────────────────────
  pinned: {
    type: Boolean,
    default: false,
    index: true,
  },
  pinOrder: {
    type: Number,
    default: 0,
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
websiteProjectSchema.index({ pinned: 1, pinOrder: 1 });

module.exports = mongoose.model('WebsiteProject', websiteProjectSchema);
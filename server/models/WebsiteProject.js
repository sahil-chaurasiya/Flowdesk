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
  // ── Scratchpad ────────────────────────────────────────────────────────────
  // Freeform markdown notes for the project — known issues, tech debt, TODOs.
  // Not a formal task, just a running dev notepad. Rendered as a terminal-style
  // panel in the Website Work project drawer (client/src/pages/admin/WebsiteWorkPage.jsx).
  notes: {
    type: String,
    trim: true,
    maxlength: [20000, 'Notes cannot exceed 20000 characters'],
    default: '',
  },
  notesUpdatedAt: {
    type: Date,
    default: null,
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
  // ── Credential access control ────────────────────────────────────────────
  // Governs the project's "Credentials" panel (admin panel / hosting / FTP
  // logins, etc — see models/WebsiteCredential.js). The project's creator
  // (typically the developer who set it up) and admins always have full
  // access; this list is how they can additionally grant other specific
  // team members permission to view, edit, add, or delete credentials for
  // this project. Nobody else can see this project's credentials at all.
  credentialAccess: {
    type: [{
      _id: false,
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      canView:   { type: Boolean, default: true },
      canEdit:   { type: Boolean, default: false },
      canAdd:    { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false },
    }],
    default: [],
  },
  // ── Uptime monitoring ────────────────────────────────────────────────────
  // Populated by server/services/uptimeMonitor.js, which pings `liveUrl` on
  // a timer (see index.js) and on-demand (see PATCH /:id/check-uptime in
  // routes/websiteWork.js). Entirely additive — a project with no liveUrl
  // simply never gets checked and `uptime.status` stays 'unknown'.
  uptime: {
    status: {
      type: String,
      enum: ['up', 'down', 'unknown'],
      default: 'unknown',
    },
    lastCheckedAt: { type: Date, default: null },
    statusCode: { type: Number, default: null },
    responseTimeMs: { type: Number, default: null },
    error: { type: String, default: null },
    // Rolling window of recent checks, oldest first, for a small sparkline /
    // history view. Capped in server/services/uptimeMonitor.js.
    history: {
      type: [{
        _id: false,
        checkedAt: { type: Date, required: true },
        up: { type: Boolean, required: true },
        statusCode: { type: Number, default: null },
        responseTimeMs: { type: Number, default: null },
      }],
      default: [],
    },
  },
}, {
  timestamps: true,
});

websiteProjectSchema.index({ status: 1 });
websiteProjectSchema.index({ createdAt: -1 });
websiteProjectSchema.index({ pinned: 1, pinOrder: 1 });

module.exports = mongoose.model('WebsiteProject', websiteProjectSchema);
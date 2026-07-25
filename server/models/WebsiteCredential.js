const mongoose = require('mongoose');

// WebsiteCredential — login credentials tied to a Website Work project
// (e.g. WordPress admin, hosting cPanel, FTP, database, domain registrar).
//
// Access is per-credential, not per-project: whoever adds a credential
// (`addedBy`) always has full access to it, and can pick exactly who else
// is allowed to see it and what they can do (view / edit / delete) via the
// `permissions` list below. Nobody else — not even an admin — can see a
// credential unless they added it or were explicitly granted access. See
// getCredentialPerms() in routes/websiteWork.js for the enforcement.
const websiteCredentialSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WebsiteProject',
    required: true,
  },
  label: {
    type: String,
    required: [true, 'Label is required'],
    trim: true,
    maxlength: [150, 'Label cannot exceed 150 characters'],
  },
  // e.g. 'admin_panel', 'hosting', 'domain', 'ftp', 'database', 'email', 'other'
  platform: {
    type: String,
    trim: true,
    default: 'other',
  },
  url: {
    type: String,
    trim: true,
    maxlength: [500, 'URL cannot exceed 500 characters'],
  },
  username: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Per-credential sharing — set when the credential is added, and editable
  // later, only by whoever added it. Anyone not listed here (and not the
  // adder) has zero access to this credential — it won't even show up for
  // them, admin included.
  permissions: {
    type: [{
      _id: false,
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      canView:   { type: Boolean, default: true },
      canEdit:   { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false },
    }],
    default: [],
  },
}, {
  timestamps: true,
});

websiteCredentialSchema.index({ project: 1 });

module.exports = mongoose.model('WebsiteCredential', websiteCredentialSchema);
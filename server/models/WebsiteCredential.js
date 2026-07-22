const mongoose = require('mongoose');

// WebsiteCredential — login credentials tied to a Website Work project
// (e.g. WordPress admin, hosting cPanel, FTP, database, domain registrar).
// Who can view/edit/add/delete these is governed by the parent
// WebsiteProject's `credentialAccess` list — see models/WebsiteProject.js
// and the /api/website-work/projects/:id/credentials routes.
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
}, {
  timestamps: true,
});

websiteCredentialSchema.index({ project: 1 });

module.exports = mongoose.model('WebsiteCredential', websiteCredentialSchema);
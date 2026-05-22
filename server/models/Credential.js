const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  platform: {
    type: String,
    required: true,
    // e.g. 'instagram', 'facebook', 'gmb', 'twitter', 'linkedin', 'tiktok', 'youtube', 'other'
  },
  label: {
    type: String,
    trim: true,
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
  visibleTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

credentialSchema.index({ client: 1 });
credentialSchema.index({ platform: 1 });

module.exports = mongoose.model('Credential', credentialSchema);
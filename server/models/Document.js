const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'Untitled Document',
  },
  html: {
    type: String,
    default: '',
  },
  // Whether this document appears in the client portal at all
  clientVisible: {
    type: Boolean,
    default: false,
  },
  // If clientVisible=true, can the client edit it?
  clientCanEdit: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

documentSchema.index({ client: 1, createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
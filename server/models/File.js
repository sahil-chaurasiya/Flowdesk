const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  mimeType: String,
  size: Number,
  category: {
    type: String,
    enum: ['report', 'creative', 'contract', 'invoice', 'presentation', 'media', 'other'],
    default: 'other'
  },
  description: String,
  tags: [String],
  isPublic: {
    type: Boolean,
    default: true
  },
  downloads: {
    type: Number,
    default: 0
  },
  cloudinaryId: String,
  storageType: {
    type: String,
    enum: ['local', 'cloudinary'],
    default: 'local'
  }
}, {
  timestamps: true
});

fileSchema.index({ client: 1, createdAt: -1 });
fileSchema.index({ category: 1 });

module.exports = mongoose.model('File', fileSchema);

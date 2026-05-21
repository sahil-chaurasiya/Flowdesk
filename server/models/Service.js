const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Service key is required'],
      unique: true,          // this alone creates the index — no schema.index() needed
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_]+$/, 'Key may only contain lowercase letters, numbers, and underscores'],
    },
    label: {
      type: String,
      required: [true, 'Service label is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// No extra schema.index({ key: 1 }) — `unique: true` above already handles it

module.exports = mongoose.model('Service', serviceSchema);
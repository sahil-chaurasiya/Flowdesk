const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const wfhRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    comment: { type: String, default: '' },
    daysRequested: { type: Number, required: true, min: 1 },
    daysApproved: { type: Number, default: null },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    // When this permission expires (set on approval)
    expiresAt: { type: Date, default: null },
    // Days used for WFH under this permission
    daysUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = bindModel('attendance', 'WFHRequest', wfhRequestSchema);

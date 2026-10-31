const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

/**
 * Attendance Regularization Request
 *
 * An employee can request to fix one attendance record by specifying:
 *  - the date
 *  - what they want changed (check-in time, check-out time, or both)
 *  - the reason
 *
 * On admin approval the relevant Attendance document is patched directly.
 */
const regularizationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The calendar date being corrected  (YYYY-MM-DD)
    date: {
      type: String,
      required: true,
    },

    // What kind of correction is being requested
    requestType: {
      type: String,
      enum: ['missing_checkin', 'missing_checkout', 'both', 'absent_correction'],
      required: true,
    },

    // Requested corrected times (ISO strings or null when not applicable)
    requestedCheckIn: {
      type: Date,
      default: null,
    },
    requestedCheckOut: {
      type: Date,
      default: null,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    // ── Review fields ──────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },

    adminNote: {
      type: String,
      default: '',
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    // Snapshot of the attendance record BEFORE the change (for audit trail)
    snapshotBefore: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// One pending request per user per date — prevents duplicate spam
regularizationSchema.index(
  { userId: 1, date: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);

module.exports = bindModel('attendance', 'RegularizationRequest', regularizationSchema);
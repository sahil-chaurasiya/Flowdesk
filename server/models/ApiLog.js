const mongoose = require('mongoose');

const apiLogSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    },
    url: {
      type: String,
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    responseTime: {
      type: Number, // milliseconds
      required: true,
    },
    ip: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userAgent: {
      type: String,
    },
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    errorMessage: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// TTL index: auto-delete logs after 7 days
apiLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Index for common query patterns
apiLogSchema.index({ method: 1, statusCode: 1, timestamp: -1 });
apiLogSchema.index({ userId: 1, timestamp: -1 });
apiLogSchema.index({ url: 1, timestamp: -1 });

module.exports = mongoose.model('ApiLog', apiLogSchema);

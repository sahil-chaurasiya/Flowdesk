const mongoose = require('mongoose');

/**
 * ActivityLog — audit trail for all important actions in the system.
 * Kept lean: only append, never update. TTL index auto-purges after 1 year.
 */
const activityLogSchema = new mongoose.Schema({
  // Who did it
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  actorName:  { type: String }, // denormalised so logs survive user deletion
  actorRole:  { type: String },

  // What happened
  action: {
    type: String,
    required: true,
    enum: [
      // Auth
      'auth.login', 'auth.logout', 'auth.password_changed',
      // Users / Team
      'user.created', 'user.updated', 'user.deactivated', 'user.reactivated', 'user.deleted',
      // Clients
      'client.created', 'client.updated', 'client.deleted',
      // Tasks
      'task.created', 'task.updated', 'task.status_changed',
      'task.assigned', 'task.deleted', 'task.commented',
      // Website Work (admin + developer only)
      'website_project.created', 'website_project.updated', 'website_project.deleted',
      // Leads
      'lead.uploaded', 'lead.status_changed', 'lead.deleted', 'lead.batch_deleted',
      // Files
      'file.uploaded', 'file.deleted',
      // Reports
      'report.created', 'report.updated',
      // Social
      'social.post_created', 'social.post_updated', 'social.post_deleted',
      // Updates
      'update.posted',
      // Settings
      'settings.updated',
      // Payments & Contracts
      'payment.submitted',
      'payment.approved',
      'payment.rejected',
      'contract.renewed',
      'contract.expired',
    ],
  },

  // Which entity was affected
  entity: {
    type: { type: String }, // 'task' | 'lead' | 'client' | 'user' | 'file' | ...
    id:   { type: mongoose.Schema.Types.ObjectId },
    name: { type: String }, // human-readable label, e.g. task title
  },

  // Optional extra detail (diff / metadata)
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Context
  ip:        { type: String },
  userAgent: { type: String },

}, {
  timestamps: true,
  // Never update logs
  versionKey: false,
});

// Indexes for fast admin timeline queries
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ actor: 1, createdAt: -1 });
activityLogSchema.index({ 'entity.type': 1, 'entity.id': 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

// Auto-purge after 1 year (365 days)
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
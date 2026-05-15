const ActivityLog = require('../models/ActivityLog');

/**
 * logActivity — fire-and-forget audit log writer.
 * Call this after any important mutation. Never awaited in request handlers
 * so it doesn't slow responses, but errors are silently swallowed.
 *
 * @param {Object} opts
 * @param {import('express').Request} opts.req  — to extract actor + IP
 * @param {string}  opts.action                 — ActivityLog.action enum value
 * @param {Object}  [opts.entity]               — { type, id, name }
 * @param {Object}  [opts.meta]                 — any extra diff / metadata
 */
async function logActivity({ req, action, entity = {}, meta = {} }) {
  try {
    const actor = req?.user;
    if (!actor) return; // unauthenticated — skip

    await ActivityLog.create({
      actor:     actor._id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      entity,
      meta,
      ip:        req.ip || req.headers?.['x-forwarded-for'] || '',
      userAgent: req.headers?.['user-agent'] || '',
    });
  } catch (err) {
    // Never break the main request
    console.error('[ActivityLog] write error:', err.message);
  }
}

module.exports = { logActivity };

/**
 * Flowdesk user  →  Attendance-database user.
 *
 * Resolution order (first match wins):
 *   1. An explicit, admin-approved IdentityLink  (authoritative; email is ignored)
 *   2. Exact, case-insensitive e-mail match, ONLY if
 *        - IDENTITY_EMAIL_FALLBACK is not "false"  (default: enabled – this is the
 *          matching rule both original apps already used), AND
 *        - exactly one attendance user has that e-mail, AND
 *        - that attendance user is not explicitly linked to a DIFFERENT Flowdesk user.
 *
 * Never matches on name, never on ObjectId equality, never creates records.
 * Results are cached for a few seconds; any link change clears the cache.
 */
const IdentityLink = require('../models/IdentityLink');
const AttUser = require('../modules/attendance/models/User');

const CACHE_TTL_MS = 20 * 1000;
const cache = new Map();

const emailFallbackEnabled = () => String(process.env.IDENTITY_EMAIL_FALLBACK).toLowerCase() !== 'false';

function clearIdentityCache() { cache.clear(); }

/**
 * @returns {Promise<{ status: 'linked'|'unlinked'|'ambiguous'|'broken_link'|'claimed_by_other',
 *                     source?: 'link'|'email', attUser?: object, reason?: string }>}
 */
async function resolveAttendanceUser(flowdeskUser) {
  const key = String(flowdeskUser._id);
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;

  const value = await _resolve(flowdeskUser);
  cache.set(key, { value, exp: Date.now() + CACHE_TTL_MS });
  return value;
}

async function _resolve(flowdeskUser) {
  const link = await IdentityLink.findOne({ kind: 'attendance_user', flowdeskId: flowdeskUser._id }).lean();
  if (link) {
    const attUser = await AttUser.findById(link.externalId);
    if (!attUser) return { status: 'broken_link', reason: 'The linked attendance account no longer exists.' };
    return { status: 'linked', source: 'link', attUser };
  }

  if (!emailFallbackEnabled()) {
    return { status: 'unlinked', reason: 'No approved link and e-mail matching is disabled.' };
  }

  const email = String(flowdeskUser.email || '').trim().toLowerCase();
  if (!email) return { status: 'unlinked', reason: 'Flowdesk account has no e-mail.' };

  const matches = await AttUser.find({ email }).limit(2);
  if (matches.length === 0) return { status: 'unlinked', reason: 'No attendance account with this e-mail.' };
  if (matches.length > 1) return { status: 'ambiguous', reason: 'More than one attendance account has this e-mail.' };

  const claimed = await IdentityLink.findOne({ kind: 'attendance_user', externalId: matches[0]._id }).lean();
  if (claimed) {
    return { status: 'claimed_by_other', reason: 'This attendance account is explicitly linked to a different Flowdesk user.' };
  }
  return { status: 'linked', source: 'email', attUser: matches[0] };
}

module.exports = { resolveAttendanceUser, clearIdentityCache, emailFallbackEnabled };

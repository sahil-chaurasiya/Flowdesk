/**
 * AI Rate Limiter — FlowDesk
 *
 * Per-user rate limiting for AI assistant requests.
 * Uses a simple in-memory sliding window (no Redis dep).
 * Swap with Redis for production multi-instance deployments.
 *
 * Limits by role:
 *   admin/manager  — 40 requests / 15 min
 *   team members   — 25 requests / 15 min
 *   clients        — 20 requests / 15 min
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const ROLE_LIMITS = {
  admin:                 40,
  manager:               40,
  developer:             40,
  performance_marketer:  25,
  social_media_manager:  25,
  video_editor:          25,
  graphic_designer:      25,
  copywriter:            25,
  client:                20,
};

// In-memory store: userId → [timestamps]
const store = new Map();

// Cleanup old entries every 15 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, timestamps] of store.entries()) {
    const filtered = timestamps.filter(ts => ts > cutoff);
    if (filtered.length === 0) store.delete(key);
    else store.set(key, filtered);
  }
}, WINDOW_MS);

function aiRateLimiter(req, res, next) {
  const userId = req.user?._id?.toString();
  const role   = req.user?.role || 'client';

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const limit  = ROLE_LIMITS[role] || 15;
  const now    = Date.now();
  const cutoff = now - WINDOW_MS;

  const timestamps = (store.get(userId) || []).filter(ts => ts > cutoff);

  if (timestamps.length >= limit) {
    const oldest    = Math.min(...timestamps);
    const resetIn   = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `AI rate limit reached. Try again in ${resetIn} seconds.`,
      retryAfter: resetIn,
      limit,
      remaining: 0,
    });
  }

  timestamps.push(now);
  store.set(userId, timestamps);

  // Expose rate limit info to route handlers
  req.aiRateLimit = {
    limit,
    remaining: limit - timestamps.length,
    resetIn: Math.ceil((Math.min(...timestamps) + WINDOW_MS - now) / 1000),
  };

  next();
}

module.exports = { aiRateLimiter };
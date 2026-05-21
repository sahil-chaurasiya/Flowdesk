const ApiLog = require('../models/ApiLog');

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'passwd', 'pwd'];
const SKIP_PATHS     = ['/api/auth/refresh', '/uploads'];

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    const lo = k.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lo.includes(s))) { out[k] = '[REDACTED]'; }
    else if (v && typeof v === 'object' && !Array.isArray(v)) { out[k] = sanitizeBody(v); }
    else { out[k] = v; }
  }
  return out;
}

const apiLogger = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (SKIP_PATHS.some(p => req.url.startsWith(p))) return next();

  const startAt = process.hrtime();

  res.on('finish', async () => {
    try {
      const diff         = process.hrtime(startAt);
      const responseTime = Math.round(diff[0] * 1000 + diff[1] / 1e6);
      const statusCode   = res.statusCode;
      const ip           =
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress || null;

      const logData = {
        method:       req.method,
        url:          req.originalUrl || req.url,
        statusCode,
        responseTime,
        ip,
        userId:       req.user?._id || null,
        userAgent:    req.headers['user-agent'] || null,
        requestBody:  sanitizeBody(req.body),
        errorMessage: statusCode >= 400 ? (res.locals.errorMessage || null) : null,
        timestamp:    new Date(),
      };

      const saved = await ApiLog.create(logData);

      // ── Broadcast to admin watchers via Socket.io ──────────────────────────
      try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        // Attach user info if present so the client can display it immediately
        const payload = { ...saved.toObject(), userId: req.user
          ? { _id: req.user._id, name: req.user.name, email: req.user.email }
          : null };
        io.emit('api:log', payload);
      } catch (_) {
        // Socket may not be ready during startup — silently ignore
      }
    } catch (_) {
      // Logging must never crash the server
    }
  });

  next();
};

module.exports = apiLogger;
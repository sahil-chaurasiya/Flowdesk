const express = require('express');
const router = express.Router();
const ApiLog = require('../models/ApiLog');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// All routes: admin only
router.use(protect, authorize('admin'));

// ── GET /api/logs ─────────────────────────────────────────────────────────────
// Paginated list with filters
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    method,
    status,       // success | redirect | client-error | server-error
    url,
    dateFrom,
    dateTo,
    userId,
  } = req.query;

  const filter = {};

  if (method && method !== 'ALL') {
    filter.method = method.toUpperCase();
  }

  if (status) {
    const statusMap = {
      'success':      { $gte: 200, $lt: 300 },
      'redirect':     { $gte: 300, $lt: 400 },
      'client-error': { $gte: 400, $lt: 500 },
      'server-error': { $gte: 500, $lt: 600 },
    };
    if (statusMap[status]) filter.statusCode = statusMap[status];
  }

  if (url) {
    filter.url = { $regex: url, $options: 'i' };
  }

  if (dateFrom || dateTo) {
    filter.timestamp = {};
    if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
    if (dateTo)   filter.timestamp.$lte = new Date(dateTo);
  }

  if (userId) {
    filter.userId = userId;
  }

  const pageNum  = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * pageSize;

  const [logs, total] = await Promise.all([
    ApiLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('userId', 'name email role')
      .lean(),
    ApiLog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      pages: Math.ceil(total / pageSize),
    },
  });
}));

// ── GET /api/logs/stats ───────────────────────────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  const now        = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Today totals
  const [
    totalToday,
    errorsToday,
    avgResTime,
    slowestEndpoints,
    topEndpoints,
    errorsByHour,
  ] = await Promise.all([
    // Total requests today
    ApiLog.countDocuments({ timestamp: { $gte: todayStart } }),

    // Error requests today (4xx + 5xx)
    ApiLog.countDocuments({ timestamp: { $gte: todayStart }, statusCode: { $gte: 400 } }),

    // Average response time (last 24h)
    ApiLog.aggregate([
      { $match: { timestamp: { $gte: last24h } } },
      { $group: { _id: null, avg: { $avg: '$responseTime' } } },
    ]),

    // Top 5 slowest endpoints (by avg response time, last 24h)
    ApiLog.aggregate([
      { $match: { timestamp: { $gte: last24h } } },
      {
        $group: {
          _id: { method: '$method', url: '$url' },
          avgTime: { $avg: '$responseTime' },
          count:   { $sum: 1 },
        },
      },
      { $sort: { avgTime: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          method: '$_id.method',
          url:    '$_id.url',
          avgTime: { $round: ['$avgTime', 0] },
          count: 1,
        },
      },
    ]),

    // Top 5 most-called endpoints (last 24h)
    ApiLog.aggregate([
      { $match: { timestamp: { $gte: last24h } } },
      {
        $group: {
          _id: { method: '$method', url: '$url' },
          count:   { $sum: 1 },
          avgTime: { $avg: '$responseTime' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          method: '$_id.method',
          url:    '$_id.url',
          count: 1,
          avgTime: { $round: ['$avgTime', 0] },
        },
      },
    ]),

    // Errors by hour for last 24h (for chart)
    ApiLog.aggregate([
      {
        $match: {
          timestamp:  { $gte: last24h },
          statusCode: { $gte: 400 },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%dT%H:00:00.000Z', date: '$timestamp' },
          },
          errors: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, hour: '$_id', errors: 1 } },
    ]),
  ]);

  const errorRate = totalToday > 0
    ? ((errorsToday / totalToday) * 100).toFixed(1)
    : '0.0';

  const avgResponseTime = avgResTime.length > 0
    ? Math.round(avgResTime[0].avg)
    : 0;

  res.json({
    success: true,
    data: {
      totalToday,
      errorsToday,
      errorRate: parseFloat(errorRate),
      avgResponseTime,
      slowestEndpoints,
      topEndpoints,
      errorsByHour,
    },
  });
}));

// ── DELETE /api/logs ──────────────────────────────────────────────────────────
// Delete logs older than N days
router.delete('/', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10);
  if (!days || days < 1) {
    return res.status(400).json({ success: false, message: 'Provide a valid ?days= parameter (>= 1)' });
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await ApiLog.deleteMany({ timestamp: { $lt: cutoff } });

  res.json({
    success: true,
    message: `Deleted ${result.deletedCount} log entries older than ${days} day(s).`,
    deletedCount: result.deletedCount,
  });
}));

module.exports = router;

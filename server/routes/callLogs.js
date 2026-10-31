const express  = require('express');
const router   = express.Router();
const CallLog  = require('../models/CallLog');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// Only admin + performance_marketer can access
const CALL_ROLES = ['admin', 'performance_marketer'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function dayBounds(dateStr) {
  // dateStr: 'YYYY-MM-DD' or null (→ today)
  const d = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end   = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ── POST /api/call-logs — log a single call ───────────────────────────────────
router.post(
  '/',
  protect,
  authorize(...CALL_ROLES),
  asyncHandler(async (req, res) => {
    const {
      prospectName, prospectPhone, prospectCompany, prospectSource,
      callDate, duration, callType, outcome, notes,
      convertedToLead, leadId,
    } = req.body;

    if (!outcome) {
      return res.status(400).json({ success: false, message: 'outcome is required' });
    }

    const log = await CallLog.create({
      performedBy:     req.user._id,
      prospectName:    prospectName    || '',
      prospectPhone:   prospectPhone   || '',
      prospectCompany: prospectCompany || '',
      prospectSource:  prospectSource  || 'other',
      callDate:        callDate        ? new Date(callDate) : new Date(),
      duration:        duration        || 0,
      callType:        callType        || 'cold_call',
      outcome,
      notes:           notes           || '',
      convertedToLead: !!convertedToLead,
      leadId:          leadId          || null,
    });

    res.status(201).json({ success: true, log });
  })
);

// ── GET /api/call-logs — list with filters ────────────────────────────────────
router.get(
  '/',
  protect,
  authorize(...CALL_ROLES),
  asyncHandler(async (req, res) => {
    const {
      performedBy, outcome, callType,
      from, to,
      page = 1, limit = 50,
    } = req.query;

    const query = {};

    // Admin sees all; PM sees only their own
    if (req.user.role === 'performance_marketer') {
      query.performedBy = req.user._id;
    } else if (performedBy) {
      query.performedBy = performedBy;
    }

    if (outcome)   query.outcome   = outcome;
    if (callType)  query.callType  = callType;

    if (from || to) {
      query.callDate = {};
      if (from) query.callDate.$gte = new Date(from);
      if (to)   query.callDate.$lte = new Date(to);
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await CallLog.countDocuments(query);
    const logs  = await CallLog
      .find(query)
      .populate('performedBy', 'name avatar role')
      .populate('leadId', 'name company stage')
      .sort({ callDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json({ success: true, logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  })
);

// ── GET /api/call-logs/stats — daily / weekly / overview metrics ──────────────
router.get(
  '/stats',
  protect,
  authorize(...CALL_ROLES),
  asyncHandler(async (req, res) => {
    const { performedBy: qPM, date } = req.query;

    // Scope
    const userMatch = {};
    if (req.user.role === 'performance_marketer') {
      userMatch.performedBy = req.user._id;
    } else if (qPM) {
      const { Types } = require('mongoose');
      userMatch.performedBy = new Types.ObjectId(qPM);
    }

    // Today bounds
    const { start: todayStart, end: todayEnd } = dayBounds(date || null);

    // Last 7 days
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    // Last 30 days
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 29);

    const [
      todayStats,
      weekStats,
      outcomeBreakdown,
      daily7,
      callTypeBreakdown,
      conversionRate,
      allTimePMs,
    ] = await Promise.all([

      // Today totals
      CallLog.aggregate([
        { $match: { ...userMatch, callDate: { $gte: todayStart, $lte: todayEnd } } },
        { $group: {
          _id: null,
          total:           { $sum: 1 },
          totalDuration:   { $sum: '$duration' },
          connected:       { $sum: { $cond: [{ $not: [{ $in: ['$outcome', ['no_answer', 'wrong_number', 'voicemail']] }] }, 1, 0] } },
          converted:       { $sum: { $cond: ['$convertedToLead', 1, 0] } },
        }},
      ]),

      // This week totals
      CallLog.aggregate([
        { $match: { ...userMatch, callDate: { $gte: weekStart, $lte: todayEnd } } },
        { $group: {
          _id: null,
          total:         { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          converted:     { $sum: { $cond: ['$convertedToLead', 1, 0] } },
        }},
      ]),

      // Outcome breakdown (last 30 days)
      CallLog.aggregate([
        { $match: { ...userMatch, callDate: { $gte: monthStart, $lte: todayEnd } } },
        { $group: { _id: '$outcome', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Daily call count — last 7 days
      CallLog.aggregate([
        { $match: { ...userMatch, callDate: { $gte: weekStart, $lte: todayEnd } } },
        { $group: {
          _id: {
            year:  { $year:  '$callDate' },
            month: { $month: '$callDate' },
            day:   { $dayOfMonth: '$callDate' },
          },
          total:     { $sum: 1 },
          connected: { $sum: { $cond: [{ $not: [{ $in: ['$outcome', ['no_answer', 'wrong_number', 'voicemail']] }] }, 1, 0] } },
          converted: { $sum: { $cond: ['$convertedToLead', 1, 0] } },
        }},
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]),

      // Call type mix (last 30 days)
      CallLog.aggregate([
        { $match: { ...userMatch, callDate: { $gte: monthStart, $lte: todayEnd } } },
        { $group: { _id: '$callType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Conversion rate (all time / scoped)
      CallLog.aggregate([
        { $match: userMatch },
        { $group: {
          _id: null,
          total:     { $sum: 1 },
          converted: { $sum: { $cond: ['$convertedToLead', 1, 0] } },
        }},
      ]),

      // Admin only: per-PM summary (all time)
      ...(req.user.role === 'admin' ? [
        CallLog.aggregate([
          { $group: {
            _id: '$performedBy',
            total:     { $sum: 1 },
            converted: { $sum: { $cond: ['$convertedToLead', 1, 0] } },
            lastCall:  { $max: '$callDate' },
          }},
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
          { $unwind: { path: '$user', preserveNullAndEmpty: true } },
          { $project: {
            name:      '$user.name',
            avatar:    '$user.avatar',
            total:     1,
            converted: 1,
            lastCall:  1,
          }},
          { $sort: { total: -1 } },
        ]),
      ] : []),
    ]);

    res.json({
      success: true,
      today: todayStats[0] || { total: 0, totalDuration: 0, connected: 0, converted: 0 },
      week:  weekStats[0]  || { total: 0, totalDuration: 0, converted: 0 },
      outcomeBreakdown,
      daily7,
      callTypeBreakdown,
      conversionRate: conversionRate[0] || { total: 0, converted: 0 },
      pmLeaderboard: allTimePMs || [],
    });
  })
);

// ── GET /api/call-logs/:id ────────────────────────────────────────────────────
router.get(
  '/:id',
  protect,
  authorize(...CALL_ROLES),
  asyncHandler(async (req, res) => {
    const log = await CallLog.findById(req.params.id)
      .populate('performedBy', 'name avatar role')
      .populate('leadId', 'name company stage');

    if (!log) return res.status(404).json({ success: false, message: 'Call log not found' });

    // PM can only view own logs
    if (
      req.user.role === 'performance_marketer' &&
      log.performedBy._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.json({ success: true, log });
  })
);

// ── PUT /api/call-logs/:id ────────────────────────────────────────────────────
router.put(
  '/:id',
  protect,
  authorize(...CALL_ROLES),
  asyncHandler(async (req, res) => {
    const log = await CallLog.findById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Call log not found' });

    if (
      req.user.role === 'performance_marketer' &&
      log.performedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const allowed = [
      'prospectName', 'prospectPhone', 'prospectCompany', 'prospectSource',
      'callDate', 'duration', 'callType', 'outcome', 'notes',
      'convertedToLead', 'leadId',
    ];
    allowed.forEach(k => { if (req.body[k] !== undefined) log[k] = req.body[k]; });

    await log.save();
    res.json({ success: true, log });
  })
);

// ── DELETE /api/call-logs/:id ─────────────────────────────────────────────────
router.delete(
  '/:id',
  protect,
  authorize(...CALL_ROLES),
  asyncHandler(async (req, res) => {
    const log = await CallLog.findById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Call log not found' });

    if (
      req.user.role === 'performance_marketer' &&
      log.performedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await log.deleteOne();
    res.json({ success: true, message: 'Deleted' });
  })
);

module.exports = router;

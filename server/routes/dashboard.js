const express = require('express');
const router = express.Router();
const Task   = require('../models/Task');
const Client = require('../models/Client');
const User   = require('../models/User');
const Lead   = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const TEAM_ROLES_ALL = ['admin', 'manager', 'performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];
const TEAM_ROLES     = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

// @route GET /api/dashboard/stats  (existing — unchanged signature)
router.get('/stats', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const [activeClients, tasksByStatus, teamCount, totalLeads, recentTasks] = await Promise.all([
    Client.countDocuments({ status: 'active' }),
    Task.aggregate([
      { $match: { status: { $in: ['pending', 'in_progress', 'review'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    User.countDocuments({ role: { $in: TEAM_ROLES_ALL }, isActive: true }),
    Lead.countDocuments({}),
    Task.find({ status: { $in: ['pending', 'in_progress'] } })
      .sort({ priority: -1, deadline: 1 })
      .limit(5)
      .populate('client', 'company')
      .populate('assignedTo', 'name role')
      .lean()
  ]);

  const byStatus   = tasksByStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
  const openTasks  = (byStatus.pending || 0) + (byStatus.in_progress || 0);
  const reviewTasks = byStatus.review || 0;

  res.json({ success: true, activeClients, openTasks, reviewTasks, teamCount, totalLeads, recentTasks });
}));

// @route GET /api/dashboard/team  (existing — unchanged)
router.get('/team', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const members  = await User.find({ role: { $in: TEAM_ROLES }, isActive: true }).select('name role jobTitle avatar');
  const workload = await Promise.all(members.map(async (member) => {
    const [pending, inProgress, review, completed] = await Promise.all([
      Task.countDocuments({ assignedTo: member._id, status: 'pending' }),
      Task.countDocuments({ assignedTo: member._id, status: 'in_progress' }),
      Task.countDocuments({ assignedTo: member._id, status: 'review' }),
      Task.countDocuments({ assignedTo: member._id, status: 'completed' }),
    ]);
    return { member, pending, inProgress, review, completed, total: pending + inProgress + review };
  }));

  res.json({ success: true, workload });
}));

// ── NEW: Analytics endpoints ──────────────────────────────────────────────────

// @route GET /api/dashboard/analytics/tasks
// Task completion trend over the last N days (default 30)
router.get('/analytics/tasks', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [completedTrend, createdTrend, byCategory, overdue] = await Promise.all([
    // Completed per day
    Task.aggregate([
      { $match: { completedAt: { $gte: since }, status: 'completed' } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // Created per day
    Task.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // By category (all time)
    Task.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // Overdue count
    Task.countDocuments({
      deadline: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] }
    }),
  ]);

  // Fill in missing days
  const dateMap = {};
  for (let d = 0; d < days; d++) {
    const date = new Date(since);
    date.setDate(date.getDate() + d);
    const key = date.toISOString().slice(0, 10);
    dateMap[key] = { date: key, completed: 0, created: 0 };
  }
  completedTrend.forEach(r => { if (dateMap[r._id]) dateMap[r._id].completed = r.count; });
  createdTrend.forEach(r   => { if (dateMap[r._id]) dateMap[r._id].created   = r.count; });
  const trend = Object.values(dateMap);

  res.json({ success: true, trend, byCategory, overdue });
}));

// @route GET /api/dashboard/analytics/leads
// Lead funnel + conversion analytics
router.get('/analytics/leads', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const mongoose = require('mongoose');
  const { clientId } = req.query;

  // Safely build match filter — avoid ObjectId cast errors
  let match = {};
  if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
    match = { client: new mongoose.Types.ObjectId(clientId) };
  }

  const since12Weeks = new Date(Date.now() - 84 * 24 * 3600 * 1000);

  const [byStatus, byQuality, bySource, trend] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Lead.aggregate([
      { $match: match },
      { $group: { _id: '$quality', count: { $sum: 1 } } }
    ]),
    Lead.aggregate([
      { $match: match },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    // Upload trend (last 12 weeks) — use %Y-%m-%d grouped by week via $week arithmetic
    // Use %Y-%m-%d with day-of-week truncation for broad MongoDB compatibility
    Lead.aggregate([
      { $match: { ...match, createdAt: { $gte: since12Weeks } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $dateSubtract: {
                  startDate: '$createdAt',
                  unit: 'day',
                  amount: { $mod: [{ $dayOfWeek: '$createdAt' }, 7] }
                }
              }
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]),
  ]);

  // Funnel order
  const FUNNEL_ORDER = ['new', 'contacted', 'qualified', 'converted', 'lost'];
  const statusMap = byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
  const funnel = FUNNEL_ORDER.map(s => ({ stage: s, count: statusMap[s] || 0 }));
  const total  = byStatus.reduce((sum, s) => sum + s.count, 0);
  const converted = statusMap['converted'] || 0;
  const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';

  res.json({ success: true, funnel, byQuality, bySource, trend, total, conversionRate });
}));

// @route GET /api/dashboard/analytics/productivity
// Per-team-member productivity metrics
router.get('/analytics/productivity', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const members = await User.find({ role: { $in: TEAM_ROLES }, isActive: true })
    .select('name role jobTitle avatar');

  const productivity = await Promise.all(members.map(async (m) => {
    const [total, completed, overdue, inReview] = await Promise.all([
      Task.countDocuments({ assignedTo: m._id }),
      Task.countDocuments({ assignedTo: m._id, status: 'completed', completedAt: { $gte: since } }),
      Task.countDocuments({ assignedTo: m._id, status: { $nin: ['completed', 'cancelled'] }, deadline: { $lt: new Date() } }),
      Task.countDocuments({ assignedTo: m._id, status: 'review' }),
    ]);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { member: m, total, completed, overdue, inReview, completionRate };
  }));

  // Sort by completed desc
  productivity.sort((a, b) => b.completed - a.completed);

  res.json({ success: true, productivity });
}));

module.exports = router;
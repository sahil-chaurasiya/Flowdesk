const express = require('express');
const router  = express.Router();
const Task    = require('../models/Task');
const Client  = require('../models/Client');
const User    = require('../models/User');
const Lead    = require('../models/Lead');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const TEAM_ROLES_ALL = ['admin', 'manager', 'performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];
const TEAM_ROLES     = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

// Helper: return the set of client IDs a manager/admin is scoped to.
// Admins get all; managers get clients where they are accountManager or teamMember.
async function getScopedClientIds(user) {
  if (user.role === 'admin') return null; // null = no restriction
  const clients = await Client.find({
    $or: [{ accountManager: user._id }, { teamMembers: user._id }],
  }).select('_id');
  return clients.map(c => c._id);
}

// @route GET /api/dashboard/stats
router.get('/stats', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const scopedClientIds = await getScopedClientIds(req.user);
  const clientMatch = scopedClientIds ? { client: { $in: scopedClientIds } } : {};

  const [activeClients, tasksByStatus, teamCount, totalLeads, recentTasks] = await Promise.all([
    scopedClientIds
      ? Client.countDocuments({ _id: { $in: scopedClientIds }, status: 'active' })
      : Client.countDocuments({ status: 'active' }),
    Task.aggregate([
      { $match: { ...clientMatch, status: { $in: ['pending', 'in_progress', 'review'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: { $in: TEAM_ROLES_ALL }, isActive: true }),
    scopedClientIds
      ? Lead.countDocuments({ client: { $in: scopedClientIds } })
      : Lead.countDocuments({}),
    Task.find({ ...clientMatch, status: { $in: ['pending', 'in_progress'] } })
      .sort({ priority: -1, deadline: 1 })
      .limit(5)
      .populate('client', 'company')
      .populate('assignedTo', 'name role')
      .lean(),
  ]);

  const byStatus    = tasksByStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
  const openTasks   = (byStatus.pending || 0) + (byStatus.in_progress || 0);
  const reviewTasks = byStatus.review || 0;

  res.json({ success: true, activeClients, openTasks, reviewTasks, teamCount, totalLeads, recentTasks });
}));

// @route GET /api/dashboard/team
router.get('/team', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const scopedClientIds = await getScopedClientIds(req.user);
  const clientMatch = scopedClientIds ? { client: { $in: scopedClientIds } } : {};

  // For managers, only show team members assigned to their clients
  let members;
  if (scopedClientIds) {
    const clientDocs = await Client.find({ _id: { $in: scopedClientIds } })
      .select('teamMembers accountManager');
    const memberIdSet = new Set();
    clientDocs.forEach(c => {
      if (c.accountManager) memberIdSet.add(String(c.accountManager));
      c.teamMembers.forEach(m => memberIdSet.add(String(m)));
    });
    members = await User.find({
      _id: { $in: [...memberIdSet] },
      role: { $in: TEAM_ROLES },
      isActive: true,
    }).select('name role jobTitle avatar');
  } else {
    members = await User.find({ role: { $in: TEAM_ROLES }, isActive: true })
      .select('name role jobTitle avatar');
  }

  const workload = await Promise.all(members.map(async (member) => {
    const taskMatch = { assignedTo: member._id, ...clientMatch };
    const [pending, inProgress, review, completed] = await Promise.all([
      Task.countDocuments({ ...taskMatch, status: 'pending' }),
      Task.countDocuments({ ...taskMatch, status: 'in_progress' }),
      Task.countDocuments({ ...taskMatch, status: 'review' }),
      Task.countDocuments({ ...taskMatch, status: 'completed' }),
    ]);
    return { member, pending, inProgress, review, completed, total: pending + inProgress + review };
  }));

  res.json({ success: true, workload });
}));

// ── Analytics ─────────────────────────────────────────────────────────────────

// @route GET /api/dashboard/analytics/tasks
router.get('/analytics/tasks', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const scopedClientIds = await getScopedClientIds(req.user);
  const clientMatch = scopedClientIds ? { client: { $in: scopedClientIds } } : {};

  const [completedTrend, createdTrend, byCategory, overdue] = await Promise.all([
    Task.aggregate([
      { $match: { ...clientMatch, completedAt: { $gte: since }, status: 'completed' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Task.aggregate([
      { $match: { ...clientMatch, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Task.aggregate([
      { $match: clientMatch },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Task.countDocuments({
      ...clientMatch,
      deadline: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] },
    }),
  ]);

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
router.get('/analytics/leads', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const scopedClientIds = await getScopedClientIds(req.user);

  let match = {};
  if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
    // If manager is scoped, verify they have access to this client
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(clientId));
      if (!hasAccess) return res.json({ success: true, funnel: [], byQuality: [], bySource: [], trend: [], total: 0, conversionRate: '0.0' });
    }
    match = { client: new mongoose.Types.ObjectId(clientId) };
  } else if (scopedClientIds) {
    match = { client: { $in: scopedClientIds } };
  }

  const since12Weeks = new Date(Date.now() - 84 * 24 * 3600 * 1000);

  const [byStatus, byQuality, bySource, trend] = await Promise.all([
    Lead.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$quality', count: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: match },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
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
                  amount: { $mod: [{ $dayOfWeek: '$createdAt' }, 7] },
                },
              },
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]),
  ]);

  const FUNNEL_ORDER = ['new', 'contacted', 'qualified', 'converted', 'lost'];
  const statusMap = byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
  const funnel = FUNNEL_ORDER.map(s => ({ stage: s, count: statusMap[s] || 0 }));
  const total  = byStatus.reduce((sum, s) => sum + s.count, 0);
  const converted = statusMap['converted'] || 0;
  const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';

  res.json({ success: true, funnel, byQuality, bySource, trend, total, conversionRate });
}));

// @route GET /api/dashboard/analytics/productivity
router.get('/analytics/productivity', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const scopedClientIds = await getScopedClientIds(req.user);
  const clientMatch = scopedClientIds ? { client: { $in: scopedClientIds } } : {};

  let members;
  if (scopedClientIds) {
    const clientDocs = await Client.find({ _id: { $in: scopedClientIds } })
      .select('teamMembers accountManager');
    const memberIdSet = new Set();
    clientDocs.forEach(c => {
      if (c.accountManager) memberIdSet.add(String(c.accountManager));
      c.teamMembers.forEach(m => memberIdSet.add(String(m)));
    });
    members = await User.find({
      _id: { $in: [...memberIdSet] },
      role: { $in: TEAM_ROLES },
      isActive: true,
    }).select('name role jobTitle avatar');
  } else {
    members = await User.find({ role: { $in: TEAM_ROLES }, isActive: true })
      .select('name role jobTitle avatar');
  }

  const productivity = await Promise.all(members.map(async (m) => {
    const base = { assignedTo: m._id, ...clientMatch };
    const [total, completed, overdue, inReview] = await Promise.all([
      Task.countDocuments(base),
      Task.countDocuments({ ...base, status: 'completed', completedAt: { $gte: since } }),
      Task.countDocuments({ ...base, status: { $nin: ['completed', 'cancelled'] }, deadline: { $lt: new Date() } }),
      Task.countDocuments({ ...base, status: 'review' }),
    ]);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { member: m, total, completed, overdue, inReview, completionRate };
  }));

  productivity.sort((a, b) => b.completed - a.completed);

  res.json({ success: true, productivity });
}));

module.exports = router;

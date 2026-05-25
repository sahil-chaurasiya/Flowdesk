const express  = require('express');
const router   = express.Router();
const Task     = require('../models/Task');
const Client   = require('../models/Client');
const User     = require('../models/User');
const Lead     = require('../models/Lead');
const InternalLead = require('../models/InternalLead');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const TEAM_ROLES_ALL = ['admin', 'manager', 'performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];
const TEAM_ROLES     = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

// Helper: return the set of client IDs a manager/admin is scoped to.
async function getScopedClientIds(user) {
  if (user.role === 'admin') return null;
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

  const [created, completed] = await Promise.all([
    Task.aggregate([
      { $match: { ...clientMatch, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Task.aggregate([
      { $match: { ...clientMatch, status: 'completed', updatedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const dateSet = new Set([...created.map(d => d._id), ...completed.map(d => d._id)]);
  const createdMap   = created.reduce((a, d)   => { a[d._id] = d.count; return a; }, {});
  const completedMap = completed.reduce((a, d) => { a[d._id] = d.count; return a; }, {});

  const trend = [...dateSet].sort().map(date => ({
    date,
    created:   createdMap[date]   || 0,
    completed: completedMap[date] || 0,
  }));

  res.json({ success: true, trend });
}));

// @route GET /api/dashboard/analytics/leads
router.get('/analytics/leads', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const scopedClientIds = await getScopedClientIds(req.user);

  let match = {};
  if (clientId) {
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

// ── Performance Marketer KPIs ─────────────────────────────────────────────────

// @route GET /api/dashboard/pm/kpis
// @desc  All KPIs for the performance marketer dashboard
// @access admin, performance_marketer
router.get('/pm/kpis', protect, authorize('admin', 'performance_marketer'), asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const now    = new Date();
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Build base query — admins see all, PM sees their own or assigned
  const leadBase = req.user.role === 'admin'
    ? {}
    : { $or: [{ createdBy: userId }, { assignedTo: userId }] };

  const [
    totalLeads,
    byStage,
    newToday,
    overdueFollowUps,
    dealValueAgg,
    lastMonthAgg,
    recentActivity,
    hotLeads,
    overdueLeadsList,
    actionNeeded,
  ] = await Promise.all([
    // Total leads
    InternalLead.countDocuments(leadBase),

    // By stage
    InternalLead.aggregate([
      { $match: leadBase },
      { $group: { _id: '$stage', count: { $sum: 1 }, totalDealValue: { $sum: '$dealValue' } } },
    ]),

    // New today
    InternalLead.countDocuments({ ...leadBase, createdAt: { $gte: today } }),

    // Overdue follow-ups
    InternalLead.countDocuments({
      ...leadBase,
      followUpDate: { $lt: today },
      stage: { $nin: ['won', 'lost'] },
    }),

    // Total pipeline value (open stages)
    InternalLead.aggregate([
      { $match: { ...leadBase, stage: { $nin: ['lost'] } } },
      { $group: { _id: null, total: { $sum: '$dealValue' }, won: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, '$dealValue', 0] } } } },
    ]),

    // Last month won deal value (for comparison)
    InternalLead.aggregate([
      { $match: { ...leadBase, stage: 'won', updatedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      { $group: { _id: null, total: { $sum: '$dealValue' } } },
    ]),

    // Recent stage-change activity (last 10)
    InternalLead.find({
      ...leadBase,
      'activity.0': { $exists: true },
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('name company stage activity updatedAt quality dealValue')
      .lean(),

    // Hot leads needing contact
    InternalLead.find({
      ...leadBase,
      quality: 'hot',
      stage: { $in: ['new', 'contacted'] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name company phone stage followUpDate dealValue')
      .lean(),

    // Overdue follow-up leads (list for action)
    InternalLead.find({
      ...leadBase,
      followUpDate: { $lt: today },
      stage: { $nin: ['won', 'lost'] },
    })
      .sort({ followUpDate: 1 })
      .limit(8)
      .select('name company phone stage followUpDate followUpNote quality dealValue')
      .lean(),

    // Action needed: no follow-up date set and not won/lost
    InternalLead.find({
      ...leadBase,
      followUpDate: null,
      stage: { $nin: ['won', 'lost'] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name company stage quality dealValue createdAt')
      .lean(),
  ]);

  // Stage map
  const stageMap = byStage.reduce((a, s) => { a[s._id] = { count: s.count, dealValue: s.totalDealValue }; return a; }, {});

  const STAGES = ['new', 'contacted', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost'];
  const pipeline = STAGES.map(s => ({
    stage:     s,
    count:     stageMap[s]?.count     || 0,
    dealValue: stageMap[s]?.dealValue || 0,
  }));

  const pipelineValue = dealValueAgg[0]?.total  || 0;
  const wonValue      = dealValueAgg[0]?.won    || 0;
  const lastMonthWon  = lastMonthAgg[0]?.total  || 0;

  const wonCount  = stageMap['won']?.count  || 0;
  const lostCount = stageMap['lost']?.count || 0;
  const openCount = totalLeads - wonCount - lostCount;

  // Conversion rate this month
  const wonThisMonth = await InternalLead.countDocuments({
    ...leadBase,
    stage: 'won',
    updatedAt: { $gte: startOfMonth },
  });
  const totalThisMonth = await InternalLead.countDocuments({
    ...leadBase,
    createdAt: { $gte: startOfMonth },
  });
  const conversionRate = totalThisMonth > 0
    ? ((wonThisMonth / totalThisMonth) * 100).toFixed(1)
    : '0.0';

  // Flatten activity for timeline
  const activityTimeline = recentActivity.flatMap(lead =>
    (lead.activity || []).slice(-2).map(a => ({
      leadId:    lead._id,
      leadName:  lead.name || lead.company,
      stage:     lead.stage,
      quality:   lead.quality,
      action:    a.action,
      fromStage: a.fromStage,
      toStage:   a.toStage,
      note:      a.note,
      at:        a.createdAt,
    }))
  ).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15);

  res.json({
    success: true,
    kpis: {
      totalLeads,
      openLeads:      openCount,
      wonLeads:       wonCount,
      lostLeads:      lostCount,
      newToday,
      overdueFollowUps,
      pipelineValue,
      wonValue,
      lastMonthWon,
      conversionRate,
      wonThisMonth,
    },
    pipeline,
    activityTimeline,
    hotLeads,
    overdueLeads:  overdueLeadsList,
    actionNeeded,
  });
}));

// @route GET /api/dashboard/pm/activity-stats
// @desc  Sales activity counts (calls, emails, meetings, etc.) for performance marketer
// @access admin, performance_marketer
router.get('/pm/activity-stats', protect, authorize('admin', 'performance_marketer'), asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const leadBase = req.user.role === 'admin'
    ? {}
    : { $or: [{ createdBy: userId }, { assignedTo: userId }] };

  // Aggregate activity actions from InternalLead sub-docs
  const activityAgg = await InternalLead.aggregate([
    { $match: leadBase },
    { $unwind: '$activity' },
    { $match: { 'activity.createdAt': { $gte: since } } },
    { $group: { _id: '$activity.action', count: { $sum: 1 } } },
  ]);

  const actMap = activityAgg.reduce((a, x) => { a[x._id] = x.count; return a; }, {});

  // Daily breakdown for trend chart
  const dailyAgg = await InternalLead.aggregate([
    { $match: leadBase },
    { $unwind: '$activity' },
    { $match: { 'activity.createdAt': { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$activity.createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    success: true,
    stats: {
      call_made:         actMap['call_made']         || 0,
      whatsapp_sent:     actMap['whatsapp_sent']     || 0,
      email_sent:        actMap['email_sent']        || 0,
      meeting_scheduled: actMap['meeting_scheduled'] || 0,
      meeting_completed: actMap['meeting_completed'] || 0,
      proposal_sent:     actMap['proposal_sent']     || 0,
      proposal_viewed:   actMap['proposal_viewed']   || 0,
      follow_up_done:    actMap['follow_up_done']    || 0,
      note_added:        actMap['note_added']        || 0,
      stage_changed:     actMap['moved']             || 0,
    },
    daily: dailyAgg,
  });
}));

module.exports = router;

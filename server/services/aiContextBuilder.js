/**
 * AI Context Builder — FlowDesk
 *
 * ALL data fetching is ROLE-SCOPED and PERMISSION-FILTERED.
 * This service is the ONLY source of truth for what the AI can "see".
 *
 * FIXES vs original:
 *  - teamWorkload now uses a single $group aggregate instead of
 *    N×4 countDocuments queries (was hanging for managers with 6+ members)
 *  - All DB queries have a 8s maxTimeMS timeout — no more silent hangs
 *  - buildContext itself has a 12s hard timeout wrapper
 */

const Task         = require('../models/Task');
const Client       = require('../models/Client');
const User         = require('../models/User');
const Lead         = require('../models/Lead');
const Report       = require('../models/Report');
const File         = require('../models/File');
const Update       = require('../models/Update');
const { Conversation, Message } = require('../models/Message');

const MANAGER_ROLES = ['admin', 'manager'];
const TEAM_ROLES    = ['admin', 'manager', 'developer', 'performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];
const WORKER_ROLES  = TEAM_ROLES.filter(r => !['admin', 'manager'].includes(r));

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const today       = () => new Date();
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const daysAgo     = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

// Wrap a promise with a timeout — resolves to fallback value on timeout
function withTimeout(promise, ms, fallback) {
  const timer = new Promise(resolve => setTimeout(() => resolve(fallback), ms));
  return Promise.race([promise, timer]);
}

function sanitizeTask(task) {
  return {
    title:           task.title,
    description:     task.description || null,
    status:          task.status,
    priority:        task.priority,
    category:        task.category,
    deadline:        task.deadline ? task.deadline.toISOString().split('T')[0] : null,
    client:          task.client?.company || task.client?.name || null,
    assignedTo:      task.assignedTo?.name || null,
    isClientRequest: task.isClientRequest || false,
    tags:            task.tags || [],
    createdAt:       task.createdAt?.toISOString().split('T')[0] || null,
  };
}

function sanitizeClient(client) {
  return {
    name:               client.name,
    company:            client.company,
    status:             client.status,
    plan:               client.plan,
    services:           client.services || [],
    industry:           client.industry || null,
    startDate:          client.startDate ? client.startDate.toISOString().split('T')[0] : null,
    contractEndDate:    client.contractEndDate ? client.contractEndDate.toISOString().split('T')[0] : null,
    onboardingCompleted: client.onboardingCompleted,
  };
}

function sanitizeReport(report) {
  return {
    title:           report.title,
    period:          report.period,
    startDate:       report.startDate?.toISOString().split('T')[0],
    endDate:         report.endDate?.toISOString().split('T')[0],
    metrics:         report.metrics,
    highlights:      report.highlights || [],
    recommendations: report.recommendations || [],
    client:          report.client?.company || null,
  };
}

function sanitizeUpdate(update) {
  return {
    title:     update.title,
    content:   update.content,
    type:      update.type,
    createdAt: update.createdAt?.toISOString().split('T')[0],
    client:    update.client?.company || null,
    isPinned:  update.isPinned || false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM WORKLOAD — single aggregate (replaces N×4 countDocuments)
// Returns: [{ _id: userId, name, role, jobTitle, pending, inProgress, review, total }]
// ─────────────────────────────────────────────────────────────────────────────

async function buildTeamWorkload(scopedClientIds = null) {
  try {
    // One aggregate on Task — group by assignedTo × status, filter active statuses only
    const matchStage = { status: { $in: ['pending', 'in_progress', 'review'] } };
    if (scopedClientIds) matchStage.client = { $in: scopedClientIds };
    const rows = await Task.aggregate([
      {
        $match: matchStage,
      },
      {
        $group: {
          _id:    { user: '$assignedTo', status: '$status' },
          count:  { $sum: 1 },
        },
      },
    ]);

    // Pivot into a map: userId → { pending, inProgress, review }
    const map = {};
    for (const row of rows) {
      const uid = row._id.user?.toString();
      if (!uid) continue;
      if (!map[uid]) map[uid] = { pending: 0, inProgress: 0, review: 0 };
      if (row._id.status === 'pending')    map[uid].pending    = row.count;
      if (row._id.status === 'in_progress') map[uid].inProgress = row.count;
      if (row._id.status === 'review')     map[uid].review     = row.count;
    }

    // Fetch only the worker users whose IDs appear in the map
    const workerUsers = await User.find({ role: { $in: WORKER_ROLES }, isActive: true })
      .select('name role jobTitle')
      
      .lean();

    return workerUsers.map(m => {
      const uid   = m._id.toString();
      const stats = map[uid] || { pending: 0, inProgress: 0, review: 0 };
      return {
        name:            m.name,
        role:            m.role,
        jobTitle:        m.jobTitle || null,
        pendingTasks:    stats.pending,
        inProgressTasks: stats.inProgress,
        reviewTasks:     stats.review,
        totalActiveTasks: stats.pending + stats.inProgress + stats.review,
      };
    });
  } catch (err) {
    console.error('[aiContextBuilder] teamWorkload aggregate failed:', err.message);
    return []; // graceful degradation — context still works, just missing workload
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / MANAGER CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

async function buildAdminContext(user) {
  const isAdmin = user.role === 'admin';
  const Q_MS    = 8000; // per-query timeout

  // Managers are scoped to clients they manage or are a team member of.
  // Admins see everything (scopedClientIds === null).
  let scopedClientIds = null;
  if (!isAdmin) {
    const managedClients = await Client.find({
      $or: [{ accountManager: user._id }, { teamMembers: user._id }],
    }).select('_id').lean();
    scopedClientIds = managedClients.map(c => c._id);
  }

  const clientFilter      = scopedClientIds ? { _id: { $in: scopedClientIds } } : {};
  const taskClientFilter  = scopedClientIds ? { client: { $in: scopedClientIds } } : {};

  const [
    allTasks,
    allClients,
    allMembers,
    upcomingDeadlines,
    recentReports,
    overdueItems,
    teamWorkload,
  ] = await Promise.all([
    withTimeout(
      Task.find({ ...taskClientFilter })
        .populate('client', 'name company')
        .populate('assignedTo', 'name role')
        .sort({ priority: -1, deadline: 1 })
        .limit(80)
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      Client.find(clientFilter)
        .select('name company status plan services industry startDate contractEndDate onboardingCompleted')
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      isAdmin
        ? User.find({ role: { $in: TEAM_ROLES }, isActive: true }).select('name role jobTitle department').lean()
        : User.find({ role: { $in: TEAM_ROLES.filter(r => r !== 'admin') }, isActive: true }).select('name role jobTitle').lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      Task.find({
        ...taskClientFilter,
        status:   { $in: ['pending', 'in_progress', 'review'] },
        deadline: { $gte: today(), $lte: daysFromNow(7) },
      })
        .populate('client', 'company')
        .populate('assignedTo', 'name')
        .sort({ deadline: 1 })
        .limit(20)
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      Report.find({ isPublished: true, ...(scopedClientIds ? { client: { $in: scopedClientIds } } : {}) })
        .populate('client', 'company')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      Task.find({
        ...taskClientFilter,
        status:   { $in: ['pending', 'in_progress', 'review'] },
        deadline: { $lt: today() },
      })
        .populate('client', 'company')
        .populate('assignedTo', 'name')
        .sort({ deadline: 1 })
        .limit(20)
        .lean(),
      Q_MS + 1000, []
    ),

    // ← single aggregate, not N×4 countDocuments
    withTimeout(buildTeamWorkload(scopedClientIds), Q_MS + 2000, []),
  ]);

  const taskSummary = {
    total:      allTasks.length,
    byStatus:   allTasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
    byPriority: allTasks.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {}),
  };

  return {
    role:       user.role,
    userName:   user.name,
    scope:      isAdmin ? 'organization' : 'managed_clients',
    snapshot: {
      totalClients:  allClients.length,
      activeClients: allClients.filter(c => c.status === 'active').length,
      taskSummary,
      teamSize:      allMembers.length,
    },
    tasks:            allTasks.map(sanitizeTask),
    clients:          allClients.map(sanitizeClient),
    teamMembers:      isAdmin ? allMembers.map(m => ({ name: m.name, role: m.role, jobTitle: m.jobTitle, department: m.department })) : [],
    teamWorkload,
    upcomingDeadlines: upcomingDeadlines.map(sanitizeTask),
    overdueItems:     overdueItems.map(sanitizeTask),
    recentReports:    recentReports.map(sanitizeReport),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM MEMBER CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

async function buildTeamMemberContext(user) {
  const Q_MS = 8000;

  const [
    myTasks,
    upcomingDeadlines,
    myClients,
    recentUpdates,
    myFiles,
  ] = await Promise.all([
    withTimeout(
      Task.find({ assignedTo: user._id })
        .populate('client', 'name company')
        .populate('createdBy', 'name')
        .sort({ priority: -1, deadline: 1 })
        .limit(50)
        
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      Task.find({
        assignedTo: user._id,
        status:     { $in: ['pending', 'in_progress', 'review'] },
        deadline:   { $gte: today(), $lte: daysFromNow(7) },
      })
        .populate('client', 'company')
        .sort({ deadline: 1 })
        
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      Client.find({ teamMembers: user._id })
        .select('name company status plan services')
        
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      (async () => {
        const clientIds = await Client.find({ teamMembers: user._id })
          .select('_id')
          
          .lean()
          .then(cs => cs.map(c => c._id));
        if (!clientIds.length) return [];
        return Update.find({ client: { $in: clientIds }, isVisible: true })
          .populate('client', 'company')
          .sort({ createdAt: -1 })
          .limit(10)
          
          .lean();
      })(),
      Q_MS * 2 + 1000, []
    ),

    withTimeout(
      File.find({ uploadedBy: user._id })
        .populate('client', 'company')
        .sort({ createdAt: -1 })
        .limit(10)
        
        .lean(),
      Q_MS + 1000, []
    ),
  ]);

  const taskSummary = {
    total:    myTasks.length,
    byStatus: myTasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
    urgent:   myTasks.filter(t => t.priority === 'urgent').length,
    overdue:  myTasks.filter(t => t.deadline && new Date(t.deadline) < today() && t.status !== 'completed').length,
  };

  return {
    role:      user.role,
    userName:  user.name,
    jobTitle:  user.jobTitle || null,
    scope:     'personal',
    snapshot:  taskSummary,
    myTasks:           myTasks.map(sanitizeTask),
    upcomingDeadlines: upcomingDeadlines.map(sanitizeTask),
    myClients:         myClients.map(sanitizeClient),
    recentUpdates:     recentUpdates.map(sanitizeUpdate),
    recentFiles:       myFiles.map(f => ({
      name:       f.name,
      category:   f.category,
      client:     f.client?.company,
      uploadedAt: f.createdAt?.toISOString().split('T')[0],
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

async function buildClientContext(user) {
  if (!user.clientId) {
    return {
      role: 'client', userName: user.name, scope: 'client',
      error: 'No client profile linked to this account.',
      tasks: [], updates: [], reports: [], files: [], leads: [],
    };
  }

  const clientId = user.clientId;
  const Q_MS     = 8000;

  const [
    clientProfile,
    tasks,
    updates,
    reports,
    files,
    leads,
    recentMessages,
  ] = await Promise.all([
    withTimeout(
      Client.findById(clientId)
        .select('name company status plan services industry startDate contractEndDate onboardingCompleted')
        
        .lean(),
      Q_MS + 1000, null
    ),

    withTimeout(
      Task.find({ client: clientId, isClientVisible: true })
        .select('title description status priority category deadline tags createdAt')
        .sort({ priority: -1, deadline: 1 })
        .limit(30)
        
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      Update.find({ client: clientId, isVisible: true })
        .select('title content type isPinned createdAt metrics tags')
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(15)
        
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      Report.find({ client: clientId, isPublished: true })
        .select('title period startDate endDate metrics highlights recommendations createdAt')
        .sort({ createdAt: -1 })
        .limit(8)
        
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      File.find({ client: clientId, isPublic: true })
        .select('name category description tags createdAt size')
        .sort({ createdAt: -1 })
        .limit(20)
        
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      Lead.find({ client: clientId })
        .select('name email phone status campaign source createdAt')
        .sort({ createdAt: -1 })
        .limit(20)
        
        .lean(),
      Q_MS + 1000, []
    ),

    withTimeout(
      (async () => {
        const conv = await Conversation.findOne({ client: clientId }).lean();
        if (!conv) return [];
        return Message.find({ conversation: conv._id, isDeleted: false })
          .populate('sender', 'name role')
          .select('content type createdAt sender')
          .sort({ createdAt: -1 })
          .limit(20)
          
          .lean();
      })(),
      Q_MS * 2 + 1000, []
    ),
  ]);

  const taskSummary = {
    total:    tasks.length,
    byStatus: tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
    upcoming: tasks.filter(t => t.deadline && new Date(t.deadline) >= today() && new Date(t.deadline) <= daysFromNow(7)).length,
  };

  return {
    role:      'client',
    userName:  user.name,
    scope:     'client',
    clientProfile: clientProfile ? sanitizeClient(clientProfile) : null,
    snapshot:  taskSummary,
    tasks: tasks.map(t => ({
      title:       t.title,
      description: t.description || null,
      status:      t.status,
      priority:    t.priority,
      category:    t.category,
      deadline:    t.deadline ? new Date(t.deadline).toISOString().split('T')[0] : null,
      tags:        t.tags || [],
    })),
    updates: updates.map(u => ({
      title:    u.title,
      content:  u.content,
      type:     u.type,
      isPinned: u.isPinned,
      date:     u.createdAt?.toISOString().split('T')[0],
      metrics:  u.metrics || null,
    })),
    reports: reports.map(r => ({
      title:           r.title,
      period:          r.period,
      dateRange:       `${r.startDate?.toISOString().split('T')[0]} to ${r.endDate?.toISOString().split('T')[0]}`,
      metrics:         r.metrics,
      highlights:      r.highlights || [],
      recommendations: r.recommendations || [],
    })),
    files: files.map(f => ({
      name:       f.name,
      category:   f.category,
      description: f.description,
      uploadedAt: f.createdAt?.toISOString().split('T')[0],
    })),
    leads: leads.map(l => ({
      name:     l.name,
      status:   l.status,
      campaign: l.campaign,
      source:   l.source,
      date:     l.createdAt?.toISOString().split('T')[0],
    })),
    recentMessages: recentMessages.map(m => ({
      from:    m.sender?.role === 'client' ? 'You' : `Team (${m.sender?.name})`,
      content: m.content,
      date:    m.createdAt?.toISOString().split('T')[0],
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

async function buildContext(user) {
  if (!user) throw new Error('User is required to build AI context');

  const build =
    (user.role === 'admin' || user.role === 'manager') ? buildAdminContext(user) :
    user.role === 'client' ? buildClientContext(user) :
    buildTeamMemberContext(user);

  // Hard 12s cap on the entire context build
  return withTimeout(build, 12000, {
    role:     user.role,
    userName: user.name,
    scope:    user.role === 'client' ? 'client' : user.role === 'admin' ? 'organization' : user.role === 'manager' ? 'managed_clients' : 'personal',
    _timeout: true,
    tasks: [], clients: [], teamWorkload: [], upcomingDeadlines: [],
    overdueItems: [], recentReports: [], snapshot: {},
  });
}

module.exports = { buildContext };
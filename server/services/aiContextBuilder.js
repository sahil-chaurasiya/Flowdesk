/**
 * AI Context Builder — FlowDesk
 *
 * ALL data fetching is ROLE-SCOPED and PERMISSION-FILTERED.
 * This service is the ONLY source of truth for what the AI can "see".
 * It NEVER exposes raw collections — every query is filtered by:
 *   • user identity (userId)
 *   • organization scope (clientId for clients)
 *   • role-based access rules (admin > manager > team > client)
 *   • visibility flags (isClientVisible, isPublic, etc.)
 *
 * Context is assembled server-side ONLY. The frontend receives no
 * permissions logic and no raw data — only the AI's response.
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
const TEAM_ROLES    = ['admin', 'manager', 'performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const today      = () => new Date();
const startOfDay = (d) => new Date(d.setHours(0, 0, 0, 0));
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const daysAgo    = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

// Sanitize a task for AI consumption — strip internal IDs, keep readable fields
function sanitizeTask(task) {
  return {
    title: task.title,
    description: task.description || null,
    status: task.status,
    priority: task.priority,
    category: task.category,
    deadline: task.deadline ? task.deadline.toISOString().split('T')[0] : null,
    client: task.client?.company || task.client?.name || null,
    assignedTo: task.assignedTo?.name || null,
    isClientRequest: task.isClientRequest || false,
    tags: task.tags || [],
    createdAt: task.createdAt?.toISOString().split('T')[0] || null,
  };
}

function sanitizeClient(client) {
  return {
    name: client.name,
    company: client.company,
    status: client.status,
    plan: client.plan,
    services: client.services || [],
    industry: client.industry || null,
    startDate: client.startDate ? client.startDate.toISOString().split('T')[0] : null,
    contractEndDate: client.contractEndDate ? client.contractEndDate.toISOString().split('T')[0] : null,
    onboardingCompleted: client.onboardingCompleted,
  };
}

function sanitizeReport(report) {
  return {
    title: report.title,
    period: report.period,
    startDate: report.startDate?.toISOString().split('T')[0],
    endDate: report.endDate?.toISOString().split('T')[0],
    metrics: report.metrics,
    highlights: report.highlights || [],
    recommendations: report.recommendations || [],
    client: report.client?.company || null,
  };
}

function sanitizeUpdate(update) {
  return {
    title: update.title,
    content: update.content,
    type: update.type,
    createdAt: update.createdAt?.toISOString().split('T')[0],
    client: update.client?.company || null,
    isPinned: update.isPinned || false,
  };
}

function sanitizeMember(m) {
  return {
    name: m.member?.name || m.name,
    role: m.member?.role || m.role,
    jobTitle: m.member?.jobTitle || m.jobTitle || null,
    pendingTasks: m.pending || 0,
    inProgressTasks: m.inProgress || 0,
    reviewTasks: m.review || 0,
    totalActiveTasks: m.total || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE-SCOPED CONTEXT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin/Manager context — broad org-level visibility
 */
async function buildAdminContext(user) {
  const isAdmin = user.role === 'admin';

  const [
    allTasks,
    allClients,
    allMembers,
    upcomingDeadlines,
    recentReports,
    overdueItems,
    teamWorkload,
  ] = await Promise.all([
    // All org tasks — capped at 80 for prompt size
    Task.find({})
      .populate('client', 'name company')
      .populate('assignedTo', 'name role')
      .sort({ priority: -1, deadline: 1 })
      .limit(80)
      .lean(),

    // All clients
    Client.find({})
      .select('name company status plan services industry startDate contractEndDate onboardingCompleted')
      .lean(),

    // All active team members (never expose passwords/tokens — already excluded)
    isAdmin
      ? User.find({ role: { $in: TEAM_ROLES }, isActive: true })
          .select('name role jobTitle department')
          .lean()
      : User.find({ role: { $in: TEAM_ROLES.filter(r => r !== 'admin') }, isActive: true })
          .select('name role jobTitle')
          .lean(),

    // Deadlines in next 7 days
    Task.find({
      status: { $in: ['pending', 'in_progress', 'review'] },
      deadline: { $gte: today(), $lte: daysFromNow(7) },
    })
      .populate('client', 'company')
      .populate('assignedTo', 'name')
      .sort({ deadline: 1 })
      .limit(20)
      .lean(),

    // Last 10 reports (org-wide)
    Report.find({ isPublished: true })
      .populate('client', 'company')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),

    // Overdue tasks
    Task.find({
      status: { $in: ['pending', 'in_progress', 'review'] },
      deadline: { $lt: today() },
    })
      .populate('client', 'company')
      .populate('assignedTo', 'name')
      .sort({ deadline: 1 })
      .limit(20)
      .lean(),

    // Team workload aggregate
    (async () => {
      const members = await User.find({ role: { $in: TEAM_ROLES.filter(r => !['admin','manager'].includes(r)) }, isActive: true })
        .select('name role jobTitle')
        .lean();
      return Promise.all(members.map(async (member) => {
        const [pending, inProgress, review, completed7d] = await Promise.all([
          Task.countDocuments({ assignedTo: member._id, status: 'pending' }),
          Task.countDocuments({ assignedTo: member._id, status: 'in_progress' }),
          Task.countDocuments({ assignedTo: member._id, status: 'review' }),
          Task.countDocuments({ assignedTo: member._id, status: 'completed', completedAt: { $gte: daysAgo(7) } }),
        ]);
        return { member, pending, inProgress, review, completed7d, total: pending + inProgress + review };
      }));
    })(),
  ]);

  const taskSummary = {
    total: allTasks.length,
    byStatus: allTasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
    byPriority: allTasks.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {}),
  };

  return {
    role: user.role,
    userName: user.name,
    scope: 'organization',
    snapshot: {
      totalClients: allClients.length,
      activeClients: allClients.filter(c => c.status === 'active').length,
      taskSummary,
      teamSize: allMembers.length,
    },
    tasks: allTasks.map(sanitizeTask),
    clients: allClients.map(sanitizeClient),
    teamMembers: isAdmin ? allMembers.map(m => ({ name: m.name, role: m.role, jobTitle: m.jobTitle, department: m.department })) : [],
    teamWorkload: teamWorkload.map(sanitizeMember),
    upcomingDeadlines: upcomingDeadlines.map(sanitizeTask),
    overdueItems: overdueItems.map(sanitizeTask),
    recentReports: recentReports.map(sanitizeReport),
  };
}

/**
 * Team Member context — only their assigned tasks + their client's data
 */
async function buildTeamMemberContext(user) {
  const [
    myTasks,
    upcomingDeadlines,
    myClients,
    recentUpdates,
    myFiles,
  ] = await Promise.all([
    // Only tasks assigned to this user
    Task.find({ assignedTo: user._id })
      .populate('client', 'name company')
      .populate('createdBy', 'name')
      .sort({ priority: -1, deadline: 1 })
      .limit(50)
      .lean(),

    // Their upcoming deadlines
    Task.find({
      assignedTo: user._id,
      status: { $in: ['pending', 'in_progress', 'review'] },
      deadline: { $gte: today(), $lte: daysFromNow(7) },
    })
      .populate('client', 'company')
      .sort({ deadline: 1 })
      .lean(),

    // Clients they are associated with (via teamMembers array)
    Client.find({ teamMembers: user._id })
      .select('name company status plan services')
      .lean(),

    // Recent updates on their clients (only visible ones)
    (async () => {
      const clientIds = (await Client.find({ teamMembers: user._id }).select('_id').lean()).map(c => c._id);
      return Update.find({ client: { $in: clientIds }, isVisible: true })
        .populate('client', 'company')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    })(),

    // Files they uploaded
    File.find({ uploadedBy: user._id })
      .populate('client', 'company')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const taskSummary = {
    total: myTasks.length,
    byStatus: myTasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
    urgent: myTasks.filter(t => t.priority === 'urgent').length,
    overdue: myTasks.filter(t => t.deadline && new Date(t.deadline) < today() && t.status !== 'completed').length,
  };

  return {
    role: user.role,
    userName: user.name,
    jobTitle: user.jobTitle || null,
    scope: 'personal',
    snapshot: taskSummary,
    myTasks: myTasks.map(sanitizeTask),
    upcomingDeadlines: upcomingDeadlines.map(sanitizeTask),
    myClients: myClients.map(sanitizeClient),
    recentUpdates: recentUpdates.map(sanitizeUpdate),
    // Only their own file names — no URLs
    recentFiles: myFiles.map(f => ({ name: f.name, category: f.category, client: f.client?.company, uploadedAt: f.createdAt?.toISOString().split('T')[0] })),
  };
}

/**
 * Client context — strictly scoped to their own clientId ONLY.
 * NEVER sees other clients' data, team internal data, or admin info.
 */
async function buildClientContext(user) {
  // Guard: client users MUST have a clientId
  if (!user.clientId) {
    return {
      role: 'client',
      userName: user.name,
      scope: 'client',
      error: 'No client profile linked to this account.',
      tasks: [],
      updates: [],
      reports: [],
      files: [],
      leads: [],
    };
  }

  const clientId = user.clientId;

  const [
    clientProfile,
    tasks,
    updates,
    reports,
    files,
    leads,
    recentMessages,
  ] = await Promise.all([
    // Only their own client record — no other clients
    Client.findById(clientId)
      .select('name company status plan services industry startDate contractEndDate onboardingCompleted')
      .lean(),

    // Only client-visible tasks for THEIR client
    Task.find({ client: clientId, isClientVisible: true })
      .select('title description status priority category deadline tags createdAt')
      .sort({ priority: -1, deadline: 1 })
      .limit(30)
      .lean(),

    // Only visible updates for their client
    Update.find({ client: clientId, isVisible: true })
      .select('title content type isPinned createdAt metrics tags')
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(15)
      .lean(),

    // Published reports for their client
    Report.find({ client: clientId, isPublished: true })
      .select('title period startDate endDate metrics highlights recommendations createdAt')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),

    // Public files for their client
    File.find({ client: clientId, isPublic: true })
      .select('name category description tags createdAt size')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),

    // Their own leads
    Lead.find({ client: clientId })
      .select('name email phone status campaign source createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),

    // Their recent conversation messages (last 20)
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
  ]);

  const taskSummary = {
    total: tasks.length,
    byStatus: tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
    upcoming: tasks.filter(t => t.deadline && new Date(t.deadline) >= today() && new Date(t.deadline) <= daysFromNow(7)).length,
  };

  return {
    role: 'client',
    userName: user.name,
    scope: 'client',
    clientProfile: clientProfile ? sanitizeClient(clientProfile) : null,
    snapshot: taskSummary,
    tasks: tasks.map(t => ({
      title: t.title,
      description: t.description || null,
      status: t.status,
      priority: t.priority,
      category: t.category,
      deadline: t.deadline ? new Date(t.deadline).toISOString().split('T')[0] : null,
      tags: t.tags || [],
    })),
    updates: updates.map(u => ({
      title: u.title,
      content: u.content,
      type: u.type,
      isPinned: u.isPinned,
      date: u.createdAt?.toISOString().split('T')[0],
      metrics: u.metrics || null,
    })),
    reports: reports.map(r => ({
      title: r.title,
      period: r.period,
      dateRange: `${r.startDate?.toISOString().split('T')[0]} to ${r.endDate?.toISOString().split('T')[0]}`,
      metrics: r.metrics,
      highlights: r.highlights || [],
      recommendations: r.recommendations || [],
    })),
    files: files.map(f => ({ name: f.name, category: f.category, description: f.description, uploadedAt: f.createdAt?.toISOString().split('T')[0] })),
    leads: leads.map(l => ({ name: l.name, status: l.status, campaign: l.campaign, source: l.source, date: l.createdAt?.toISOString().split('T')[0] })),
    recentMessages: recentMessages.map(m => ({
      from: m.sender?.role === 'client' ? 'You' : `Team (${m.sender?.name})`,
      content: m.content,
      date: m.createdAt?.toISOString().split('T')[0],
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: buildContext(user) → role-scoped context object
// ─────────────────────────────────────────────────────────────────────────────

async function buildContext(user) {
  if (!user) throw new Error('User is required to build AI context');

  if (user.role === 'admin' || user.role === 'manager') {
    return buildAdminContext(user);
  }

  if (user.role === 'client') {
    return buildClientContext(user);
  }

  // All other team roles (performance_marketer, social_media_manager, etc.)
  return buildTeamMemberContext(user);
}

module.exports = { buildContext };

const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Client = require('../models/Client');
const User = require('../models/User');
const WebsiteProject = require('../models/WebsiteProject');
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createNotification } = require('../utils/notifications');
const { logActivity } = require('../utils/activityLog');

const NON_CLIENT_ROLES = [...TEAM_ROLES];
// 'developer' gets near-admin oversight of tasks (assign to anyone, edit/
// delete across clients) — see getScopedClientIds below.
const MANAGER_ROLES = ['admin', 'manager', 'developer'];

// Helper: return the set of client IDs a manager/admin is scoped to.
// Admins and developers get null (= no restriction). Managers (PMs) are
// restricted to the clients they're the accountManager or a teamMember for —
// matching the scoping used everywhere else in the app (clients.js,
// dashboard.js, reports.js, etc).
async function getScopedClientIds(user) {
  if (user.role === 'admin' || user.role === 'developer') return null; // no restriction
  const clients = await Client.find({
    $or: [{ accountManager: user._id }, { teamMembers: user._id }],
  }).select('_id');
  return clients.map(c => c._id);
}

// ── Client-only: view and submit their own requests ───────────────────────────

// @route GET /api/tasks/my-requests
router.get('/my-requests', protect, authorize('client'), asyncHandler(async (req, res) => {
  const clientId = req.user.clientId;
  if (!clientId) return res.status(403).json({ success: false, message: 'No client account linked' });

  const tasks = await Task.find({ client: clientId, isClientRequest: true })
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ success: true, tasks });
}));

// @route POST /api/tasks/my-requests
router.post('/my-requests', protect, authorize('client'), asyncHandler(async (req, res) => {
  const clientId = req.user.clientId;
  if (!clientId) return res.status(403).json({ success: false, message: 'No client account linked' });

  const { title, description, priority = 'medium' } = req.body;
  if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

  const task = await Task.create({
    title,
    description,
    priority,
    client: clientId,
    createdBy: req.user._id,
    isClientRequest: true,
    category: 'client_request',
    status: 'pending',
  });

  const populated = await Task.findById(task._id)
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name')
    .lean();

  logActivity({
    req,
    action: 'task.created',
    entity: { type: 'task', id: task._id, name: task.title },
    meta: { isClientRequest: true },
  });

  res.status(201).json({ success: true, task: populated });
}));

// @route GET /api/tasks/mine
// @desc  "My Tasks" feed — tasks assigned to the current user, regardless of
//        role. Unlike GET /api/tasks (which scopes admins/managers/developers
//        to all client tasks), this always filters to `assignedTo: me`, so
//        project managers, developers, and admins see the same personal
//        "My Tasks" experience as any other team member.
// @access Any team role (not client)
router.get('/mine', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const { status, priority, client: clientId, createdBy, dateFrom, dateTo } = req.query;

  const query = { assignedTo: req.user._id };
  if (status)    query.status   = status;
  if (priority)  query.priority = priority;
  if (clientId)  query.client   = clientId;
  if (createdBy) query.createdBy = createdBy;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   query.createdAt.$lte = new Date(dateTo);
  }

  const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  const rawTasks = await Task.find(query)
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name')
    .populate('websiteProject', 'name status')
    .populate('revisions.requestedBy', 'name avatar role')
    .sort({ deadline: 1, createdAt: -1 });

  const tasks = rawTasks.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    const da = a.deadline ? new Date(a.deadline) : Infinity;
    const db = b.deadline ? new Date(b.deadline) : Infinity;
    return da - db;
  });

  res.json({ success: true, tasks, total: tasks.length });
}));

// @route GET /api/tasks/website-projects
// @desc  Lightweight name-only list of Website Work projects, so any task
//        creator can tag a task with the project it belongs to (e.g. when
//        logging a "Need updates" task with category Website Dev). This is
//        intentionally separate from the full /api/website-work section
//        (which stays admin/developer-only) — it only exposes id + name,
//        nothing else about the project.
// @access Any team role (not client)
router.get('/website-projects', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const projects = await WebsiteProject.find().select('name status').sort({ name: 1 }).lean();
  res.json({ success: true, projects });
}));

// @route GET /api/tasks
router.get('/', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const {
    status, priority, category, client,
    clientId: clientIdParam,
    assignedTo, page = 1, search,
    createdBy, dateFrom, dateTo,
  } = req.query;

  // Accept both ?client=<id> and ?clientId=<id>
  const clientId = client || clientIdParam;
  // "Other" is a synthetic filter value (not a real client id) meaning
  // tasks that aren't tied to any client — excludes personal tasks, which
  // also have no client but are a separate concept.
  const isOtherFilter = clientId === 'other';

  const isManager = MANAGER_ROLES.includes(req.user.role);
  const query = {};
  // Website Work tasks used to be excluded from this list entirely. They're
  // now included, but only the ones tied to the current user (created by
  // them or assigned to them) — see the ownership $or pushed into
  // andConditions below. The full Website Work backlog still lives in its
  // own dedicated view (see routes/websiteWork.js).

  if (!isManager) {
    // Team members only see tasks assigned to them
    query.assignedTo = req.user._id;
    // Still allow them to narrow down to a specific client among their own tasks
    if (isOtherFilter) {
      query.client = null;
      query.isPersonal = { $ne: true };
    } else if (clientId) {
      query.client = clientId;
    }
  } else {
    // Admins and managers: scope to their assigned clients
    const scopedClientIds = await getScopedClientIds(req.user);

    if (isOtherFilter) {
      query.client = null;
      query.isPersonal = { $ne: true };
    } else if (clientId) {
      // Verify manager has access to the requested client
      if (scopedClientIds) {
        const hasAccess = scopedClientIds.some(id => String(id) === String(clientId));
        if (!hasAccess) return res.json({ success: true, tasks: [], total: 0, page: 1, pages: 0 });
      }
      query.client = clientId;
    } else if (scopedClientIds) {
      // No specific client requested — scope to managed clients. Website
      // Work tasks have no client, so they're exempted from this clause;
      // their visibility is governed separately below (owned-by-me only).
      query.$or = [
        { client: { $in: scopedClientIds } },
        { isWebsiteWork: true },
      ];
    }
    // Admin with no filter: no restriction (scopedClientIds === null)

    if (assignedTo) query.assignedTo = assignedTo;
  }


  if (status)    query.status    = status;
  if (priority)  query.priority  = priority;
  if (category)  query.category  = category;
  if (search)    query.title     = { $regex: search, $options: 'i' };
  // "Assigned by" filter — who created/assigned the task
  if (createdBy) query.createdBy = createdBy;

  // Monthly / date-range filter — scoped to task creation date, so the
  // person can view "this month's" tasks instead of the entire history.
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   query.createdAt.$lte = new Date(dateTo);
  }

  // Personal tasks (own tasks, no client) are never visible to anyone
  // other than the person who created them — not even other admins.
  const andConditions = [{
    $or: [
      { isPersonal: { $ne: true } },
      { isPersonal: true, createdBy: req.user._id },
    ],
  }];

  // Website Work tasks now show up on this board too, but logically scoped:
  // only the ones *you* created or are assigned to — everyone else's
  // Website Work tasks stay out of your Kanban, same as before. Applies to
  // every role, including admins/managers.
  andConditions.push({
    $or: [
      { isWebsiteWork: { $ne: true } },
      { isWebsiteWork: true, createdBy: req.user._id },
      { isWebsiteWork: true, assignedTo: req.user._id },
    ],
  });

  // Developers get client-scoping like admins/managers (see getScopedClientIds
  // above), but unlike admins/managers they shouldn't see the whole team's
  // workload on the Kanban board — only tasks they're assigned to, or tasks
  // they assigned to someone else.
  if (req.user.role === 'developer') {
    andConditions.push({
      $or: [
        { assignedTo: req.user._id },
        { createdBy: req.user._id },
      ],
    });
  }

  query.$and = andConditions;

  const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  const total = await Task.countDocuments(query);
  const rawTasks = await Task.find(query)
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name')
    .populate('websiteProject', 'name status')
    .populate('revisions.requestedBy', 'name avatar role')
    .sort({ deadline: 1, createdAt: -1 });
  const tasks = rawTasks.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    const da = a.deadline ? new Date(a.deadline) : Infinity;
    const db = b.deadline ? new Date(b.deadline) : Infinity;
    return da - db;
  });

  res.json({ success: true, tasks, total });
}));

// @route POST /api/tasks
router.post('/', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const payload = { ...req.body, createdBy: req.user._id };

  // Empty-string client (e.g. "Select client…" left unselected) would fail
  // ObjectId casting — treat it the same as "no client".
  if (payload.client === '') delete payload.client;

  // The dedicated isWebsiteWork flag is only ever set via routes/websiteWork.js
  // — strip it here so it can't be spoofed through the generic task creation
  // endpoint. The websiteProject *reference*, however, can optionally be
  // attached to a regular task by anyone who can create tasks (e.g. tagging
  // which website project a task relates to, alongside or instead of a
  // client) — this is just a tag, not access to the Website Work section
  // itself, which stays admin/developer-only.
  delete payload.isWebsiteWork;
  if (!payload.websiteProject) {
    delete payload.websiteProject;
  }

  if (payload.isPersonal) {
    // Personal tasks: always private, never tied to a client. Available to
    // everyone who has Kanban access (admin, manager, developer) — not just
    // admins.
    if (!MANAGER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins, project managers, and developers can create personal tasks' });
    }
    delete payload.client;
    payload.isClientVisible = false;
  } else {
    delete payload.isPersonal;

    // Managers: validate they have access to the target client
    if (req.user.role === 'manager' && payload.client) {
      const scopedClientIds = await getScopedClientIds(req.user);
      if (scopedClientIds) {
        const hasAccess = scopedClientIds.some(id => String(id) === String(payload.client));
        if (!hasAccess) {
          return res.status(403).json({ success: false, message: 'Not authorised to create tasks for this client' });
        }
      }
    }
  }

  const task = await Task.create(payload);
  const populated = await Task.findById(task._id)
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name')
    .populate('websiteProject', 'name status');

  // Notify assignee
  if (task.assignedTo && String(task.assignedTo) !== String(req.user._id)) {
    await createNotification(task.assignedTo, {
      type: 'task',
      title: '📋 New Task Assigned',
      body: `"${task.title}" has been assigned to you`,
      link: '/admin/my-tasks'
    });
  }

  logActivity({
    req,
    action: 'task.created',
    entity: { type: 'task', id: task._id, name: task.title },
    meta: { client: populated.client?.company, assignedTo: populated.assignedTo?.name, isPersonal: !!task.isPersonal },
  });

  res.status(201).json({ success: true, task: populated });
}));

// @route PUT /api/tasks/:id
router.put('/:id', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Task not found' });

  // Personal tasks are invisible to everyone except their creator — treat
  // any attempt to touch one by someone else as "not found" rather than
  // leaking that it exists.
  if (existing.isPersonal && String(existing.createdBy) !== String(req.user._id)) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  const isManager = MANAGER_ROLES.includes(req.user.role);

  if (!isManager) {
    if (String(existing.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only update tasks assigned to you' });
    }
    const allowed = ['status', 'actualHours', 'comments'];
    Object.keys(req.body).forEach(key => { if (!allowed.includes(key)) delete req.body[key]; });
  } else if (req.user.role === 'manager') {
    // Managers: verify they have access to this task's client
    const scopedClientIds = await getScopedClientIds(req.user);
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(existing.client));
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not authorised to edit this task' });
      }
    }
  } else if (req.user.role === 'developer') {
    // Developers can fully edit tasks they created or are assigned to, but
    // NOT another developer's (or team member's) task just because they can
    // see the whole board — ownership is required.
    const isOwner = String(existing.createdBy) === String(req.user._id) ||
      (existing.assignedTo && String(existing.assignedTo) === String(req.user._id));
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You can only edit tasks you created or are assigned to' });
    }
  }


  // Empty-string client would fail ObjectId casting — treat as "no client".
  if (req.body.client === '') delete req.body.client;

  // isPersonal can't be flipped after creation via a plain edit — keep the
  // logic simple and avoid a client task suddenly disappearing, or vice versa.
  delete req.body.isPersonal;
  if (existing.isPersonal) delete req.body.client; // personal tasks never get a client

  // The isWebsiteWork flag stays exclusively controlled by routes/websiteWork.js.
  // The websiteProject reference can be edited on a regular task by anyone
  // who can edit the task (same tagging rule as task creation above).
  delete req.body.isWebsiteWork;
  if (req.body.websiteProject === '') {
    req.body.websiteProject = null;
  }

  // Capture the pre-update values before we mutate `existing` below — the
  // status-change / assignment-change comparisons further down need to
  // compare against what it *was*, not what it's about to become.
  const previousStatus = existing.status;
  const previousAssignedTo = existing.assignedTo;

  // Apply the (already filtered/sanitized) updates onto the document itself,
  // then save it — this is what makes the pre('save') hook run, which is
  // what stamps `completedAt` the moment status flips to 'completed'.
  // findByIdAndUpdate() looks equivalent but skips document middleware
  // entirely, so it was silently saving the new status without ever
  // recording completedAt — which is what the Developer Dashboard's
  // activity heatmap and "shipped" counts read from.
  Object.keys(req.body).forEach(key => { existing[key] = req.body[key]; });
  await existing.save();

  const task = await Task.findById(existing._id)
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name')
    .populate('websiteProject', 'name status');

  // Log status change
  if (req.body.status && req.body.status !== previousStatus) {
    logActivity({
      req,
      action: 'task.status_changed',
      entity: { type: 'task', id: task._id, name: task.title },
      meta: { from: previousStatus, to: req.body.status },
    });
  } else if (req.body.assignedTo && String(req.body.assignedTo) !== String(previousAssignedTo)) {
    logActivity({
      req,
      action: 'task.assigned',
      entity: { type: 'task', id: task._id, name: task.title },
      meta: { assignedTo: task.assignedTo?.name },
    });
  } else {
    logActivity({
      req,
      action: 'task.updated',
      entity: { type: 'task', id: task._id, name: task.title },
    });
  }

  // Notify manager when team sends for review
  if (req.body.status === 'review' && previousStatus !== 'review') {
    const managers = await User.find({ role: { $in: MANAGER_ROLES } }).select('_id');
    for (const mgr of managers) {
      await createNotification(mgr._id, {
        type: 'task',
        title: '👀 Task Ready for Review',
        body: `"${task.title}" has been sent for review by ${req.user.name}`,
        link: '/admin/tasks'
      });
    }
    try { req.app.locals.emitEvent?.('task.review_requested', { taskId: task._id, title: task.title, client: task.client?.company, reviewedBy: req.user.name }); } catch {}
  }

  if (req.body.status === 'completed' && previousStatus !== 'completed') {
    try { req.app.locals.emitEvent?.('task.completed', { taskId: task._id, title: task.title, client: task.client?.company, completedBy: req.user.name }); } catch {}
  }

  res.json({ success: true, task });
}));

// @route DELETE /api/tasks/:id
router.delete('/:id', protect, authorize('admin', 'manager', 'developer'), asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Task not found' });

  if (existing.isPersonal && String(existing.createdBy) !== String(req.user._id)) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  // Managers: verify they have access to this task's client
  if (req.user.role === 'manager') {
    const scopedClientIds = await getScopedClientIds(req.user);
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(existing.client));
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not authorised to delete this task' });
      }
    }
  }

  // Developers: only allowed to delete tasks they created or are assigned
  // to — not another developer's (or team member's) task.
  if (req.user.role === 'developer') {
    const isOwner = String(existing.createdBy) === String(req.user._id) ||
      (existing.assignedTo && String(existing.assignedTo) === String(req.user._id));
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You can only delete tasks you created or are assigned to' });
    }
  }

  const task = await Task.findByIdAndDelete(req.params.id);

  logActivity({
    req,
    action: 'task.deleted',
    entity: { type: 'task', id: task._id, name: task.title },
  });

  res.json({ success: true, message: 'Task deleted' });
}));

// @route GET /api/tasks/stats
router.get('/stats', protect, authorize('admin', 'manager', 'developer'), asyncHandler(async (req, res) => {
  const { clientId } = req.query;

  const scopedClientIds = await getScopedClientIds(req.user);

  let match = { isWebsiteWork: { $ne: true } };
  if (clientId) {
    // Verify manager has access to requested client
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(clientId));
      if (!hasAccess) return res.json({ success: true, byStatus: [], byPriority: [], byCategory: [], overdue: 0 });
    }
    match = { client: require('mongoose').Types.ObjectId.createFromHexString(clientId), isWebsiteWork: { $ne: true } };
  } else if (scopedClientIds) {
    match = { client: { $in: scopedClientIds }, isWebsiteWork: { $ne: true } };
  }

  const [byStatus, byPriority, byCategory, overdue, revisionAgg] = await Promise.all([
    Task.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: match }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Task.countDocuments({ ...match, deadline: { $lt: new Date() }, status: { $nin: ['completed', 'cancelled'] } }),
    // Revisions KPI: total revision count across tasks, and how many tasks had at least one revision
    Task.aggregate([
      { $match: match },
      { $group: { _id: null, totalRevisions: { $sum: '$revisionCount' }, tasksWithRevisions: { $sum: { $cond: [{ $gt: ['$revisionCount', 0] }, 1, 0] } } } },
    ]),
  ]);

  const revisions = revisionAgg[0] || { totalRevisions: 0, tasksWithRevisions: 0 };

  res.json({ success: true, byStatus, byPriority, byCategory, overdue, revisions });
}));

// @route POST /api/tasks/:id/revisions
// Team member presses this when the PM asks them to make changes to a task.
// Increments the task's revision counter and stores an optional note.
router.post('/:id/revisions', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const { note } = req.body;

  const existing = await Task.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Task not found' });

  const isManager = MANAGER_ROLES.includes(req.user.role);
  if (!isManager && String(existing.assignedTo) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'You can only log revisions on tasks assigned to you' });
  }

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    {
      $inc: { revisionCount: 1 },
      $push: {
        revisions: {
          note: note?.trim() || '',
          requestedBy: req.user._id,
          statusAtTime: existing.status,
        },
      },
    },
    { new: true, runValidators: true }
  )
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name')
    .populate('revisions.requestedBy', 'name avatar role');

  logActivity({
    req,
    action: 'task.revision_logged',
    entity: { type: 'task', id: task._id, name: task.title },
    meta: { note: note?.trim() || '', revisionCount: task.revisionCount },
  });

  // Notify managers that a change request was logged
  const managers = await User.find({ role: { $in: MANAGER_ROLES } }).select('_id');
  for (const mgr of managers) {
    await createNotification(mgr._id, {
      type: 'task',
      title: '🔄 Revision Logged',
      body: `${req.user.name} logged a change request on "${task.title}" (revision #${task.revisionCount})`,
      link: '/admin/tasks'
    });
  }

  res.json({ success: true, task });
}));

// @route POST /api/tasks/:id/comments
router.post('/:id/comments', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text is required' });

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $push: { comments: { user: req.user._id, text: text.trim() } } },
    { new: true }
  ).populate('comments.user', 'name avatar role');

  logActivity({
    req,
    action: 'task.commented',
    entity: { type: 'task', id: task._id, name: task.title },
  });

  res.json({ success: true, task });
}));

module.exports = router;
const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Client = require('../models/Client');
const User = require('../models/User');
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createNotification } = require('../utils/notifications');
const { logActivity } = require('../utils/activityLog');

const NON_CLIENT_ROLES = [...TEAM_ROLES];
const MANAGER_ROLES = ['admin', 'manager'];

// Helper: return the set of client IDs a manager/admin is scoped to.
// Only admins get null (= no restriction). Managers (PMs) are restricted to
// the clients they're the accountManager or a teamMember for — matching the
// scoping used everywhere else in the app (clients.js, dashboard.js, reports.js, etc).
async function getScopedClientIds(user) {
  if (user.role === 'admin') return null; // no restriction
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

// @route GET /api/tasks
router.get('/', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const {
    status, priority, category, client,
    clientId: clientIdParam,
    assignedTo, page = 1, search
  } = req.query;

  // Accept both ?client=<id> and ?clientId=<id>
  const clientId = client || clientIdParam;

  const isManager = MANAGER_ROLES.includes(req.user.role);
  const query = {};

  if (!isManager) {
    // Team members only see tasks assigned to them
    query.assignedTo = req.user._id;
  } else {
    // Admins and managers: scope to their assigned clients
    const scopedClientIds = await getScopedClientIds(req.user);

    if (clientId) {
      // Verify manager has access to the requested client
      if (scopedClientIds) {
        const hasAccess = scopedClientIds.some(id => String(id) === String(clientId));
        if (!hasAccess) return res.json({ success: true, tasks: [], total: 0, page: 1, pages: 0 });
      }
      query.client = clientId;
    } else {
      // No specific client requested — scope to managed clients
      if (scopedClientIds) {
        query.client = { $in: scopedClientIds };
      }
      // Admin with no filter: no restriction (scopedClientIds === null)
    }

    if (assignedTo) query.assignedTo = assignedTo;
  }

  if (status)   query.status   = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (search)   query.title    = { $regex: search, $options: 'i' };

  // Personal tasks (admin's own, no client) are never visible to anyone
  // other than the person who created them — not even other admins.
  query.$or = [
    { isPersonal: { $ne: true } },
    { isPersonal: true, createdBy: req.user._id },
  ];

  const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  const total = await Task.countDocuments(query);
  const rawTasks = await Task.find(query)
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name')
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

  if (payload.isPersonal) {
    // Personal tasks: admin-only, always private, never tied to a client.
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can create personal tasks' });
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
    .populate('createdBy', 'name');

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
  }

  // Empty-string client would fail ObjectId casting — treat as "no client".
  if (req.body.client === '') delete req.body.client;

  // isPersonal can't be flipped after creation via a plain edit — keep the
  // logic simple and avoid a client task suddenly disappearing, or vice versa.
  delete req.body.isPersonal;
  if (existing.isPersonal) delete req.body.client; // personal tasks never get a client

  const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name');

  // Log status change
  if (req.body.status && req.body.status !== existing.status) {
    logActivity({
      req,
      action: 'task.status_changed',
      entity: { type: 'task', id: task._id, name: task.title },
      meta: { from: existing.status, to: req.body.status },
    });
  } else if (req.body.assignedTo && String(req.body.assignedTo) !== String(existing.assignedTo)) {
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
  if (req.body.status === 'review' && existing.status !== 'review') {
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

  if (req.body.status === 'completed' && existing.status !== 'completed') {
    try { req.app.locals.emitEvent?.('task.completed', { taskId: task._id, title: task.title, client: task.client?.company, completedBy: req.user.name }); } catch {}
  }

  res.json({ success: true, task });
}));

// @route DELETE /api/tasks/:id
router.delete('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
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

  const task = await Task.findByIdAndDelete(req.params.id);

  logActivity({
    req,
    action: 'task.deleted',
    entity: { type: 'task', id: task._id, name: task.title },
  });

  res.json({ success: true, message: 'Task deleted' });
}));

// @route GET /api/tasks/stats
router.get('/stats', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { clientId } = req.query;

  const scopedClientIds = await getScopedClientIds(req.user);

  let match = {};
  if (clientId) {
    // Verify manager has access to requested client
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(clientId));
      if (!hasAccess) return res.json({ success: true, byStatus: [], byPriority: [], byCategory: [], overdue: 0 });
    }
    match = { client: require('mongoose').Types.ObjectId.createFromHexString(clientId) };
  } else if (scopedClientIds) {
    match = { client: { $in: scopedClientIds } };
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
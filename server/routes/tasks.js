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
// Admins get null (= no restriction); managers get only their assigned clients.
async function getScopedClientIds(user) {
  if (user.role === 'admin') return null; // null = no restriction
  const clients = await Client.find({
    $or: [{ accountManager: user._id }, { teamMembers: user._id }],
  }).select('_id');
  return clients.map(c => c._id);
}

// @route GET /api/tasks
router.get('/', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const {
    status, priority, category, client: clientId,
    assignedTo, page = 1, limit = 50, search
  } = req.query;

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

  const total = await Task.countDocuments(query);
  const tasks = await Task.find(query)
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name')
    .sort({ priority: -1, deadline: 1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, tasks, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route POST /api/tasks
router.post('/', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  // Managers: validate they have access to the target client
  if (req.user.role === 'manager' && req.body.client) {
    const scopedClientIds = await getScopedClientIds(req.user);
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(req.body.client));
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not authorised to create tasks for this client' });
      }
    }
  }

  const task = await Task.create({ ...req.body, createdBy: req.user._id });
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
    meta: { client: populated.client?.company, assignedTo: populated.assignedTo?.name },
  });

  res.status(201).json({ success: true, task: populated });
}));

// @route PUT /api/tasks/:id
router.put('/:id', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Task not found' });

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

  const [byStatus, byPriority, byCategory, overdue] = await Promise.all([
    Task.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: match }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Task.countDocuments({ ...match, deadline: { $lt: new Date() }, status: { $nin: ['completed', 'cancelled'] } }),
  ]);

  res.json({ success: true, byStatus, byPriority, byCategory, overdue });
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

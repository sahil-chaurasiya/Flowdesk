const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Client = require('../models/Client');
const User = require('../models/User');
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createNotification } = require('../utils/notifications');

const NON_CLIENT_ROLES = [...TEAM_ROLES]; // all internal roles
const MANAGER_ROLES = ['admin', 'manager'];

// @route GET /api/tasks
// Admin/manager → all tasks (with optional filters)
// Team member   → only their assigned tasks
// Client        → not allowed
router.get('/', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const {
    status, priority, category, client: clientId,
    assignedTo, page = 1, limit = 50, search
  } = req.query;

  const isManager = MANAGER_ROLES.includes(req.user.role);
  const query = {};

  // Team members only see their own tasks
  if (!isManager) {
    query.assignedTo = req.user._id;
  } else {
    if (clientId) query.client = clientId;
    if (assignedTo) query.assignedTo = assignedTo;
  }

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (search) query.title = { $regex: search, $options: 'i' };

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

  res.status(201).json({ success: true, task: populated });
}));

// @route PUT /api/tasks/:id
router.put('/:id', protect, authorize(...NON_CLIENT_ROLES), asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Task not found' });

  const isManager = MANAGER_ROLES.includes(req.user.role);

  // Team members can only update status/actualHours on their own tasks
  if (!isManager) {
    if (String(existing.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only update tasks assigned to you' });
    }
    const allowed = ['status', 'actualHours', 'comments'];
    Object.keys(req.body).forEach(key => {
      if (!allowed.includes(key)) delete req.body[key];
    });
  }

  const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name');

  // Notify manager when team member sends task for review
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
    // Emit automation event
    try { req.app.locals.emitEvent?.('task.review_requested', { taskId: task._id, title: task.title, client: task.client?.company, reviewedBy: req.user.name }); } catch {}
  }

  // Emit task.completed event
  if (req.body.status === 'completed' && existing.status !== 'completed') {
    try { req.app.locals.emitEvent?.('task.completed', { taskId: task._id, title: task.title, client: task.client?.company, completedBy: req.user.name }); } catch {}
  }

  res.json({ success: true, task });
}));

// @route DELETE /api/tasks/:id  (admin/manager only)
router.delete('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
  res.json({ success: true, message: 'Task deleted' });
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

  res.json({ success: true, task });
}));

// @route GET /api/tasks/stats  (admin/manager)
router.get('/stats', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const match = clientId ? { client: require('mongoose').Types.ObjectId.createFromHexString(clientId) } : {};

  const [byStatus, byPriority, byCategory, overdue] = await Promise.all([
    Task.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: match }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Task.countDocuments({ ...match, deadline: { $lt: new Date() }, status: { $nin: ['completed', 'cancelled'] } }),
  ]);

  res.json({ success: true, byStatus, byPriority, byCategory, overdue });
}));

module.exports = router;

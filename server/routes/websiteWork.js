const express = require('express');
const router = express.Router();
const WebsiteProject = require('../models/WebsiteProject');
const Task = require('../models/Task');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createNotification } = require('../utils/notifications');
const { logActivity } = require('../utils/activityLog');

// Everything in this file is restricted to admin + developer. This is the
// section where devs (and admins) create projects and assign/change tasks
// to/for each other and to other team members. Nobody else can see or
// touch any of it.
router.use(protect, authorize('admin', 'developer'));

// ── Projects ────────────────────────────────────────────────────────────────

// @route GET /api/website-work/projects
// @desc  List all Website Work projects with rolled-up task/status-bar stats
router.get('/projects', asyncHandler(async (req, res) => {
  const projects = await WebsiteProject.find()
    .populate('createdBy', 'name avatar role')
    .populate('client', 'name company')
    .sort({ createdAt: -1 })
    .lean();

  const statusAgg = await Task.aggregate([
    { $match: { isWebsiteWork: true } },
    { $group: { _id: { project: '$websiteProject', status: '$status' }, count: { $sum: 1 } } },
  ]);

  const byProject = {};
  statusAgg.forEach(s => {
    const pid = String(s._id.project);
    if (!byProject[pid]) byProject[pid] = {};
    byProject[pid][s._id.status] = s.count;
  });

  const projectsWithStats = projects.map(p => {
    const counts = byProject[String(p._id)] || {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const completed = counts.completed || 0;
    const pending = (counts.pending || 0) + (counts.today || 0);
    return {
      ...p,
      taskStats: {
        total,
        completed,
        inProgress: counts.in_progress || 0,
        review: counts.review || 0,
        pending,
        cancelled: counts.cancelled || 0,
        progress: total ? Math.round((completed / total) * 100) : 0,
      },
    };
  });

  res.json({ success: true, projects: projectsWithStats });
}));

// @route POST /api/website-work/projects
router.post('/projects', asyncHandler(async (req, res) => {
  const { name, description, status, priority, deadline, client } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Project name is required' });

  const project = await WebsiteProject.create({
    name: name.trim(),
    description,
    status,
    priority,
    deadline: deadline || undefined,
    client: client || undefined,
    createdBy: req.user._id,
  });

  const populated = await WebsiteProject.findById(project._id)
    .populate('createdBy', 'name avatar role')
    .populate('client', 'name company');

  logActivity({
    req,
    action: 'website_project.created',
    entity: { type: 'website_project', id: project._id, name: project.name },
  });

  res.status(201).json({ success: true, project: populated });
}));

// @route PUT /api/website-work/projects/:id
// @desc  Any admin or developer can edit any project (including ones
//        created by another developer) — this section is shared/collaborative.
router.put('/projects/:id', asyncHandler(async (req, res) => {
  const allowed = ['name', 'description', 'status', 'priority', 'deadline', 'client'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (updates.client === '') updates.client = null;

  const project = await WebsiteProject.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  })
    .populate('createdBy', 'name avatar role')
    .populate('client', 'name company');

  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  logActivity({
    req,
    action: 'website_project.updated',
    entity: { type: 'website_project', id: project._id, name: project.name },
  });

  res.json({ success: true, project });
}));

// @route DELETE /api/website-work/projects/:id
// @desc  Deletes the project and all of its Website Work tasks.
router.delete('/projects/:id', asyncHandler(async (req, res) => {
  const project = await WebsiteProject.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  await Task.deleteMany({ websiteProject: project._id, isWebsiteWork: true });
  await WebsiteProject.findByIdAndDelete(req.params.id);

  logActivity({
    req,
    action: 'website_project.deleted',
    entity: { type: 'website_project', id: project._id, name: project.name },
  });

  res.json({ success: true, message: 'Project and its tasks deleted' });
}));

// ── Tasks ───────────────────────────────────────────────────────────────────

// @route GET /api/website-work/tasks?project=<id>
router.get('/tasks', asyncHandler(async (req, res) => {
  const { project } = req.query;
  const query = { isWebsiteWork: true };
  if (project) query.websiteProject = project;

  const tasks = await Task.find(query)
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name avatar role')
    .populate('websiteProject', 'name status')
    .sort({ createdAt: -1 });

  res.json({ success: true, tasks });
}));

// @route POST /api/website-work/tasks
// @desc  Create a task under a Website Work project. Can be assigned to
//        ANY team member (not just other developers) — e.g. asking a
//        copywriter for site copy, or a PM to review something.
router.post('/tasks', asyncHandler(async (req, res) => {
  const { title, description, websiteProject, assignedTo, priority, deadline, status } = req.body;
  if (!title?.trim()) return res.status(400).json({ success: false, message: 'Task title is required' });
  if (!websiteProject) return res.status(400).json({ success: false, message: 'A project is required' });

  const project = await WebsiteProject.findById(websiteProject);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  const task = await Task.create({
    title: title.trim(),
    description,
    priority,
    deadline: deadline || undefined,
    status,
    assignedTo: assignedTo || undefined,
    websiteProject,
    isWebsiteWork: true,
    category: 'website_dev',
    createdBy: req.user._id,
  });

  const populated = await Task.findById(task._id)
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name avatar role')
    .populate('websiteProject', 'name status');

  if (task.assignedTo && String(task.assignedTo) !== String(req.user._id)) {
    await createNotification(task.assignedTo, {
      type: 'task',
      title: '🖥️ New Website Work Task',
      body: `"${task.title}" (${project.name}) has been assigned to you`,
      link: '/admin/my-tasks',
    });
  }

  logActivity({
    req,
    action: 'task.created',
    entity: { type: 'task', id: task._id, name: task.title },
    meta: { isWebsiteWork: true, project: project.name, assignedTo: populated.assignedTo?.name },
  });

  res.status(201).json({ success: true, task: populated });
}));

// @route PUT /api/website-work/tasks/:id
// @desc  Any admin or developer can edit or reassign any Website Work task —
//        including tasks created by, or assigned to, a different developer.
router.put('/tasks/:id', asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id);
  if (!existing || !existing.isWebsiteWork) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  const allowed = ['title', 'description', 'status', 'priority', 'deadline', 'assignedTo', 'websiteProject'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (updates.assignedTo === '') updates.assignedTo = null;

  const reassigned = updates.assignedTo && String(updates.assignedTo) !== String(existing.assignedTo || '');

  const task = await Task.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  })
    .populate('assignedTo', 'name avatar role jobTitle')
    .populate('createdBy', 'name avatar role')
    .populate('websiteProject', 'name status');

  if (reassigned && task.assignedTo && String(task.assignedTo._id) !== String(req.user._id)) {
    await createNotification(task.assignedTo._id, {
      type: 'task',
      title: '🖥️ Website Work Task Assigned',
      body: `"${task.title}" has been assigned to you`,
      link: '/admin/my-tasks',
    });
  }

  logActivity({
    req,
    action: req.body.status && req.body.status !== existing.status ? 'task.status_changed' : 'task.updated',
    entity: { type: 'task', id: task._id, name: task.title },
    meta: { isWebsiteWork: true },
  });

  res.json({ success: true, task });
}));

// @route DELETE /api/website-work/tasks/:id
router.delete('/tasks/:id', asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id);
  if (!existing || !existing.isWebsiteWork) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  await Task.findByIdAndDelete(req.params.id);

  logActivity({
    req,
    action: 'task.deleted',
    entity: { type: 'task', id: existing._id, name: existing.title },
    meta: { isWebsiteWork: true },
  });

  res.json({ success: true, message: 'Task deleted' });
}));

module.exports = router;
const express = require('express');
const router = express.Router();
const WebsiteProject = require('../models/WebsiteProject');
const WebsiteCredential = require('../models/WebsiteCredential');
const Task = require('../models/Task');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createNotification } = require('../utils/notifications');
const { logActivity } = require('../utils/activityLog');
const { checkProject } = require('../services/uptimeMonitor');

// ── Credential permission helper ─────────────────────────────────────────────
// Access is per-credential, not per-project, and there is no automatic
// admin bypass: whoever added a credential always has full access to it;
// everyone else — admins included — only gets what's explicitly listed in
// that credential's own `permissions` array (see models/WebsiteCredential.js).
function getCredentialPerms(credential, user) {
  const isOwner = String(credential.addedBy?._id || credential.addedBy) === String(user._id);
  if (isOwner) {
    return { canView: true, canEdit: true, canDelete: true, isOwner: true };
  }
  const entry = (credential.permissions || []).find(
    p => String(p.user?._id || p.user) === String(user._id)
  );
  return {
    canView: !!entry?.canView,
    canEdit: !!entry?.canEdit,
    canDelete: !!entry?.canDelete,
    isOwner: false,
  };
}

// Everything in this file is restricted to admin + developer. This is the
// section where devs (and admins) create projects and assign/change tasks
// to/for each other and to other team members. Nobody else can see or
// touch any of it.
router.use(protect, authorize('admin', 'developer'));

// ── Projects ────────────────────────────────────────────────────────────────

// @route GET /api/website-work/projects
// @desc  List all Website Work projects with rolled-up task/status-bar stats.
//        Pinned projects sort first (by pinOrder), then the rest by newest.
router.get('/projects', asyncHandler(async (req, res) => {
  const { category } = req.query;
  const query = {};
  if (category) query.categories = category;

  const projects = await WebsiteProject.find(query)
    .populate('createdBy', 'name avatar role')
    .populate('client', 'name company')
    .sort({ pinned: -1, pinOrder: 1, createdAt: -1 })
    .lean();

  // Matches by websiteProject presence (not the isWebsiteWork flag) so a
  // task created from the regular Kanban board and tagged to a Website
  // Work project counts toward that project's stats too — same reasoning
  // as the GET /tasks fix above.
  const statusAgg = await Task.aggregate([
    { $match: { websiteProject: { $ne: null } } },
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
  const { name, description, status, priority, deadline, client, categories, repoUrl, adminUrl, liveUrl } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Project name is required' });

  const project = await WebsiteProject.create({
    name: name.trim(),
    description,
    status,
    priority,
    deadline: deadline || undefined,
    client: client || undefined,
    categories: Array.isArray(categories) ? categories : [],
    repoUrl: repoUrl?.trim() || undefined,
    adminUrl: adminUrl?.trim() || undefined,
    liveUrl: liveUrl?.trim() || undefined,
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
// @desc  Developers can edit any Website Work project. Admins can only
//        edit projects they created themselves through this page.
router.put('/projects/:id', asyncHandler(async (req, res) => {
  const existing = await WebsiteProject.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Project not found' });

  if (req.user.role === 'admin' && String(existing.createdBy) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'You can only edit website projects you created' });
  }

  const allowed = ['name', 'description', 'status', 'priority', 'deadline', 'client', 'categories', 'repoUrl', 'adminUrl', 'liveUrl', 'notes'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (updates.client === '') updates.client = null;
  // Scratchpad notes have their own timestamp, separate from the project's
  // general `updatedAt`, so the drawer can show "last edited" for notes
  // specifically without it changing every time the project itself is edited.
  if (updates.notes !== undefined) updates.notesUpdatedAt = new Date();

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
// @desc  Deletes the project and all of its Website Work tasks. Developers
//        can delete any project; admins only ones they created themselves.
router.delete('/projects/:id', asyncHandler(async (req, res) => {
  const project = await WebsiteProject.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  if (req.user.role === 'admin' && String(project.createdBy) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'You can only delete website projects you created' });
  }

  await Task.deleteMany({ websiteProject: project._id, isWebsiteWork: true });
  await WebsiteProject.findByIdAndDelete(req.params.id);

  logActivity({
    req,
    action: 'website_project.deleted',
    entity: { type: 'website_project', id: project._id, name: project.name },
  });

  res.json({ success: true, message: 'Project and its tasks deleted' });
}));

// @route PATCH /api/website-work/projects/:id/pin
// @desc  Toggle a project's pinned state. Newly pinned projects land at the
//        end of the pinned list; unpinning just resets its order.
router.patch('/projects/:id/pin', asyncHandler(async (req, res) => {
  const project = await WebsiteProject.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  project.pinned = !project.pinned;

  if (project.pinned) {
    const highestPinned = await WebsiteProject.findOne({
      pinned: true,
      _id: { $ne: project._id },
    }).sort({ pinOrder: -1 }).lean();
    project.pinOrder = highestPinned ? highestPinned.pinOrder + 1 : 0;
  } else {
    project.pinOrder = 0;
  }

  await project.save();

  const populated = await WebsiteProject.findById(project._id)
    .populate('createdBy', 'name avatar role')
    .populate('client', 'name company');

  logActivity({
    req,
    action: 'website_project.updated',
    entity: { type: 'website_project', id: project._id, name: project.name },
    meta: { pinned: project.pinned },
  });

  res.json({ success: true, project: populated });
}));

// @route PATCH /api/website-work/projects/reorder-pins
// @desc  Persist a new drag-and-drop order for the pinned projects.
router.patch('/projects/reorder-pins', asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ success: false, message: 'orderedIds must be an array' });
  }

  await Promise.all(
    orderedIds.map((id, idx) => WebsiteProject.updateOne({ _id: id, pinned: true }, { pinOrder: idx }))
  );

  res.json({ success: true });
}));

// @route GET /api/website-work/projects/:id/uptime
// @desc  Return a project's current uptime status + recent check history.
//        Lightweight read — no ownership restriction, same as viewing the
//        project itself.
router.get('/projects/:id/uptime', asyncHandler(async (req, res) => {
  const project = await WebsiteProject.findById(req.params.id).select('name liveUrl uptime');
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  res.json({
    success: true,
    liveUrl: project.liveUrl || null,
    uptime: project.uptime || { status: 'unknown', history: [] },
  });
}));

// @route PATCH /api/website-work/projects/:id/check-uptime
// @desc  Ping the project's liveUrl right now instead of waiting for the
//        next scheduled sweep (see index.js). Any admin or developer can
//        trigger this — it's a read-like action, not an edit of the project.
router.patch('/projects/:id/check-uptime', asyncHandler(async (req, res) => {
  const project = await WebsiteProject.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  if (!project.liveUrl?.trim()) {
    return res.status(400).json({ success: false, message: 'This project has no live URL to check' });
  }

  const uptime = await checkProject(project);
  res.json({ success: true, uptime });
}));

// ── Tasks ───────────────────────────────────────────────────────────────────

// @route GET /api/website-work/tasks?project=<id>
// @desc  When a project is given, this returns every task tied to that
//        Website Work project — including ones created from the regular
//        Kanban board by picking the project from its "Website Project"
//        dropdown, not just ones added from this page's own task list.
//        Without a project (used for the dev dashboard overview), it's
//        scoped to tasks explicitly flagged isWebsiteWork.
router.get('/tasks', asyncHandler(async (req, res) => {
  const { project } = req.query;
  const query = project
    ? { websiteProject: project }
    : { isWebsiteWork: true };

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
// @desc  Developers can edit or reassign any Website Work task. Admins can
//        only edit tasks they created or are assigned to — not another
//        admin's task.
router.put('/tasks/:id', asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id);
  if (!existing || !(existing.isWebsiteWork || existing.websiteProject)) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  if (req.user.role === 'admin') {
    const isOwner = String(existing.createdBy) === String(req.user._id) ||
      (existing.assignedTo && String(existing.assignedTo) === String(req.user._id));
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You can only edit website work tasks you created or are assigned to' });
    }
  }

  const allowed = ['title', 'description', 'status', 'priority', 'deadline', 'assignedTo', 'websiteProject'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (updates.assignedTo === '') updates.assignedTo = null;

  const reassigned = updates.assignedTo && String(updates.assignedTo) !== String(existing.assignedTo || '');

  // Keep the pre-update status for the activity-log comparison below, since
  // we're about to overwrite `existing` in place.
  const previousStatus = existing.status;

  // Apply updates onto the document and .save() it — NOT findByIdAndUpdate.
  // findByIdAndUpdate() bypasses the Task model's pre('save') hook, which is
  // what stamps `completedAt` when status flips to 'completed'. Without that
  // timestamp, the task never shows up in the Developer Dashboard's activity
  // heatmap even though its status genuinely is "completed".
  Object.keys(updates).forEach(key => { existing[key] = updates[key]; });
  await existing.save();

  const task = await Task.findById(existing._id)
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
    action: req.body.status && req.body.status !== previousStatus ? 'task.status_changed' : 'task.updated',
    entity: { type: 'task', id: task._id, name: task.title },
    meta: { isWebsiteWork: true },
  });

  res.json({ success: true, task });
}));

// @route DELETE /api/website-work/tasks/:id
// @desc  Developers can delete any Website Work task. Admins can only
//        delete tasks they created or are assigned to.
router.delete('/tasks/:id', asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id);
  if (!existing || !(existing.isWebsiteWork || existing.websiteProject)) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  if (req.user.role === 'admin') {
    const isOwner = String(existing.createdBy) === String(req.user._id) ||
      (existing.assignedTo && String(existing.assignedTo) === String(req.user._id));
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You can only delete website work tasks you created or are assigned to' });
    }
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

// ── Credentials ────────────────────────────────────────────────────────────
// Admin panel / hosting / FTP / domain logins for a project. Access is set
// per credential, by whoever adds it — see getCredentialPerms() above.
// Nobody, including admins, sees a credential unless they added it or were
// explicitly granted access on that specific credential.

// @route GET /api/website-work/projects/:id/credentials
// @desc  Returns only the credentials this user has view access to, each
//        with their own personal permission flags attached as `myPerms`.
router.get('/projects/:id/credentials', asyncHandler(async (req, res) => {
  const project = await WebsiteProject.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  const all = await WebsiteCredential.find({ project: project._id })
    .populate('addedBy', 'name avatar role')
    .populate('permissions.user', 'name avatar role jobTitle')
    .sort({ createdAt: -1 });

  const visible = all
    .map(c => ({ credential: c, perms: getCredentialPerms(c, req.user) }))
    .filter(({ perms }) => perms.canView)
    .map(({ credential, perms }) => ({ ...credential.toObject(), myPerms: perms }));

  res.json({ success: true, credentials: visible });
}));

// @route POST /api/website-work/projects/:id/credentials
// @desc  Any admin/developer with access to Website Work can add a
//        credential (same rule as creating projects/tasks in this file).
//        The adder becomes its owner and can optionally share it with
//        specific teammates right away via `permissions`.
router.post('/projects/:id/credentials', asyncHandler(async (req, res) => {
  const project = await WebsiteProject.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  const { label, platform, url, username, password, notes, permissions } = req.body;
  if (!label?.trim()) return res.status(400).json({ success: false, message: 'A label is required' });

  const cleanPerms = Array.isArray(permissions)
    ? permissions.filter(p => p && p.user).map(p => ({
        user: p.user,
        canView: !!p.canView,
        canEdit: !!p.canEdit,
        canDelete: !!p.canDelete,
      }))
    : [];

  const credential = await WebsiteCredential.create({
    project: project._id,
    label: label.trim(),
    platform: platform || 'other',
    url: url?.trim() || undefined,
    username,
    password,
    notes,
    addedBy: req.user._id,
    permissions: cleanPerms,
  });

  const populated = await WebsiteCredential.findById(credential._id)
    .populate('addedBy', 'name avatar role')
    .populate('permissions.user', 'name avatar role jobTitle');

  logActivity({
    req,
    action: 'website_credential.created',
    entity: { type: 'website_credential', id: credential._id, name: credential.label },
    meta: { project: project.name },
  });

  res.status(201).json({
    success: true,
    credential: { ...populated.toObject(), myPerms: { canView: true, canEdit: true, canDelete: true, isOwner: true } },
  });
}));

// @route PUT /api/website-work/credentials/:id
// @desc  Edit a credential's own fields (label, login details, notes, etc).
//        Requires canEdit — the owner always has it; anyone else needs to
//        have been explicitly granted it.
router.put('/credentials/:id', asyncHandler(async (req, res) => {
  const credential = await WebsiteCredential.findById(req.params.id);
  if (!credential) return res.status(404).json({ success: false, message: 'Credential not found' });

  const perms = getCredentialPerms(credential, req.user);
  if (!perms.canEdit) {
    return res.status(403).json({ success: false, message: 'You do not have permission to edit this credential' });
  }

  const allowed = ['label', 'platform', 'url', 'username', 'password', 'notes'];
  allowed.forEach(f => { if (req.body[f] !== undefined) credential[f] = req.body[f]; });
  await credential.save();

  const populated = await WebsiteCredential.findById(credential._id)
    .populate('addedBy', 'name avatar role')
    .populate('permissions.user', 'name avatar role jobTitle');

  logActivity({
    req,
    action: 'website_credential.updated',
    entity: { type: 'website_credential', id: credential._id, name: credential.label },
  });

  res.json({ success: true, credential: { ...populated.toObject(), myPerms: perms } });
}));

// @route PUT /api/website-work/credentials/:id/access
// @desc  Change who this specific credential is shared with and what they
//        can do with it. Only the credential's owner (whoever added it) can
//        do this — not even an admin who was merely granted canEdit access.
router.put('/credentials/:id/access', asyncHandler(async (req, res) => {
  const credential = await WebsiteCredential.findById(req.params.id);
  if (!credential) return res.status(404).json({ success: false, message: 'Credential not found' });

  const perms = getCredentialPerms(credential, req.user);
  if (!perms.isOwner) {
    return res.status(403).json({ success: false, message: 'Only whoever added this credential can manage who it\'s shared with' });
  }

  const { permissions } = req.body;
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ success: false, message: 'permissions must be an array' });
  }

  credential.permissions = permissions
    .filter(p => p && p.user && String(p.user) !== String(req.user._id))
    .map(p => ({
      user: p.user,
      canView: !!p.canView,
      canEdit: !!p.canEdit,
      canDelete: !!p.canDelete,
    }));

  await credential.save();

  const populated = await WebsiteCredential.findById(credential._id)
    .populate('addedBy', 'name avatar role')
    .populate('permissions.user', 'name avatar role jobTitle');

  logActivity({
    req,
    action: 'website_credential.access_updated',
    entity: { type: 'website_credential', id: credential._id, name: credential.label },
  });

  res.json({ success: true, credential: { ...populated.toObject(), myPerms: { canView: true, canEdit: true, canDelete: true, isOwner: true } } });
}));

// @route DELETE /api/website-work/credentials/:id
router.delete('/credentials/:id', asyncHandler(async (req, res) => {
  const credential = await WebsiteCredential.findById(req.params.id);
  if (!credential) return res.status(404).json({ success: false, message: 'Credential not found' });

  const perms = getCredentialPerms(credential, req.user);
  if (!perms.canDelete) {
    return res.status(403).json({ success: false, message: 'You do not have permission to delete this credential' });
  }

  await WebsiteCredential.findByIdAndDelete(req.params.id);

  logActivity({
    req,
    action: 'website_credential.deleted',
    entity: { type: 'website_credential', id: credential._id, name: credential.label },
  });

  res.json({ success: true, message: 'Credential deleted' });
}));

module.exports = router;
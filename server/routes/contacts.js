const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const ContactProject = require('../models/ContactProject');
const CalendarEvent = require('../models/CalendarEvent');
const Client = require('../models/Client');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route GET /api/contacts
// Visible to every team member. Every contact is visible to the entire
// team regardless of who added it — no per-contact visibility
// restrictions.
router.get('/', protect, authorize('team'), asyncHandler(async (req, res) => {
  const { search, field, gender, isActive, minFollowers, maxFollowers, page = 1, limit = 50 } = req.query;
  const query = {};

  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (field) query.field = field;
  if (gender) query.gender = gender;

  if (minFollowers !== undefined || maxFollowers !== undefined) {
    query.followers = {};
    if (minFollowers !== undefined && minFollowers !== '') query.followers.$gte = Number(minFollowers);
    if (maxFollowers !== undefined && maxFollowers !== '') query.followers.$lte = Number(maxFollowers);
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
      { field: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Contact.countDocuments(query);
  const contacts = await Contact.find(query)
    .populate('addedBy', 'name role')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, contacts, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route POST /api/contacts
// Any team member can add a contact. Contacts are visible to the whole
// team by default — there's no per-contact visibility restriction.
router.post('/', protect, authorize('team'), asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.gender === '') delete body.gender;
  const contact = await Contact.create({ ...body, addedBy: req.user._id });
  const populated = await contact.populate({ path: 'addedBy', select: 'name role' });
  res.status(201).json({ success: true, contact: populated });
}));

// @route PUT /api/contacts/:id
// Admins can edit any contact. Everyone else can only edit contacts they
// added themselves.
router.put('/:id', protect, authorize('team'), asyncHandler(async (req, res) => {
  const existing = await Contact.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Contact not found' });

  const canEdit = req.user.role === 'admin' || existing.addedBy?.toString() === req.user._id.toString();
  if (!canEdit) {
    return res.status(403).json({ success: false, message: 'You can only edit contacts you added' });
  }

  const body = { ...req.body };
  if (body.gender === '') body.gender = undefined;
  const contact = await Contact.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
    .populate('addedBy', 'name role');
  res.json({ success: true, contact });
}));

// @route DELETE /api/contacts/:id
// Kept admin-only for now — deleting is destructive and wasn't part of the
// requested change.
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  // Clean up this contact's project history so nothing is left orphaned.
  const projects = await ContactProject.find({ contact: req.params.id }).select('calendarEvent');
  const eventIds = projects.map(p => p.calendarEvent).filter(Boolean);
  if (eventIds.length) await CalendarEvent.deleteMany({ _id: { $in: eventIds } });
  await ContactProject.deleteMany({ contact: req.params.id });
  await Contact.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Contact deleted' });
}));

// ════════════════════════════════════════════════════════════════════════════
//  CONTACT DETAIL + PROJECTS (work history, payments, reviews)
// ════════════════════════════════════════════════════════════════════════════

const canManageMoney = (user) => ['admin', 'manager'].includes(user.role);
const canEditProject = (user, project) =>
  canManageMoney(user) || project.createdBy?.toString() === user._id.toString();

const PROJECT_POPULATE = [
  { path: 'client', select: 'name company' },
  { path: 'createdBy', select: 'name role' },
  { path: 'payments.recordedBy', select: 'name' },
];

// Project type → team-calendar event type / shoot subtype
const SHOOT_TYPES = ['photo_shoot', 'video_shoot', 'reel_shoot', 'product_shoot', 'event_shoot'];
const CAL_STATUS = { upcoming: 'scheduled', in_progress: 'in_progress', completed: 'done', cancelled: 'cancelled' };

function calendarFieldsFor(project, contactName) {
  const isShoot = SHOOT_TYPES.includes(project.type);
  const start = new Date(project.startDate);
  const end = project.endDate ? new Date(project.endDate) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    title: `${contactName} — ${project.title}`.slice(0, 200),
    description: project.description || '',
    startDate: start,
    endDate: end < start ? start : end,
    type: isShoot ? 'shoot' : (project.type === 'influencer_collab' ? 'campaign' : 'other'),
    shootSubtype: isShoot ? project.type : null,
    status: CAL_STATUS[project.status] || 'scheduled',
    isReady: project.status === 'completed',
    isCompleted: project.status === 'completed',
    client: project.client || null,
  };
}

// Best-effort: calendar problems must never break saving a project.
async function syncCalendar(project, contactName, user, { create = false } = {}) {
  try {
    if (project.calendarEvent) {
      const ev = await CalendarEvent.findById(project.calendarEvent);
      if (!ev) { project.calendarEvent = null; await project.save(); return; }
      ev.set(calendarFieldsFor(project, contactName));
      await ev.save();
    } else if (create) {
      const ev = await CalendarEvent.create({
        ...calendarFieldsFor(project, contactName),
        visibility: 'all',
        createdBy: user._id,
      });
      project.calendarEvent = ev._id;
      await project.save();
    }
  } catch (err) {
    console.error('[ContactProject] calendar sync failed:', err.message);
  }
}

// Resolve `client` + snapshot `clientName` from the request body.
async function resolveClient(body) {
  const out = {};
  if (body.client) {
    const c = await Client.findById(body.client).select('name company');
    if (c) { out.client = c._id; out.clientName = c.company || c.name; }
    else { out.client = null; }
  } else if ('client' in body) {
    out.client = null;
    out.clientName = (body.clientName || '').trim();
  }
  return out;
}

function buildStats(projects) {
  const stats = {
    totalProjects: projects.length,
    completed: 0, upcoming: 0, cancelled: 0,
    totalValue: 0, totalPaid: 0, totalPending: 0,
    ratingCount: 0, avgRating: null,
    rehireYes: 0, rehireTotal: 0,
    tagCounts: {},
    clients: [],
    nextProject: null, lastWorked: null,
  };
  let ratingSum = 0;
  const clientMap = new Map();

  projects.forEach(p => {
    if (p.status === 'completed') stats.completed += 1;
    else if (p.status === 'cancelled') stats.cancelled += 1;
    else stats.upcoming += 1;

    if (p.status !== 'cancelled') stats.totalValue += p.fee || 0;
    stats.totalPaid += p.paidAmount;
    stats.totalPending += p.pendingAmount;

    if (p.rating) { stats.ratingCount += 1; ratingSum += p.rating; }
    if (typeof p.wouldRehire === 'boolean') {
      stats.rehireTotal += 1;
      if (p.wouldRehire) stats.rehireYes += 1;
    }
    (p.reviewTags || []).forEach(t => { stats.tagCounts[t] = (stats.tagCounts[t] || 0) + 1; });

    const key = p.client?._id?.toString() || (p.clientName ? `name:${p.clientName.toLowerCase()}` : null);
    if (key && p.status !== 'cancelled') {
      const cur = clientMap.get(key) || {
        _id: p.client?._id || null,
        name: p.client?.company || p.client?.name || p.clientName,
        count: 0,
      };
      cur.count += 1;
      clientMap.set(key, cur);
    }
  });

  stats.avgRating = stats.ratingCount ? Math.round((ratingSum / stats.ratingCount) * 10) / 10 : null;
  stats.clients = [...clientMap.values()].sort((a, b) => b.count - a.count);

  const now = Date.now();
  const active = projects.filter(p => p.status === 'upcoming' || p.status === 'in_progress');
  const futureOrOpen = active.filter(p => new Date(p.startDate).getTime() >= now).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  stats.nextProject = (futureOrOpen[0] || active.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0] || null)?._id || null;
  const done = projects.filter(p => p.status === 'completed').sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  stats.lastWorked = done[0]?.startDate || null;
  return stats;
}

// @route GET /api/contacts/:id — full profile: contact + every project + rolled-up stats
router.get('/:id', protect, authorize('team'), asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id).populate('addedBy', 'name role');
  if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });

  const projects = await ContactProject.find({ contact: contact._id })
    .populate(PROJECT_POPULATE)
    .sort({ startDate: -1 });

  res.json({ success: true, contact, projects, stats: buildStats(projects) });
}));

// @route GET /api/contacts/:id/projects/:projectId — one project (with its contact)
router.get('/:id/projects/:projectId', protect, authorize('team'), asyncHandler(async (req, res) => {
  const project = await ContactProject.findOne({ _id: req.params.projectId, contact: req.params.id })
    .populate(PROJECT_POPULATE);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  const contact = await Contact.findById(req.params.id).select('name field phone currency paymentMethod rateAmount rateType');
  res.json({ success: true, project, contact });
}));

// @route POST /api/contacts/:id/projects — book a contact for a project
router.post('/:id/projects', protect, authorize('team'), asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);
  if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });

  const b = req.body;
  const clientFields = await resolveClient({ client: b.client, clientName: b.clientName });

  const project = await ContactProject.create({
    contact: contact._id,
    title: b.title,
    type: b.type || 'other',
    description: b.description,
    deliverables: b.deliverables,
    ...clientFields,
    startDate: b.startDate,
    endDate: b.endDate || undefined,
    location: b.location,
    status: ['upcoming', 'in_progress'].includes(b.status) ? b.status : 'upcoming',
    fee: Number(b.fee) || 0,
    createdBy: req.user._id,
  });

  if (b.addToCalendar) await syncCalendar(project, contact.name, req.user, { create: true });

  const populated = await ContactProject.findById(project._id).populate(PROJECT_POPULATE);
  res.status(201).json({ success: true, project: populated });
}));

// @route PUT /api/contacts/:id/projects/:projectId — edit details / change status / save review
router.put('/:id/projects/:projectId', protect, authorize('team'), asyncHandler(async (req, res) => {
  const project = await ContactProject.findOne({ _id: req.params.projectId, contact: req.params.id });
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  if (!canEditProject(req.user, project)) {
    return res.status(403).json({ success: false, message: 'You can only edit projects you added' });
  }

  const b = req.body;
  ['title', 'type', 'description', 'deliverables', 'location', 'startDate'].forEach(k => {
    if (b[k] !== undefined) project[k] = b[k];
  });
  if (b.endDate !== undefined) project.endDate = b.endDate || undefined;
  if (b.fee !== undefined) project.fee = Number(b.fee) || 0;

  if ('client' in b || 'clientName' in b) {
    const c = await resolveClient({ client: b.client, clientName: b.clientName });
    if (c.client !== undefined) project.client = c.client;
    if (c.clientName !== undefined) project.clientName = c.clientName;
  }

  if (b.status !== undefined && b.status !== project.status) {
    project.status = b.status;
    project.completedAt = b.status === 'completed' ? new Date() : undefined;
  }

  // Review fields — only meaningful on completed work
  const touchesReview = ['rating', 'reviewNote', 'reviewTags', 'wouldRehire'].some(k => b[k] !== undefined);
  if (touchesReview) {
    if (project.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'You can only review a project once it is completed' });
    }
    if (b.rating !== undefined) project.rating = b.rating ? Number(b.rating) : undefined;
    if (b.reviewNote !== undefined) project.reviewNote = b.reviewNote;
    if (b.reviewTags !== undefined) project.reviewTags = Array.isArray(b.reviewTags) ? b.reviewTags : [];
    if (b.wouldRehire !== undefined) project.wouldRehire = b.wouldRehire === null ? undefined : !!b.wouldRehire;
    project.reviewedAt = new Date();
    project.reviewedBy = req.user._id;
  }

  await project.save();

  const contact = await Contact.findById(req.params.id).select('name');
  await syncCalendar(project, contact?.name || 'Contact', req.user, { create: !!b.addToCalendar });

  const populated = await ContactProject.findById(project._id).populate(PROJECT_POPULATE);
  res.json({ success: true, project: populated });
}));

// @route DELETE /api/contacts/:id/projects/:projectId
router.delete('/:id/projects/:projectId', protect, authorize('team'), asyncHandler(async (req, res) => {
  const project = await ContactProject.findOne({ _id: req.params.projectId, contact: req.params.id });
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  if (!canEditProject(req.user, project)) {
    return res.status(403).json({ success: false, message: 'You can only delete projects you added' });
  }
  if (project.calendarEvent) await CalendarEvent.findByIdAndDelete(project.calendarEvent).catch(() => {});
  await project.deleteOne();
  res.json({ success: true, message: 'Project deleted' });
}));

// @route POST /api/contacts/:id/projects/:projectId/payments — record a payment made to the contact
// Money movement is limited to admins and managers.
router.post('/:id/projects/:projectId/payments', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const project = await ContactProject.findOne({ _id: req.params.projectId, contact: req.params.id });
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  const { amount, paidAt, method, reference, note } = req.body;
  project.payments.push({
    amount: Number(amount),
    paidAt: paidAt || new Date(),
    method, reference, note,
    recordedBy: req.user._id,
  });
  await project.save();

  const populated = await ContactProject.findById(project._id).populate(PROJECT_POPULATE);
  res.status(201).json({ success: true, project: populated });
}));

// @route DELETE /api/contacts/:id/projects/:projectId/payments/:paymentId
router.delete('/:id/projects/:projectId/payments/:paymentId', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const project = await ContactProject.findOne({ _id: req.params.projectId, contact: req.params.id });
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  const payment = project.payments.id(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
  payment.deleteOne();
  await project.save();

  const populated = await ContactProject.findById(project._id).populate(PROJECT_POPULATE);
  res.json({ success: true, project: populated });
}));

module.exports = router;
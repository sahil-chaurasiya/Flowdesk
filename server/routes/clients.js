const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const User = require('../models/User');
const Task = require('../models/Task');
const Update = require('../models/Update');
const Report = require('../models/Report');
const File = require('../models/File');
const Lead = require('../models/Lead');
const { SocialPost } = require('../models/SocialPost');
const CalendarEvent = require('../models/CalendarEvent');
const { Conversation } = require('../models/Message');
const Document = require('../models/Document');
const Credential = require('../models/Credential');
const ClientTarget = require('../models/ClientTarget');
const PaymentVerification = require('../models/PaymentVerification');
const RenewalHistory = require('../models/RenewalHistory');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { getUploader, cloudinary, getFileUrl } = require('../config/cloudinary');
const { sendClientWelcomeMessages } = require('../utils/messaging');
const { logActivity } = require('../utils/activityLog');

// ── Helper: calculate contractEndDate from startDate + planDuration ───────────
// Called on create AND update so the field is always in sync.
function calcContractEndDate(startDate, planDuration) {
  if (!startDate || !planDuration) return null;
  const d = new Date(startDate);
  if (planDuration === '3_months') d.setMonth(d.getMonth() + 3);
  else if (planDuration === '6_months') d.setMonth(d.getMonth() + 6);
  else if (planDuration === '1_year') d.setFullYear(d.getFullYear() + 1);
  else return null; // unknown duration — don't overwrite
  return d;
}

function deriveContractStatus(endDate) {
  if (!endDate) return 'active';
  const days = Math.ceil((new Date(endDate) - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'active';
}

// ── Map legacy plan values to planDuration if planDuration not supplied ────────
const PLAN_TO_DURATION = {
  '3_month':  '3_months',
  '6_month':  '6_months',
  '1_year':   '1_year',
  '3_months': '3_months',
  '6_months': '6_months',
};

// @route GET /api/clients
router.get('/', protect, asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20, managerId } = req.query;
  const query = {};

  if (req.user.role === 'client') {
    query._id = req.user.clientId;
  } else if (!['admin', 'manager', 'client'].includes(req.user.role)) {
    query.$or = [{ accountManager: req.user._id }, { teamMembers: req.user._id }];
  } else if (req.user.role === 'manager') {
    if (managerId) query.accountManager = managerId;
    else query.$or = [{ accountManager: req.user._id }, { teamMembers: req.user._id }];
  }

  if (status) query.status = status;
  if (search) {
    const searchOr = [
      { name: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchOr }];
      delete query.$or;
    } else {
      query.$or = searchOr;
    }
  }

  const total = await Client.countDocuments(query);
  const clients = await Client.find(query)
    .populate('accountManager', 'name email avatar jobTitle')
    .populate('teamMembers', 'name email avatar jobTitle')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, clients, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route POST /api/clients
router.post('/', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const body = { ...req.body };

  // Resolve planDuration — form sends `plan` (legacy), map it if needed
  if (!body.planDuration && body.plan) {
    body.planDuration = PLAN_TO_DURATION[body.plan] || '3_months';
  }

  // Auto-calculate contractEndDate
  const base = body.startDate ? new Date(body.startDate) : new Date();
  const endDate = calcContractEndDate(base, body.planDuration);
  if (endDate) {
    body.contractEndDate = endDate;
    body.contractStatus  = deriveContractStatus(endDate);
  }

  const client = await Client.create(body);

  // If createPortalUser is requested, create a linked user
  if (req.body.createPortalUser && req.body.portalEmail) {
    const portalPassword = req.body.portalPassword || 'ClientPass123!';
    const user = await User.create({
      name: client.name,
      email: req.body.portalEmail,
      password: portalPassword,
      role: 'client',
      clientId: client._id
    });
    client.linkedUserId = user._id;
    await client.save();

    // Send welcome email + WhatsApp only when credentials are actually created
    try {
      await sendClientWelcomeMessages({
        client,
        portalEmail: req.body.portalEmail,
        portalPassword,
      });
    } catch (err) {
      // Non-fatal — client is already created, just log the failure
      console.error('[Messaging] Failed to send welcome messages:', err.message || err);
    }
  }

  const populated = await Client.findById(client._id)
    .populate('accountManager', 'name email avatar')
    .populate('teamMembers', 'name email avatar');

  res.status(201).json({ success: true, client: populated });
}));

// @route GET /api/clients/stats
router.get('/stats/overview', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const [totalClients, activeClients, pendingTasks, completedTasks] = await Promise.all([
    Client.countDocuments(),
    Client.countDocuments({ status: 'active' }),
    Task.countDocuments({ status: { $in: ['pending', 'in_progress'] } }),
    Task.countDocuments({ status: 'completed' })
  ]);

  const clientsByStatus = await Client.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const clientsByPlan = await Client.aggregate([
    { $group: { _id: '$plan', count: { $sum: 1 } } }
  ]);

  const recentClients = await Client.find()
    .populate('accountManager', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(5)
    .select('name company status plan startDate accountManager');

  res.json({
    success: true,
    stats: { totalClients, activeClients, pendingTasks, completedTasks },
    clientsByStatus,
    clientsByPlan,
    recentClients
  });
}));

// @route GET /api/clients/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  if (req.user.role === 'client' && String(req.user.clientId) !== req.params.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const client = await Client.findById(req.params.id)
    .populate('accountManager', 'name email avatar jobTitle phone')
    .populate('teamMembers', 'name email avatar jobTitle')
    .populate('linkedUserId', 'name email lastLogin');

  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

  res.json({ success: true, client });
}));

// @route PUT /api/clients/:id
router.put('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const body = { ...req.body };

  // If plan or planDuration or startDate changed, recalculate contractEndDate
  // (but only if this isn't a contract-only update — payments route handles that separately)
  if (!body.contractEndDate && (body.planDuration || body.plan || body.startDate)) {
    // Fetch current client to fill any missing fields
    const existing = await Client.findById(req.params.id).lean();
    if (existing) {
      if (!body.planDuration && body.plan) {
        body.planDuration = PLAN_TO_DURATION[body.plan] || existing.planDuration || '3_months';
      }
      const duration  = body.planDuration || existing.planDuration;
      const startDate = body.startDate    || existing.startDate;
      const endDate   = calcContractEndDate(new Date(startDate), duration);
      if (endDate) {
        body.contractEndDate = endDate;
        body.contractStatus  = deriveContractStatus(endDate);
      }
    }
  }

  const client = await Client.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
    .populate('accountManager', 'name email avatar')
    .populate('teamMembers', 'name email avatar');

  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
  res.json({ success: true, client });
}));

// @route DELETE /api/clients/:id
// Access: admin (any client) | manager (only their own clients)
router.delete('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

  // Project managers can only delete clients they manage
  if (req.user.role === 'manager') {
    const isOwner =
      String(client.accountManager) === String(req.user._id) ||
      (client.teamMembers || []).some(m => String(m) === String(req.user._id));
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You can only delete your own clients' });
    }
  }

  const id = req.params.id;

  // ── Cascade delete all related data ─────────────────────────────────────────
  await Promise.all([
    Task.deleteMany({ client: id }),
    Update.deleteMany({ client: id }),
    Report.deleteMany({ client: id }),
    File.deleteMany({ client: id }),
    Lead.deleteMany({ client: id }),
    SocialPost.deleteMany({ client: id }),
    CalendarEvent.deleteMany({ client: id }),
    Conversation.deleteMany({ client: id }),
    Document.deleteMany({ client: id }),
    Credential.deleteMany({ client: id }),
    ClientTarget.deleteMany({ client: id }),
    PaymentVerification.deleteMany({ client: id }),
    RenewalHistory.deleteMany({ client: id }),
    // Deactivate portal user account linked to this client (don't hard-delete — preserves audit trail)
    User.updateMany({ clientId: id, role: 'client' }, { isActive: false }),
  ]);

  await Client.findByIdAndDelete(id);

  // Fire-and-forget activity log
  logActivity({
    req,
    action: 'client.deleted',
    entity: { type: 'client', id: client._id, name: client.company || client.name },
    meta: { deletedBy: req.user.role },
  });

  res.json({ success: true, message: 'Client and all related data deleted successfully' });
}));

// @route GET /api/clients/:id/overview
router.get('/:id/overview', protect, asyncHandler(async (req, res) => {
  if (req.user.role === 'client' && String(req.user.clientId) !== req.params.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const [client, taskStats, recentUpdates, recentFiles, latestReport] = await Promise.all([
    Client.findById(req.params.id)
      .populate('accountManager', 'name email avatar jobTitle phone')
      .populate('teamMembers', 'name email avatar jobTitle role'),
    Task.aggregate([
      { $match: { client: require('mongoose').Types.ObjectId.createFromHexString(req.params.id) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Update.find({ client: req.params.id }).populate('author', 'name avatar').sort({ createdAt: -1 }).limit(5),
    File.find({ client: req.params.id }).populate('uploadedBy', 'name').sort({ createdAt: -1 }).limit(5),
    Report.findOne({ client: req.params.id }).sort({ createdAt: -1 })
  ]);

  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

  res.json({ success: true, client, taskStats, recentUpdates, recentFiles, latestReport });
}));

// @route POST /api/clients/:id/logo  — upload company logo
router.post('/:id/logo', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const uploader = getUploader();
  uploader.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    let logoUrl;
    if (process.env.FILE_STORAGE === 'cloudinary') {
      logoUrl = req.file.path;
    } else {
      logoUrl = getFileUrl(req, req.file.filename);
    }

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { logo: logoUrl },
      { new: true }
    ).populate('accountManager', 'name email avatar');

    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, logo: logoUrl, client });
  });
}));

// @route GET /api/clients/:id/gmb
// Returns all GMB profiles. If the client has none but has legacy `gmb` data,
// it auto-migrates the legacy data into gmbProfiles[0].
router.get('/:id/gmb', protect, asyncHandler(async (req, res) => {
  if (req.user.role === 'client' && String(req.user.clientId) !== req.params.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  const client = await Client.findById(req.params.id).select('gmb gmbProfiles');
  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

  // Auto-migrate legacy single gmb → gmbProfiles if gmbProfiles is empty
  if ((!client.gmbProfiles || client.gmbProfiles.length === 0) && client.gmb && Object.keys(client.gmb.toObject ? client.gmb.toObject() : client.gmb).some(k => client.gmb[k])) {
    const legacyData = client.gmb.toObject ? client.gmb.toObject() : { ...client.gmb };
    delete legacyData._id;
    const migratedProfile = { profileName: 'Main Location', ...legacyData, history: [] };
    await Client.findByIdAndUpdate(req.params.id, { gmbProfiles: [migratedProfile] });
    return res.json({ success: true, gmbProfiles: [migratedProfile], gmb: client.gmb });
  }

  res.json({ success: true, gmbProfiles: client.gmbProfiles || [], gmb: client.gmb || {} });
}));

// @route PUT /api/clients/:id/gmb
// Body: { profiles: [...] }  — full array of profiles to save.
// Before overwriting, saves a history snapshot for any profile that has changed.
router.put('/:id/gmb', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id).select('gmb gmbProfiles');
  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

  const incomingProfiles = req.body.profiles || [];
  const existingProfiles = client.gmbProfiles || [];

  const SNAPSHOT_FIELDS = ['businessName','category','phone','website','address','profileUrl',
    'totalReviews','avgRating','totalViews','totalClicks','newReviews','calls','directions','messages','notes'];

  const updatedProfiles = incomingProfiles.map((incoming) => {
    // Try to find existing profile by _id (for updates) or treat as new
    const existing = incoming._id
      ? existingProfiles.find(p => String(p._id) === String(incoming._id))
      : null;

    // Build the new profile, preserving existing history
    const newHistory = existing ? [...(existing.history || [])] : [];

    if (existing) {
      // Check if any data field changed — if so, push a snapshot of the OLD data
      const hasChanges = SNAPSHOT_FIELDS.some(k => String(existing[k] || '') !== String(incoming[k] || ''));
      if (hasChanges) {
        const snapshot = {};
        SNAPSHOT_FIELDS.forEach(k => { snapshot[k] = existing[k]; });
        newHistory.push({
          savedAt: new Date(),
          savedBy: req.user._id,
          snapshot,
        });
      }
    }

    return {
      ...(incoming._id ? { _id: incoming._id } : {}),
      profileName: incoming.profileName || 'Location',
      ...Object.fromEntries(SNAPSHOT_FIELDS.map(k => [k, incoming[k] || ''])),
      history: newHistory,
    };
  });

  await Client.findByIdAndUpdate(req.params.id, { gmbProfiles: updatedProfiles }, { new: true });
  const updated = await Client.findById(req.params.id).select('gmbProfiles');
  res.json({ success: true, gmbProfiles: updated.gmbProfiles || [] });
}));

module.exports = router;
const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const User = require('../models/User');
const Task = require('../models/Task');
const Update = require('../models/Update');
const Report = require('../models/Report');
const File = require('../models/File');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route GET /api/clients
router.get('/', protect, asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20, managerId } = req.query;
  const query = {};

  if (req.user.role === 'client') {
    query._id = req.user.clientId;
  } else if (!['admin', 'manager', 'client'].includes(req.user.role)) {
    // Team members: only see clients they're assigned to
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
    // If there's already an $or from role-based access, combine with $and to avoid overwriting it
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
  const client = await Client.create(req.body);

  // If createPortalUser is requested, create a linked user
  if (req.body.createPortalUser && req.body.portalEmail) {
    const user = await User.create({
      name: client.name,
      email: req.body.portalEmail,
      password: req.body.portalPassword || 'ClientPass123!',
      role: 'client',
      clientId: client._id
    });
    client.linkedUserId = user._id;
    await client.save();
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
  const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('accountManager', 'name email avatar')
    .populate('teamMembers', 'name email avatar');

  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
  res.json({ success: true, client });
}));

// @route DELETE /api/clients/:id
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const client = await Client.findByIdAndDelete(req.params.id);
  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
  res.json({ success: true, message: 'Client deleted successfully' });
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

module.exports = router;
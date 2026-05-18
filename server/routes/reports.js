const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Client = require('../models/Client');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const MANAGER_ROLES = ['admin', 'manager'];

// @route GET /api/reports
router.get('/', protect, asyncHandler(async (req, res) => {
  const { clientId, period, page = 1, limit = 10 } = req.query;
  const query = {};

  if (req.user.role === 'client') {
    query.client = req.user.clientId;
    query.isPublished = true;
  } else if (MANAGER_ROLES.includes(req.user.role)) {
    if (clientId) query.client = clientId;
  } else {
    // Team members: only see reports for their assigned clients
    const assignedClients = await Client.find({
      $or: [{ accountManager: req.user._id }, { teamMembers: req.user._id }],
    }).select('_id');
    const assignedIds = assignedClients.map(c => c._id);

    if (clientId) {
      const isAssigned = assignedIds.some(id => String(id) === String(clientId));
      if (!isAssigned) return res.json({ success: true, reports: [], total: 0, page: 1, pages: 0 });
      query.client = clientId;
    } else {
      query.client = { $in: assignedIds };
    }
  }

  if (period) query.period = period;

  const total = await Report.countDocuments(query);
  const reports = await Report.find(query)
    .populate('createdBy', 'name avatar')
    .populate('client', 'name company')
    .sort({ startDate: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, reports, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route POST /api/reports
router.post('/', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  // Team members: validate they belong to this client
  if (!MANAGER_ROLES.includes(req.user.role) && req.body.client) {
    const assignedClients = await Client.find({
      $or: [{ accountManager: req.user._id }, { teamMembers: req.user._id }],
    }).select('_id');
    const isAssigned = assignedClients.some(c => String(c._id) === String(req.body.client));
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'Not authorised to create reports for this client' });
    }
  }

  // Auto-calculate ROAS if not provided
  if (req.body.metrics && req.body.metrics.adSpend && req.body.metrics.revenue && !req.body.metrics.roas) {
    req.body.metrics.roas = parseFloat((req.body.metrics.revenue / req.body.metrics.adSpend).toFixed(2));
  }

  const report = await Report.create({ ...req.body, createdBy: req.user._id });
  const populated = await Report.findById(report._id)
    .populate('createdBy', 'name avatar')
    .populate('client', 'name company');

  try { req.app.locals.emitEvent?.('report.created', { reportId: report._id, title: report.title, client: populated.client?.company, period: report.period }); } catch {}

  res.status(201).json({ success: true, report: populated });
}));

// @route GET /api/reports/client/:clientId/summary
// NOTE: must be declared before /:id to avoid route shadowing
router.get('/client/:clientId/summary', protect, asyncHandler(async (req, res) => {
  if (req.user.role === 'client' && String(req.user.clientId) !== req.params.clientId) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  // Team members: check they are assigned to this client
  if (!MANAGER_ROLES.includes(req.user.role) && req.user.role !== 'client') {
    const assignedClients = await Client.find({
      $or: [{ accountManager: req.user._id }, { teamMembers: req.user._id }],
    }).select('_id');
    const isAssigned = assignedClients.some(c => String(c._id) === String(req.params.clientId));
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
  }

  const reports = await Report.find({ client: req.params.clientId, isPublished: true })
    .sort({ startDate: -1 })
    .limit(12);

  const totals = reports.reduce((acc, r) => {
    acc.totalSpend += r.metrics.adSpend || 0;
    acc.totalRevenue += r.metrics.revenue || 0;
    acc.totalLeads += r.metrics.leads || 0;
    acc.totalConversions += r.metrics.conversions || 0;
    return acc;
  }, { totalSpend: 0, totalRevenue: 0, totalLeads: 0, totalConversions: 0 });

  totals.avgROAS = totals.totalSpend ? parseFloat((totals.totalRevenue / totals.totalSpend).toFixed(2)) : 0;

  res.json({ success: true, reports, totals });
}));

// @route GET /api/reports/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id)
    .populate('createdBy', 'name avatar')
    .populate('client', 'name company');

  if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

  if (req.user.role === 'client') {
    if (String(report.client._id) !== String(req.user.clientId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
  } else if (!MANAGER_ROLES.includes(req.user.role)) {
    const assignedClients = await Client.find({
      $or: [{ accountManager: req.user._id }, { teamMembers: req.user._id }],
    }).select('_id');
    const isAssigned = assignedClients.some(c => String(c._id) === String(report.client._id));
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
  }

  res.json({ success: true, report });
}));

// @route PUT /api/reports/:id
router.put('/:id', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  const existing = await Report.findById(req.params.id).populate('client', '_id');
  if (!existing) return res.status(404).json({ success: false, message: 'Report not found' });

  if (!MANAGER_ROLES.includes(req.user.role)) {
    const assignedClients = await Client.find({
      $or: [{ accountManager: req.user._id }, { teamMembers: req.user._id }],
    }).select('_id');
    const isAssigned = assignedClients.some(c => String(c._id) === String(existing.client._id));
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'Not authorised to edit this report' });
    }
  }

  if (req.body.metrics?.adSpend && req.body.metrics?.revenue) {
    req.body.metrics.roas = parseFloat((req.body.metrics.revenue / req.body.metrics.adSpend).toFixed(2));
  }

  const report = await Report.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .populate('createdBy', 'name avatar')
    .populate('client', 'name company');

  res.json({ success: true, report });
}));

// @route DELETE /api/reports/:id
router.delete('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  await Report.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Report deleted' });
}));

module.exports = router;

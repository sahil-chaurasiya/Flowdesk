const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route GET /api/reports
router.get('/', protect, asyncHandler(async (req, res) => {
  const { clientId, period, page = 1, limit = 10 } = req.query;
  const query = {};

  if (req.user.role === 'client') {
    query.client = req.user.clientId;
    query.isPublished = true;
  } else if (clientId) {
    query.client = clientId;
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
  // Auto-calculate ROAS if not provided
  if (req.body.metrics && req.body.metrics.adSpend && req.body.metrics.revenue && !req.body.metrics.roas) {
    req.body.metrics.roas = parseFloat((req.body.metrics.revenue / req.body.metrics.adSpend).toFixed(2));
  }

  const report = await Report.create({ ...req.body, createdBy: req.user._id });
  const populated = await Report.findById(report._id)
    .populate('createdBy', 'name avatar')
    .populate('client', 'name company');

  // Emit automation event
  try { req.app.locals.emitEvent?.('report.created', { reportId: report._id, title: report.title, client: populated.client?.company, period: report.period }); } catch {}

  res.status(201).json({ success: true, report: populated });
}));

// @route GET /api/reports/client/:clientId/summary
// NOTE: must be declared before /:id to avoid route shadowing
router.get('/client/:clientId/summary', protect, asyncHandler(async (req, res) => {
  if (req.user.role === 'client' && String(req.user.clientId) !== req.params.clientId) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
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

  if (req.user.role === 'client' && String(report.client._id) !== String(req.user.clientId)) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.json({ success: true, report });
}));

// @route PUT /api/reports/:id
router.put('/:id', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  if (req.body.metrics?.adSpend && req.body.metrics?.revenue) {
    req.body.metrics.roas = parseFloat((req.body.metrics.revenue / req.body.metrics.adSpend).toFixed(2));
  }

  const report = await Report.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .populate('createdBy', 'name avatar')
    .populate('client', 'name company');

  if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
  res.json({ success: true, report });
}));

// @route DELETE /api/reports/:id
router.delete('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  await Report.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Report deleted' });
}));

module.exports = router;
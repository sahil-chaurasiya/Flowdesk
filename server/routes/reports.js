const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Report = require('../models/Report');
const Client = require('../models/Client');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const MANAGER_ROLES = ['admin', 'manager'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  }
});

// ── Known metric column aliases ───────────────────────────────────────────────
// Ad-platform exports (Meta, Google, etc.) name columns differently and don't
// always include the same set, so we match loosely and tolerate missing ones.
const METRIC_ALIASES = {
  adSpend:     ['amount spent (inr)', 'amount spent', 'spend', 'cost', 'ad spend'],
  impressions: ['impressions'],
  reach:       ['reach'],
  clicks:      ['clicks', 'link clicks'],
  conversions: ['purchases', 'conversions', 'results'],
  leads:       ['total messaging contacts', 'new messaging contacts', 'leads'],
};

const DATE_ALIASES = {
  startDate: ['reporting starts', 'start date', 'starts'],
  endDate:   ['reporting ends', 'end date', 'ends'],
};

function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase();
}

// Sum a numeric-ish column across all parsed rows, for any alias that matches.
function sumColumn(rows, columns, aliases) {
  const matchIdx = columns.findIndex(c => aliases.includes(normalizeHeader(c)));
  if (matchIdx === -1) return undefined;
  const colName = columns[matchIdx];
  let total = 0;
  let found = false;
  rows.forEach(row => {
    const val = row[colName];
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      if (!Number.isNaN(num)) { total += num; found = true; }
    }
  });
  return found ? total : undefined;
}

function findEarliestDate(rows, columns, aliases) {
  const matchIdx = columns.findIndex(c => aliases.includes(normalizeHeader(c)));
  if (matchIdx === -1) return undefined;
  const colName = columns[matchIdx];
  const dates = rows.map(r => r[colName]).filter(Boolean).map(v => new Date(v)).filter(d => !isNaN(d));
  if (!dates.length) return undefined;
  return new Date(Math.min(...dates.map(d => d.getTime())));
}

function findLatestDate(rows, columns, aliases) {
  const matchIdx = columns.findIndex(c => aliases.includes(normalizeHeader(c)));
  if (matchIdx === -1) return undefined;
  const colName = columns[matchIdx];
  const dates = rows.map(r => r[colName]).filter(Boolean).map(v => new Date(v)).filter(d => !isNaN(d));
  if (!dates.length) return undefined;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

// Helper: return scoped client IDs for a manager (null = admin, no restriction)
async function getScopedClientIds(user) {
  if (user.role === 'admin') return null;
  const clients = await Client.find({
    $or: [{ accountManager: user._id }, { teamMembers: user._id }],
  }).select('_id');
  return clients.map(c => c._id);
}

// @route GET /api/reports
router.get('/', protect, asyncHandler(async (req, res) => {
  const { clientId, period, page = 1, limit = 10 } = req.query;
  const query = {};

  if (req.user.role === 'client') {
    query.client = req.user.clientId;
    query.isPublished = true;
  } else if (MANAGER_ROLES.includes(req.user.role)) {
    const scopedClientIds = await getScopedClientIds(req.user);
    if (clientId) {
      if (scopedClientIds) {
        const hasAccess = scopedClientIds.some(id => String(id) === String(clientId));
        if (!hasAccess) return res.json({ success: true, reports: [], total: 0, page: 1, pages: 0 });
      }
      query.client = clientId;
    } else if (scopedClientIds) {
      query.client = { $in: scopedClientIds };
    }
    // Admin with no filter: no restriction
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

// @route POST /api/reports/upload
// Create a report from an uploaded spreadsheet (Excel/CSV). Designed for
// ad-platform exports (e.g. Meta Ads Manager ad-set reports) where the exact
// set of columns varies between exports — whatever headers are present are
// kept as-is, and known metric/date columns are aggregated if found.
router.post('/upload', protect, authorize('admin', 'manager', 'team'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const { clientId, title, period } = req.body;
  if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });

  if (req.user.role !== 'admin') {
    const scopedClientIds = await getScopedClientIds(req.user);
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(clientId));
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not authorised to upload reports for this client' });
      }
    }
  }

  const client = await Client.findById(clientId);
  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

  let wb;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  } catch {
    return res.status(400).json({ success: false, message: 'Could not read file. Please upload a valid Excel or CSV file.' });
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rawRows.length < 2) {
    return res.status(400).json({ success: false, message: 'File appears to be empty' });
  }

  // Header row defines the columns actually present in this upload — could be
  // a subset or superset of any other report's columns.
  const columns = rawRows[0].map(h => String(h).trim()).filter(Boolean);

  const sheetData = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

    const rowObj = {};
    columns.forEach((col, idx) => {
      const val = row[idx];
      if (val !== '' && val !== null && val !== undefined) {
        rowObj[col] = val instanceof Date ? val.toISOString() : val;
      }
    });
    if (Object.keys(rowObj).length) sheetData.push(rowObj);
  }

  if (!sheetData.length) {
    return res.status(400).json({ success: false, message: 'No data rows found in file' });
  }

  // Best-effort aggregation of known metrics from whichever columns exist.
  const metrics = {};
  Object.entries(METRIC_ALIASES).forEach(([key, aliases]) => {
    const total = sumColumn(sheetData, columns, aliases);
    if (total !== undefined) metrics[key] = total;
  });
  if (metrics.adSpend && metrics.conversions) {
    metrics.cpl = parseFloat((metrics.adSpend / metrics.conversions).toFixed(2));
  }

  const inferredStart = findEarliestDate(sheetData, columns, DATE_ALIASES.startDate);
  const inferredEnd = findLatestDate(sheetData, columns, DATE_ALIASES.endDate);

  const startDate = req.body.startDate ? new Date(req.body.startDate) : (inferredStart || new Date());
  const endDate = req.body.endDate ? new Date(req.body.endDate) : (inferredEnd || startDate);

  const report = await Report.create({
    client: clientId,
    createdBy: req.user._id,
    title: title?.trim() || req.file.originalname.replace(/\.(xlsx|xls|csv)$/i, ''),
    period: period || 'custom',
    startDate,
    endDate,
    metrics,
    columns,
    sheetData,
    sourceFile: { name: req.file.originalname, uploadedAt: new Date() },
  });

  const populated = await Report.findById(report._id)
    .populate('createdBy', 'name avatar')
    .populate('client', 'name company');

  try {
    req.app.locals.emitEvent?.('report.created', {
      reportId: report._id, title: report.title, client: populated.client?.company, period: report.period,
    });
  } catch {}

  res.status(201).json({ success: true, report: populated });
}));

// @route POST /api/reports
router.post('/', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  // Managers and team: validate they have access to the target client
  if (req.user.role !== 'admin' && req.body.client) {
    const scopedClientIds = await getScopedClientIds(req.user);
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(c => String(c) === String(req.body.client));
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not authorised to create reports for this client' });
      }
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

  // Managers and team members: check they are assigned to this client
  if (req.user.role !== 'admin' && req.user.role !== 'client') {
    const scopedClientIds = await getScopedClientIds(req.user);
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(req.params.clientId));
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
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
  } else if (req.user.role !== 'admin') {
    const scopedClientIds = await getScopedClientIds(req.user);
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(report.client._id));
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }
  }

  res.json({ success: true, report });
}));

// @route PUT /api/reports/:id
router.put('/:id', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  const existing = await Report.findById(req.params.id).populate('client', '_id');
  if (!existing) return res.status(404).json({ success: false, message: 'Report not found' });

  if (req.user.role !== 'admin') {
    const scopedClientIds = await getScopedClientIds(req.user);
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(existing.client._id));
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not authorised to edit this report' });
      }
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
  const existing = await Report.findById(req.params.id).populate('client', '_id');
  if (!existing) return res.status(404).json({ success: false, message: 'Report not found' });

  if (req.user.role === 'manager') {
    const scopedClientIds = await getScopedClientIds(req.user);
    if (scopedClientIds) {
      const hasAccess = scopedClientIds.some(id => String(id) === String(existing.client._id));
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not authorised to delete this report' });
      }
    }
  }

  await Report.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Report deleted' });
}));

module.exports = router;
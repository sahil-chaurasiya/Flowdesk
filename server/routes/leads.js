const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createNotification } = require('../utils/notifications');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
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

// ── Column name normalizer ─────────────────────────────────────────────────────
const KNOWN_COLS = {
  name: ['name', 'full name', 'fullname', 'lead name', 'contact', 'first name', 'firstname'],
  email: ['email', 'email address', 'e-mail', 'mail'],
  phone: ['phone', 'phone number', 'mobile', 'cell', 'contact number', 'tel'],
  company: ['company', 'company name', 'business', 'organisation', 'organization'],
  location: ['location', 'city', 'area', 'region', 'address', 'country'],
  campaign: ['campaign', 'campaign name', 'ad campaign', 'source campaign'],
  source: ['source', 'platform', 'channel', 'ad source', 'lead source'],
  notes: ['notes', 'note', 'remarks', 'comment', 'comments'],
  leadDate: ['date', 'lead date', 'created', 'created at', 'submission date', 'timestamp'],
};

function mapColumns(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    if (!h) return;
    const key = String(h).toLowerCase().trim();
    for (const [field, aliases] of Object.entries(KNOWN_COLS)) {
      if (aliases.includes(key)) { map[field] = idx; break; }
    }
    if (!Object.values(map).includes(idx)) map[`__extra_${h}`] = idx;
  });
  return map;
}

// @route POST /api/leads/upload
// Only admin, manager (project manager) can upload leads
router.post('/upload', protect, authorize('admin', 'manager'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const { clientId, batchLabel, source, campaign } = req.body;
  if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });

  const client = await Client.findById(clientId);
  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

  // Parse Excel / CSV
  const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rows.length < 2) {
    return res.status(400).json({ success: false, message: 'File appears to be empty (need at least a header row + 1 data row)' });
  }

  const headers = rows[0].map(h => String(h).trim());
  const colMap = mapColumns(headers);
  const batchId = uuidv4();

  const leads = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip entirely blank rows
    if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

    const get = (field) => {
      const idx = colMap[field];
      return idx !== undefined ? String(row[idx] || '').trim() : '';
    };

    const extra = {};
    headers.forEach((h, idx) => {
      const isKnown = Object.values(KNOWN_COLS).some(aliases => aliases.includes(h.toLowerCase().trim()));
      if (!isKnown && row[idx] !== '' && row[idx] !== null) {
        extra[h] = String(row[idx]);
      }
    });

    leads.push({
      client: clientId,
      uploadedBy: req.user._id,
      batchId,
      batchLabel: batchLabel || `Upload ${new Date().toLocaleDateString()}`,
      campaign: get('campaign') || campaign || '',
      source: get('source') || source || '',
      name: get('name'),
      email: get('email'),
      phone: get('phone'),
      company: get('company'),
      location: get('location'),
      notes: get('notes'),
      extra,
      leadDate: get('leadDate') ? new Date(get('leadDate')) : new Date(),
      status: 'new',
    });
  }

  if (leads.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid data rows found in file' });
  }

  await Lead.insertMany(leads);

  // Notify client that new leads have been uploaded
  if (client.linkedUserId) {
    await createNotification(client.linkedUserId, {
      type: 'lead',
      title: '🎯 New Leads Available',
      body: `${leads.length} new leads have been uploaded to your dashboard`,
      link: '/portal/leads'
    });
  }

  res.status(201).json({
    success: true,
    message: `${leads.length} leads imported successfully`,
    batchId,
    count: leads.length,
  });
}));

// @route GET /api/leads
// Admin/manager see all; client sees their own; team members see nothing
router.get('/', protect, asyncHandler(async (req, res) => {
  const { clientId, batchId, status, source, page = 1, limit = 50 } = req.query;
  const query = {};

  if (req.user.role === 'client') {
    query.client = req.user.clientId;
  } else if (['admin', 'manager'].includes(req.user.role)) {
    if (clientId) query.client = clientId;
  } else {
    return res.status(403).json({ success: false, message: 'Not authorized to view leads' });
  }

  if (batchId) query.batchId = batchId;
  if (status) query.status = status;
  if (source) query.source = new RegExp(source, 'i');

  const total = await Lead.countDocuments(query);
  const leads = await Lead.find(query)
    .populate('uploadedBy', 'name avatar')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, leads, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route GET /api/leads/batches
// List all upload batches for a client
router.get('/batches', protect, asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const matchClient = req.user.role === 'client' ? req.user.clientId : clientId;

  if (!matchClient) {
    return res.status(400).json({ success: false, message: 'clientId is required' });
  }

  const batches = await Lead.aggregate([
    { $match: { client: require('mongoose').Types.ObjectId.createFromHexString(String(matchClient)) } },
    { $group: {
        _id: '$batchId',
        batchLabel: { $first: '$batchLabel' },
        count: { $sum: 1 },
        sources: { $addToSet: '$source' },
        createdAt: { $min: '$createdAt' },
        uploadedBy: { $first: '$uploadedBy' }
      }
    },
    { $sort: { createdAt: -1 } },
    { $limit: 50 }
  ]);

  // Populate uploadedBy manually
  const User = require('../models/User');
  for (const b of batches) {
    if (b.uploadedBy) {
      b.uploader = await User.findById(b.uploadedBy).select('name avatar');
    }
  }

  res.json({ success: true, batches });
}));

// @route GET /api/leads/stats
// Summary stats for a client's leads
router.get('/stats', protect, asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const matchClient = req.user.role === 'client' ? req.user.clientId : (clientId || null);
  if (!matchClient) return res.status(400).json({ success: false, message: 'clientId required' });

  const mongoose = require('mongoose');
  const oid = mongoose.Types.ObjectId.createFromHexString(String(matchClient));

  const [total, byStatus, bySource] = await Promise.all([
    Lead.countDocuments({ client: oid }),
    Lead.aggregate([
      { $match: { client: oid } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Lead.aggregate([
      { $match: { client: oid } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
  ]);

  res.json({ success: true, total, byStatus, bySource });
}));

// @route PUT /api/leads/:id
// Update lead status/quality/notes — admin/manager only
router.put('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  res.json({ success: true, lead });
}));

// @route DELETE /api/leads/batch/:batchId
// Delete an entire batch
router.delete('/batch/:batchId', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const result = await Lead.deleteMany({ batchId: req.params.batchId });
  res.json({ success: true, deleted: result.deletedCount });
}));

module.exports = router;
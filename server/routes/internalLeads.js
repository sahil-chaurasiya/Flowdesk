const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const XLSX       = require('xlsx');
const InternalLead = require('../models/InternalLead');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { logActivity } = require('../utils/activityLog');

// Only admin + performance_marketer can access these routes
const INTERNAL_LEADS_ROLES = ['admin', 'performance_marketer'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls|csv)$/i)) cb(null, true);
    else cb(new Error('Only Excel / CSV files allowed'));
  },
});

// ── Column mapper (mirrors client-leads approach) ──────────────────────────────
const KNOWN = {
  name:         ['name', 'full name', 'fullname', 'contact name'],
  email:        ['email', 'email address', 'e-mail'],
  phone:        ['phone', 'mobile', 'cell', 'phone number'],
  company:      ['company', 'company name', 'business', 'organisation', 'organization'],
  website:      ['website', 'url', 'web'],
  location:     ['location', 'city', 'area', 'region'],
  source:       ['source', 'lead source', 'channel', 'platform'],
  sourceDetail: ['source detail', 'referred by', 'referral'],
  budget:       ['budget', 'ad budget', 'monthly budget'],
  requirements: ['requirements', 'remarks', 'notes', 'comment', 'comments'],
};

function mapCols(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    if (!h) return;
    const k = String(h).toLowerCase().trim();
    for (const [field, aliases] of Object.entries(KNOWN)) {
      if (aliases.includes(k)) { map[field] = idx; break; }
    }
  });
  return map;
}

// ── GET /api/internal-leads ───────────────────────────────────────────────────
router.get('/', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const { stage, quality, assignedTo, search, followUpToday } = req.query;
  const query = {};

  if (stage)      query.stage   = stage;
  if (quality)    query.quality = quality;
  if (assignedTo) query.assignedTo = assignedTo;

  if (followUpToday === 'true') {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
    query.followUpDate = { $gte: todayStart, $lte: todayEnd };
  }

  if (search) {
    query.$or = [
      { name:    new RegExp(search, 'i') },
      { email:   new RegExp(search, 'i') },
      { phone:   new RegExp(search, 'i') },
      { company: new RegExp(search, 'i') },
    ];
  }

  const leads = await InternalLead.find(query)
    .populate('createdBy',  'name avatar role')
    .populate('assignedTo', 'name avatar role')
    .sort({ updatedAt: -1 })
    .lean();

  res.json({ success: true, leads });
}));

// ── GET /api/internal-leads/stats ─────────────────────────────────────────────
router.get('/stats', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

  const [byStage, byQuality, followUpsToday, totalDealValue, recentActivity] = await Promise.all([
    InternalLead.aggregate([
      { $group: { _id: '$stage', count: { $sum: 1 }, dealValue: { $sum: '$dealValue' } } }
    ]),
    InternalLead.aggregate([
      { $group: { _id: '$quality', count: { $sum: 1 } } }
    ]),
    InternalLead.countDocuments({ followUpDate: { $gte: todayStart, $lte: todayEnd } }),
    InternalLead.aggregate([
      { $match: { stage: 'won' } },
      { $group: { _id: null, total: { $sum: '$dealValue' } } }
    ]),
    InternalLead.find({})
      .populate('createdBy', 'name avatar')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const stageMap   = {};
  byStage.forEach(s => { stageMap[s._id] = { count: s.count, dealValue: s.dealValue }; });
  const qualityMap = {};
  byQuality.forEach(q => { qualityMap[q._id] = q.count; });

  res.json({
    success: true,
    byStage: stageMap,
    byQuality: qualityMap,
    followUpsToday,
    totalWonValue: totalDealValue[0]?.total || 0,
    recentActivity,
  });
}));

// ── GET /api/internal-leads/follow-ups-today ──────────────────────────────────
// Used by the Dashboard widget
router.get('/follow-ups-today', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

  // Also include overdue (follow-up date passed but lead not won/lost)
  const leads = await InternalLead.find({
    followUpDate: { $lte: todayEnd },
    stage: { $nin: ['won', 'lost'] },
    $or: [
      { followUpDate: { $gte: todayStart } }, // today
      { followUpDate: { $lt: todayStart } },  // overdue
    ],
  })
    .populate('assignedTo', 'name avatar')
    .sort({ followUpDate: 1 })
    .limit(20)
    .lean();

  res.json({ success: true, leads });
}));

// ── GET /api/internal-leads/:id ───────────────────────────────────────────────
router.get('/:id', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const lead = await InternalLead.findById(req.params.id)
    .populate('createdBy',       'name avatar role')
    .populate('assignedTo',      'name avatar role')
    .populate('notes.createdBy', 'name avatar')
    .populate('activity.by',     'name avatar');

  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  res.json({ success: true, lead });
}));

// ── POST /api/internal-leads ──────────────────────────────────────────────────
router.post('/', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const lead = await InternalLead.create({
    ...req.body,
    createdBy: req.user._id,
    activity: [{
      action: 'created',
      by: req.user._id,
      note: 'Lead created',
    }],
  });

  logActivity({
    req,
    action: 'internal_lead.created',
    entity: { type: 'internal_lead', id: lead._id, name: lead.name || lead.company || lead.email },
    meta: { stage: lead.stage },
  });

  const populated = await lead.populate(['createdBy', 'assignedTo']);
  res.status(201).json({ success: true, lead: populated });
}));

// ── PUT /api/internal-leads/:id ───────────────────────────────────────────────
router.put('/:id', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const existing = await InternalLead.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Lead not found' });

  const { stage, followUpDate, followUpNote, ...rest } = req.body;
  const activityEntries = [];

  // Track stage changes
  if (stage && stage !== existing.stage) {
    activityEntries.push({
      action: 'moved',
      fromStage: existing.stage,
      toStage: stage,
      by: req.user._id,
      note: `Moved from ${existing.stage} → ${stage}`,
    });
  }

  // Track follow-up scheduling
  if (followUpDate && (!existing.followUpDate || String(existing.followUpDate) !== String(new Date(followUpDate)))) {
    activityEntries.push({
      action: 'follow_up_set',
      by: req.user._id,
      note: `Follow-up scheduled for ${new Date(followUpDate).toLocaleDateString('en-IN')}`,
    });
  }

  const updates = { ...rest };
  if (stage) updates.stage = stage;
  if (followUpDate !== undefined) updates.followUpDate = followUpDate || null;
  if (followUpNote !== undefined) updates.followUpNote = followUpNote;

  if (activityEntries.length) {
    updates.$push = { activity: { $each: activityEntries } };
  }

  const lead = await InternalLead.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate('createdBy',       'name avatar role')
    .populate('assignedTo',      'name avatar role')
    .populate('notes.createdBy', 'name avatar')
    .populate('activity.by',     'name avatar');

  res.json({ success: true, lead });
}));

// ── POST /api/internal-leads/:id/notes ───────────────────────────────────────
router.post('/:id/notes', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ success: false, message: 'Note body is required' });

  const lead = await InternalLead.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        notes: { body: body.trim(), createdBy: req.user._id },
        activity: { action: 'note_added', by: req.user._id, note: body.trim().slice(0, 80) },
      },
    },
    { new: true }
  )
    .populate('createdBy',       'name avatar role')
    .populate('assignedTo',      'name avatar role')
    .populate('notes.createdBy', 'name avatar')
    .populate('activity.by',     'name avatar');

  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  res.json({ success: true, lead });
}));

// ── DELETE /api/internal-leads/:id/notes/:noteId ──────────────────────────────
router.delete('/:id/notes/:noteId', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const lead = await InternalLead.findByIdAndUpdate(
    req.params.id,
    { $pull: { notes: { _id: req.params.noteId } } },
    { new: true }
  ).populate('notes.createdBy', 'name avatar');

  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  res.json({ success: true, lead });
}));

// ── POST /api/internal-leads/:id/activity ────────────────────────────────────
// Log a sales activity: call_made, whatsapp_sent, email_sent, meeting_scheduled,
// meeting_completed, proposal_sent, proposal_viewed, follow_up_done
router.post('/:id/activity', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const VALID_ACTIONS = [
    'call_made', 'whatsapp_sent', 'email_sent',
    'meeting_scheduled', 'meeting_completed',
    'proposal_sent', 'proposal_viewed',
    'follow_up_done', 'note_added',
  ];

  const { action, note } = req.body;
  if (!action || !VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ success: false, message: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
  }

  const lead = await InternalLead.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        activity: { action, by: req.user._id, note: note?.trim() || '' },
      },
    },
    { new: true }
  )
    .populate('createdBy',       'name avatar role')
    .populate('assignedTo',      'name avatar role')
    .populate('notes.createdBy', 'name avatar')
    .populate('activity.by',     'name avatar');

  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  res.json({ success: true, lead });
}));

// ── DELETE /api/internal-leads/:id ───────────────────────────────────────────
router.delete('/:id', protect, authorize(...INTERNAL_LEADS_ROLES), asyncHandler(async (req, res) => {
  const lead = await InternalLead.findByIdAndDelete(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

  logActivity({
    req,
    action: 'internal_lead.deleted',
    entity: { type: 'internal_lead', id: lead._id, name: lead.name || lead.company },
  });

  res.json({ success: true });
}));

// ── POST /api/internal-leads/import ───────────────────────────────────────────
router.post('/import', protect, authorize(...INTERNAL_LEADS_ROLES), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const wb   = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rows.length < 2) return res.status(400).json({ success: false, message: 'File is empty' });

  const headers = rows[0].map(h => String(h).trim());
  const colMap  = mapCols(headers);

  const get = (row, field) => {
    const idx = colMap[field];
    if (idx === undefined) return undefined;
    const val = row[idx];
    return val !== '' && val != null ? String(val).trim() : undefined;
  };

  const leads = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => !c)) continue;
    leads.push({
      name:         get(row, 'name'),
      email:        get(row, 'email'),
      phone:        get(row, 'phone'),
      company:      get(row, 'company'),
      website:      get(row, 'website'),
      location:     get(row, 'location'),
      source:       get(row, 'source') || 'other',
      sourceDetail: get(row, 'sourceDetail'),
      budget:       get(row, 'budget'),
      requirements: get(row, 'requirements'),
      createdBy:    req.user._id,
      stage:        'new',
      activity: [{
        action: 'created',
        by: req.user._id,
        note: 'Imported from Excel',
      }],
    });
  }

  if (!leads.length) return res.status(400).json({ success: false, message: 'No valid rows' });

  await InternalLead.insertMany(leads);
  res.status(201).json({ success: true, count: leads.length });
}));

module.exports = router;

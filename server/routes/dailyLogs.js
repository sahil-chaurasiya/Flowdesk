const express = require('express');
const router = express.Router();
const DailyLog = require('../models/DailyLog');
const User = require('../models/User');
const Client = require('../models/Client');
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// Non-admin team roles shown in Team Log
const DISPLAY_ROLES = ['manager', 'performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

// Helper: today's date string in YYYY-MM-DD (server local, consistent)
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── TEAM MEMBER ROUTES ───────────────────────────────────────────────────────

// @route  GET /api/daily-logs/my/today
router.get('/my/today', protect, authorize('team'), asyncHandler(async (req, res) => {
  const today = todayStr();
  let log = await DailyLog.findOne({ user: req.user._id, date: today })
    .populate('entries.client', 'name')
    .lean();

  if (!log) {
    // carry over in_progress from yesterday
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const yLog = await DailyLog.findOne({ user: req.user._id, date: yStr }).lean();
    const carried = (yLog?.entries || [])
      .filter(e => e.status === 'in_progress')
      .map(e => ({ ...e, _id: undefined, status: 'carried_over' }));

    const created = await DailyLog.create({ user: req.user._id, date: today, entries: carried });
    log = await DailyLog.findById(created._id).populate('entries.client', 'name').lean();
  }

  res.json({ success: true, log });
}));

// @route  GET /api/daily-logs/my/history
router.get('/my/history', protect, authorize('team'), asyncHandler(async (req, res) => {
  const { limit = 30 } = req.query;
  const logs = await DailyLog.find({ user: req.user._id })
    .populate('entries.client', 'name')
    .sort({ date: -1 })
    .limit(parseInt(limit))
    .lean();
  res.json({ success: true, logs });
}));

// @route  PUT /api/daily-logs/my/today
router.put('/my/today', protect, authorize('team'), asyncHandler(async (req, res) => {
  const today = todayStr();
  const { entries = [], blockers = '' } = req.body;

  if (!Array.isArray(entries)) {
    return res.status(400).json({ success: false, message: 'entries must be an array' });
  }
  for (const e of entries) {
    if (!e.description || !e.description.trim()) {
      return res.status(400).json({ success: false, message: 'Each entry must have a description' });
    }
  }

  const log = await DailyLog.findOneAndUpdate(
    { user: req.user._id, date: today },
    { $set: { entries, blockers, updatedAt: new Date() } },
    { new: true, upsert: true, runValidators: true }
  ).populate('entries.client', 'name');

  res.json({ success: true, log });
}));

// @route  POST /api/daily-logs/my/today/submit
router.post('/my/today/submit', protect, authorize('team'), asyncHandler(async (req, res) => {
  const today = todayStr();
  const log = await DailyLog.findOne({ user: req.user._id, date: today });
  if (!log) return res.status(404).json({ success: false, message: 'No log found for today. Add entries first.' });
  if (log.entries.length === 0) return res.status(400).json({ success: false, message: 'Add at least one entry before submitting.' });

  const { entries, blockers } = req.body;
  if (entries && Array.isArray(entries)) log.entries = entries;
  if (blockers !== undefined) log.blockers = blockers;

  log.isSubmitted = true;
  log.submittedAt = new Date();
  await log.save();

  const populated = await log.populate('entries.client', 'name');
  res.json({ success: true, log: populated });
}));

// ─── ADMIN / MANAGER ROUTES ───────────────────────────────────────────────────

// @route  GET /api/daily-logs/team
// @desc   All team logs for a date. Excludes admin role.
router.get('/team', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const date = req.query.date || todayStr();

  // Exclude admin from the team log view
  const teamMembers = await User.find({
    role: { $in: DISPLAY_ROLES },
    isActive: true,
  }).select('name avatar role jobTitle').lean();

  const logs = await DailyLog.find({ date })
    .populate('user', 'name avatar role jobTitle')
    .populate('entries.client', 'name')
    .lean();

  const logByUser = {};
  logs.forEach(l => { logByUser[String(l.user._id)] = l; });

  const result = teamMembers.map(member => ({
    member,
    log: logByUser[String(member._id)] || null,
  }));

  res.json({ success: true, date, result });
}));

// @route  GET /api/daily-logs/team/:userId
// @desc   A specific member's full log history
router.get('/team/:userId', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 60 } = req.query;

  const member = await User.findById(userId).select('name avatar role jobTitle').lean();
  if (!member) return res.status(404).json({ success: false, message: 'User not found' });

  const logs = await DailyLog.find({ user: userId })
    .populate('entries.client', 'name')
    .sort({ date: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json({ success: true, member, logs });
}));

// @route  GET /api/daily-logs/team/:userId/:date
router.get('/team/:userId/:date', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { userId, date } = req.params;

  const log = await DailyLog.findOne({ user: userId, date })
    .populate('user', 'name avatar role jobTitle')
    .populate('entries.client', 'name')
    .lean();

  if (!log) return res.status(404).json({ success: false, message: 'No log found for that date' });
  res.json({ success: true, log });
}));

// @route  GET /api/daily-logs/stats
router.get('/stats', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const daysInt = Math.min(parseInt(days), 30);

  const totalTeam = await User.countDocuments({ role: { $in: DISPLAY_ROLES }, isActive: true });

  const results = [];
  for (let i = 0; i < daysInt; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const submitted = await DailyLog.countDocuments({ date: dateStr, isSubmitted: true });
    const saved     = await DailyLog.countDocuments({ date: dateStr, isSubmitted: false, 'entries.0': { $exists: true } });
    results.push({ date: dateStr, submitted, saved, notLogged: Math.max(0, totalTeam - submitted - saved) });
  }

  res.json({ success: true, totalTeam, stats: results });
}));

module.exports = router;
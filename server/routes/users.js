const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { getUploader, cloudinary, getFileUrl } = require('../config/cloudinary');
const { logActivity } = require('../utils/activityLog');

const TEAM_ONLY_ROLES = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

// ─── Attendance DB lazy connection ───────────────────────────────────────────
let _attendanceDb = null;
let _AttUser = null;
let _AttRecord = null;

function getAttendanceDb() {
  if (_attendanceDb && _attendanceDb.readyState === 1) return _attendanceDb;

  const uri = (process.env.MONGODB_URI || '').replace(
    /\/toflymediaportal(\?|$)/,
    '/office_attendance_db$1'
  );

  _attendanceDb = mongoose.createConnection(uri);
  _attendanceDb.on('connected', () => console.log('✅ Attendance DB connected'));
  _attendanceDb.on('error', (err) => console.error('❌ Attendance DB error:', err.message));

  _AttUser = _attendanceDb.model(
    'AttUser',
    new mongoose.Schema({ email: String, name: String, department: String }, { strict: false }),
    'users'
  );

  _AttRecord = _attendanceDb.model(
    'AttRecord',
    new mongoose.Schema({
      userId:       { type: mongoose.Schema.Types.ObjectId },
      date:         String,
      checkInTime:  Date,
      checkOutTime: Date,
      status:       String,
      workHours:    Number,
      notes:        String,
      autoCheckout: Boolean,
      latitude:     Number,
      longitude:    Number,
    }, { strict: false }),
    'attendances'
  );

  return _attendanceDb;
}

// Helper — today's date in YYYY-MM-DD (IST)
function getTodayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // gives YYYY-MM-DD
}
// ─────────────────────────────────────────────────────────────────────────────

// @route GET /api/users
router.get('/', protect, asyncHandler(async (req, res) => {
  const isManagerOrAdmin = ['admin', 'manager'].includes(req.user.role);
  const isInternalTeam   = TEAM_ONLY_ROLES.includes(req.user.role);

  if (!isManagerOrAdmin && !isInternalTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const { role, isActive, search, page = 1, limit = 20 } = req.query;
  const query = {};

  if (role === 'team') {
    query.role = { $in: [...TEAM_ONLY_ROLES, 'manager', 'admin'] };
  } else if (role) {
    query.role = role;
  }

  if (!isManagerOrAdmin && !query.role) {
    query.role = { $in: [...TEAM_ONLY_ROLES, 'manager', 'admin'] };
  }

  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search && isManagerOrAdmin) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .populate(isManagerOrAdmin ? { path: 'clientId', select: 'name company' } : '')
    .select(isManagerOrAdmin ? '' : 'name role jobTitle avatar')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, users, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route POST /api/users
router.post('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, alternativePhone, jobTitle, department, clientId } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
  const user = await User.create({ name, email, password: password || 'Password123!', role, phone, alternativePhone, jobTitle, department, clientId });
  res.status(201).json({ success: true, user });
}));

// @route GET /api/users/attendance-today
// @desc  Returns a map of { email -> { status, checkInTime, checkOutTime, workHours } } for today
//        Used by TeamPage to show present/absent dots on cards
// @access Admin, Manager
router.get('/attendance-today', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  getAttendanceDb();

  const today = getTodayIST();
  const records = await _AttRecord.find({ date: today }).lean();

  if (!records.length) {
    return res.json({ success: true, today, byEmail: {} });
  }

  // Get all attendance-app userIds that checked in today
  const userIds = [...new Set(records.map(r => r.userId?.toString()).filter(Boolean))];
  const attUsers = await _AttUser.find({ _id: { $in: userIds } }).select('email').lean();

  const idToEmail = {};
  attUsers.forEach(u => { idToEmail[u._id.toString()] = u.email?.toLowerCase(); });

  const byEmail = {};
  records.forEach(r => {
    const email = idToEmail[r.userId?.toString()];
    if (email) {
      byEmail[email] = {
        status:       r.status,
        checkInTime:  r.checkInTime,
        checkOutTime: r.checkOutTime,
        workHours:    r.workHours,
      };
    }
  });

  res.json({ success: true, today, byEmail });
}));

// @route GET /api/users/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('clientId', 'name company status');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user });
}));

// @route PUT /api/users/:id
router.put('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const allowed = ['name', 'email', 'role', 'phone', 'alternativePhone', 'jobTitle', 'department', 'isActive', 'clientId', 'avatar'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user });
}));

// @route DELETE /api/users/:id
// Access: admin only — permanently removes a team member
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  }

  const targetUser = await User.findById(req.params.id);
  if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

  // Prevent admins from accidentally deleting other admin accounts
  if (targetUser.role === 'admin') {
    return res.status(403).json({ success: false, message: 'Cannot delete another admin account' });
  }

  await User.findByIdAndDelete(req.params.id);

  // Fire-and-forget activity log
  logActivity({
    req,
    action: 'user.deleted',
    entity: { type: 'user', id: targetUser._id, name: targetUser.name },
    meta: { deletedRole: targetUser.role, deletedEmail: targetUser.email },
  });

  res.json({ success: true, message: 'Team member deleted successfully' });
}));

// @route POST /api/users/:id/documents
router.post('/:id/documents', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const uploader = getUploader();
  uploader.single('document')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let fileUrl;
    let publicId = null;
    if (process.env.FILE_STORAGE === 'cloudinary') {
      fileUrl = req.file.path;
      publicId = req.file.filename;
    } else {
      fileUrl = getFileUrl(req, req.file.filename);
    }

    const ext = (req.file.originalname || '').split('.').pop().toLowerCase();
    const fileType = ['pdf'].includes(ext) ? 'pdf'
      : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? 'image'
      : ['doc', 'docx'].includes(ext) ? 'docx'
      : ext;

    const doc = {
      name: req.body.name || req.file.originalname,
      type: req.body.type || 'other',
      url: fileUrl,
      publicId,
      fileType,
      uploadedAt: new Date(),
    };

    user.documents.push(doc);
    await user.save({ validateBeforeSave: false });
    res.status(201).json({ success: true, document: user.documents[user.documents.length - 1], user });
  });
}));

// @route DELETE /api/users/:id/documents/:docId
router.delete('/:id/documents/:docId', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const doc = user.documents.id(req.params.docId);
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

  if (process.env.FILE_STORAGE === 'cloudinary' && doc.publicId) {
    try { await cloudinary.uploader.destroy(doc.publicId, { resource_type: 'raw' }); } catch (_) {}
  }

  doc.deleteOne();
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Document deleted' });
}));

// @route GET /api/users/:id/notifications
router.get('/:id/notifications', protect, asyncHandler(async (req, res) => {
  if (String(req.params.id) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  const user = await User.findById(req.params.id).select('notifications');
  res.json({ success: true, notifications: user.notifications });
}));

// @route PUT /api/users/:id/notifications/read
router.put('/:id/notifications/read', protect, asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.params.id }, { $set: { 'notifications.$[].read': true } });
  res.json({ success: true, message: 'Notifications marked as read' });
}));

// ─── ATTENDANCE (per-member, monthly) ────────────────────────────────────────
// @route  GET /api/users/:id/attendance?month=5&year=2026
// @access Admin, Manager
router.get('/:id/attendance', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('email name');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  getAttendanceDb();

  const attUser = await _AttUser.findOne({ email: user.email.toLowerCase() }).lean();
  if (!attUser) {
    return res.json({
      success: true,
      found: false,
      records: [],
      summary: { present: 0, late: 0, absent: 0, onLeave: 0, wfh: 0, totalWorkHours: 0 },
      message: 'No attendance account found for this email address',
    });
  }

  const { month, year } = req.query;
  const query = { userId: attUser._id };

  if (month && year) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    query.date = { $regex: `^${prefix}` };
  }

  const records = await _AttRecord.find(query).sort({ date: -1 }).limit(62).lean();

  // Mirror attendance app calendar view exactly:
  // present/late = ALL records with that status (not just fully-completed)
  // workHours = only fully-completed records (both check-in AND check-out)
  const present        = records.filter(r => r.status === 'present').length;
  const late           = records.filter(r => r.status === 'late').length;
  const fullyCompleted = records.filter(r => r.checkInTime && r.checkOutTime);
  const totalWorkHours = +fullyCompleted.reduce((acc, r) => acc + (r.workHours || 0), 0).toFixed(1);

  // Absent = working days elapsed (Mon-Sat, skip Sunday) since DATA_START, minus present+late
  const DATA_START = '2026-04-01';
  const todayIST = (() => {
    const now = new Date();
    const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return istDate.toISOString().split('T')[0];
  })();

  let absentCount = 0;
  if (month && year) {
    const m = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${m}-01`;
    const endDate   = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
    const effectiveStart = startDate < DATA_START ? DATA_START : startDate;
    const effectiveEnd   = endDate > todayIST ? todayIST : endDate;

    if (effectiveStart <= effectiveEnd) {
      let workingDays = 0;
      const cur = new Date(effectiveStart + 'T00:00:00Z');
      const end = new Date(effectiveEnd + 'T00:00:00Z');
      while (cur <= end) {
        if (cur.getUTCDay() !== 0) workingDays++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      absentCount = Math.max(0, workingDays - (present + late));
    }
  }

  res.json({
    success: true,
    found: true,
    summary: { present, late, absent: absentCount, totalWorkHours },
    records,
  });
}));
// ─────────────────────────────────────────────────────────────────────────────

module.exports = router;
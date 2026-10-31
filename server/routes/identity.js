/**
 * Identity reconciliation (Flowdesk user ↔ attendance user).
 *
 *   GET    /api/identity/attendance          overview: every Flowdesk user, how it resolves, and unmatched attendance users
 *   POST   /api/identity/attendance/links    create an explicit link
 *   DELETE /api/identity/attendance/links/:id remove an explicit link
 *
 * Admin-only (IDENTITY_ADMIN_ROLES). Nothing here writes to the attendance
 * database; links live in Flowdesk's own `identitylinks` collection.
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const IdentityLink = require('../models/IdentityLink');
const AttUser = require('../modules/attendance/models/User');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { can } = require('../config/permissions');
const { requireModuleDb } = require('../config/connections');
const { clearIdentityCache, emailFallbackEnabled } = require('../utils/identity');

const identityAdmin = (req, res, next) => {
  if (!can.identityAdmin(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Not authorized to manage identity links' });
  }
  next();
};

router.use(protect, identityAdmin, requireModuleDb('attendance'));

const lc = (s) => String(s || '').trim().toLowerCase();

router.get('/attendance', asyncHandler(async (req, res) => {
  const [fdUsers, attUsers, links] = await Promise.all([
    User.find({ role: { $ne: 'client' } }).select('name email role isActive').sort({ name: 1 }).lean(),
    AttUser.find({}).select('name email role department isActive').sort({ name: 1 }).lean(),
    IdentityLink.find({ kind: 'attendance_user' }).lean(),
  ]);

  const attById = new Map(attUsers.map((a) => [String(a._id), a]));
  const attByEmail = new Map();
  for (const a of attUsers) {
    const k = lc(a.email);
    attByEmail.set(k, [...(attByEmail.get(k) || []), a]);
  }
  const linkByFd = new Map(links.map((l) => [String(l.flowdeskId), l]));
  const claimedAtt = new Set(links.map((l) => String(l.externalId)));
  const emailFallback = emailFallbackEnabled();

  const used = new Set(); // attendance users that some Flowdesk user resolves to
  const flowdeskUsers = fdUsers.map((u) => {
    const row = { id: u._id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, status: 'unmatched', source: null, linkId: null, attendanceUser: null };
    const link = linkByFd.get(String(u._id));
    const pick = (a) => ({ id: a._id, name: a.name, email: a.email, department: a.department, role: a.role, isActive: a.isActive });
    if (link) {
      const a = attById.get(String(link.externalId));
      row.linkId = link._id;
      if (a) { used.add(String(a._id)); Object.assign(row, { status: 'linked', source: 'link', attendanceUser: pick(a) }); }
      else row.status = 'broken_link';
      return row;
    }
    if (emailFallback) {
      const m = attByEmail.get(lc(u.email)) || [];
      if (m.length === 1) {
        used.add(String(m[0]._id));
        if (claimedAtt.has(String(m[0]._id))) { row.status = 'claimed_by_other'; row.attendanceUser = pick(m[0]); }
        else Object.assign(row, { status: 'linked', source: 'email', attendanceUser: pick(m[0]) });
      } else if (m.length > 1) row.status = 'ambiguous';
    }
    return row;
  });

  const orphanAttendanceUsers = attUsers
    .filter((a) => !used.has(String(a._id)))
    .map((a) => ({ id: a._id, name: a.name, email: a.email, department: a.department, role: a.role, isActive: a.isActive }));

  res.json({ success: true, emailFallbackEnabled: emailFallback, flowdeskUsers, orphanAttendanceUsers });
}));

router.post('/attendance/links', asyncHandler(async (req, res) => {
  const { flowdeskUserId, attendanceUserId, note = '', confirmEmailMismatch = false } = req.body || {};
  if (![flowdeskUserId, attendanceUserId].every((v) => mongoose.Types.ObjectId.isValid(v))) {
    return res.status(400).json({ success: false, message: 'flowdeskUserId and attendanceUserId must be valid ids' });
  }
  const [fd, att] = await Promise.all([User.findById(flowdeskUserId).select('name email role'), AttUser.findById(attendanceUserId).select('name email')]);
  if (!fd) return res.status(404).json({ success: false, message: 'Flowdesk user not found' });
  if (fd.role === 'client') return res.status(400).json({ success: false, message: 'Client accounts cannot be linked to attendance profiles' });
  if (!att) return res.status(404).json({ success: false, message: 'Attendance user not found' });

  if (lc(fd.email) !== lc(att.email) && !confirmEmailMismatch) {
    return res.status(409).json({
      success: false,
      code: 'EMAIL_MISMATCH',
      message: `E-mails differ (${fd.email} vs ${att.email}). Resend with confirmEmailMismatch=true if these are the same person.`,
    });
  }

  try {
    const link = await IdentityLink.create({
      kind: 'attendance_user',
      flowdeskId: fd._id,
      externalId: att._id,
      externalLabel: att.email,
      note: String(note).slice(0, 500),
      createdBy: req.user._id,
    });
    clearIdentityCache();
    res.status(201).json({ success: true, link });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Either this Flowdesk user or this attendance user is already linked.' });
    }
    throw err;
  }
}));

router.delete('/attendance/links/:id', asyncHandler(async (req, res) => {
  const link = await IdentityLink.findOneAndDelete({ _id: req.params.id, kind: 'attendance_user' });
  if (!link) return res.status(404).json({ success: false, message: 'Link not found' });
  clearIdentityCache();
  res.json({ success: true, message: 'Link removed' });
}));

module.exports = router;

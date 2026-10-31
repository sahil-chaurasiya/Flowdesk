/**
 * GET /api/modules/access   – what the signed-in user may do in each module (drives the UI).
 * GET /api/modules/status   – connection state of every database (admin only; no secrets).
 */
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { can } = require('../config/permissions');
const connections = require('../config/connections');
const { resolveAttendanceUser } = require('../utils/identity');

router.get('/access', protect, asyncHandler(async (req, res) => {
  const role = req.user.role;
  const st = connections.status();

  const attendance = {
    enabled: st.attendance.configured,
    available: st.attendance.state === 'connected',
    canUse: can.attendanceUse(role),
    canAdmin: can.attendanceAdmin(role),
    link: null,
  };
  if (attendance.canUse && attendance.available) {
    try {
      const r = await resolveAttendanceUser(req.user);
      attendance.link = { status: r.status, source: r.source || null, reason: r.reason || null };
    } catch (_) {
      attendance.link = { status: 'error', source: null, reason: 'Could not resolve attendance profile.' };
    }
  }

  res.json({
    success: true,
    access: {
      attendance,
      finance: {
        enabled: st.finance.configured,
        available: st.finance.state === 'connected',
        canView: can.financeView(role),
        canWrite: can.financeWrite(role),
      },
      identity: { canManage: can.identityAdmin(role) },
    },
  });
}));

router.get('/status', protect, authorize('admin'), (req, res) => {
  res.json({ success: true, databases: connections.status() });
});

module.exports = router;

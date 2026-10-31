/**
 * Auth bridge: Flowdesk authentication  →  attendance identity.
 *
 * The attendance module no longer has its own login or JWT. Every request is
 * authenticated by Flowdesk's own `protect` middleware (same tokens, same
 * refresh flow, same active-user check). On top of that:
 *
 *   1. the Flowdesk role must be allowed to use attendance (config/permissions)
 *   2. the attendance database must be configured and connected (else 503 –
 *      never a silent fallback to another database)
 *   3. the Flowdesk user is mapped to an attendance-database user via
 *      utils/identity (explicit link first, then exact e-mail). The attendance
 *      user document is exposed as `req.attUser`; Flowdesk's `req.user` is left
 *      untouched so Flowdesk logging / activity code keeps seeing the real actor.
 *
 * Authorization for administrative actions is decided by the FLOWDESK role
 * (ATTENDANCE_ADMIN_ROLES, default admin) – never by a role value stored in
 * another database.
 */
const { protect: flowdeskProtect } = require('../../../middleware/auth');
const { can } = require('../../../config/permissions');
const { requireModuleDb } = require('../../../config/connections');
const { resolveAttendanceUser } = require('../../../utils/identity');

const roleGate = (req, res, next) => {
  if (!can.attendanceUse(req.user.role)) {
    return res.status(403).json({ success: false, code: 'ATTENDANCE_ROLE_FORBIDDEN', message: 'Your role does not have access to Attendance.' });
  }
  next();
};

const dbGate = requireModuleDb('attendance');

const resolveProfile = async (req, res, next) => {
  try {
    const r = await resolveAttendanceUser(req.user);
    req.attIdentity = { status: r.status, source: r.source || null, reason: r.reason || null };

    if (r.status === 'linked') {
      if (!r.attUser.isActive) {
        return res.status(403).json({ success: false, code: 'ATTENDANCE_ACCOUNT_DEACTIVATED', message: 'Your attendance account is deactivated. Contact an admin.' });
      }
      req.attUser = r.attUser;
      return next();
    }

    // Admins can still run administrative screens without having an employee profile.
    if (can.attendanceAdmin(req.user.role)) {
      req.attUser = { _id: null, name: req.user.name, email: req.user.email, role: 'admin', isActive: true, synthetic: true };
      return next();
    }

    return res.status(403).json({
      success: false,
      code: 'ATTENDANCE_PROFILE_NOT_LINKED',
      message: 'Your Flowdesk account is not linked to an attendance profile. Ask an admin to link it.',
      reason: r.reason || null,
      identityStatus: r.status,
    });
  } catch (err) { next(err); }
};

/** Authenticated + allowed + module DB up + profile resolved (admins may lack a profile). */
const protect = [flowdeskProtect, roleGate, dbGate, resolveProfile];

/** Same as protect but a REAL attendance profile is mandatory (check-in, leave, WFH, …). */
const requireRealProfile = (req, res, next) => {
  if (!req.attUser || req.attUser.synthetic) {
    return res.status(403).json({
      success: false,
      code: 'ATTENDANCE_PROFILE_REQUIRED',
      message: 'This action needs an attendance profile linked to your Flowdesk account.',
    });
  }
  next();
};
const protectEmployee = [...protect, requireRealProfile];

/** Administrative attendance actions: decided by the Flowdesk role. */
const adminOnly = (req, res, next) => {
  if (req.user && can.attendanceAdmin(req.user.role)) return next();
  return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
};

module.exports = { protect, protectEmployee, adminOnly };

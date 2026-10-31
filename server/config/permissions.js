/**
 * Module permission model (backend is the source of truth; the frontend only
 * mirrors it via GET /api/modules/access).
 *
 * Defaults follow least privilege and are overridable per deployment with
 * comma-separated Flowdesk role lists:
 *
 *   ATTENDANCE_ACCESS_ROLES   who may use attendance as an employee      (default: every internal role)
 *   ATTENDANCE_ADMIN_ROLES    who may administer attendance              (default: admin)
 *   FINANCE_VIEW_ROLES        who may READ finance data                  (default: admin)
 *   FINANCE_WRITE_ROLES       who may create/edit/delete finance data    (default: admin)
 *   IDENTITY_ADMIN_ROLES      who may manage identity links              (default: admin)
 *
 * The `client` role can never be granted access to these modules.
 * Variables are read at call time so tests / hot config changes behave.
 */
const { TEAM_ROLES } = require('../middleware/auth');

const csv = (name, fallback) => {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  return raw.split(',').map((s) => s.trim()).filter((r) => r && r !== 'client');
};

const attendanceUseRoles = () => csv('ATTENDANCE_ACCESS_ROLES', TEAM_ROLES);
const attendanceAdminRoles = () => csv('ATTENDANCE_ADMIN_ROLES', ['admin']);
const financeWriteRoles = () => csv('FINANCE_WRITE_ROLES', ['admin']);
const financeViewRoles = () => Array.from(new Set([...csv('FINANCE_VIEW_ROLES', ['admin']), ...financeWriteRoles()]));
const identityAdminRoles = () => csv('IDENTITY_ADMIN_ROLES', ['admin']);

const can = {
  attendanceUse: (role) => attendanceUseRoles().includes(role) || attendanceAdminRoles().includes(role),
  attendanceAdmin: (role) => attendanceAdminRoles().includes(role),
  financeView: (role) => financeViewRoles().includes(role),
  financeWrite: (role) => financeWriteRoles().includes(role),
  identityAdmin: (role) => identityAdminRoles().includes(role),
};

module.exports = { can, attendanceUseRoles, attendanceAdminRoles, financeViewRoles, financeWriteRoles, identityAdminRoles };

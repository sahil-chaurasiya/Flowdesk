/**
 * Startup configuration report.
 *
 * Prints the NAMES of missing / unset variables – never their values.
 * Nothing here changes how any existing Flowdesk variable behaves: variables
 * that Flowdesk already tolerates being absent (it has built-in fallbacks)
 * produce warnings, not failures.
 *
 * Set STRICT_MODULE_DBS=true to make the process exit when a module database
 * is not configured / refused (useful in production once everything is set).
 */
const connections = require('./connections');

const isSet = (k) => !!(process.env[k] && String(process.env[k]).trim());

function buildReport() {
  const production = process.env.NODE_ENV === 'production';

  const flowdeskCore = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CLIENT_URL'];
  const flowdeskMissing = flowdeskCore.filter((k) => !isSet(k));

  const attendanceOptional = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
  const attendanceOptionalMissing = attendanceOptional.filter((k) => !isSet(k));

  return {
    production,
    flowdeskMissing,
    moduleDbMissing: connections.missingModuleVars(),
    attendanceOptionalMissing,
    strict: String(process.env.STRICT_MODULE_DBS).toLowerCase() === 'true',
  };
}

function printReport(report = buildReport()) {
  if (report.flowdeskMissing.length) {
    const level = report.production ? 'error' : 'warn';
    console[level](
      `⚠️  Flowdesk variables not set: ${report.flowdeskMissing.join(', ')} ` +
      `(built-in development defaults are in effect${report.production ? ' — NOT SAFE FOR PRODUCTION' : ''})`
    );
  }
  if (report.moduleDbMissing.length) {
    console.warn(
      `⚠️  Module database variables not set: ${report.moduleDbMissing.join(', ')} — ` +
      `the corresponding module(s) are disabled and their endpoints return 503. ` +
      `Flowdesk itself is unaffected and will NOT fall back to another database.`
    );
  }
  if (!report.moduleDbMissing.includes('ATTENDANCE_MONGODB_URI') && report.attendanceOptionalMissing.length) {
    console.warn(
      `ℹ️  Attendance push notifications disabled — not set: ${report.attendanceOptionalMissing.join(', ')}`
    );
  }
  return report;
}

/** Call after connectAll(): exit in strict mode if any module DB isn't usable. */
function enforceStrict(report) {
  if (!report.strict) return;
  const st = connections.status();
  const bad = Object.entries(st)
    .filter(([k, v]) => k !== 'flowdesk' && v.state !== 'connected')
    .map(([k, v]) => `${v.label} (${v.envVar}): ${v.state}`);
  if (bad.length) {
    console.error(`❌ STRICT_MODULE_DBS=true and these module databases are not usable → ${bad.join('; ')}`);
    process.exit(1);
  }
}

module.exports = { buildReport, printReport, enforceStrict };

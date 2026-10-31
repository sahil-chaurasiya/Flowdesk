/**
 * Connection registry for the unified Flowdesk backend.
 *
 * Flowdesk now talks to up to THREE independent MongoDB databases:
 *
 *   flowdesk   – the original Flowdesk database. Uses Mongoose's DEFAULT
 *                connection, initialised by config/database.js exactly as
 *                before, from MONGODB_URI. Nothing about it changes.
 *   attendance – the Attendance app's database, from ATTENDANCE_MONGODB_URI.
 *   finance    – the To Fly Accountant database, from ACCOUNTANT_MONGODB_URI.
 *
 * Design rules (see docs/INTEGRATION_REPORT.md):
 *
 *   1. Module connections are explicit `mongoose.createConnection()` objects,
 *      created at require-time (unopened) so models can be bound to them, and
 *      opened later by connectAll(). Models are registered ONLY on their own
 *      connection (`conn.model(...)`), never on the default connection, so an
 *      attendance/finance model can never land on the Flowdesk database and
 *      same-named models (Client, Service, User) never collide.
 *   2. A missing URI never falls back to another database. The module is simply
 *      "not configured": its routes answer 503 with the NAME of the missing
 *      variable, and its background jobs do not start.
 *   3. Two modules (or a module and Flowdesk) pointing at the SAME database are
 *      refused – they would share collections such as `users` and `clients`.
 *   4. Connection strings / credentials are never logged. Error text is
 *      scrubbed before it is printed or returned.
 *   5. If a module database is unreachable at boot it is retried in the
 *      background; the rest of the application keeps running.
 */
const mongoose = require('mongoose');

const MODULES = {
  attendance: {
    label: 'Attendance',
    envVar: 'ATTENDANCE_MONGODB_URI',
  },
  finance: {
    label: 'Revenue & Finance',
    envVar: 'ACCOUNTANT_MONGODB_URI',
  },
};

const RETRY_MS = 30 * 1000;

const registry = {};
for (const [name, def] of Object.entries(MODULES)) {
  registry[name] = {
    name,
    ...def,
    // Unopened connection: models can be bound now, the socket opens later.
    conn: mongoose.createConnection(),
    state: 'not_started', // not_started | not_configured | refused | connecting | connected | error
    lastError: null,
    retryTimer: null,
    eventsBound: false,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Remove anything that looks like a connection string / credentials. */
function scrub(text) {
  if (!text) return text;
  return String(text)
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, 'mongodb://***')
    .replace(/\/\/[^/\s:@]+:[^/\s@]+@/g, '//***:***@');
}

/** "host1,host2/dbname" – used only to detect two URIs targeting one database. */
function fingerprint(uri) {
  const m = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)\/?([^?]*)/i.exec(String(uri || '').trim());
  if (!m) return null;
  const hosts = m[1].toLowerCase().split(',').map((h) => h.trim()).sort().join(',');
  const db = (m[2] || 'test').toLowerCase();
  return `${hosts}/${db}`;
}

function configuredUri(name) {
  const v = process.env[MODULES[name].envVar];
  return v && v.trim() ? v.trim() : null;
}

function entry(name) {
  const e = registry[name];
  if (!e) throw new Error(`Unknown module database "${name}"`);
  return e;
}

// ── public API ───────────────────────────────────────────────────────────────

/** The Connection object for a module. Always returns a Connection (maybe unopened). */
function getConnection(name) {
  return entry(name).conn;
}

/**
 * Register (or fetch) a model on a module's own connection.
 * Collection names are left to Mongoose's default pluralisation – exactly what
 * the original standalone apps produced – so existing data is read in place.
 */
function bindModel(moduleName, modelName, schema, collection) {
  const { conn } = entry(moduleName);
  if (conn.models[modelName]) return conn.models[modelName];
  return collection ? conn.model(modelName, schema, collection) : conn.model(modelName, schema);
}

function isReady(name) {
  return entry(name).conn.readyState === 1;
}

function bindEvents(e) {
  if (e.eventsBound) return;
  e.eventsBound = true;
  e.conn.on('connected', () => {
    e.state = 'connected';
    e.lastError = null;
    console.log(`✅ ${e.label} DB connected`);
  });
  e.conn.on('error', (err) => {
    e.lastError = scrub(err.message);
    console.error(`❌ ${e.label} DB error: ${e.lastError}`);
  });
  e.conn.on('disconnected', () => {
    if (e.state === 'connected') e.state = 'error';
    console.warn(`⚠️  ${e.label} DB disconnected`);
  });
  e.conn.on('reconnected', () => {
    e.state = 'connected';
    console.log(`✅ ${e.label} DB reconnected`);
  });
}

async function connectModule(name, { onConnected } = {}) {
  const e = entry(name);
  const uri = configuredUri(name);

  if (!uri) {
    e.state = 'not_configured';
    e.lastError = `${e.envVar} is not set`;
    return false;
  }

  // Refuse to share a database with Flowdesk or another module.
  const mine = fingerprint(uri);
  const flowdeskUri = (process.env.MONGODB_URI || 'mongodb://localhost:27017/toflymedia').trim();
  const others = [['Flowdesk (MONGODB_URI)', fingerprint(flowdeskUri)]];
  for (const other of Object.keys(MODULES).filter((n) => n !== name)) {
    const u = configuredUri(other);
    if (u) others.push([`${MODULES[other].label} (${MODULES[other].envVar})`, fingerprint(u)]);
  }
  const clash = others.find(([, fp]) => fp && fp === mine);
  if (mine && clash) {
    e.state = 'refused';
    e.lastError = `${e.envVar} points at the same database as ${clash[0]}. Each application must keep its own database.`;
    console.error(`❌ ${e.label}: ${e.lastError}`);
    return false;
  }

  bindEvents(e);
  e.state = 'connecting';
  try {
    await e.conn.openUri(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
    e.state = 'connected';
    e.lastError = null;
    if (typeof onConnected === 'function') {
      try { await onConnected(); } catch (err) { console.error(`${e.label} onConnected hook failed: ${scrub(err.message)}`); }
    }
    return true;
  } catch (err) {
    e.state = 'error';
    e.lastError = scrub(err.message);
    console.error(`❌ ${e.label} DB connection failed: ${e.lastError}`);
    // openUri leaves the connection in a failed state – make sure it is closed so
    // that a retry starts clean.
    try { await e.conn.close(); } catch (_) { /* ignore */ }
    scheduleRetry(name, { onConnected });
    return false;
  }
}

function scheduleRetry(name, opts) {
  const e = entry(name);
  if (e.retryTimer) return;
  e.retryTimer = setTimeout(async () => {
    e.retryTimer = null;
    console.log(`🔁 Retrying ${e.label} DB connection…`);
    await connectModule(name, opts);
  }, RETRY_MS);
  if (e.retryTimer.unref) e.retryTimer.unref();
}

/**
 * Open every configured module database (in parallel).
 * `hooks[name]` runs once after that module connects (e.g. start its cron jobs).
 * Returns a status summary. Never throws for module DBs.
 */
async function connectAll(hooks = {}) {
  await Promise.all(Object.keys(MODULES).map((n) => connectModule(n, { onConnected: hooks[n] })));
  return status();
}

function status() {
  const out = {
    flowdesk: {
      label: 'Flowdesk',
      envVar: 'MONGODB_URI',
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    },
  };
  for (const [name, e] of Object.entries(registry)) {
    out[name] = {
      label: e.label,
      envVar: e.envVar,
      configured: !!configuredUri(name),
      state: e.conn.readyState === 1 ? 'connected' : e.state,
      error: e.conn.readyState === 1 ? null : e.lastError,
    };
  }
  return out;
}

/** Names of required module variables that are not set (names only, never values). */
function missingModuleVars() {
  return Object.keys(MODULES).filter((n) => !configuredUri(n)).map((n) => MODULES[n].envVar);
}

/** Express guard: 503 unless the module's database is connected. */
function requireModuleDb(name) {
  return (req, res, next) => {
    const e = entry(name);
    if (!configuredUri(name)) {
      return res.status(503).json({
        success: false,
        code: 'MODULE_DATABASE_NOT_CONFIGURED',
        module: name,
        message: `${e.label} is not configured on this server. Set ${e.envVar}.`,
        missing: [e.envVar],
      });
    }
    if (e.conn.readyState !== 1) {
      return res.status(503).json({
        success: false,
        code: 'MODULE_DATABASE_UNAVAILABLE',
        module: name,
        message: `${e.label} database is currently unavailable.`,
      });
    }
    next();
  };
}

async function closeAll() {
  await Promise.all(
    Object.values(registry).map(async (e) => {
      if (e.retryTimer) { clearTimeout(e.retryTimer); e.retryTimer = null; }
      try { await e.conn.close(); } catch (_) { /* ignore */ }
    })
  );
}

module.exports = {
  MODULES,
  getConnection,
  bindModel,
  isReady,
  connectModule,
  connectAll,
  status,
  missingModuleVars,
  requireModuleDb,
  closeAll,
  // exported for tests
  _internal: { scrub, fingerprint, registry },
};

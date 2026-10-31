/**
 * Test harness: boots the REAL server (index.js) as a child process against
 * throw-away databases on a local mongod. Safety: refuses to run unless every
 * database name ends in "_test".
 */
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const path = require('path');

const BASE = process.env.TEST_MONGO_BASE || 'mongodb://127.0.0.1:27117';
const DBS = { flowdesk: 'flowdesk_test', attendance: 'attendance_test', accountant: 'accountant_test' };
for (const n of Object.values(DBS)) if (!n.endsWith('_test')) throw new Error('unsafe test db name');
const uri = (k) => `${BASE}/${DBS[k]}`;

async function resetAll() {
  for (const k of Object.keys(DBS)) {
    const c = await mongoose.createConnection(uri(k)).asPromise();
    await c.dropDatabase();           // test databases only (names enforced above)
    await c.close();
  }
}

let port = 5600;
function startServer(extraEnv = {}, { omit = [] } = {}) {
  const p = port++;
  const env = {
    ...process.env,
    NODE_ENV: 'test', PORT: String(p),
    MONGODB_URI: uri('flowdesk'),
    ATTENDANCE_MONGODB_URI: uri('attendance'),
    ACCOUNTANT_MONGODB_URI: uri('accountant'),
    JWT_ACCESS_SECRET: 'test_access_secret_test_access_secret',
    JWT_REFRESH_SECRET: 'test_refresh_secret_test_refresh_secret',
    CLIENT_URL: 'http://localhost:5173',
    OFFICE_LATITUDE: '23.2310465', OFFICE_LONGITUDE: '77.442858', OFFICE_RADIUS_METERS: '200',
    ...extraEnv,
  };
  for (const k of omit) delete env[k];
  const child = spawn('node', ['index.js'], { cwd: path.join(__dirname, '..'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const base = `http://127.0.0.1:${p}`;
  const ready = (async () => {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(`${base}/api/health`); if (r.ok) { await new Promise((r2) => setTimeout(r2, 1500)); return; } } catch (_) {}
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error('server did not start:\n' + log);
  })();
  return { base, child, ready, logs: () => log, stop: () => new Promise((res) => { child.once('exit', res); child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 3000); }) };
}

const http = (base) => async (method, url, { token, body } = {}) => {
  const r = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await r.json(); } catch (_) {}
  return { status: r.status, body: json };
};

module.exports = { uri, DBS, resetAll, startServer, http, BASE };

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, resetAll, startServer, http } = require('./helpers');

// Models are only used to SEED the isolated *_test databases.
const bcrypt = require('bcryptjs');

let srv, call;
const tokens = {};
const OFFICE = { latitude: 23.2310465, longitude: 77.442858 };
const FAR = { latitude: 28.6139, longitude: 77.209 }; // Delhi

async function rawDb(k) { return mongoose.createConnection(uri(k)).asPromise(); }

test.before(async () => {
  await resetAll();

  // ── seed Flowdesk DB (users) ──────────────────────────────────────────────
  const fd = await rawDb('flowdesk');
  const pw = await bcrypt.hash('Password123!', 4);
  const mk = (name, email, role) => ({ name, email, password: pw, role, isActive: true, createdAt: new Date(), updatedAt: new Date() });
  await fd.collection('users').insertMany([
    mk('Admin', 'admin@t.com', 'admin'),
    mk('Emp One', 'emp1@t.com', 'copywriter'),
    mk('Unlinked', 'nobody@t.com', 'graphic_designer'),
    mk('Mgr', 'mgr@t.com', 'manager'),
    mk('Renamed', 'renamed-flowdesk@t.com', 'video_editor'),   // differs from attendance e-mail
  ]);
  await fd.close();

  // ── seed Attendance DB (pre-existing production-like data) ────────────────
  const at = await rawDb('attendance');
  const att = await at.collection('users').insertMany([
    { name: 'Emp One', email: 'emp1@t.com', password: pw, role: 'employee', isActive: true, department: '', phone: '', avatar: '', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Video Person', email: 'video-att@t.com', password: pw, role: 'employee', isActive: true, department: '', phone: '', avatar: '', createdAt: new Date(), updatedAt: new Date() },
  ]);
  await at.collection('attendances').insertOne({ userId: att.insertedIds[0], date: '2026-03-01', status: 'present', workHours: 8 });
  await at.close();

  srv = startServer();
  await srv.ready;
  call = http(srv.base);
  for (const [k, email] of [['admin', 'admin@t.com'], ['emp', 'emp1@t.com'], ['nobody', 'nobody@t.com'], ['mgr', 'mgr@t.com'], ['renamed', 'renamed-flowdesk@t.com']]) {
    const r = await call('POST', '/api/auth/login', { body: { email, password: 'Password123!' } });
    assert.equal(r.status, 200, `login ${email}`);
    tokens[k] = r.body.accessToken;
  }
});

test.after(async () => { if (srv) await srv.stop(); });

test('existing Flowdesk health + auth contract unchanged', async () => {
  const h = await call('GET', '/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.body.message, 'FlowDesk API is running');
  const me = await call('GET', '/api/auth/me', { token: tokens.admin });
  assert.equal(me.status, 200);
});

test('unauthenticated requests are rejected on every module', async () => {
  for (const url of ['/api/attendance/today', '/api/attendance/admin/dashboard', '/api/finance/clients', '/api/finance/dashboard', '/api/overview/summary', '/api/identity/attendance', '/api/modules/access']) {
    const r = await call('GET', url);
    assert.equal(r.status, 401, url);
  }
  const bad = await call('GET', '/api/finance/clients', { token: 'garbage' });
  assert.equal(bad.status, 401);
});

test('a token from another app (different secret) is rejected', async () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ id: new mongoose.Types.ObjectId() }, 'attendance_app_secret');
  assert.equal((await call('GET', '/api/attendance/today', { token: forged })).status, 401);
  assert.equal((await call('GET', '/api/finance/clients', { token: forged })).status, 401);
});

test('legacy databases are untouched at boot (no retention delete of pre-2026-04 data)', async () => {
  const at = await rawDb('attendance');
  const old = await at.collection('attendances').countDocuments({ date: '2026-03-01' });
  await at.close();
  assert.equal(old, 1);
});

test('attendance: e-mail-matched employee works, geofence enforced on the backend', async () => {
  const access = await call('GET', '/api/modules/access', { token: tokens.emp });
  assert.equal(access.body.access.attendance.link.status, 'linked');
  assert.equal(access.body.access.attendance.link.source, 'email');

  const far = await call('POST', '/api/attendance/checkin', { token: tokens.emp, body: FAR });
  assert.ok([400, 403].includes(far.status), `far checkin should be refused, got ${far.status}`);
  const near = await call('POST', '/api/attendance/checkin', { token: tokens.emp, body: OFFICE });
  assert.equal(near.status, 201, JSON.stringify(near.body));
  const today = await call('GET', '/api/attendance/today', { token: tokens.emp });
  assert.ok(today.body.attendance.checkInTime);

  // record landed in the ATTENDANCE db and nowhere else
  const at = await rawDb('attendance'); const fd = await rawDb('flowdesk'); const ac = await rawDb('accountant');
  const todayCount = await at.collection('attendances').countDocuments({ checkInTime: { $ne: null } });
  assert.equal(todayCount, 1);
  assert.equal((await fd.db.listCollections({ name: 'attendances' }).toArray()).length, 0);
  assert.equal((await ac.db.listCollections({ name: 'attendances' }).toArray()).length, 0);
  await at.close(); await fd.close(); await ac.close();
});

test('attendance: unlinked user is refused until an explicit, validated link exists', async () => {
  const r = await call('GET', '/api/attendance/today', { token: tokens.nobody });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'ATTENDANCE_PROFILE_NOT_LINKED');

  // non-admin cannot manage links
  assert.equal((await call('GET', '/api/identity/attendance', { token: tokens.emp })).status, 403);

  const rec = await call('GET', '/api/identity/attendance', { token: tokens.admin });
  assert.equal(rec.status, 200);
  const renamed = rec.body.flowdeskUsers.find((u) => u.email === 'renamed-flowdesk@t.com');
  assert.equal(renamed.status, 'unmatched');
  const orphan = rec.body.orphanAttendanceUsers.find((u) => u.email === 'video-att@t.com');
  assert.ok(orphan);

  // differing e-mails need explicit confirmation
  const body = { flowdeskUserId: renamed.id, attendanceUserId: orphan.id };
  const refused = await call('POST', '/api/identity/attendance/links', { token: tokens.admin, body });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'EMAIL_MISMATCH');
  const ok = await call('POST', '/api/identity/attendance/links', { token: tokens.admin, body: { ...body, confirmEmailMismatch: true } });
  assert.equal(ok.status, 201);

  // duplicate claim refused
  const dup = await call('POST', '/api/identity/attendance/links', { token: tokens.admin, body: { flowdeskUserId: renamed.id, attendanceUserId: orphan.id, confirmEmailMismatch: true } });
  assert.equal(dup.status, 409);

  const after = await call('GET', '/api/attendance/today', { token: tokens.renamed });
  assert.equal(after.status, 200);

  // the first employee's e-mail-matched attendance account is not hijackable via a link made for someone else
  const emp1 = rec.body.flowdeskUsers.find((u) => u.email === 'emp1@t.com');
  const att1 = rec.body.flowdeskUsers.find((u) => u.email === 'emp1@t.com').attendanceUser;
  const hijack = await call('POST', '/api/identity/attendance/links', { token: tokens.admin, body: { flowdeskUserId: rec.body.flowdeskUsers.find((u) => u.email === 'mgr@t.com').id, attendanceUserId: att1.id, confirmEmailMismatch: true } });
  assert.equal(hijack.status, 201); // admin's explicit decision is allowed…
  const emp1After = await call('GET', '/api/attendance/today', { token: tokens.emp });
  assert.equal(emp1After.status, 403, '…and the e-mail match is then no longer honoured for the original user');
  void emp1;
});

test('attendance admin screens: admin without employee profile works, others forbidden', async () => {
  const d = await call('GET', '/api/attendance/admin/dashboard', { token: tokens.admin });
  assert.equal(d.status, 200);
  assert.ok('totalEmployees' in d.body.dashboard);
  assert.equal((await call('GET', '/api/attendance/admin/dashboard', { token: tokens.renamed })).status, 403);
  assert.equal((await call('GET', '/api/attendance/admin/employees', { token: tokens.mgr })).status, 403);
  // admin cannot check in without an employee profile (would create an orphan record)
  const ci = await call('POST', '/api/attendance/checkin', { token: tokens.admin, body: OFFICE });
  assert.equal(ci.status, 403);
  assert.equal(ci.body.code, 'ATTENDANCE_PROFILE_REQUIRED');
});

test('finance: default role matrix (admin only) enforced on the backend', async () => {
  for (const t of ['emp', 'mgr', 'nobody']) {
    assert.equal((await call('GET', '/api/finance/dashboard', { token: tokens[t] })).status, 403, `read ${t}`);
    assert.equal((await call('POST', '/api/finance/clients', { token: tokens[t], body: { name: 'x' } })).status, 403, `write ${t}`);
  }
  assert.equal((await call('GET', '/api/finance/clients', { token: tokens.admin })).status, 200);
});

test('finance: CRUD hits ONLY the accountant database; Flowdesk clients collection is untouched', async () => {
  const c = await call('POST', '/api/finance/clients', { token: tokens.admin, body: { name: 'Acme Finance Client', startDate: '2026-04-01', contractValue: 50000 } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const id = c.body._id || c.body.client?._id;
  assert.ok(id);

  const pay = await call('POST', '/api/finance/payments', { token: tokens.admin, body: { clientId: id, amount: 12000, paymentDate: new Date().toISOString(), month: new Date().getMonth() + 1, year: new Date().getFullYear() } });
  assert.equal(pay.status, 201, JSON.stringify(pay.body));
  const exp = await call('POST', '/api/finance/expenses', { token: tokens.admin, body: { title: 'Rent', amount: 3000, category: 'Rent', expenseDate: new Date().toISOString() } });
  assert.ok([200, 201].includes(exp.status), JSON.stringify(exp.body));

  const dash = await call('GET', '/api/finance/dashboard', { token: tokens.admin });
  assert.equal(dash.status, 200);
  assert.equal(dash.body.cards.currentMonthRevenue, 12000);
  assert.equal(dash.body.cards.currentMonthExpenses, 3000);
  assert.equal(dash.body.cards.netProfit, 9000);

  const ac = await rawDb('accountant'); const fd = await rawDb('flowdesk');
  assert.equal(await ac.collection('clients').countDocuments({ name: 'Acme Finance Client' }), 1);
  assert.equal(await fd.collection('clients').countDocuments({}), 0, 'Flowdesk clients collection must stay empty');
  assert.equal((await fd.db.listCollections({ name: 'payments' }).toArray()).length, 0);
  await ac.close(); await fd.close();

  // financial request bodies are not mirrored into Flowdesk's ApiLog
  const fd2 = await rawDb('flowdesk');
  const logs = await fd2.collection('apilogs').find({ url: /\/api\/finance\/payments/, method: 'POST' }).toArray();
  await fd2.close();
  assert.ok(logs.every((l) => l.requestBody && l.requestBody.redacted === 'finance module'));
});

test('overview: independent widgets from independent databases', async () => {
  const r = await call('GET', '/api/overview/summary', { token: tokens.admin });
  assert.equal(r.status, 200);
  assert.equal(r.body.attendance.status, 'ok');
  assert.equal(r.body.finance.status, 'ok');
  assert.equal(r.body.finance.data.revenue, 12000);
  assert.ok(r.body.finance.data.recentTransactions.length >= 2);

  const e = await call('GET', '/api/overview/summary', { token: tokens.renamed });
  assert.equal(e.body.finance.status, 'forbidden');
  assert.equal(e.body.attendance.status, 'ok');
  assert.equal(e.body.attendance.data.scope, 'self');
});

test('module status endpoint is admin-only and leaks no connection strings', async () => {
  assert.equal((await call('GET', '/api/modules/status', { token: tokens.emp })).status, 403);
  const s = await call('GET', '/api/modules/status', { token: tokens.admin });
  assert.equal(s.status, 200);
  const text = JSON.stringify(s.body);
  assert.ok(!/mongodb:\/\//.test(text) && !text.includes('127.0.0.1'));
  assert.equal(s.body.databases.attendance.state, 'connected');
  assert.equal(s.body.databases.finance.state, 'connected');
});

test('missing module variable: module returns 503 naming the variable; Flowdesk keeps working; no fallback', async () => {
  const s2 = startServer({}, { omit: ['ACCOUNTANT_MONGODB_URI'] });
  await s2.ready;
  const c2 = http(s2.base);
  const login = await c2('POST', '/api/auth/login', { body: { email: 'admin@t.com', password: 'Password123!' } });
  assert.equal(login.status, 200);
  const f = await c2('GET', '/api/finance/clients', { token: login.body.accessToken });
  assert.equal(f.status, 503);
  assert.equal(f.body.code, 'MODULE_DATABASE_NOT_CONFIGURED');
  assert.deepEqual(f.body.missing, ['ACCOUNTANT_MONGODB_URI']);
  const ov = await c2('GET', '/api/overview/summary', { token: login.body.accessToken });
  assert.equal(ov.body.finance.status, 'not_configured');
  assert.equal(ov.body.attendance.status, 'ok');           // other modules unaffected
  assert.match(s2.logs(), /ACCOUNTANT_MONGODB_URI/);       // reported by NAME
  assert.ok(!s2.logs().includes('mongodb://127.0.0.1'));    // …never the value
  await s2.stop();
  // nothing was written to the accountant db by the unconfigured instance
  const fd = await rawDb('flowdesk');
  assert.equal(await fd.collection('clients').countDocuments({}), 0);
  await fd.close();
});

test('a module URI that points at the Flowdesk database is refused', async () => {
  const s3 = startServer({ ATTENDANCE_MONGODB_URI: uri('flowdesk') });
  await s3.ready;
  const c3 = http(s3.base);
  const login = await c3('POST', '/api/auth/login', { body: { email: 'emp1@t.com', password: 'Password123!' } });
  const r = await c3('GET', '/api/attendance/today', { token: login.body.accessToken });
  assert.equal(r.status, 503);
  assert.match(s3.logs(), /same database as Flowdesk/);
  await s3.stop();
});

test('unreachable module database: 503 for that module only, secrets scrubbed, STRICT mode exits', async () => {
  const dead = 'mongodb://user:supersecretpw@127.0.0.1:1/dead_test';
  const s4 = startServer({ ACCOUNTANT_MONGODB_URI: dead });
  await s4.ready;
  const c4 = http(s4.base);
  const login = await c4('POST', '/api/auth/login', { body: { email: 'admin@t.com', password: 'Password123!' } });
  const r = await c4('GET', '/api/finance/clients', { token: login.body.accessToken });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'MODULE_DATABASE_UNAVAILABLE');
  assert.equal((await c4('GET', '/api/attendance/admin/dashboard', { token: login.body.accessToken })).status, 200);
  assert.ok(!s4.logs().includes('supersecretpw'));
  assert.ok(!JSON.stringify(r.body).includes('supersecretpw'));
  await s4.stop();

  const s5 = startServer({ ACCOUNTANT_MONGODB_URI: dead, STRICT_MODULE_DBS: 'true' });
  const exited = await new Promise((res) => { s5.child.once('exit', (code) => res(code)); setTimeout(() => res('timeout'), 25000); });
  assert.equal(exited, 1);
  assert.ok(!s5.logs().includes('supersecretpw'));
});

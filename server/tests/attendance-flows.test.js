/**
 * Attendance workflows through the unified API (leave, WFH, regularization,
 * holidays, employee admin, export) with real Flowdesk tokens, against
 * throw-away *_test databases.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { uri, resetAll, startServer, http } = require('./helpers');

let srv, call; const tok = {};
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };
const nextWeekday = (from) => { const d = addDays(from); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d; };
const raw = (k) => mongoose.createConnection(uri(k)).asPromise();

test.before(async () => {
  await resetAll();
  const pw = await bcrypt.hash('Password123!', 4); const now = new Date();
  const fd = await raw('flowdesk');
  await fd.collection('users').insertMany([
    { name: 'Admin', email: 'admin@t.com', password: pw, role: 'admin', isActive: true, createdAt: now, updatedAt: now },
    { name: 'Emp', email: 'emp@t.com', password: pw, role: 'copywriter', isActive: true, createdAt: now, updatedAt: now },
  ]);
  await fd.close();
  const at = await raw('attendance');
  await at.collection('users').insertOne({ name: 'Emp', email: 'emp@t.com', password: pw, role: 'employee', isActive: true, department: '', phone: '', avatar: '', createdAt: now, updatedAt: now });
  await at.close();
  srv = startServer(); await srv.ready; call = http(srv.base);
  for (const [k, e] of [['admin', 'admin@t.com'], ['emp', 'emp@t.com']]) tok[k] = (await call('POST', '/api/auth/login', { body: { email: e, password: 'Password123!' } })).body.accessToken;
});
test.after(async () => { if (srv) await srv.stop(); });

test('leave: request → overlap refused → admin approve → employee cannot approve', async () => {
  const s = iso(nextWeekday(10)), e = iso(nextWeekday(10));
  const r = await call('POST', '/api/attendance/leave/request', { token: tok.emp, body: { leaveType: 'casual', startDate: s, endDate: e, reason: 'family' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.leave?._id || r.body.request?._id || r.body.leaveRequest?._id;
  assert.ok(id, JSON.stringify(r.body));
  const dup = await call('POST', '/api/attendance/leave/request', { token: tok.emp, body: { leaveType: 'casual', startDate: s, endDate: e, reason: 'again' } });
  assert.equal(dup.status, 400);
  assert.equal((await call('GET', '/api/attendance/leave/my-leaves', { token: tok.emp })).status, 200);
  assert.equal((await call('PUT', `/api/attendance/leave/requests/${id}/approve`, { token: tok.emp, body: {} })).status, 403);
  const list = await call('GET', '/api/attendance/leave/requests', { token: tok.admin });
  assert.equal(list.status, 200);
  const ok = await call('PUT', `/api/attendance/leave/requests/${id}/approve`, { token: tok.admin, body: { adminNote: 'ok' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const at = await raw('attendance');
  const lr = await at.collection('leaverequests').findOne({ _id: new mongoose.Types.ObjectId(id) });
  assert.equal(lr.status, 'approved');
  assert.equal(await at.collection('attendances').countDocuments({ status: 'on_leave' }) >= 1, true, 'approval writes on_leave attendance to the ATTENDANCE db');
  await at.close();
});

test('WFH: request → admin approves → employee status', async () => {
  const r = await call('POST', '/api/attendance/wfh/request', { token: tok.emp, body: { latitude: 28.6, longitude: 77.2, accuracy: 10, comment: 'plumber visit', daysRequested: 1 } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.request?._id || r.body.wfhRequest?._id || r.body.wfh?._id;
  assert.ok(id, JSON.stringify(r.body));
  assert.equal((await call('PUT', `/api/attendance/wfh/requests/${id}/approve`, { token: tok.emp, body: { daysApproved: 1 } })).status, 403);
  assert.equal((await call('PUT', `/api/attendance/wfh/requests/${id}/approve`, { token: tok.admin, body: { daysApproved: 1 } })).status, 200);
  const st = await call('GET', '/api/attendance/wfh/my-status', { token: tok.emp });
  assert.equal(st.status, 200);
});

test('WFH approval is what lets a far-away check-in through (geofence still enforced otherwise)', async () => {
  const far = { latitude: 28.6, longitude: 77.2 };
  const ci = await call('POST', '/api/attendance/checkin', { token: tok.emp, body: far });
  assert.equal(ci.status, 201, 'approved WFH permits check-in from the requested area: ' + JSON.stringify(ci.body));
});

test('regularization: request → employee cannot approve → admin approves → record corrected', async () => {
  const d = iso(addDays(-3));
  const r = await call('POST', '/api/attendance/regularization/request', { token: tok.emp, body: { date: d, requestType: 'both', checkInTime: '10:00', checkOutTime: '18:30', reason: 'forgot' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.request?._id;
  assert.ok(id, JSON.stringify(r.body));
  assert.equal((await call('PUT', `/api/attendance/regularization/requests/${id}/approve`, { token: tok.emp, body: {} })).status, 403);
  assert.equal((await call('GET', '/api/attendance/regularization/requests/pending-count', { token: tok.admin })).status, 200);
  assert.equal((await call('PUT', `/api/attendance/regularization/requests/${id}/approve`, { token: tok.admin, body: { adminNote: 'fine' } })).status, 200);
  const at = await raw('attendance');
  const rec = await at.collection('attendances').findOne({ date: d });
  assert.ok(rec && rec.checkInTime && rec.checkOutTime, 'attendance record created in attendance DB');
  await at.close();
});

test('holidays: admin manages, everyone reads, employee cannot write', async () => {
  const d = iso(addDays(20));
  assert.equal((await call('POST', '/api/attendance/holidays', { token: tok.emp, body: { date: d, name: 'X' } })).status, 403);
  const c = await call('POST', '/api/attendance/holidays', { token: tok.admin, body: { date: d, name: 'Company Day' } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const list = await call('GET', '/api/attendance/holidays', { token: tok.emp });
  assert.equal(list.status, 200);
  const id = c.body.holiday?._id;
  assert.equal((await call('DELETE', `/api/attendance/holidays/${id}`, { token: tok.admin })).status, 200);
});

test('employee admin + records + monthly report + Excel export (admin only)', async () => {
  assert.equal((await call('POST', '/api/attendance/admin/employees', { token: tok.emp, body: { name: 'N', email: 'n@t.com' } })).status, 403);
  const c = await call('POST', '/api/attendance/admin/employees', { token: tok.admin, body: { name: 'New Hire', email: 'new@t.com', department: 'Ops' } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const at = await raw('attendance'); const fd = await raw('flowdesk');
  assert.equal(await at.collection('users').countDocuments({ email: 'new@t.com' }), 1);
  assert.equal(await fd.collection('users').countDocuments({ email: 'new@t.com' }), 0, 'attendance employee must not appear in Flowdesk users');
  await at.close(); await fd.close();

  const now = new Date(); const q = `month=${now.getUTCMonth() + 1}&year=${now.getUTCFullYear()}`;
  assert.equal((await call('GET', `/api/attendance/admin/attendance?${q}`, { token: tok.admin })).status, 200);
  assert.equal((await call('GET', `/api/attendance/admin/reports/monthly?${q}`, { token: tok.admin })).status, 200);
  const x = await fetch(`${srv.base}/api/attendance/admin/attendance/export?${q}`, { headers: { Authorization: `Bearer ${tok.admin}` } });
  assert.equal(x.status, 200);
  assert.match(x.headers.get('content-type') || '', /spreadsheet|excel|octet|csv/i);
  assert.ok((await x.arrayBuffer()).byteLength > 500);
  assert.equal((await call('GET', '/api/attendance/users', { token: tok.emp })).status, 403);
});

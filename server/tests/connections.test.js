const test = require('node:test');
const assert = require('node:assert/strict');
const connections = require('../config/connections');
const { scrub, fingerprint } = connections._internal;

test('scrub removes connection strings and credentials from error text', () => {
  const msg = 'failed to connect mongodb+srv://bob:p%40ss@cluster0.abc.mongodb.net/db?retryWrites=true';
  const out = scrub(msg);
  assert.ok(!out.includes('bob') && !out.includes('p%40ss') && !out.includes('cluster0'));
  assert.ok(!scrub('auth failed //user:secret@host/db').includes('secret'));
  assert.equal(scrub(null), null);
});

test('fingerprint identifies the same database regardless of credentials / host order', () => {
  const a = fingerprint('mongodb://u:p@h1:27017,h2:27017/crm?x=1');
  const b = fingerprint('mongodb://other:pw@h2:27017,h1:27017/CRM');
  assert.equal(a, b);
  assert.notEqual(a, fingerprint('mongodb://u:p@h1:27017,h2:27017/attendance'));
  assert.equal(fingerprint('mongodb+srv://u:p@c0.net/'), fingerprint('mongodb+srv://x:y@c0.net/test'));
  assert.equal(fingerprint('not a uri'), null);
});

test('models bind to their own connection, never the default one', () => {
  const mongoose = require('mongoose');
  const Att = require('../modules/attendance/models/User');
  const Fin = require('../modules/finance/models/Client');
  assert.equal(Att.db, connections.getConnection('attendance'));
  assert.equal(Fin.db, connections.getConnection('finance'));
  assert.notEqual(Att.db, mongoose.connection);
  assert.notEqual(Fin.db, mongoose.connection);
  assert.ok(!Object.keys(mongoose.models).some((n) => ['Attendance', 'Payment', 'Expense'].includes(n)), 'module models must not be on the default connection');
  // same-named models in different databases stay separate
  const FdClient = require('../models/Client');
  assert.notEqual(FdClient, Fin);
  assert.equal(FdClient.db, mongoose.connection);
  // collection names preserved from the standalone apps
  assert.equal(Att.collection.collectionName, 'users');
  assert.equal(require('../modules/attendance/models/Attendance').collection.collectionName, 'attendances');
  assert.equal(Fin.collection.collectionName, 'clients');
  assert.equal(require('../modules/finance/models/SalaryPayment').collection.collectionName, 'salarypayments');
});

test('permission defaults are least-privilege and env-overridable; clients can never be granted', () => {
  const { can } = require('../config/permissions');
  delete process.env.FINANCE_VIEW_ROLES; delete process.env.FINANCE_WRITE_ROLES;
  assert.equal(can.financeView('admin'), true);
  for (const r of ['manager', 'developer', 'copywriter', 'client']) assert.equal(can.financeView(r), false, r);
  assert.equal(can.attendanceAdmin('manager'), false);
  assert.equal(can.attendanceUse('client'), false);
  process.env.FINANCE_VIEW_ROLES = 'manager,client';
  assert.equal(can.financeView('manager'), true);
  assert.equal(can.financeWrite('manager'), false, 'view role does not imply write');
  assert.equal(can.financeView('client'), false, 'client is always stripped');
  delete process.env.FINANCE_VIEW_ROLES;
});

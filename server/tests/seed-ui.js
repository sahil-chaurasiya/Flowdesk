// Seeds ONLY the *_test databases (name-guarded in helpers.js) for the browser smoke test.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { uri, resetAll } = require('./helpers');
(async () => {
  await resetAll();
  const pw = await bcrypt.hash('Password123!', 4);
  const now = new Date();
  const fd = await mongoose.createConnection(uri('flowdesk')).asPromise();
  const mk = (name, email, role) => ({ name, email, password: pw, role, isActive: true, createdAt: now, updatedAt: now });
  await fd.collection('users').insertMany([mk('Admin User', 'admin@t.com', 'admin'), mk('Emp One', 'emp1@t.com', 'copywriter')]);
  await fd.close();
  const at = await mongoose.createConnection(uri('attendance')).asPromise();
  await at.collection('users').insertOne({ name: 'Emp One', email: 'emp1@t.com', password: pw, role: 'employee', isActive: true, department: 'Content', phone: '', avatar: '', createdAt: now, updatedAt: now });
  await at.close();
  console.log('seeded');
})();

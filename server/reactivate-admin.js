require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function reactivateAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const result = await User.findOneAndUpdate(
    { role: 'admin' },          // finds the admin account
    { $set: { isActive: true } },
    { new: true }
  );

  if (result) {
    console.log(`✅ Reactivated: ${result.name} (${result.email})`);
  } else {
    console.log('❌ No admin user found');
  }

  await mongoose.disconnect();
}

reactivateAdmin().catch(console.error);
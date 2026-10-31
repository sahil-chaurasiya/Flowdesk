const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toflymedia', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// IMPORTANT: an EventEmitter's 'error' event with no listener throws an
// uncaught exception and crashes the whole Node process. Atlas shared/free
// clusters routinely emit transient connection errors (primary elections,
// network blips) — without this listener, every one of those was killing
// the server and causing the auto-restarts.
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
  // Do NOT process.exit() here — mongoose handles reconnection internally.
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Graceful shutdown: close Flowdesk's connection AND the independent module
// connections (attendance / accountant). SIGTERM is what most hosts send.
const shutdown = async () => {
  try { await require('./connections').closeAll(); } catch (_) { /* ignore */ }
  await mongoose.connection.close();
  console.log('MongoDB connections closed through app termination');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = connectDB;
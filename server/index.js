require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./config/database');
const { initSocket } = require('./config/socket');
const { errorHandler } = require('./middleware/error');
const apiLogger        = require('./middleware/apiLogger');

// ── Existing routes (DO NOT REMOVE) ──────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const clientRoutes       = require('./routes/clients');
const taskRoutes         = require('./routes/tasks');
const updateRoutes       = require('./routes/updates');
const messageRoutes      = require('./routes/messages');
const fileRoutes         = require('./routes/files');
const reportRoutes       = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const leadsRouter        = require('./routes/leads');
const dashboardRouter    = require('./routes/dashboard');
const socialRouter       = require('./routes/social');
const { router: eventsRouter, emitEvent } = require('./routes/events');

// ── Existing new routes ───────────────────────────────────────────────────────
const activityRouter  = require('./routes/activity');
const calendarRouter  = require('./routes/calendar');
const importantDaysRouter = require('./routes/importantDays');
const searchRouter    = require('./routes/search');

// ── AI Assistant route ────────────────────────────────────────────────────────
const aiRouter = require('./routes/ai');

// ── Call Log Tracker (admin + performance_marketer only) ──────────────────────
const callLogsRouter      = require('./routes/callLogs');

// ── Internal Lead Management (admin + performance_marketer only) ───────────────
const internalLeadsRouter = require('./routes/internalLeads');
const servicesRouter      = require('./routes/services');
const apiLogsRouter       = require('./routes/apiLogs');
const credentialsRouter   = require('./routes/credentials');
const contactsRouter      = require('./routes/contacts');
const targetsRouter       = require('./routes/targets');
const documentsRouter     = require('./routes/documents');
const paymentsRouter      = require('./routes/payments');
const dailyLogsRouter     = require('./routes/dailyLogs');

const app    = express();
const server = http.createServer(app);

// Init Socket.io
initSocket(server);

// Connect Database
connectDB();

// Security Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
app.use(cors({
  origin: [
    'https://flowdesk.toflymediaa.com',
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight for all routes
app.options('*', cors());

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files for local uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Request Logger (before all routes) ────────────────────────────────────
app.use(apiLogger);

// Make emitEvent available globally for other routes
app.locals.emitEvent = emitEvent;

// ── Mount routes ──────────────────────────────────────────────────────────────

// Existing — rate limiter REMOVED from auth
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/clients',       clientRoutes);
app.use('/api/tasks',         taskRoutes);
app.use('/api/updates',       updateRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/files',         fileRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/leads',         leadsRouter);
app.use('/api/dashboard',     dashboardRouter);
app.use('/api/social',        socialRouter);
app.use('/api/events',        eventsRouter);

// New (pre-existing)
app.use('/api/activity',  activityRouter);
app.use('/api/calendar',       calendarRouter);
app.use('/api/important-days', importantDaysRouter);
app.use('/api/search',    searchRouter);

// ── AI Assistant ──────────────────────────────────────────────────────────────
app.use('/api/ai', aiRouter);

// ── Internal Lead Management ──────────────────────────────────────────────────
app.use('/api/internal-leads', internalLeadsRouter);
app.use('/api/call-logs',      callLogsRouter);
app.use('/api/services',       servicesRouter);
app.use('/api/logs',           apiLogsRouter);
app.use('/api/credentials',    credentialsRouter);
app.use('/api/contacts',       contactsRouter);
app.use('/api/targets',        targetsRouter);
app.use('/api/documents',      documentsRouter);
app.use('/api/payments',       paymentsRouter);
app.use('/api/daily-logs',     dailyLogsRouter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'FlowDesk API is running', timestamp: new Date() });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global Error Handler
app.use(errorHandler);

// ── Global crash guards ────────────────────────────────────────────────────
// Without these, ANY unhandled promise rejection or thrown error anywhere in
// the app (not just Mongo) takes down the entire server for every user.
// We log it instead of exiting so one bad request doesn't kill everyone else.
process.on('unhandledRejection', (reason) => {
  console.error('🔥 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 FlowDesk Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  console.log(`🤖 AI Assistant: ${process.env.GROQ_API_KEY ? 'enabled' : 'GROQ_API_KEY not set — AI disabled'}`);

  // ── Deadline auto-move: 'today' tasks past their deadline → 'pending' ──────
  const Task = require('./models/Task');
  const runDeadlineCheck = async () => {
    try {
      const result = await Task.updateMany(
        { status: 'today', deadline: { $lt: new Date() } },
        { $set: { status: 'pending' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`⏰ Moved ${result.modifiedCount} overdue "today" task(s) → pending`);
      }
    } catch (err) {
      console.error('Deadline check error:', err.message);
    }
  };
  runDeadlineCheck();
  setInterval(runDeadlineCheck, 60 * 60 * 1000);
});

module.exports = { app, server };
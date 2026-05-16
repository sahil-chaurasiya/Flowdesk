require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const { initSocket } = require('./config/socket');
const { errorHandler } = require('./middleware/error');

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
const searchRouter    = require('./routes/search');

// ── AI Assistant route ────────────────────────────────────────────────────────
const aiRouter = require('./routes/ai');

const app    = express();
const server = http.createServer(app);

// Init Socket.io
initSocket(server);

// Connect Database
connectDB();

// Security Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Auth-specific stricter limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files for local uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make emitEvent available globally for other routes
app.locals.emitEvent = emitEvent;

// ── Mount routes ──────────────────────────────────────────────────────────────

// Existing
app.use('/api/auth',          authLimiter, authRoutes);
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
app.use('/api/calendar',  calendarRouter);
app.use('/api/search',    searchRouter);

// ── AI Assistant ──────────────────────────────────────────────────────────────
// All AI requests require JWT auth. Context is built server-side — the frontend
// has zero control over what data the AI receives.
app.use('/api/ai', aiRouter);

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 FlowDesk Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  console.log(`🤖 AI Assistant: ${process.env.GROQ_API_KEY ? 'enabled' : 'GROQ_API_KEY not set — AI disabled'}`);
});

module.exports = { app, server };

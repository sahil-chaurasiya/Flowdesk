/**
 * Attendance module (the Attendance application).
 * Mounted at /api/attendance  — see server/index.js.
 *
 * Original route                →  Unified route
 *   /api/attendance/*           →  /api/attendance/*              (checkin, checkout, today, history, stats)
 *   /api/admin/*                →  /api/attendance/admin/*
 *   /api/wfh/*                  →  /api/attendance/wfh/*
 *   /api/leave/*                →  /api/attendance/leave/*
 *   /api/regularization/*       →  /api/attendance/regularization/*
 *   /api/holidays/*             →  /api/attendance/holidays/*
 *   /api/notifications/*        →  /api/attendance/notifications/*   (web-push)
 *   /api/users                  →  /api/attendance/users            (now admin-only)
 *   /api/auth/{me,profile,change-password} → /api/attendance/auth/*  (login is Flowdesk's)
 *   /api/health                 →  Flowdesk's /api/health
 *
 * The prefix is needed because several original paths (auth, users, notifications,
 * health) collide with Flowdesk's own routes.
 */
const express = require('express');
const { errorHandler } = require('./middleware/errorHandler');
const cronJobs = require('./services/cronJobs');

const router = express.Router();

// The original app forced no-caching on every API response (stale check-in data
// behind a CDN was a real problem for it). Keep that for this module only.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

router.use('/auth', require('./routes/auth'));
router.use('/admin', require('./routes/admin'));
router.use('/users', require('./routes/users'));
router.use('/wfh', require('./routes/wfh'));
router.use('/leave', require('./routes/leave'));
router.use('/regularization', require('./routes/regularization'));
router.use('/notifications', require('./routes/notifications'));
router.use('/holidays', require('./routes/holiday'));
router.use('/', require('./routes/attendance'));

router.use(errorHandler);

module.exports = { router, startJobs: cronJobs.start };

/**
 * Webhook / Automation Events Route
 * 
 * These endpoints are designed for tools like n8n, Zapier, or custom webhooks.
 * They emit structured event payloads that describe what happened in the system.
 * 
 * External tools can poll GET /api/events or register a webhook URL to receive
 * POST callbacks when events fire.
 */

const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { SocialPost } = require('../models/SocialPost');
const Report = require('../models/Report');
const Client = require('../models/Client');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// In-memory event log (replace with Redis/DB in production)
// Stores last 500 events
const eventLog = [];
const MAX_EVENTS = 500;

function pushEvent(type, payload) {
  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    timestamp: new Date().toISOString()
  };
  eventLog.unshift(event);
  if (eventLog.length > MAX_EVENTS) eventLog.length = MAX_EVENTS;
  return event;
}

// Export so other routes can push events
const emitEvent = pushEvent;

// @route GET /api/events
// Returns recent events (for polling-based integrations like n8n)
router.get('/', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { type, since, limit = 50 } = req.query;
  let events = [...eventLog];

  if (type) events = events.filter(e => e.type === type);
  if (since) {
    const sinceDate = new Date(since);
    events = events.filter(e => new Date(e.timestamp) > sinceDate);
  }

  res.json({
    success: true,
    events: events.slice(0, Number(limit)),
    total: events.length
  });
}));

// @route GET /api/events/types
// Lists all event types the system can emit
router.get('/types', protect, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    eventTypes: [
      { type: 'task.completed',       description: 'Fires when a task status is set to completed' },
      { type: 'task.review_requested',description: 'Fires when a task is sent for review' },
      { type: 'post.published',       description: 'Fires when a social post status is set to published' },
      { type: 'report.created',       description: 'Fires when a new performance report is created' },
      { type: 'lead.batch_uploaded',  description: 'Fires when a new batch of leads is uploaded' },
      { type: 'update.created',       description: 'Fires when a new client update is posted' },
      { type: 'file.uploaded',        description: 'Fires when a file is uploaded for a client' },
    ]
  });
}));

// @route POST /api/events/simulate (dev/test only)
// Simulate an event for testing webhook integrations
router.post('/simulate', protect, authorize('admin'), asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Not available in production' });
  }

  const { type } = req.body;
  const simulatedPayloads = {
    'task.completed': { taskId: 'sample_id', title: 'Create landing page', client: 'Test Client', completedBy: req.user.name },
    'post.published': { postId: 'sample_id', platform: 'instagram', contentType: 'reel', client: 'Test Client' },
    'report.created': { reportId: 'sample_id', title: 'Monthly Report - July', client: 'Test Client', period: 'monthly' },
  };

  const event = pushEvent(type, simulatedPayloads[type] || { note: 'simulated' });
  res.json({ success: true, event });
}));

module.exports = { router, emitEvent };

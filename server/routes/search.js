const express = require('express');
const router = express.Router();
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const User          = require('../models/User');
const Client        = require('../models/Client');
const Task          = require('../models/Task');
const Lead          = require('../models/Lead');
const InternalLead  = require('../models/InternalLead');
const CalendarEvent = require('../models/CalendarEvent');
const { SocialPost } = require('../models/SocialPost');
const File          = require('../models/File');
const { Message, Conversation } = require('../models/Message');
const WebsiteProject = require('../models/WebsiteProject');

const ALL_INTERNAL = ['admin', 'manager', ...TEAM_ROLES];

// @route  GET /api/search?q=<query>
// @desc   Global search across ALL entities
// @access All internal team
router.get('/', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const { q = '' } = req.query;
  const term = q.trim();

  if (!term || term.length < 2) {
    return res.json({
      success: true,
      results: {
        users: [], clients: [], tasks: [], leads: [],
        internalLeads: [], events: [], socialPosts: [], files: [], messages: [],
        websiteProjects: [],
      },
    });
  }

  const regex = { $regex: term, $options: 'i' };
  const isManager = ['admin', 'manager'].includes(req.user.role);
  // Software developers get near-admin visibility into the Website Work
  // section specifically (same access rule as server/routes/websiteWork.js),
  // but nothing else manager-only (clients, leads, social, team, etc).
  const canSeeWebsiteWork = ['admin', 'developer'].includes(req.user.role);
  const LIMIT = 5;

  const [
    users,
    clients,
    tasks,
    leads,
    internalLeads,
    events,
    socialPosts,
    files,
    messages,
    websiteProjects,
  ] = await Promise.all([

    // ── Users (managers/admins only) ─────────────────────────────────────────
    isManager
      ? User.find({ $or: [{ name: regex }, { email: regex }, { jobTitle: regex }], isActive: true })
          .select('name email role avatar jobTitle')
          .limit(LIMIT)
          .lean()
      : Promise.resolve([]),

    // ── Clients (managers/admins only) ──────────────────────────────────────
    isManager
      ? Client.find({ $or: [{ company: regex }, { name: regex }, { industry: regex }, { email: regex }, { phone: regex }] })
          .select('company name industry status email phone')
          .limit(LIMIT)
          .lean()
      : Promise.resolve([]),

    // ── Tasks (team sees only their own; managers see all; developers also
    //    see every Website Work task regardless of assignment — same
    //    visibility they already get on the Website Work page itself) ──────
    Task.find({
      $and: [
        { $or: [{ title: regex }, { description: regex }, { category: regex }] },
        isManager
          ? {}
          : canSeeWebsiteWork
            ? { $or: [{ assignedTo: req.user._id }, { isWebsiteWork: true }] }
            : { assignedTo: req.user._id },
      ],
    })
      .populate('client', 'company')
      .populate('websiteProject', 'name')
      .select('title status priority category deadline client isWebsiteWork websiteProject')
      .limit(LIMIT)
      .lean(),

    // ── Leads (managers only) ────────────────────────────────────────────────
    isManager
      ? Lead.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }, { company: regex }] })
          .populate('client', 'company')
          .select('name email phone status quality client batchLabel')
          .limit(LIMIT)
          .lean()
      : Promise.resolve([]),

    // ── Internal Leads (managers only) ───────────────────────────────────────
    isManager
      ? InternalLead.find({
          $or: [
            { name: regex }, { email: regex }, { phone: regex },
            { company: regex }, { requirements: regex }, { sourceDetail: regex },
          ],
        })
          .select('name email phone company stage source budget services')
          .limit(LIMIT)
          .lean()
      : Promise.resolve([]),

    // ── Calendar Events ──────────────────────────────────────────────────────
    // team sees their own or public events; managers see all
    CalendarEvent.find({
      $and: [
        { $or: [{ title: regex }, { description: regex }] },
        isManager
          ? {}
          : {
              $or: [
                { createdBy: req.user._id },
                { assignedTo: req.user._id },
                { visibility: 'all' },
              ],
            },
      ],
    })
      .populate('client', 'company')
      .select('title description type startDate endDate client')
      .limit(LIMIT)
      .lean(),

    // ── Social Posts (managers only) ─────────────────────────────────────────
    isManager
      ? SocialPost.find({
          $or: [{ caption: regex }, { hashtags: regex }],
        })
          .populate('client', 'company')
          .select('caption platform contentType status client hashtags')
          .limit(LIMIT)
          .lean()
      : Promise.resolve([]),

    // ── Files ─────────────────────────────────────────────────────────────────
    // team sees public files for their clients; managers see all
    File.find({
      $or: [{ name: regex }, { originalName: regex }, { description: regex }, { tags: regex }],
      ...(isManager ? {} : { isPublic: true }),
    })
      .populate('client', 'company')
      .select('name originalName category description tags client mimeType size')
      .limit(LIMIT)
      .lean(),

    // ── Messages ─────────────────────────────────────────────────────────────
    // Search message content; team sees only conversations they participate in
    (async () => {
      // First find conversations the user can access
      const conversationFilter = isManager
        ? {}
        : { participants: req.user._id };

      const accessibleConversations = await Conversation.find(conversationFilter)
        .select('_id client')
        .lean();

      const convIds = accessibleConversations.map(c => c._id);

      if (!convIds.length) return [];

      return Message.find({
        conversation: { $in: convIds },
        content: regex,
      })
        .populate({ path: 'conversation', select: 'client', populate: { path: 'client', select: 'company' } })
        .populate('sender', 'name avatar')
        .select('content sender conversation createdAt')
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .lean();
    })(),

    // ── Website Work projects (admin + developer only) ───────────────────────
    canSeeWebsiteWork
      ? WebsiteProject.find({ $or: [{ name: regex }, { description: regex }] })
          .select('name description status priority categories')
          .limit(LIMIT)
          .lean()
      : Promise.resolve([]),
  ]);

  res.json({
    success: true,
    results: {
      users:         users.map(u => ({ ...u, _type: 'user' })),
      clients:       clients.map(c => ({ ...c, _type: 'client' })),
      tasks:         tasks.map(t => ({ ...t, _type: 'task' })),
      leads:         leads.map(l => ({ ...l, _type: 'lead' })),
      internalLeads: internalLeads.map(l => ({ ...l, _type: 'internalLead' })),
      events:        events.map(e => ({ ...e, _type: 'event' })),
      socialPosts:   socialPosts.map(p => ({ ...p, _type: 'socialPost' })),
      files:         files.map(f => ({ ...f, _type: 'file' })),
      messages:      messages.map(m => ({ ...m, _type: 'message' })),
      websiteProjects: websiteProjects.map(p => ({ ...p, _type: 'websiteProject' })),
    },
    query: term,
  });
}));

module.exports = router;
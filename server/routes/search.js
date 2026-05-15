const express = require('express');
const router = express.Router();
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const User   = require('../models/User');
const Client = require('../models/Client');
const Task   = require('../models/Task');
const Lead   = require('../models/Lead');

const ALL_INTERNAL = ['admin', 'manager', ...TEAM_ROLES];

// @route  GET /api/search?q=<query>
// @desc   Global search across users, clients, tasks, leads
// @access All internal team
router.get('/', protect, authorize(...ALL_INTERNAL), asyncHandler(async (req, res) => {
  const { q = '' } = req.query;
  const term = q.trim();

  if (!term || term.length < 2) {
    return res.json({ success: true, results: { users: [], clients: [], tasks: [], leads: [] } });
  }

  const regex = { $regex: term, $options: 'i' };
  const isManager = ['admin', 'manager'].includes(req.user.role);
  const LIMIT = 5;

  const [users, clients, tasks, leads] = await Promise.all([
    // Users — managers/admins only
    isManager
      ? User.find({ $or: [{ name: regex }, { email: regex }, { jobTitle: regex }], isActive: true })
          .select('name email role avatar jobTitle')
          .limit(LIMIT)
          .lean()
      : Promise.resolve([]),

    // Clients — managers/admins only
    isManager
      ? Client.find({ $or: [{ company: regex }, { name: regex }, { industry: regex }] })
          .select('company name industry status')
          .limit(LIMIT)
          .lean()
      : Promise.resolve([]),

    // Tasks — team sees only their own, managers see all
    Task.find({
      $or: [{ title: regex }, { description: regex }],
      ...(isManager ? {} : { assignedTo: req.user._id }),
    })
      .populate('client', 'company')
      .select('title status priority category deadline client')
      .limit(LIMIT)
      .lean(),

    // Leads — managers only
    isManager
      ? Lead.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }, { company: regex }] })
          .populate('client', 'company')
          .select('name email phone status quality client batchLabel')
          .limit(LIMIT)
          .lean()
      : Promise.resolve([]),
  ]);

  res.json({
    success: true,
    results: {
      users:   users.map(u => ({ ...u, _type: 'user' })),
      clients: clients.map(c => ({ ...c, _type: 'client' })),
      tasks:   tasks.map(t => ({ ...t, _type: 'task' })),
      leads:   leads.map(l => ({ ...l, _type: 'lead' })),
    },
    query: term,
  });
}));

module.exports = router;

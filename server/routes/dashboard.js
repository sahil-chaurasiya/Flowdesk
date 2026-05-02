const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Client = require('../models/Client');
const User = require('../models/User');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route GET /api/dashboard/stats  (admin/manager)
router.get('/stats', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const TEAM_ROLES = ['admin', 'manager', 'performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

  const [
    activeClients,
    tasksByStatus,
    teamCount,
    totalLeads,
    recentTasks
  ] = await Promise.all([
    Client.countDocuments({ status: 'active' }),
    Task.aggregate([
      { $match: { status: { $in: ['pending', 'in_progress', 'review'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    User.countDocuments({ role: { $in: TEAM_ROLES }, isActive: true }),
    Lead.countDocuments({}),
    Task.find({ status: { $in: ['pending', 'in_progress'] } })
      .sort({ priority: -1, deadline: 1 })
      .limit(5)
      .populate('client', 'company')
      .populate('assignedTo', 'name role')
      .lean()
  ]);

  const byStatus = tasksByStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
  const openTasks = (byStatus.pending || 0) + (byStatus.in_progress || 0);
  const reviewTasks = byStatus.review || 0;

  res.json({
    success: true,
    activeClients,
    openTasks,
    reviewTasks,
    teamCount,
    totalLeads,
    recentTasks,
  });
}));

// @route GET /api/dashboard/team  (admin/manager — see per-member workload)
router.get('/team', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const TEAM_ROLES = ['performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

  const members = await User.find({ role: { $in: TEAM_ROLES }, isActive: true }).select('name role jobTitle avatar');

  const workload = await Promise.all(members.map(async (member) => {
    const [pending, inProgress, review, completed] = await Promise.all([
      Task.countDocuments({ assignedTo: member._id, status: 'pending' }),
      Task.countDocuments({ assignedTo: member._id, status: 'in_progress' }),
      Task.countDocuments({ assignedTo: member._id, status: 'review' }),
      Task.countDocuments({ assignedTo: member._id, status: 'completed' }),
    ]);
    return { member, pending, inProgress, review, completed, total: pending + inProgress + review };
  }));

  res.json({ success: true, workload });
}));

module.exports = router;

const express = require('express');
const router = express.Router();
const { SocialAccount, SocialPost } = require('../models/SocialPost');
const Client = require('../models/Client');
const { protect, authorize, TEAM_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createNotification } = require('../utils/notifications');

// ═══════════════════════════════════════════════════════════════
// SOCIAL ACCOUNTS
// ═══════════════════════════════════════════════════════════════

// GET /api/social/accounts?clientId=xxx
router.get('/accounts', protect, asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const query = {};

  if (req.user.role === 'client') {
    query.client = req.user.clientId;
  } else if (clientId) {
    query.client = clientId;
  }

  const accounts = await SocialAccount.find(query)
    .populate('client', 'name company')
    .sort({ platform: 1 });

  res.json({ success: true, accounts });
}));

// POST /api/social/accounts
router.post('/accounts', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const account = await SocialAccount.create(req.body);
  res.status(201).json({ success: true, account });
}));

// PUT /api/social/accounts/:id
router.put('/accounts/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const account = await SocialAccount.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
  res.json({ success: true, account });
}));

// DELETE /api/social/accounts/:id
router.delete('/accounts/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  await SocialAccount.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Account deleted' });
}));

// ═══════════════════════════════════════════════════════════════
// SOCIAL POSTS
// ═══════════════════════════════════════════════════════════════

// GET /api/social/posts
router.get('/posts', protect, asyncHandler(async (req, res) => {
  const {
    clientId, platform, status, contentType,
    page = 1, limit = 20, assignedTo
  } = req.query;

  const query = {};

  if (req.user.role === 'client') {
    query.client = req.user.clientId;
    query.isClientVisible = true;
  } else if (clientId) {
    query.client = clientId;
  }

  if (platform) query.platform = platform;
  if (status) query.status = status;
  if (contentType) query.contentType = contentType;
  if (assignedTo) query.assignedTo = assignedTo;

  const total = await SocialPost.countDocuments(query);
  const posts = await SocialPost.find(query)
    .populate('client', 'name company')
    .populate('createdBy', 'name avatar role')
    .populate('assignedTo', 'name avatar role')
    .populate('publishedBy', 'name avatar')
    .sort({ publishedAt: -1, scheduledAt: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, posts, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// POST /api/social/posts
router.post('/posts', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  const post = await SocialPost.create({ ...req.body, createdBy: req.user._id });

  const populated = await SocialPost.findById(post._id)
    .populate('client', 'name company')
    .populate('createdBy', 'name avatar role')
    .populate('assignedTo', 'name avatar role');

  // Notify assignee if different from creator
  if (post.assignedTo && String(post.assignedTo) !== String(req.user._id)) {
    await createNotification(post.assignedTo, {
      type: 'task',
      title: '📱 Social Post Assigned',
      body: `New ${post.contentType} for ${post.platform} has been assigned to you`,
      link: '/admin/social'
    });
  }

  res.status(201).json({ success: true, post: populated });
}));

// GET /api/social/posts/:id
router.get('/posts/:id', protect, asyncHandler(async (req, res) => {
  const post = await SocialPost.findById(req.params.id)
    .populate('client', 'name company')
    .populate('createdBy', 'name avatar role')
    .populate('assignedTo', 'name avatar role')
    .populate('publishedBy', 'name avatar')
    .populate('approvedBy', 'name avatar');

  if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

  if (req.user.role === 'client') {
    if (String(post.client._id) !== String(req.user.clientId) || !post.isClientVisible) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
  }

  res.json({ success: true, post });
}));

// PUT /api/social/posts/:id
router.put('/posts/:id', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  const existing = await SocialPost.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Post not found' });

  // Track who published / scheduled
  if (req.body.status === 'published' && existing.status !== 'published') {
    req.body.publishedBy = req.user._id;
    req.body.publishedAt = new Date();
    // Notify client when post is published
    const client = await Client.findById(existing.client);
    if (client?.linkedUserId) {
      await createNotification(client.linkedUserId, {
        type: 'general',
        title: '📱 New Content Published',
        body: `A new ${existing.contentType} was published on ${existing.platform}`,
        link: '/portal/social'
      });
    }
    // Emit automation event
    try { req.app.locals.emitEvent?.('post.published', { postId: existing._id, platform: existing.platform, contentType: existing.contentType, client: client?.company }); } catch {}
  }
  if (req.body.status === 'scheduled' && existing.status !== 'scheduled') {
    req.body.scheduledBy = req.user._id;
  }

  // Recalculate engagementRate if metrics are being updated (pre-save hook doesn't fire on findByIdAndUpdate)
  if (req.body.metrics) {
    const m = req.body.metrics;
    const reach = m.reach ?? existing.metrics?.reach ?? 0;
    if (reach > 0) {
      const likes = m.likes ?? existing.metrics?.likes ?? 0;
      const comments = m.comments ?? existing.metrics?.comments ?? 0;
      const shares = m.shares ?? existing.metrics?.shares ?? 0;
      req.body['metrics.engagementRate'] = parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2));
      // Flatten metrics into dot-notation keys to avoid replacing the whole metrics object
      Object.keys(m).forEach(k => { req.body[`metrics.${k}`] = m[k]; });
      delete req.body.metrics;
    }
  }

  const post = await SocialPost.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('client', 'name company')
    .populate('createdBy', 'name avatar role')
    .populate('assignedTo', 'name avatar role')
    .populate('publishedBy', 'name avatar');

  res.json({ success: true, post });
}));

// DELETE /api/social/posts/:id
router.delete('/posts/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  await SocialPost.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Post deleted' });
}));

// ═══════════════════════════════════════════════════════════════
// ANALYTICS AGGREGATIONS
// ═══════════════════════════════════════════════════════════════

// GET /api/social/analytics?clientId=xxx&days=30
router.get('/analytics', protect, asyncHandler(async (req, res) => {
  const { clientId, days = 90 } = req.query;

  const clientFilter = req.user.role === 'client'
    ? req.user.clientId
    : clientId || null;

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - Number(days));

  const matchQuery = {
    status: 'published',
    publishedAt: { $gte: dateFrom }
  };
  if (clientFilter) {
    try {
      const mongoose = require('mongoose');
      const oid = clientFilter instanceof mongoose.Types.ObjectId
        ? clientFilter
        : new mongoose.Types.ObjectId(String(clientFilter));
      matchQuery.client = oid;
    } catch {
      // Invalid ObjectId — ignore filter, return all
    }
  }

  // Aggregate by platform
  const byPlatform = await SocialPost.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$platform',
        posts: { $sum: 1 },
        totalLikes: { $sum: '$metrics.likes' },
        totalComments: { $sum: '$metrics.comments' },
        totalShares: { $sum: '$metrics.shares' },
        totalViews: { $sum: '$metrics.views' },
        totalReach: { $sum: '$metrics.reach' },
        avgEngagementRate: { $avg: '$metrics.engagementRate' }
      }
    }
  ]);

  // Posts over time (daily)
  const overTime = await SocialPost.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishedAt' } },
        posts: { $sum: 1 },
        totalLikes: { $sum: '$metrics.likes' },
        totalReach: { $sum: '$metrics.reach' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Content type breakdown
  const byContentType = await SocialPost.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$contentType', count: { $sum: 1 }, avgEngagement: { $avg: '$metrics.engagementRate' } } }
  ]);

  // Top performing posts
  const topPosts = await SocialPost.find(matchQuery)
    .populate('client', 'name company')
    .sort({ 'metrics.engagementRate': -1 })
    .limit(5);

  // Totals
  const totals = await SocialPost.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalPosts: { $sum: 1 },
        totalLikes: { $sum: '$metrics.likes' },
        totalComments: { $sum: '$metrics.comments' },
        totalShares: { $sum: '$metrics.shares' },
        totalViews: { $sum: '$metrics.views' },
        totalReach: { $sum: '$metrics.reach' },
        avgEngagementRate: { $avg: '$metrics.engagementRate' }
      }
    }
  ]);

  res.json({
    success: true,
    analytics: {
      totals: totals[0] || {},
      byPlatform,
      overTime,
      byContentType,
      topPosts
    }
  });
}));

// GET /api/social/calendar?clientId=xxx&month=2025-07
router.get('/calendar', protect, asyncHandler(async (req, res) => {
  const { clientId, month } = req.query;
  const clientFilter = req.user.role === 'client' ? req.user.clientId : clientId;

  let dateFrom, dateTo;
  if (month) {
    const [yr, mo] = month.split('-').map(Number);
    dateFrom = new Date(yr, mo - 1, 1);
    dateTo = new Date(yr, mo, 0, 23, 59, 59);
  } else {
    const now = new Date();
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const query = {
    $or: [
      { scheduledAt: { $gte: dateFrom, $lte: dateTo } },
      { publishedAt: { $gte: dateFrom, $lte: dateTo } }
    ]
  };
  if (clientFilter) query.client = clientFilter;
  if (req.user.role === 'client') query.isClientVisible = true;

  const posts = await SocialPost.find(query)
    .populate('client', 'name company')
    .populate('assignedTo', 'name avatar')
    .select('platform contentType status caption scheduledAt publishedAt client assignedTo thumbnail mediaUrls');

  res.json({ success: true, posts });
}));

module.exports = router;
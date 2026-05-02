const express = require('express');
const router = express.Router();
const { Conversation, Message } = require('../models/Message');
const Client = require('../models/Client');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { getIO } = require('../config/socket');
const { createNotification } = require('../utils/notifications');

// @route GET /api/messages/conversations
router.get('/conversations', protect, asyncHandler(async (req, res) => {
  let query = { participants: req.user._id };
  if (req.user.role === 'client') query = { client: req.user.clientId };

  const conversations = await Conversation.find(query)
    .populate('participants', 'name avatar role jobTitle')
    .populate('client', 'name company logo')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 });

  res.json({ success: true, conversations });
}));

// @route GET /api/messages/conversations/:clientId
router.get('/conversations/:clientId', protect, asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  if (req.user.role === 'client' && String(req.user.clientId) !== clientId) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  let conversation = await Conversation.findOne({ client: clientId })
    .populate('participants', 'name avatar role jobTitle lastLogin')
    .populate('client', 'name company logo');

  if (!conversation) {
    // Create conversation with client user and account manager
    const client = await Client.findById(clientId).populate('accountManager', '_id');
    const participants = [];
    if (client?.linkedUserId) participants.push(client.linkedUserId);
    if (client?.accountManager) participants.push(client.accountManager._id);

    conversation = await Conversation.create({ client: clientId, participants });
    conversation = await Conversation.findById(conversation._id)
      .populate('participants', 'name avatar role jobTitle lastLogin')
      .populate('client', 'name company logo');
  }

  res.json({ success: true, conversation });
}));

// @route GET /api/messages/:conversationId
router.get('/:conversationId', protect, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const conversation = await Conversation.findById(req.params.conversationId);
  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

  const total = await Message.countDocuments({ conversation: req.params.conversationId, isDeleted: false });
  const messages = await Message.find({ conversation: req.params.conversationId, isDeleted: false })
    .populate('sender', 'name avatar role')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  // Mark as read
  await Message.updateMany(
    { conversation: req.params.conversationId, 'readBy.user': { $ne: req.user._id } },
    { $push: { readBy: { user: req.user._id } } }
  );

  res.json({ success: true, messages: messages.reverse(), total, page: Number(page) });
}));

// @route POST /api/messages/:conversationId
router.post('/:conversationId', protect, asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.conversationId)
    .populate('participants', 'name avatar role clientId');

  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

  // Validate access
  if (req.user.role === 'client' && String(req.user.clientId) !== String(conversation.client)) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const message = await Message.create({
    conversation: req.params.conversationId,
    sender: req.user._id,
    content: req.body.content,
    type: req.body.type || 'text',
    attachments: req.body.attachments || [],
    readBy: [{ user: req.user._id }]
  });

  const populated = await Message.findById(message._id).populate('sender', 'name avatar role');

  // Update conversation
  await Conversation.findByIdAndUpdate(req.params.conversationId, {
    lastMessage: message._id,
    lastMessageAt: new Date(),
    $addToSet: { participants: req.user._id }
  });

  // Emit via Socket.io
  try {
    const io = getIO();
    io.to(`conversation:${req.params.conversationId}`).emit('message:new', populated);
  } catch (e) {}

  // Notify other participants
  const otherParticipants = conversation.participants.filter(p => String(p._id) !== String(req.user._id));
  for (const participant of otherParticipants) {
    await createNotification(participant._id, {
      type: 'message',
      title: `New message from ${req.user.name}`,
      body: req.body.content?.substring(0, 100),
      link: `/messages`
    });
  }

  res.status(201).json({ success: true, message: populated });
}));

// @route DELETE /api/messages/message/:messageId
router.delete('/message/:messageId', protect, asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

  if (String(message.sender) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  message.isDeleted = true;
  message.content = 'This message was deleted';
  await message.save();

  res.json({ success: true, message: 'Message deleted' });
}));

// @route POST /api/messages/conversations/:clientId/add-participant
router.post('/conversations/:clientId/add-participant', protect, asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOneAndUpdate(
    { client: req.params.clientId },
    { $addToSet: { participants: req.body.userId } },
    { new: true }
  ).populate('participants', 'name avatar role');

  res.json({ success: true, conversation });
}));

module.exports = router;

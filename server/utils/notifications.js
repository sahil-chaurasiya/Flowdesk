const User = require('../models/User');
const { getIO } = require('../config/socket');

const createNotification = async (userId, { type, title, body, link }) => {
  try {
    const notification = { type, title, body, link, read: false, createdAt: new Date() };

    await User.findByIdAndUpdate(userId, {
      $push: {
        notifications: {
          $each: [notification],
          $position: 0,
          $slice: 50 // Keep last 50 notifications
        }
      }
    });

    // Emit real-time notification
    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('notification', notification);
    } catch (e) {
      // Socket may not be initialized in test env
    }

    return notification;
  } catch (error) {
    console.error('Notification error:', error);
  }
};

const notifyTeamAboutClient = async (clientId, notification, excludeUserId = null) => {
  try {
    const Client = require('../models/Client');
    const client = await Client.findById(clientId).populate('accountManager teamMembers');
    if (!client) return;

    const teamIds = [
      client.accountManager?._id,
      ...client.teamMembers.map(m => m._id)
    ].filter(id => id && String(id) !== String(excludeUserId));

    // Also notify admins
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    const allIds = [...new Set([...teamIds.map(String), ...admins.map(a => String(a._id))])];

    await Promise.all(allIds.map(id => createNotification(id, notification)));
  } catch (error) {
    console.error('Team notification error:', error);
  }
};

module.exports = { createNotification, notifyTeamAboutClient };

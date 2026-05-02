const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('./error');

// All non-client internal roles
const TEAM_ROLES = [
  'admin',
  'manager',
  'performance_marketer',
  'social_media_manager',
  'video_editor',
  'graphic_designer',
  'copywriter',
];

// Protect route — verify JWT
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
});

// Authorize route — check roles
const authorize = (...roles) => {
  // Allow 'team' as a shorthand for all non-client internal roles
  const expanded = [];
  roles.forEach(r => {
    if (r === 'team') expanded.push(...TEAM_ROLES);
    else expanded.push(r);
  });

  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (!expanded.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Role '${req.user.role}' is not authorized for this action` });
    }
    next();
  };
};

// Helper: check if user is any kind of team member (not client)
const isTeamMember = (user) => TEAM_ROLES.includes(user?.role);

module.exports = { protect, authorize, isTeamMember, TEAM_ROLES };

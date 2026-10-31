const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, clientId: user.clientId },
    process.env.JWT_ACCESS_SECRET || 'access_secret',
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

const sendTokenResponse = (user, statusCode, res) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Previously this hand-picked a handful of fields (name, email, role, ...)
  // which silently dropped createdAt, lastLogin, department, phone, etc.
  // from the login response — so "Member since" / "Last login" (and any
  // other account metadata) only showed up after a page refresh forced a
  // re-fetch from GET /auth/me. Use the model's own toJSON() instead, which
  // already strips password/refreshTokens and returns everything else —
  // the same full shape /auth/me returns. Applies to every account/role.
  const userJson = typeof user.toJSON === 'function' ? user.toJSON() : user;

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    user: userJson
  });
};

module.exports = { generateAccessToken, generateRefreshToken, sendTokenResponse };
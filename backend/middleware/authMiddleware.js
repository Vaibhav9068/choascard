const { verifyAccessToken } = require('../services/tokenService');
const ApiError = require('../utils/ApiError');

const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
};

const protect = (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    return next(new ApiError(401, 'Not authorized, no access token'));
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    next(new ApiError(401, 'Not authorized, access token invalid or expired'));
  }
};

module.exports = { protect, extractBearerToken };

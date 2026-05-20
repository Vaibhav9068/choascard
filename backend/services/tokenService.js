const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_MAX_AGE_MS,
} = require('../config/config');
const {
  generateRefreshToken,
  hashRefreshToken,
} = require('../utils/cryptoUtils');
const ApiError = require('../utils/ApiError');
const {
  setRefreshTokenCookie,
  clearLegacyJwtCookie,
} = require('../utils/cookieUtils');

const signAccessToken = (userId) =>
  jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

const verifyAccessToken = (token) => jwt.verify(token, JWT_SECRET);

const getAccessTokenPayload = () => ({
  expiresIn: 15 * 60,
});

const issueTokenPair = async (userId, res) => {
  const accessToken = signAccessToken(userId);
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

  await RefreshToken.create({
    userId,
    tokenHash,
    familyId,
    expiresAt,
  });

  setRefreshTokenCookie(res, refreshToken);
  clearLegacyJwtCookie(res);

  return {
    accessToken,
    ...getAccessTokenPayload(),
  };
};

const rotateRefreshToken = async (rawRefreshToken, res) => {
  if (!rawRefreshToken) {
    throw new ApiError(401, 'Refresh token missing');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored || stored.revokedAt) {
    if (stored?.familyId) {
      await RefreshToken.updateMany(
        { familyId: stored.familyId },
        { revokedAt: new Date() }
      );
    }
    throw new ApiError(401, 'Invalid refresh token');
  }

  if (stored.expiresAt < new Date()) {
    await RefreshToken.updateOne(
      { _id: stored._id },
      { revokedAt: new Date() }
    );
    throw new ApiError(401, 'Refresh token expired');
  }

  if (stored.replacedByTokenHash) {
    await RefreshToken.updateMany(
      { familyId: stored.familyId },
      { revokedAt: new Date() }
    );
    throw new ApiError(401, 'Refresh token reuse detected');
  }

  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashRefreshToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

  await RefreshToken.updateOne(
    { _id: stored._id },
    {
      revokedAt: new Date(),
      replacedByTokenHash: newTokenHash,
    }
  );

  await RefreshToken.create({
    userId: stored.userId,
    tokenHash: newTokenHash,
    familyId: stored.familyId,
    expiresAt,
  });

  const accessToken = signAccessToken(stored.userId);
  const { setRefreshTokenCookie } = require('../utils/cookieUtils');
  setRefreshTokenCookie(res, newRefreshToken);

  return {
    accessToken,
    userId: stored.userId,
    ...getAccessTokenPayload(),
  };
};

const revokeRefreshToken = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (stored) {
    await RefreshToken.updateMany(
      { familyId: stored.familyId },
      { revokedAt: new Date() }
    );
  }
};

const revokeAllUserTokens = async (userId) => {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() }
  );
};

const cleanupExpiredRefreshTokens = async () => {
  await RefreshToken.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { revokedAt: { $ne: null, $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    ],
  });
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredRefreshTokens,
  getAccessTokenPayload,
};

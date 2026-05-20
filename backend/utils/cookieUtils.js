const { NODE_ENV, REFRESH_TOKEN_MAX_AGE_MS } = require('../config/config');

const REFRESH_COOKIE_NAME = 'refreshToken';
const LEGACY_JWT_COOKIE = 'jwt';

const isProduction = NODE_ENV === 'production' || process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

const setRefreshTokenCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
};

const clearRefreshTokenCookie = (res) => {
  res.cookie(REFRESH_COOKIE_NAME, '', {
    ...cookieOptions,
    expires: new Date(0),
  });
};

const clearLegacyJwtCookie = (res) => {
  res.cookie(LEGACY_JWT_COOKIE, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    expires: new Date(0),
  });
};

const clearAllAuthCookies = (res) => {
  clearRefreshTokenCookie(res);
  clearLegacyJwtCookie(res);
};

const getRefreshTokenFromRequest = (req) =>
  req.cookies?.[REFRESH_COOKIE_NAME] || null;

module.exports = {
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  clearLegacyJwtCookie,
  clearAllAuthCookies,
  getRefreshTokenFromRequest,
};

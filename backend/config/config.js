const dotenv = require('dotenv');

dotenv.config();

const parseOrigins = (value) =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const clientUrlEnv = process.env.CLIENT_URL;

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  REFRESH_TOKEN_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: clientUrlEnv
    ? parseOrigins(clientUrlEnv)
    : [],
  OTP_EXPIRY_MS: 5 * 60 * 1000,
  OTP_MAX_ATTEMPTS: 5,
  OTP_RESEND_COOLDOWN_MS: 60 * 1000,
  OTP_RESEND_MAX_PER_HOUR: 5,
};

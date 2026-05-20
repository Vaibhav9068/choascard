const ApiError = require('../utils/ApiError');

const createRateLimiter = ({ windowMs, max, keyGenerator, message }) => {
  const hits = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now - entry.startedAt > windowMs) {
        hits.delete(key);
      }
    }
  };

  return (req, res, next) => {
    cleanup();
    const key = keyGenerator(req);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.startedAt > windowMs) {
      hits.set(key, { count: 1, startedAt: now });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      return next(new ApiError(429, message || 'Too many requests'));
    }

    return next();
  };
};

const authIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `auth:${req.ip}:${req.path}`,
  message: 'Too many auth requests from this IP',
});

const otpResendLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `otp-resend:${req.ip}:${req.body?.email || 'unknown'}`,
  message: 'Too many OTP resend requests',
});

module.exports = { authIpLimiter, otpResendLimiter, createRateLimiter };

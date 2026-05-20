const OTP = require('../models/OTP');
const User = require('../models/User');
const {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_RESEND_MAX_PER_HOUR,
} = require('../config/config');
const { generateOtp, hashOtp, verifyOtp } = require('../utils/cryptoUtils');
const { sendOtpEmail } = require('./emailService');
const ApiError = require('../utils/ApiError');

const normalizeEmail = (email) => email.trim().toLowerCase();

const cleanupExpiredOtps = async (email) => {
  await OTP.deleteMany({ email: normalizeEmail(email) });
};

const createAndSendOtp = async (email) => {
  const normalized = normalizeEmail(email);
  const existing = await OTP.findOne({ email: normalized });

  if (existing) {
    const sinceLastSend = Date.now() - new Date(existing.lastSentAt).getTime();
    if (sinceLastSend < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - sinceLastSend) / 1000);
      throw new ApiError(429, `Please wait ${waitSec}s before requesting another OTP`);
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (existing.createdAt > hourAgo && existing.resendCount >= OTP_RESEND_MAX_PER_HOUR) {
      throw new ApiError(429, 'OTP resend limit reached. Try again later.');
    }
  }

  await cleanupExpiredOtps(normalized);

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  try {
    await OTP.create({
      email: normalized,
      otpHash,
      attempts: 0,
      resendCount: existing ? existing.resendCount + 1 : 1,
      lastSentAt: new Date(),
    });
  } catch (dbErr) {
    console.error(`[OtpService] Failed to save OTP in DB for ${normalized}:`, dbErr);
    throw new ApiError(500, `Failed to initialize verification: ${dbErr.message}`);
  }

  await sendOtpEmail(normalized, otp);

  return { message: 'OTP sent to your email' };
};

const verifyOtpCode = async (email, otp) => {
  const normalized = normalizeEmail(email);
  const record = await OTP.findOne({ email: normalized });

  if (!record) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await cleanupExpiredOtps(normalized);
    throw new ApiError(429, 'Too many failed attempts. Request a new OTP.');
  }

  const isValid = await verifyOtp(otp, record.otpHash);

  if (!isValid) {
    record.attempts += 1;
    await record.save();

    const remaining = OTP_MAX_ATTEMPTS - record.attempts;
    if (remaining <= 0) {
      await cleanupExpiredOtps(normalized);
      throw new ApiError(429, 'Too many failed attempts. Request a new OTP.');
    }

    throw new ApiError(400, `Invalid OTP. ${remaining} attempt(s) remaining.`);
  }

  const user = await User.findOne({ email: normalized });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.isVerified = true;
  await user.save();
  await cleanupExpiredOtps(normalized);

  return user;
};

const resendOtp = async (email) => {
  const normalized = normalizeEmail(email);
  const user = await User.findOne({ email: normalized });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isVerified) {
    throw new ApiError(400, 'Email is already verified');
  }

  return createAndSendOtp(normalized);
};

module.exports = {
  createAndSendOtp,
  verifyOtpCode,
  resendOtp,
  cleanupExpiredOtps,
};

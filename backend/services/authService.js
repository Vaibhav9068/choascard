const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { issueTokenPair, rotateRefreshToken, revokeRefreshToken } = require('./tokenService');
const { createAndSendOtp, verifyOtpCode, resendOtp } = require('./otpService');
const { getRefreshTokenFromRequest, clearAllAuthCookies } = require('../utils/cookieUtils');
const ApiError = require('../utils/ApiError');

const formatUserResponse = (user) => ({
  _id: user._id,
  username: user.username,
  fullName: user.fullName,
  email: user.email,
  trophies: user.trophies,
  league: user.league,
  wins: user.wins,
  losses: user.losses,
  isVerified: user.isVerified,
});

const register = async ({ fullName, username, email, password }) => {
  if (!fullName?.trim() || !username?.trim() || !email?.trim() || !password) {
    throw new ApiError(400, 'All fields are required');
  }

  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: username.trim() }],
  });

  if (existing) {
    throw new ApiError(400, 'User already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await User.create({
    fullName: fullName.trim(),
    username: username.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    isVerified: false,
  });

  await createAndSendOtp(normalizedEmail);

  return { message: 'Registration successful. OTP sent to your email.' };
};

const verifyOTP = async (email, otp, res) => {
  if (!email || !otp) {
    throw new ApiError(400, 'Email and OTP are required');
  }

  const user = await verifyOtpCode(email, otp);
  const tokens = await issueTokenPair(user._id, res);

  return {
    ...tokens,
    user: formatUserResponse(user),
  };
};

const login = async (email, password, res) => {
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.isVerified) {
    throw new ApiError(403, 'Please verify your email via OTP first');
  }

  const tokens = await issueTokenPair(user._id, res);

  return {
    ...tokens,
    user: formatUserResponse(user),
  };
};

const refreshAccessToken = async (req, res) => {
  const rawRefresh = getRefreshTokenFromRequest(req);
  const result = await rotateRefreshToken(rawRefresh, res);
  const user = await User.findById(result.userId).select('-password');

  if (!user) {
    throw new ApiError(401, 'User not found');
  }

  return {
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    user: formatUserResponse(user),
  };
};

const logout = async (req, res) => {
  const rawRefresh = getRefreshTokenFromRequest(req);
  await revokeRefreshToken(rawRefresh);
  clearAllAuthCookies(res);
  return { message: 'Logged out successfully' };
};

const getMe = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
};

module.exports = {
  register,
  verifyOTP,
  login,
  refreshAccessToken,
  logout,
  getMe,
  resendOtp,
  formatUserResponse,
};

const catchAsync = require('../utils/catchAsync');
const authService = require('../services/authService');
const { resendOtp } = require('../services/otpService');

exports.register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

exports.verifyOTP = catchAsync(async (req, res) => {
  const { email, otp } = req.body;
  const result = await authService.verifyOTP(email, otp, res);
  res.status(200).json(result);
});

exports.resendOTP = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await resendOtp(email);
  res.status(200).json(result);
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, res);
  res.status(200).json(result);
});

exports.refreshToken = catchAsync(async (req, res) => {
  const result = await authService.refreshAccessToken(req, res);
  res.status(200).json(result);
});

exports.logout = catchAsync(async (req, res) => {
  const result = await authService.logout(req, res);
  res.status(200).json(result);
});

exports.getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user.userId);
  res.status(200).json(user);
});

exports.getProfile = exports.getMe;

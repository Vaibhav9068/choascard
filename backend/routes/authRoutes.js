const express = require('express');
const {
  register,
  verifyOTP,
  resendOTP,
  login,
  refreshToken,
  logout,
  getMe,
  getProfile,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authIpLimiter, otpResendLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(authIpLimiter);

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', otpResendLimiter, resendOTP);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.get('/profile', protect, getProfile);

module.exports = router;

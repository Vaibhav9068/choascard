const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const hashOtp = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
};

const verifyOtp = async (otp, hash) => bcrypt.compare(otp, hash);

const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtp,
  generateRefreshToken,
  hashRefreshToken,
};

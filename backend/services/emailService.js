const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_USER,
} = require('../config/config');
const ApiError = require('../utils/ApiError');

let transporter = null;

const createTransporter = async () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_USER) {
    throw new ApiError(500, 'Email service is not configured');
  }

  try {
    console.log('[EmailService] Creating Nodemailer transporter with native OAuth2 auto-refresh...');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: GOOGLE_USER,
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        refreshToken: GOOGLE_REFRESH_TOKEN,
      },
      connectionTimeout: 8000, // 8 seconds
      greetingTimeout: 8000,   // 8 seconds
      socketTimeout: 10000,    // 10 seconds
    });
  } catch (error) {
    console.error('[EmailService] Transporter creation failed:', error);
    throw new ApiError(500, `Failed to initialize email transport: ${error.message}`);
  }
};

const getTransporter = async () => {
  if (!transporter) {
    transporter = await createTransporter();
  }
  return transporter;
};

const sendOtpEmail = async (email, otp) => {
  try {
    console.log(`[EmailService] Attempting to send OTP email to: ${email}`);
    const mailer = await getTransporter();

    const info = await mailer.sendMail({
      from: `"CHAOS DECK" <${GOOGLE_USER}>`,
      to: email,
      subject: 'CHAOS DECK — Email Verification Code',
      text: `Your verification code is ${otp}. It expires in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #fae500;">CHAOS DECK</h2>
          <p>Your email verification code:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111;">${otp}</p>
          <p style="color: #666;">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
        </div>
      `,
    });

    console.log(`[EmailService] OTP email sent successfully. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[EmailService] Error occurred while sending OTP email to ${email}:`, error);
    // Reset transporter on failure to force recreation on the next request
    transporter = null;
    throw new ApiError(500, `Email delivery failed: ${error.message}`);
  }
};

module.exports = { sendOtpEmail };

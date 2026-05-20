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

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

  const accessTokenResponse = await oauth2Client.getAccessToken();
  const accessToken = accessTokenResponse?.token;

  if (!accessToken) {
    throw new ApiError(500, 'Failed to obtain Gmail OAuth2 access token');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GOOGLE_USER,
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      refreshToken: GOOGLE_REFRESH_TOKEN,
      accessToken,
    },
  });
};

const getTransporter = async () => {
  if (!transporter) {
    transporter = await createTransporter();
  }
  return transporter;
};

const sendOtpEmail = async (email, otp) => {
  const mailer = await getTransporter();

  await mailer.sendMail({
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
};

module.exports = { sendOtpEmail };

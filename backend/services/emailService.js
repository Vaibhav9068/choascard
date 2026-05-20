const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const ApiError = require('../utils/ApiError');
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_USER,
} = require('../config/config');

let transporter = null;

const resolveSmtpHost = async () => {
  try {
    const addresses = await dns.resolve4('smtp.gmail.com');
    if (addresses && addresses.length > 0) {
      const selectedIp = addresses[Math.floor(Math.random() * addresses.length)];
      console.log(`[EmailService] Programmatically resolved smtp.gmail.com to IPv4: ${selectedIp}`);
      return selectedIp;
    }
  } catch (dnsErr) {
    console.error('[EmailService] DNS resolution for smtp.gmail.com failed, falling back to hostname:', dnsErr.message);
  }
  return 'smtp.gmail.com';
};

const createTransporter = async () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_USER) {
    console.error('[EmailService] Missing Gmail credentials:', {
      hasClientId: !!GOOGLE_CLIENT_ID,
      hasClientSecret: !!GOOGLE_CLIENT_SECRET,
      hasRefreshToken: !!GOOGLE_REFRESH_TOKEN,
      hasUser: !!GOOGLE_USER,
    });
    throw new ApiError(500, 'Email service is not configured correctly in env variables.');
  }

  try {
    const resolvedIp = await resolveSmtpHost();
    console.log(`[EmailService] Creating Nodemailer transporter for IP ${resolvedIp}...`);
    return nodemailer.createTransport({
      host: resolvedIp,
      port: 465,
      secure: true,
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
      dnsTimeout: 5000,
      tls: {
        servername: 'smtp.gmail.com', // Must match the SSL certificate hostname
      },
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

const verifySmtpConnection = async () => {
  try {
    console.log('[EmailService] Verifying SMTP connection to smtp.gmail.com...');
    const mailer = await getTransporter();
    await mailer.verify();
    console.log('[EmailService] SMTP connection verified successfully!');
    return true;
  } catch (error) {
    console.error('[EmailService] SMTP verification failed:', {
      message: error.message,
      code: error.code,
      command: error.command,
    });
    transporter = null; // Force recreation on next attempt
    return false;
  }
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
    console.error(`[EmailService] Error occurred while sending OTP email to ${email}:`, {
      message: error.message,
      code: error.code,
      command: error.command,
    });
    // Reset transporter on failure to force recreation on the next request
    transporter = null;
    throw new ApiError(500, `Email delivery failed: ${error.message}`);
  }
};

module.exports = { sendOtpEmail, verifySmtpConnection };

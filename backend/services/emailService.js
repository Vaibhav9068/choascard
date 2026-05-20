const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const ApiError = require('../utils/ApiError');
const { EMAIL_USER, EMAIL_PASS } = require('../config/config');

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
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('[EmailService] Missing Gmail App Password credentials:', {
      hasUser: !!EMAIL_USER,
      hasPass: !!EMAIL_PASS,
    });
    throw new ApiError(500, 'Email service is not configured correctly in env variables.');
  }

  try {
    const resolvedIp = await resolveSmtpHost();
    console.log(`[EmailService] Creating Nodemailer transporter using IP ${resolvedIp} for user ${EMAIL_USER}...`);
    return nodemailer.createTransport({
      host: resolvedIp,
      port: 465,
      secure: true,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
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
    console.log('[EmailService] SMTP connected');
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

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #0d0e12; color: #ffffff; max-width: 480px; margin: 0 auto; padding: 32px; border-radius: 12px; border: 1px solid #1a1c23; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #fae500; font-size: 28px; font-weight: 900; letter-spacing: -1px; font-style: italic; margin: 0; text-transform: uppercase;">CHAOS DECK</h2>
          <div style="height: 2px; width: 60px; background-color: #fae500; margin: 8px auto 0 auto;"></div>
        </div>
        <div style="background-color: #15171e; border-radius: 8px; padding: 24px; border: 1px solid #232731; text-align: center;">
          <p style="font-size: 14px; color: #a0aec0; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
          <p style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #fae500; margin: 0 0 16px 0; font-family: monospace;">${otp}</p>
          <p style="font-size: 13px; color: #718096; margin: 0;">This code will expire in <strong style="color: #ffffff;">5 minutes</strong>.</p>
        </div>
        <div style="margin-top: 24px; text-align: center; font-size: 12px; color: #4a5568;">
          <p style="margin: 0 0 4px 0;">If you did not request this code, please ignore this email.</p>
          <p style="margin: 0;">&copy; 2026 CHAOS DECK. All rights reserved.</p>
        </div>
      </div>
    `;

    const info = await mailer.sendMail({
      from: `"CHAOS DECK" <${EMAIL_USER}>`,
      to: email,
      subject: 'CHAOS DECK — Email Verification Code',
      text: `Your verification code is ${otp}. It expires in 5 minutes.`,
      html: htmlContent,
    });

    console.log(`[EmailService] OTP sent successfully. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[EmailService] Email send failed for ${email}:`, {
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

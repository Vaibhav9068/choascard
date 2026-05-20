const { Resend } = require('resend');
const ApiError = require('../utils/ApiError');
const { RESEND_API_KEY } = require('../config/config');

let resendInstance = null;

const getResendClient = () => {
  if (!resendInstance) {
    if (!RESEND_API_KEY) {
      throw new ApiError(500, 'Resend API key is not configured in env variables.');
    }
    resendInstance = new Resend(RESEND_API_KEY);
  }
  return resendInstance;
};

const verifySmtpConnection = async () => {
  try {
    if (!RESEND_API_KEY) {
      console.error('[EmailService] Resend API Key is missing.');
      return false;
    }
    // Check if client initializes
    getResendClient();
    console.log('[EmailService] Resend API service initialized successfully.');
    return true;
  } catch (error) {
    console.error('[EmailService] Resend initialization failed:', error.message);
    return false;
  }
};

const sendWithTimeout = async (promise, ms = 8000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Email dispatch timed out'));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

const sendOtpEmail = async (email, otp) => {
  try {
    console.log(`[EmailService] Preparing OTP email to send to: ${email}`);
    const client = getResendClient();

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

    // Free Resend accounts allow sending to registered domain owners from onboarding@resend.dev
    const fromAddress = 'Chaos Deck <onboarding@resend.dev>';

    console.log(`[EmailService] Sending email via Resend API to ${email}...`);
    
    const response = await sendWithTimeout(
      client.emails.send({
        from: fromAddress,
        to: email,
        subject: 'CHAOS DECK — Email Verification Code',
        html: htmlContent,
      }),
      8000 // 8 seconds timeout
    );

    if (response.error) {
      console.error('[EmailService] Resend API failed:', response.error);
      throw new Error(response.error.message || 'Resend API returned an error');
    }

    console.log(`[EmailService] OTP sent successfully. ID: ${response.data?.id}`);
    return response.data;
  } catch (error) {
    console.error(`[EmailService] Failed to send OTP email via Resend to ${email}:`, error.message);
    throw new ApiError(500, `Email delivery failed: ${error.message}`);
  }
};

module.exports = { sendOtpEmail, verifySmtpConnection };

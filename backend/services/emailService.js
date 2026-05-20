const ApiError = require('../utils/ApiError');
const { EMAIL_USER, EMAIL_PASS } = require('../config/config');

// EMAIL_PASS is reused to hold the Brevo API key.
// EMAIL_USER is the verified sender email on Brevo.

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const verifySmtpConnection = async () => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('[EmailService] Missing Brevo credentials:', {
      hasUser: !!EMAIL_USER,
      hasPass: !!EMAIL_PASS,
    });
    return false;
  }

  try {
    // Verify account access by hitting the Brevo account endpoint
    const res = await fetch('https://api.brevo.com/v3/account', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api-key': EMAIL_PASS,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[EmailService] Brevo API key validation failed:', res.status, body);
      return false;
    }
    const data = await res.json();
    console.log(`[EmailService] Brevo connected — account: ${data.email}, plan: ${data.plan?.[0]?.type || 'free'}`);
    return true;
  } catch (error) {
    console.error('[EmailService] Brevo verification failed:', error.message);
    return false;
  }
};

const sendOtpEmail = async (email, otp) => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new ApiError(500, 'Email service is not configured. Set EMAIL_USER and EMAIL_PASS.');
  }

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

  try {
    console.log(`[EmailService] Sending OTP email to ${email} via Brevo HTTP API...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': EMAIL_PASS,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'CHAOS DECK', email: EMAIL_USER },
        to: [{ email }],
        subject: 'CHAOS DECK — Email Verification Code',
        htmlContent,
        textContent: `Your verification code is ${otp}. It expires in 5 minutes.`,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await res.json();

    if (!res.ok) {
      console.error('[EmailService] Brevo API error:', res.status, data);
      throw new Error(data.message || `Brevo returned status ${res.status}`);
    }

    console.log(`[EmailService] OTP sent successfully. Message ID: ${data.messageId}`);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`[EmailService] Email send timed out for ${email}`);
      throw new ApiError(500, 'Email delivery timed out. Please try again.');
    }
    console.error(`[EmailService] Email send failed for ${email}:`, error.message);
    throw new ApiError(500, `Email delivery failed: ${error.message}`);
  }
};

module.exports = { sendOtpEmail, verifySmtpConnection };

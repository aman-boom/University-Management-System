const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

/**
 * Send a 6-digit verification code to the specified email address.
 */
async function sendOtpEmail(toEmail, otp, role = 'student') {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn('\n=============================================================');
    console.warn(`[EMAIL OTP] No Gmail credentials found in backend/.env`);
    console.warn(`[EMAIL OTP] Verification Code for ${toEmail}: ${otp}`);
    console.warn(`[EMAIL OTP] Add EMAIL_USER & EMAIL_PASS to backend/.env to send real emails.`);
    console.warn('=============================================================\n');
    throw new Error('Gmail credentials not configured in backend/.env. Please add EMAIL_USER and EMAIL_PASS.');
  }

  const roleLabel = role === 'teacher' ? 'Faculty Portal' : 'Student Portal';

  const mailOptions = {
    from: `"CMS Smart Portal" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your CMS Portal Verification Code: ${otp}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #ff6b2c, #f97316); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Campus Management System</h1>
          <p style="margin: 6px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${roleLabel} Authentication</p>
        </div>
        <div style="padding: 36px 28px; text-align: center;">
          <p style="margin: 0 0 16px; font-size: 15px; color: #94a3b8;">Use this single-use verification code to complete your login:</p>
          <div style="display: inline-block; background-color: #1e293b; border: 2px dashed #ff6b2c; border-radius: 12px; padding: 16px 36px; margin: 12px 0 24px;">
            <span style="font-family: 'JetBrains Mono', Consolas, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ff6b2c;">${otp}</span>
          </div>
          <p style="margin: 0; font-size: 13px; color: #64748b;">
            ⏰ This code is valid for <strong>10 minutes</strong>.<br>
            If you did not request this verification, you can safely ignore this email.
          </p>
        </div>
        <div style="background-color: #0b1120; padding: 16px; text-align: center; border-top: 1px solid #1e293b; font-size: 12px; color: #475569;">
          CMS Smart Campus Portal &copy; ${new Date().getFullYear()} &middot; Automated Security Notification
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  console.log(`[EMAIL OTP] Real email sent successfully to ${toEmail}`);
  return true;
}

module.exports = { sendOtpEmail };

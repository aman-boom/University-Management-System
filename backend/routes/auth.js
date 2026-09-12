const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/mailer');

const router = express.Router();

// Initialize Firebase Admin with Service Account
let firebaseAuth = null;
try {
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  const serviceAccount = require(serviceAccountPath);
  const fbApp = initializeApp({
    credential: cert(serviceAccount)
  });
  firebaseAuth = getAuth(fbApp);
  console.log('Firebase Admin initialized successfully in auth routes');
} catch (err) {
  console.warn('Firebase service account warning:', err.message);
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit OTP
}

/* ── FIREBASE LOGIN (PHONE OTP & GOOGLE AUTH) ──
   body: { idToken, role: 'student'|'teacher', loginId? } */
router.post('/firebase-login', async (req, res) => {
  const { idToken, role = 'student', loginId, department, designation } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'Firebase idToken is required' });
  if (!firebaseAuth) {
    return res.status(500).json({ error: 'Firebase Admin is not configured on the server' });
  }

  try {
    // 1. Verify the Firebase ID token
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const { uid, phone_number, email, name: tokenName, picture } = decoded;

    // 2. Find existing user by firebase_uid, phone, email, or login_id
    let user = null;
    if (uid) {
      user = db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(uid);
    }
    if (!user && phone_number) {
      user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone_number);
    }
    if (!user && email) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }
    if (!user && loginId) {
      user = db.prepare('SELECT * FROM users WHERE login_id = ?').get(loginId);
    }

    if (!user) {
      // Create new user automatically
      const userRole = ['student', 'teacher'].includes(role) ? role : 'student';
      const prefix = userRole === 'teacher' ? 'FAC-' : 'STU-';
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const finalLoginId = (loginId && loginId.trim()) ? loginId.trim() : `${prefix}${year}-${randomSuffix}`;
      const finalName = tokenName || (phone_number ? `User (${phone_number.slice(-4)})` : (email ? email.split('@')[0] : 'Campus Member'));

      const info = db.prepare(
        `INSERT INTO users (login_id, name, phone, email, role, department, designation, firebase_uid, avatar)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(
        finalLoginId,
        finalName,
        phone_number || '',
        email || '',
        userRole,
        department || null,
        designation || null,
        uid,
        picture || null
      );
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else {
      // Link firebase_uid and update avatar / contact info if missing
      db.prepare(
        `UPDATE users SET
          firebase_uid = COALESCE(firebase_uid, ?),
          avatar = COALESCE(avatar, ?),
          phone = CASE WHEN (phone IS NULL OR phone = '') AND ? != '' THEN ? ELSE phone END,
          email = CASE WHEN (email IS NULL OR email = '') AND ? != '' THEN ? ELSE email END
         WHERE id = ?`
      ).run(
        uid,
        picture || null,
        phone_number || '', phone_number || '',
        email || '', email || '',
        user.id
      );
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    // 3. Generate standard CMS JWT
    const token = jwt.sign(
      { sub: user.id, loginId: user.login_id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, user });
  } catch (err) {
    console.error('Firebase token verification error:', err);
    res.status(401).json({ error: 'Invalid or expired Firebase session: ' + err.message });
  }
});

/* ── REGISTER ──
   body: { loginId, name, phone, email?, role: 'student'|'teacher', department, designation? } */
router.post('/register', (req, res) => {
  const { loginId, name, phone, email, role, department, designation } = req.body || {};
  if (!loginId || !name || !role) {
    return res.status(400).json({ error: 'loginId, name and role are required' });
  }
  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ error: "role must be 'student' or 'teacher'" });
  }
  const existing = db.prepare('SELECT id FROM users WHERE login_id = ?').get(loginId);
  if (existing) return res.status(409).json({ error: 'An account with this ID already exists' });

  const info = db.prepare(
    `INSERT INTO users (login_id, name, phone, email, role, department, designation) VALUES (?,?,?,?,?,?,?)`
  ).run(loginId, name, phone || '', email || '', role, department || null, designation || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user });
});

/* ── SEND OTP (EMAIL OR PHONE) ──
   body: { email?, phone?, loginId?, role? } */
router.post('/otp/send', async (req, res) => {
  const { email, phone, loginId, role = 'student' } = req.body || {};
  const targetEmail = (email || '').trim().toLowerCase();
  const targetPhone = (phone || '').trim();
  const targetId = (loginId || '').trim();

  const identifier = targetEmail || targetPhone || targetId;

  if (!identifier) {
    return res.status(400).json({ error: 'Email, mobile number, or ID is required' });
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  db.prepare('INSERT INTO otp_requests (login_id, otp, expires_at) VALUES (?,?,?)').run(identifier, otp, expiresAt);

  console.log(`[AUTH] Generated OTP for ${identifier}: ${otp}`);

  // 1. Send via Email (Nodemailer)
  if (targetEmail) {
    try {
      await sendOtpEmail(targetEmail, otp, role);
      return res.json({
        message: 'Verification code sent to your email inbox',
        type: 'email',
        expiresInSeconds: 600
      });
    } catch (err) {
      console.error('Email sending error:', err.message);
      return res.status(500).json({
        error: err.message || 'Failed to send OTP email. Please check server configuration.'
      });
    }
  }

  // 2. Phone OTP
  res.json({
    message: 'OTP generated successfully',
    identifier,
    type: 'phone',
    expiresInSeconds: 600
  });
});

/* ── VERIFY OTP (EMAIL OR PHONE) ──
   body: { email?, phone?, loginId?, otp, role? } -> returns a JWT + user profile */
router.post('/otp/verify', (req, res) => {
  const { email, phone, loginId, otp, role = 'student' } = req.body || {};
  const targetEmail = (email || '').trim().toLowerCase();
  const targetPhone = (phone || '').trim();
  const targetId = (loginId || '').trim();
  const identifier = targetEmail || targetPhone || targetId;

  if (!identifier || !otp) {
    return res.status(400).json({ error: 'Email/Phone and OTP code are required' });
  }

  // Match OTP record (search by identifier or email or phone)
  const record = db.prepare(
    `SELECT * FROM otp_requests WHERE (login_id = ? OR login_id = ? OR login_id = ?) AND otp = ? AND consumed = 0 ORDER BY id DESC LIMIT 1`
  ).get(identifier, targetEmail || identifier, targetPhone || identifier, String(otp).trim());

  if (!record) return res.status(400).json({ error: 'Invalid verification code. Please check your inbox and try again.' });
  if (record.expires_at < Date.now()) return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });

  db.prepare('UPDATE otp_requests SET consumed = 1 WHERE id = ?').run(record.id);

  // Find existing user by email, phone, or login_id
  let user = null;
  if (targetEmail) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(targetEmail);
  }
  if (!user && targetPhone) {
    user = db.prepare('SELECT * FROM users WHERE phone = ?').get(targetPhone);
  }
  if (!user && targetId) {
    user = db.prepare('SELECT * FROM users WHERE login_id = ?').get(targetId);
  }

  if (!user) {
    const userRole = ['student', 'teacher'].includes(role) ? role : 'student';
    const prefix = userRole === 'teacher' ? 'FAC-' : 'STU-';
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const finalLoginId = targetId || `${prefix}${year}-${randomSuffix}`;
    const finalName = targetEmail ? targetEmail.split('@')[0] : (targetPhone ? `User (${targetPhone.slice(-4)})` : 'Campus Member');

    const info = db.prepare(
      `INSERT INTO users (login_id, name, phone, email, role) VALUES (?,?,?,?,?)`
    ).run(finalLoginId, finalName, targetPhone || '', targetEmail || '', userRole);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  const token = jwt.sign(
    { sub: user.id, loginId: user.login_id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token, user });
});

/* ── CURRENT USER ── */
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;

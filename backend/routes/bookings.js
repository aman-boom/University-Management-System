const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* GET /api/bookings?userOnly=1 */
router.get('/', requireAuth, (req, res) => {
  const { userOnly } = req.query;
  let sql = 'SELECT * FROM unified_bookings';
  const params = [];
  if (userOnly) {
    sql += ' WHERE user_id = ?';
    params.push(req.user.sub);
  }
  sql += ' ORDER BY id DESC';
  const bookings = db.prepare(sql).all(...params);
  res.json({ bookings });
});

/* POST /api/bookings  (with double-booking check) */
router.post('/', requireAuth, (req, res) => {
  const { resource_type, resource_name, block, slot_date, time_slot, capacity, equipment, purpose } = req.body || {};
  if (!resource_name || !slot_date || !time_slot) {
    return res.status(400).json({ error: 'Resource name, date and time slot are required' });
  }

  // Conflict prevention check
  const conflict = db.prepare(
    `SELECT * FROM unified_bookings 
     WHERE resource_name = ? AND slot_date = ? AND time_slot = ? AND status != 'Cancelled'`
  ).get(resource_name, slot_date, time_slot);

  if (conflict) {
    return res.status(409).json({ error: `${resource_name} is already booked for ${time_slot} on ${slot_date}. Please choose another slot.` });
  }

  const qr_token = 'CMS-BK-' + Math.floor(100000 + Math.random() * 900000);
  const info = db.prepare(
    `INSERT INTO unified_bookings (user_id, user_name, resource_type, resource_name, block, slot_date, time_slot, capacity, equipment, purpose, status, qr_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?)`
  ).run(req.user.sub, req.user.name || 'Student', resource_type || 'classroom', resource_name, block || 'Block A', slot_date, time_slot, capacity || 30, equipment || 'None', purpose || 'Study/Meeting', qr_token);

  const booking = db.prepare('SELECT * FROM unified_bookings WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ booking, message: 'Reservation confirmed without conflicts.' });
});

/* DELETE /api/bookings/:id */
router.delete('/:id', requireAuth, (req, res) => {
  const booking = db.prepare('SELECT * FROM unified_bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  db.prepare("UPDATE unified_bookings SET status = 'Cancelled' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Reservation cancelled successfully' });
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* GET /api/hospital/doctors?type=general|specialist&q=search */
router.get('/doctors', (req, res) => {
  const { type, q } = req.query;
  let sql = 'SELECT * FROM doctors WHERE 1=1';
  const params = [];
  if (type && type !== 'all') { sql += ' AND type = ?'; params.push(type); }
  if (q) {
    sql += ' AND (lower(name) LIKE ? OR lower(spec) LIKE ?)';
    const like = `%${q.toLowerCase()}%`;
    params.push(like, like);
  }
  sql += ' ORDER BY name';
  res.json({ doctors: db.prepare(sql).all(...params) });
});

/* POST /api/hospital/doctors body: { name, spec, room, timing, type, avail, exp } */
router.post('/doctors', requireAuth, (req, res) => {
  const { name, spec, room, timing, type, avail, exp } = req.body || {};
  if (!name || !spec) return res.status(400).json({ error: 'Name and Specialization required' });
  const id = Date.now();
  const info = db.prepare('INSERT INTO doctors (id, name, spec, avail, room, type, icon, timing, exp) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, name, spec, avail || 'Available', room || 'Room 101', type || 'general', '🩺', timing || '9:00 AM – 1:00 PM', exp || '10 yrs');
  res.status(201).json({ doctor: { id, name, spec, avail: avail || 'Available', room, timing, type, icon: '🩺' } });
});

router.get('/doctors/:id', (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json({ doctor });
});

/* POST /api/hospital/appointments  body: { doctorId } */
router.post('/appointments', requireAuth, (req, res) => {
  const { doctorId } = req.body || {};
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  if (doctor.avail !== 'Available') {
    return res.status(400).json({ error: `Doctor is currently ${doctor.avail}` });
  }

  const info = db.prepare('INSERT INTO appointments (user_id, doctor_id) VALUES (?, ?)')
    .run(req.user.sub, doctorId);

  const appointment = db.prepare(
    `SELECT a.id, a.status, a.created_at, d.name, d.spec
     FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE a.id = ?`
  ).get(info.lastInsertRowid);
  res.status(201).json({ appointment });
});

/* GET /api/hospital/appointments */
router.get('/appointments', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT a.id, a.status, a.created_at, d.id AS doctor_id, d.name, d.spec
     FROM appointments a JOIN doctors d ON d.id = a.doctor_id
     WHERE a.user_id = ? ORDER BY a.created_at DESC`
  ).all(req.user.sub);
  res.json({ appointments: rows });
});

/* DELETE /api/hospital/appointments/:id */
router.delete('/appointments/:id', requireAuth, (req, res) => {
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  db.prepare('DELETE FROM appointments WHERE id = ?').run(appt.id);
  res.json({ message: 'Appointment cancelled' });
});

module.exports = router;

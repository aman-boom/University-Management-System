const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* GET /api/lab/equipment?department=Electronics */
router.get('/equipment', (req, res) => {
  const { department } = req.query;
  const rows = department
    ? db.prepare('SELECT * FROM lab_equipment WHERE department = ?').all(department)
    : db.prepare('SELECT * FROM lab_equipment').all();
  res.json({ equipment: rows });
});

/* POST /api/lab/equipment body: { name, department } */
router.post('/equipment', requireAuth, (req, res) => {
  const { name, department } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Equipment name is required' });
  const info = db.prepare('INSERT INTO lab_equipment (name, department) VALUES (?,?)')
    .run(name, department || 'btech');
  res.status(201).json({ equipment: { id: info.lastInsertRowid, name, department: department || 'btech' } });
});

/* POST /api/lab/reservations  body: { equipment, slot } */
router.post('/reservations', requireAuth, (req, res) => {
  const { equipment, slot } = req.body || {};
  if (!equipment || !slot) return res.status(400).json({ error: 'equipment and slot are required' });
  const info = db.prepare(
    'INSERT INTO lab_reservations (user_id, equipment, slot) VALUES (?,?,?)'
  ).run(req.user.sub, equipment, slot);
  res.status(201).json({ reservation: db.prepare('SELECT * FROM lab_reservations WHERE id = ?').get(info.lastInsertRowid) });
});

/* GET /api/lab/reservations */
router.get('/reservations', requireAuth, (req, res) => {
  res.json({
    reservations: db.prepare('SELECT * FROM lab_reservations WHERE user_id = ? ORDER BY created_at DESC').all(req.user.sub)
  });
});

router.delete('/reservations/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM lab_reservations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'Reservation not found' });
  db.prepare('DELETE FROM lab_reservations WHERE id = ?').run(row.id);
  res.json({ message: 'Reservation cancelled' });
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* GET /api/classrooms */
router.get('/', (req, res) => {
  res.json({ classrooms: db.prepare('SELECT * FROM classrooms ORDER BY created_at DESC').all() });
});

/* POST /api/classrooms  body: { roomNo, room_no, location, capacity } */
router.post('/', requireAuth, (req, res) => {
  const { roomNo, room_no, location, capacity } = req.body || {};
  const rNo = roomNo || room_no;
  if (!rNo) return res.status(400).json({ error: 'roomNo is required' });
  const info = db.prepare(
    'INSERT INTO classrooms (room_no, location, capacity, added_by) VALUES (?,?,?,?)'
  ).run(rNo, location || null, capacity || null, req.user.sub);
  res.status(201).json({ classroom: db.prepare('SELECT * FROM classrooms WHERE id = ?').get(info.lastInsertRowid) });
});

/* DELETE /api/classrooms/:id  (only the person who added it) */
router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM classrooms WHERE id = ? AND added_by = ?')
    .get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'Listing not found' });
  db.prepare('DELETE FROM classrooms WHERE id = ?').run(row.id);
  res.json({ message: 'Removed' });
});

module.exports = router;

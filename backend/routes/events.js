const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* GET /api/events */
router.get('/', (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY id ASC').all();
  res.json({ events });
});

/* POST /api/events/:id/register */
router.post('/:id/register', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  db.prepare('UPDATE events SET attendees = attendees + 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Registered successfully', attendees: event.attendees + 1 });
});

module.exports = router;

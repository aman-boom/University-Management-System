const express = require('express');
const db = require('../db');

const router = express.Router();

/* GET /api/lost-found?type=lost|found&q=search */
router.get('/', (req, res) => {
  const { type, q } = req.query;
  let sql = 'SELECT * FROM lost_found_items WHERE 1=1';
  const params = [];
  if (type && type !== 'all') {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (q) {
    sql += ' AND (lower(title) LIKE ? OR lower(description) LIKE ? OR lower(location) LIKE ?)';
    const like = `%${q.toLowerCase()}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY id DESC';
  const items = db.prepare(sql).all(...params);
  res.json({ items });
});

/* POST /api/lost-found */
router.post('/', (req, res) => {
  const { type, title, category, location, date_time, description, image, contact } = req.body || {};
  if (!type || !title || !location) {
    return res.status(400).json({ error: 'Type, title, and location are required' });
  }
  const info = db.prepare(
    `INSERT INTO lost_found_items (type, title, category, location, date_time, description, image, status, contact)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?)`
  ).run(type, title, category || 'General', location, date_time || 'Just now', description || '', image || '📦', contact || 'Campus Security');

  const item = db.prepare('SELECT * FROM lost_found_items WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item });
});

/* POST /api/lost-found/:id/claim */
router.post('/:id/claim', (req, res) => {
  const item = db.prepare('SELECT * FROM lost_found_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  db.prepare("UPDATE lost_found_items SET status = 'Claim Verification Pending' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Claim submitted. Please verify with campus security using Verification PIN: #CMS-9842', claimPin: 'CMS-9842' });
});

module.exports = router;

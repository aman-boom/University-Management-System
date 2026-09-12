const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* GET /api/marketplace?category=Books&q=search */
router.get('/', (req, res) => {
  const { category, q } = req.query;
  let sql = 'SELECT * FROM marketplace_items WHERE 1=1';
  const params = [];
  if (category && category !== 'all' && category !== 'All') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (q) {
    sql += ' AND (lower(title) LIKE ? OR lower(description) LIKE ? OR lower(seller_name) LIKE ?)';
    const like = `%${q.toLowerCase()}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY created_at DESC';
  const items = db.prepare(sql).all(...params);
  res.json({ items });
});

/* POST /api/marketplace (add new listing) */
router.post('/', (req, res) => {
  const { title, category, price, condition, seller_name, seller_dept, description, image } = req.body || {};
  if (!title || !category || !price) {
    return res.status(400).json({ error: 'Title, category and price are required' });
  }
  const info = db.prepare(
    `INSERT INTO marketplace_items (title, category, price, condition, seller_name, seller_dept, verified, image, description)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(title, category, price, condition || 'Good', seller_name || 'Student', seller_dept || 'Campus', image || '📦', description || '');
  
  const item = db.prepare('SELECT * FROM marketplace_items WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item });
});

module.exports = router;

const express = require('express');
const db = require('../db');

const router = express.Router();

function parseMenu(row) {
  return { key: row.key, name: row.name, subtitle: row.subtitle, tabs: JSON.parse(row.tabs), items: JSON.parse(row.items) };
}

/* GET /api/food/menus  -> all outlets */
router.get('/menus', (req, res) => {
  const rows = db.prepare('SELECT * FROM food_menus').all();
  res.json({ menus: rows.map(parseMenu) });
});

/* GET /api/food/menus/:key  -> single outlet, e.g. cafeteria | canteen | mess | juice */
router.get('/menus/:key', (req, res) => {
  const row = db.prepare('SELECT * FROM food_menus WHERE key = ?').get(req.params.key);
  if (!row) return res.status(404).json({ error: 'Menu not found' });
  res.json({ menu: parseMenu(row) });
});

module.exports = router;

const express = require('express');
const db = require('../db');

const router = express.Router();

/* GET /api/notices */
router.get('/', (req, res) => {
  const notices = db.prepare('SELECT * FROM campus_notices ORDER BY id DESC').all();
  res.json({ notices });
});

module.exports = router;

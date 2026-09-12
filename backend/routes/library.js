const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* GET /api/library/books?q=search+term  (search across title/author/category) */
router.get('/books', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  let rows;
  if (!q) {
    rows = db.prepare('SELECT * FROM books ORDER BY title LIMIT 10').all();
  } else {
    rows = db.prepare(
      `SELECT * FROM books
       WHERE lower(title) LIKE ? OR lower(author) LIKE ? OR lower(category) LIKE ?
       LIMIT 10`
    ).all(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  res.json({ books: rows });
});

/* GET /api/library/books/all  (full catalogue, for the grid view) */
router.get('/books/all', (req, res) => {
  res.json({ books: db.prepare('SELECT * FROM books ORDER BY title').all() });
});

/* POST /api/library/books  body: { title, author, shelf, category, copies, year } */
router.post('/books', requireAuth, (req, res) => {
  const { title, author, shelf, category, copies, year } = req.body || {};
  if (!title || !author) return res.status(400).json({ error: 'Title and Author are required' });
  const id = Date.now();
  const book = {
    id,
    title,
    author,
    copies: parseInt(copies || 3),
    shelf: shelf || 'A-10',
    category: category || 'General',
    year: year || '2025',
    icon: '📘'
  };
  db.prepare('INSERT INTO books (id, title, author, copies, shelf, category, year, icon) VALUES (@id, @title, @author, @copies, @shelf, @category, @year, @icon)').run(book);
  res.status(201).json({ book });
});

/* GET /api/library/books/:id */
router.get('/books/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json({ book });
});

/* POST /api/library/reservations  body: { bookId } */
router.post('/reservations', requireAuth, (req, res) => {
  const { bookId } = req.body || {};
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  if (book.copies < 1) return res.status(400).json({ error: 'No copies currently available' });

  const info = db.prepare(
    'INSERT INTO library_reservations (user_id, book_id) VALUES (?, ?)'
  ).run(req.user.sub, bookId);
  db.prepare('UPDATE books SET copies = copies - 1 WHERE id = ?').run(bookId);

  const reservation = db.prepare(
    `SELECT r.id, r.status, r.created_at, b.title, b.author
     FROM library_reservations r JOIN books b ON b.id = r.book_id WHERE r.id = ?`
  ).get(info.lastInsertRowid);
  res.status(201).json({ reservation });
});

/* GET /api/library/reservations  (current user's reservations) */
router.get('/reservations', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT r.id, r.status, r.created_at, b.id AS book_id, b.title, b.author
     FROM library_reservations r JOIN books b ON b.id = r.book_id
     WHERE r.user_id = ? ORDER BY r.created_at DESC`
  ).all(req.user.sub);
  res.json({ reservations: rows });
});

/* DELETE /api/library/reservations/:id  (cancel + return the copy) */
router.delete('/reservations/:id', requireAuth, (req, res) => {
  const res_ = db.prepare('SELECT * FROM library_reservations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!res_) return res.status(404).json({ error: 'Reservation not found' });

  db.prepare('DELETE FROM library_reservations WHERE id = ?').run(res_.id);
  db.prepare('UPDATE books SET copies = copies + 1 WHERE id = ?').run(res_.book_id);
  res.json({ message: 'Reservation cancelled' });
});

module.exports = router;

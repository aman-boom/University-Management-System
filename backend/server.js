require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth');
const libraryRoutes = require('./routes/library');
const hospitalRoutes = require('./routes/hospital');
const foodRoutes = require('./routes/food');
const classroomRoutes = require('./routes/classrooms');
const facultyRoutes = require('./routes/faculty');
const labRoutes = require('./routes/lab');
const eventRoutes = require('./routes/events');
const marketplaceRoutes = require('./routes/marketplace');
const lostFoundRoutes = require('./routes/lostfound');
const bookingRoutes = require('./routes/bookings');
const noticeRoutes = require('./routes/notices');
const intelligenceRoutes = require('./routes/intelligence');
const aiTutorRoutes = require('./routes/ai-tutor');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve frontend assets statically
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString(), platform: 'CMS Smart Portal AI Campus OS' }));

app.use('/api/auth', authRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/ai-tutor', aiTutorRoutes);

// 404 fallback for API
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve frontend index.html for any other GET route
app.use((req, res, next) => {
  if (req.method === 'GET') {
    return res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  }
  next();
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`CMS portal running on ${url}`);

  // Auto-open browser
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? `start ${url}`
            : process.platform === 'darwin' ? `open ${url}`
            : `xdg-open ${url}`;
  exec(cmd, (err) => {
    if (err) console.log('Could not auto-open browser:', err.message);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
    console.error(`Please stop any running server instances before running 'npm start'.\n`);
  } else {
    console.error('Server error:', err);
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Keep process active indefinitely in background
setInterval(() => {}, 1000 * 60 * 60);



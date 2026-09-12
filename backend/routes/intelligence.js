const express = require('express');
const db = require('../db');

const router = express.Router();

/* GET /api/intelligence/stats */
router.get('/stats', (req, res) => {
  const booksCount = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
  const docsCount = db.prepare("SELECT COUNT(*) as c FROM doctors WHERE avail = 'Available'").get().c;
  const roomsCount = db.prepare('SELECT COUNT(*) as c FROM classrooms').get().c;
  const eventsCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;

  res.json({
    metrics: {
      classroomUtilization: 78,
      labUtilization: 84,
      libraryUsage: 62,
      cafeteriaPeakWait: '8 mins',
      foodWasteReduction: '-28%',
      activeStudents: '23,450',
      totalEnergySaved: '14.2 MWh',
      avgRoomOccupancy: '82%'
    },
    peakHours: [
      { time: '8 AM', traffic: 32 },
      { time: '10 AM', traffic: 88 },
      { time: '12 PM', traffic: 96 },
      { time: '1 PM', traffic: 92 },
      { time: '3 PM', traffic: 74 },
      { time: '5 PM', traffic: 58 },
      { time: '7 PM', traffic: 36 }
    ],
    resourceBreakdown: [
      { category: 'Classrooms Block A & B', percent: 42, color: '#3b82f6' },
      { category: 'Engineering Labs', percent: 28, color: '#10b981' },
      { category: 'Discussion Rooms', percent: 18, color: '#f59e0b' },
      { category: 'Auditorium & Halls', percent: 12, color: '#8b5cf6' }
    ],
    aiInsights: [
      { icon: '💡', title: 'High Block B Utilization', text: 'Block B classrooms are at 94% capacity between 11:00 AM and 2:00 PM. Reallocating 3 lectures to Block C will balance footfall.' },
      { icon: '🍔', title: 'Cafeteria Peak Surge Expected', text: 'Main Cafeteria queue will peak at 1:15 PM with ~120 orders. Smart pre-ordering has already reduced counter wait by 42%.' },
      { icon: '📚', title: 'Library Study Area Opening', text: 'Discussion rooms in Block D and Library 2nd floor have 65% availability after 4:30 PM today.' },
      { icon: '⚡', title: 'HVAC Energy Conservation Alert', text: 'Lecture Hall 4 in Block C is vacant until 3:00 PM; climate control is set to eco-mode saving 4.8 kWh.' }
    ]
  });
});

module.exports = router;

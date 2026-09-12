const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

try {
  const Database = require('better-sqlite3');
  db = new Database(path.join(dataDir, 'cms.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (e) {
  // Pure JavaScript persistent JSON DB fallback for environments without C++ build tools
  const jsonDbPath = path.join(dataDir, 'cms_store.json');
  let store = {
    users: [],
    otp_requests: [],
    books: [],
    library_reservations: [],
    doctors: [],
    appointments: [],
    classrooms: [],
    faculty_directory: [],
    lab_equipment: [],
    lab_reservations: [],
    food_menus: [],
    events: [],
    marketplace_items: [],
    lost_found_items: [],
    campus_notices: [],
    unified_bookings: []
  };

  if (fs.existsSync(jsonDbPath)) {
    try {
      store = Object.assign(store, JSON.parse(fs.readFileSync(jsonDbPath, 'utf8')));
    } catch(err) {}
  }

  function saveStore() {
    try {
      fs.writeFileSync(jsonDbPath, JSON.stringify(store, null, 2), 'utf8');
    } catch(err) {}
  }

  db = {
    pragma: () => {},
    exec: () => {},
    transaction: (fn) => {
      return (items) => {
        items.forEach(fn);
        saveStore();
      };
    },
    prepare: (sql) => {
      const trimmed = sql.trim();
      return {
        all: (...params) => {
          // Query parser
          if (trimmed.includes('FROM books')) {
            let res = [...store.books];
            if (trimmed.includes('LIKE')) {
              const q = (params[0] || '').replace(/%/g, '').toLowerCase();
              res = res.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.category||'').toLowerCase().includes(q));
            }
            return res.slice(0, trimmed.includes('LIMIT 10') ? 10 : 100);
          }
          if (trimmed.includes('FROM doctors')) {
            let res = [...store.doctors];
            if (params.length && params[0] && params[0] !== 'all') {
              res = res.filter(d => d.type === params[0] || d.avail === params[0]);
            }
            return res;
          }
          if (trimmed.includes('FROM food_menus')) {
            return store.food_menus;
          }
          if (trimmed.includes('FROM events')) {
            return store.events;
          }
          if (trimmed.includes('FROM marketplace_items')) {
            return store.marketplace_items;
          }
          if (trimmed.includes('FROM lost_found_items')) {
            return store.lost_found_items;
          }
          if (trimmed.includes('FROM campus_notices')) {
            return store.campus_notices;
          }
          if (trimmed.includes('FROM classrooms')) {
            return store.classrooms;
          }
          if (trimmed.includes('FROM faculty_directory')) {
            let res = [...store.faculty_directory];
            if (trimmed.includes('LIKE')) {
              const q = (params[0] || '').replace(/%/g, '').toLowerCase();
              res = res.filter(f => (f.name || '').toLowerCase().includes(q) || (f.department || '').toLowerCase().includes(q) || (f.slot || '').toLowerCase().includes(q));
            }
            return res;
          }
          if (trimmed.includes('FROM lab_equipment')) {
            return store.lab_equipment;
          }
          if (trimmed.includes('FROM lab_reservations')) {
            return store.lab_reservations;
          }
          if (trimmed.includes('FROM library_reservations')) {
            return store.library_reservations.map(r => {
              const b = store.books.find(x => x.id == r.book_id) || {};
              return { ...r, title: b.title || 'Book', author: b.author || 'Author' };
            });
          }
          if (trimmed.includes('FROM appointments')) {
            return store.appointments.map(a => {
              const d = store.doctors.find(x => x.id == a.doctor_id) || {};
              return { ...a, name: d.name || 'Doctor', spec: d.spec || 'General' };
            });
          }
          if (trimmed.includes('FROM unified_bookings')) {
            let res = [...store.unified_bookings];
            if (trimmed.includes('WHERE user_id = ?')) {
              res = res.filter(b => b.user_id == params[0]);
            }
            return res;
          }
          if (trimmed.includes('FROM users')) {
            return store.users;
          }
          return [];
        },
        get: (...params) => {
          if (trimmed.includes('SELECT COUNT(*)')) {
            if (trimmed.includes('books')) return { c: store.books.length };
            if (trimmed.includes('doctors')) return { c: store.doctors.length };
            if (trimmed.includes('classrooms')) return { c: store.classrooms.length };
            if (trimmed.includes('events')) return { c: store.events.length };
            if (trimmed.includes('marketplace_items')) return { c: store.marketplace_items.length };
            if (trimmed.includes('lost_found_items')) return { c: store.lost_found_items.length };
            if (trimmed.includes('campus_notices')) return { c: store.campus_notices.length };
            if (trimmed.includes('food_menus')) return { c: store.food_menus.length };
            if (trimmed.includes('lab_equipment')) return { c: store.lab_equipment.length };
            if (trimmed.includes('faculty_directory')) return { c: store.faculty_directory.length };
            return { c: 0 };
          }
          if (trimmed.includes('FROM users WHERE firebase_uid = ?')) {
            return store.users.find(u => u.firebase_uid == params[0]) || null;
          }
          if (trimmed.includes('FROM users WHERE phone = ?')) {
            return store.users.find(u => u.phone == params[0]) || null;
          }
          if (trimmed.includes('FROM users WHERE email = ?')) {
            return store.users.find(u => u.email == params[0]) || null;
          }
          if (trimmed.includes('FROM users WHERE login_id = ?')) {
            return store.users.find(u => u.login_id == params[0]) || null;
          }
          if (trimmed.includes('FROM users WHERE id = ?')) {
            return store.users.find(u => u.id == params[0]) || null;
          }
          if (trimmed.includes('FROM otp_requests')) {
            const matches = store.otp_requests.filter(o => 
              (o.login_id == params[0] || o.login_id == params[1] || o.login_id == params[2]) && 
              String(o.otp).trim() == String(params[3]).trim() && 
              o.consumed == 0
            );
            return matches.length ? matches[matches.length - 1] : null;
          }
          if (trimmed.includes('FROM books WHERE id = ?')) {
            return store.books.find(b => b.id == params[0]) || null;
          }
          if (trimmed.includes('FROM doctors WHERE id = ?')) {
            return store.doctors.find(d => d.id == params[0]) || null;
          }
          if (trimmed.includes('FROM food_menus WHERE key = ?')) {
            return store.food_menus.find(f => f.key == params[0]) || null;
          }
          if (trimmed.includes('FROM events WHERE id = ?')) {
            return store.events.find(e => e.id == params[0]) || null;
          }
          if (trimmed.includes('FROM marketplace_items WHERE id = ?')) {
            return store.marketplace_items.find(m => m.id == params[0]) || null;
          }
          if (trimmed.includes('FROM lost_found_items WHERE id = ?')) {
            return store.lost_found_items.find(l => l.id == params[0]) || null;
          }
          if (trimmed.includes('FROM unified_bookings')) {
            if (trimmed.includes('WHERE id = ?')) {
              return store.unified_bookings.find(b => b.id == params[0]) || null;
            }
            return store.unified_bookings.find(b => b.resource_name == params[0] && b.slot_date == params[1] && b.time_slot == params[2] && b.status != 'Cancelled') || null;
          }
          return null;
        },
        run: (rowOrObj, ...args) => {
          let lastId = Date.now();
          if (trimmed.startsWith('INSERT INTO users')) {
            const u = typeof rowOrObj === 'object' ? rowOrObj : {
              id: store.users.length + 1,
              login_id: rowOrObj,
              name: args[0],
              phone: args[1],
              email: args[2],
              role: args[3],
              department: args[4] || null,
              designation: args[5] || null,
              firebase_uid: args[6] || null,
              avatar: args[7] || null
            };
            store.users.push(u);
            lastId = u.id;
          } else if (trimmed.startsWith('UPDATE users')) {
            const u = store.users.find(x => x.id == (typeof rowOrObj === 'object' ? rowOrObj.id : args[args.length - 1]));
            if (u) {
              if (args[0]) u.firebase_uid = args[0];
              if (args[1]) u.avatar = args[1];
            }
          } else if (trimmed.startsWith('INSERT INTO otp_requests')) {
            store.otp_requests.push({ id: store.otp_requests.length + 1, login_id: rowOrObj, otp: args[0], expires_at: args[1], consumed: 0 });
          } else if (trimmed.startsWith('INSERT INTO books')) {
            const b = typeof rowOrObj === 'object' ? rowOrObj : { id: rowOrObj, title: args[0], author: args[1], copies: args[2], shelf: args[3], category: args[4], year: args[5], icon: args[6] };
            store.books.push(b);
          } else if (trimmed.startsWith('INSERT INTO doctors')) {
            const d = typeof rowOrObj === 'object' ? rowOrObj : { id: rowOrObj, name: args[0], spec: args[1], avail: args[2], room: args[3], type: args[4], icon: args[5], timing: args[6], exp: args[7] };
            store.doctors.push(d);
          } else if (trimmed.startsWith('INSERT INTO food_menus')) {
            const m = typeof rowOrObj === 'object' ? rowOrObj : { key: rowOrObj, name: args[0], subtitle: args[1], tabs: args[2], items: args[3] };
            store.food_menus.push(m);
          } else if (trimmed.startsWith('INSERT INTO events')) {
            const ev = typeof rowOrObj === 'object' ? rowOrObj : { id: store.events.length + 1, title: rowOrObj, date: args[0], time: args[1], location: args[2], category: args[3], image: args[4], description: args[5], attendees: args[6] || 0 };
            store.events.push(ev);
          } else if (trimmed.startsWith('INSERT INTO marketplace_items')) {
            const mp = typeof rowOrObj === 'object' ? rowOrObj : { id: store.marketplace_items.length + 1, title: rowOrObj, category: args[0], price: args[1], condition: args[2], seller_name: args[3], seller_dept: args[4], verified: 1, image: args[5], description: args[6], status: 'Available' };
            store.marketplace_items.push(mp);
            lastId = mp.id;
          } else if (trimmed.startsWith('INSERT INTO lost_found_items')) {
            const lf = typeof rowOrObj === 'object' ? rowOrObj : { id: store.lost_found_items.length + 1, type: rowOrObj, title: args[0], category: args[1], location: args[2], date_time: args[3], description: args[4], image: args[5], status: 'Open', contact: args[6] };
            store.lost_found_items.push(lf);
            lastId = lf.id;
          } else if (trimmed.startsWith('INSERT INTO campus_notices')) {
            const n = typeof rowOrObj === 'object' ? rowOrObj : { id: store.campus_notices.length + 1, title: rowOrObj, category: args[0], priority: args[1], body: args[2] };
            store.campus_notices.push(n);
          } else if (trimmed.startsWith('INSERT INTO unified_bookings')) {
            const ub = typeof rowOrObj === 'object' ? rowOrObj : { id: store.unified_bookings.length + 1, user_id: rowOrObj, user_name: args[0], resource_type: args[1], resource_name: args[2], block: args[3], slot_date: args[4], time_slot: args[5], capacity: args[6], equipment: args[7], purpose: args[8], status: 'Confirmed', qr_token: args[9], created_at: new Date().toISOString() };
            ub.id = ub.id || (store.unified_bookings.length + 1);
            store.unified_bookings.push(ub);
            lastId = ub.id;
          } else if (trimmed.startsWith('INSERT INTO library_reservations')) {
            store.library_reservations.push({ id: store.library_reservations.length + 1, user_id: rowOrObj, book_id: args[0], status: 'Reserved', created_at: new Date().toISOString() });
          } else if (trimmed.startsWith('INSERT INTO appointments')) {
            store.appointments.push({ id: store.appointments.length + 1, user_id: rowOrObj, doctor_id: args[0], status: 'Confirmed', created_at: new Date().toISOString() });
          } else if (trimmed.startsWith('INSERT INTO classrooms')) {
            const cr = { id: store.classrooms.length + 1, room_no: rowOrObj, location: args[0], capacity: args[1], added_by: args[2], created_at: new Date().toISOString() };
            store.classrooms.push(cr);
            lastId = cr.id;
          } else if (trimmed.startsWith('INSERT INTO faculty_directory')) {
            const f = { id: store.faculty_directory.length + 1, name: rowOrObj, department: args[0], slot: args[1], added_by: args[2], created_at: new Date().toISOString() };
            store.faculty_directory.push(f);
            lastId = f.id;
          } else if (trimmed.startsWith('INSERT INTO lab_reservations')) {
            store.lab_reservations.push({ id: store.lab_reservations.length + 1, user_id: rowOrObj, equipment: args[0], slot: args[1], created_at: new Date().toISOString() });
          } else if (trimmed.startsWith('INSERT INTO lab_equipment')) {
            const eq = typeof rowOrObj === 'object' ? rowOrObj : { id: store.lab_equipment.length + 1, name: rowOrObj, department: args[0] || 'btech', slot: 'Daily 9 AM – 5 PM', icon: '🔬' };
            eq.id = eq.id || (store.lab_equipment.length + 1);
            store.lab_equipment.push(eq);
            lastId = eq.id;
          } else if (trimmed.startsWith('UPDATE otp_requests')) {
            const o = store.otp_requests.find(x => x.id == (typeof rowOrObj === 'object' ? rowOrObj.id : rowOrObj));
            if (o) o.consumed = 1;
          }
          saveStore();
          return { lastInsertRowid: lastId };
        }
      };
    }
  };
}

/* ══════════════════════════════════════════
   SCHEMA (for SQLite environments)
══════════════════════════════════════════ */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT UNIQUE NOT NULL,      -- Student ID / Teacher ID
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT NOT NULL CHECK(role IN ('student','teacher')),
  department TEXT,
  designation TEXT,                    -- teachers only
  firebase_uid TEXT UNIQUE,
  avatar TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  copies INTEGER NOT NULL,
  shelf TEXT,
  category TEXT,
  year TEXT,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS library_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id),
  status TEXT DEFAULT 'Reserved',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  spec TEXT,
  avail TEXT,
  room TEXT,
  type TEXT,
  icon TEXT,
  timing TEXT,
  exp TEXT
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  status TEXT DEFAULT 'Confirmed',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS classrooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no TEXT NOT NULL,
  location TEXT,
  capacity TEXT,
  added_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faculty_directory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department TEXT,
  slot TEXT,
  added_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department TEXT
);

CREATE TABLE IF NOT EXISTS lab_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equipment TEXT NOT NULL,
  slot TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS food_menus (
  key TEXT PRIMARY KEY,
  name TEXT,
  subtitle TEXT,
  tabs TEXT,
  items TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT,
  description TEXT,
  attendees INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS marketplace_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  price TEXT NOT NULL,
  condition TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  seller_dept TEXT NOT NULL,
  verified INTEGER DEFAULT 1,
  image TEXT,
  description TEXT,
  status TEXT DEFAULT 'Available',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lost_found_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('lost', 'found')),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  date_time TEXT NOT NULL,
  description TEXT,
  image TEXT,
  status TEXT DEFAULT 'Open',
  contact TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campus_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('normal', 'important', 'emergency')),
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS unified_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  resource_type TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  block TEXT NOT NULL,
  slot_date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  capacity INTEGER,
  equipment TEXT,
  purpose TEXT,
  status TEXT DEFAULT 'Confirmed',
  qr_token TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_tutor_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  filename TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_points TEXT NOT NULL,
  quiz TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

/* ══════════════════════════════════════════
   SEED DATA
══════════════════════════════════════════ */
function seedIfEmpty(table, rows, insertFn) {
  try {
    const count = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
    if (count === 0) {
      const insertMany = db.transaction((items) => items.forEach(insertFn));
      insertMany(rows);
    }
  } catch(e) {}
}

const BOOKS = [
  {id:1, title:"Data Structures & Algorithms", author:"Thomas H. Cormen", copies:4, shelf:"A-12", category:"Computer Science", year:"2022", icon:"📗"},
  {id:2, title:"Database Systems", author:"Abraham Silberschatz", copies:3, shelf:"B-07", category:"Database", year:"2021", icon:"📘"},
  {id:3, title:"Operating System Concepts", author:"Abraham Galvin", copies:6, shelf:"A-05", category:"Operating Systems", year:"2020", icon:"📙"},
  {id:4, title:"Computer Networks", author:"James F. Kurose", copies:2, shelf:"C-14", category:"Networking", year:"2021", icon:"📕"},
  {id:5, title:"Introduction to Machine Learning", author:"Ethem Alpaydin", copies:5, shelf:"D-03", category:"AI & ML", year:"2022", icon:"📗"},
  {id:6, title:"Artificial Intelligence: A Modern Approach", author:"Stuart Russell", copies:3, shelf:"D-01", category:"AI & ML", year:"2020", icon:"📘"},
  {id:7, title:"Design Patterns", author:"Gang of Four (GoF)", copies:4, shelf:"B-11", category:"Software Engg.", year:"2019", icon:"📙"},
  {id:8, title:"Clean Code", author:"Robert C. Martin", copies:7, shelf:"B-14", category:"Programming", year:"2008", icon:"📕"},
  {id:9, title:"Computer Organization & Architecture", author:"William Stallings", copies:3, shelf:"A-08", category:"Architecture", year:"2019", icon:"📗"},
  {id:10, title:"Discrete Mathematics", author:"Kenneth H. Rosen", copies:5, shelf:"E-02", category:"Mathematics", year:"2018", icon:"📘"},
  {id:11, title:"Python Crash Course", author:"Eric Matthes", copies:6, shelf:"A-02", category:"Programming", year:"2019", icon:"📙"},
  {id:12, title:"Introduction to Algorithms", author:"CLRS", copies:3, shelf:"A-13", category:"Algorithms", year:"2022", icon:"📗"},
];

const DOCTORS = [
  {id:1, name:"Dr. Anil Kumar", spec:"General Medicine", avail:"Available", room:"101", type:"general", icon:"🩺", timing:"9:00 AM – 1:00 PM", exp:"15 yrs"},
  {id:2, name:"Dr. Priya Mehta", spec:"Cardiology", avail:"Available", room:"205", type:"specialist", icon:"❤️", timing:"10:00 AM – 2:00 PM", exp:"12 yrs"},
  {id:3, name:"Dr. Rajesh Singh", spec:"Dentistry", avail:"Busy", room:"108", type:"general", icon:"🦷", timing:"9:00 AM – 12:00 PM", exp:"10 yrs"},
  {id:4, name:"Dr. Sunita Sharma", spec:"Orthopedics", avail:"Available", room:"302", type:"specialist", icon:"🦴", timing:"2:00 PM – 6:00 PM", exp:"18 yrs"},
  {id:5, name:"Dr. Vikram Rao", spec:"Psychiatry", avail:"Off Duty", room:"410", type:"specialist", icon:"🧠", timing:"11:00 AM – 3:00 PM", exp:"8 yrs"},
  {id:6, name:"Dr. Neha Gupta", spec:"Dermatology", avail:"Available", room:"206", type:"specialist", icon:"🔬", timing:"10:00 AM – 1:00 PM", exp:"9 yrs"},
  {id:7, name:"Dr. Amit Patel", spec:"General Medicine", avail:"Available", room:"102", type:"general", icon:"🩺", timing:"2:00 PM – 7:00 PM", exp:"7 yrs"},
  {id:8, name:"Dr. Kavya Nair", spec:"Ophthalmology", avail:"Busy", room:"307", type:"specialist", icon:"👁️", timing:"9:00 AM – 1:00 PM", exp:"11 yrs"},
];

const FOOD_MENUS = {
  cafeteria:{ name:"☕ Main Cafeteria", subtitle:"Block A Ground Floor · 7am–9pm",
    tabs:["Breakfast","Lunch","Dinner","Snacks"],
    items:{
      Breakfast:[
        {ico:"🥐",name:"Poha Plate",desc:"Flattened rice with spices & lemon",price:"₹30",tag:"veg",calories:"220 kcal",rating:4.8},
        {ico:"🫓",name:"Bread Omelette",desc:"2-egg omelette with toast & butter",price:"₹40",tag:"non",calories:"310 kcal",rating:4.7},
        {ico:"🍵",name:"Masala Tea",desc:"Ginger cardamom chai",price:"₹10",tag:"veg",calories:"60 kcal",rating:4.9},
        {ico:"🥣",name:"Idli Sambar",desc:"3 idlis with coconut chutney",price:"₹35",tag:"veg",calories:"180 kcal",rating:4.6},
      ],
      Lunch:[
        {ico:"🍛",name:"Dal Rice Thali",desc:"Dal, rice, sabzi, roti, salad",price:"₹70",tag:"veg",calories:"520 kcal",rating:4.9},
        {ico:"🍗",name:"Chicken Curry Rice",desc:"Spicy chicken curry with basmati rice",price:"₹90",tag:"non",calories:"640 kcal",rating:4.8},
        {ico:"🫓",name:"Paneer Butter Masala",desc:"Cottage cheese in tomato gravy",price:"₹80",tag:"veg",calories:"480 kcal",rating:4.7},
        {ico:"🥗",name:"Mix Veg Thali",desc:"Seasonal veg, roti, dal, rice",price:"₹65",tag:"veg",calories:"440 kcal",rating:4.5},
      ],
      Dinner:[
        {ico:"🍲",name:"Rajma Chawal",desc:"Kidney beans curry with rice",price:"₹65",tag:"veg",calories:"490 kcal",rating:4.9},
        {ico:"🫔",name:"Chapati Sabzi",desc:"4 rotis with seasonal vegetable",price:"₹50",tag:"veg",calories:"360 kcal",rating:4.6},
        {ico:"🍗",name:"Egg Curry Thali",desc:"2-egg curry, rice & roti",price:"₹75",tag:"non",calories:"530 kcal",rating:4.7},
        {ico:"🍮",name:"Kheer",desc:"Rice pudding dessert",price:"₹25",tag:"veg",calories:"210 kcal",rating:4.8},
      ],
      Snacks:[
        {ico:"🥪",name:"Veg Sandwich",desc:"Grilled vegetable sandwich",price:"₹35",tag:"veg",calories:"240 kcal",rating:4.6},
        {ico:"🍕",name:"Maggi Noodles",desc:"Classic masala noodles",price:"₹30",tag:"veg",calories:"290 kcal",rating:4.9},
        {ico:"☕",name:"Coffee / Tea",desc:"Hot brewed beverage",price:"₹15",tag:"veg",calories:"80 kcal",rating:4.8},
        {ico:"🍟",name:"French Fries",desc:"Crispy with seasoned ketchup",price:"₹40",tag:"veg",calories:"320 kcal",rating:4.5},
      ]
    }
  },
  canteen:{ name:"🍕 Block B Canteen", subtitle:"Near Lab Block · 9am–6pm",
    tabs:["Quick Bites","Drinks"],
    items:{
      "Quick Bites":[
        {ico:"🌯",name:"Veg Roll",desc:"Spiced vegetables in paratha wrap",price:"₹45",tag:"veg",calories:"260 kcal",rating:4.6},
        {ico:"🍔",name:"Aloo Tikki Burger",desc:"Crispy potato patty burger",price:"₹50",tag:"veg",calories:"340 kcal",rating:4.7},
        {ico:"🥙",name:"Chicken Tikka Roll",desc:"Grilled chicken in wrap",price:"₹70",tag:"non",calories:"420 kcal",rating:4.9},
        {ico:"🍜",name:"Veg Noodles",desc:"Stir fried noodles with veggies",price:"₹50",tag:"veg",calories:"310 kcal",rating:4.5},
      ],
      Drinks:[
        {ico:"🥤",name:"Cold Coffee",desc:"Iced blended coffee",price:"₹50",tag:"veg",calories:"190 kcal",rating:4.8},
        {ico:"🧃",name:"Fresh Lime Soda",desc:"Lime, soda, mint",price:"₹30",tag:"veg",calories:"70 kcal",rating:4.7},
        {ico:"🧊",name:"Iced Tea",desc:"Chilled tea with lemon",price:"₹35",tag:"veg",calories:"90 kcal",rating:4.6},
      ]
    }
  },
  mess:{ name:"🥗 Hostel Mess", subtitle:"North Campus · Students Only",
    tabs:["Weekly Menu"],
    items:{
      "Weekly Menu":[
        {ico:"📅",name:"Monday",desc:"Dal Makhani · Jeera Rice · Salad",price:"Included",tag:"veg",calories:"510 kcal",rating:4.6},
        {ico:"📅",name:"Tuesday",desc:"Egg Curry · Rice · Chapati",price:"Included",tag:"non",calories:"540 kcal",rating:4.7},
        {ico:"📅",name:"Wednesday",desc:"Chole Bhature · Pickle",price:"Included",tag:"veg",calories:"620 kcal",rating:4.8},
        {ico:"📅",name:"Thursday",desc:"Palak Paneer · Roti · Rice",price:"Included",tag:"veg",calories:"490 kcal",rating:4.7},
        {ico:"📅",name:"Friday",desc:"Fish Curry · Rice (Non-veg option)",price:"Included",tag:"non",calories:"570 kcal",rating:4.8},
        {ico:"📅",name:"Saturday",desc:"Pav Bhaji · Dessert",price:"Included",tag:"veg",calories:"560 kcal",rating:4.9},
      ]
    }
  },
  juice:{ name:"🧃 Juice & Snack Bar", subtitle:"Sports Complex Entry · 8am–8pm",
    tabs:["Juices","Healthy Snacks"],
    items:{
      Juices:[
        {ico:"🍊",name:"Orange Juice",desc:"Fresh squeezed 300ml",price:"₹40",tag:"veg",calories:"110 kcal",rating:4.9},
        {ico:"🍹",name:"Mango Lassi",desc:"Thick mango yogurt drink",price:"₹45",tag:"veg",calories:"230 kcal",rating:4.8},
        {ico:"🥤",name:"Watermelon Juice",desc:"Fresh seasonal fruit",price:"₹35",tag:"veg",calories:"80 kcal",rating:4.7},
        {ico:"🥬",name:"Green Detox",desc:"Spinach, cucumber, ginger",price:"₹55",tag:"veg",calories:"65 kcal",rating:4.6},
      ],
      "Healthy Snacks":[
        {ico:"🥜",name:"Mixed Nuts",desc:"Almonds, cashews, raisins",price:"₹60",tag:"veg",calories:"280 kcal",rating:4.9},
        {ico:"🍌",name:"Fruit Salad",desc:"Seasonal fresh fruits",price:"₹45",tag:"veg",calories:"140 kcal",rating:4.8},
        {ico:"🥙",name:"Sprout Chaat",desc:"Mixed sprouts, tangy masala",price:"₹40",tag:"veg",calories:"120 kcal",rating:4.7},
      ]
    }
  }
};

const EVENTS = [
  {title:"AI & Robotics Hackathon 2026", date:"Tomorrow, Mar 13", time:"10:00 AM – 6:00 PM", location:"Innovation Lab, Block C", category:"Technology", image:"🤖", description:"24-hour sprint building intelligent campus automation & robotics prototypes.", attendees:142},
  {title:"Guest Lecture: Next-Gen Quantum Computing", date:"Friday, Mar 15", time:"2:00 PM – 4:00 PM", location:"Auditorium Hall 1", category:"Academic", image:"⚛️", description:"Distinguished session by Dr. A. Raman on scalable quantum algorithms.", attendees:210},
  {title:"Annual Inter-College Sports Fest", date:"Mon–Wed, Mar 18–20", time:"8:00 AM – 7:00 PM", location:"Main Sports Complex", category:"Sports", image:"🏆", description:"Football, basketball, athletics & badminton tournaments across universities.", attendees:580},
  {title:"Campus Photography & Art Exhibition", date:"Thursday, Mar 21", time:"11:00 AM – 5:00 PM", location:"Central Library Atrium", category:"Cultural", image:"🎨", description:"Showcasing student visual arts, photo essays, and mixed media installations.", attendees:95},
  {title:"Tech Startup & VC Pitch Day", date:"Saturday, Mar 23", time:"1:00 PM – 5:30 PM", location:"Seminar Hall B-201", category:"Entrepreneurship", image:"🚀", description:"Student founders pitch to angel investors and industry mentors.", attendees:165},
];

const MARKETPLACE = [
  {title:"Casio FX-991EX Scientific Calculator", category:"Electronics", price:"₹750", condition:"Like New", seller_name:"Rahul S.", seller_dept:"B.Tech CSE", verified:1, image:"🧮", description:"Used for one semester only. Complete with original cover and fresh battery."},
  {title:"CLRS Algorithms (4th Edition - Hardcover)", category:"Books", price:"₹650", condition:"Very Good", seller_name:"Ananya M.", seller_dept:"B.Tech CSE", verified:1, image:"📚", description:"Clean pages without highlights. Ideal for DSA and competitive programming."},
  {title:"Hero Sprint Hybrid Bicycle (21-Speed)", category:"Cycles", price:"₹3,200", condition:"Good", seller_name:"Karthik V.", seller_dept:"Mechanical", verified:1, image:"🚲", description:"Great for campus commute. Includes security lock and front LED headlight."},
  {title:"Ergonomic Study Chair + Lumbar Cushion", category:"Furniture", price:"₹1,100", condition:"Good", seller_name:"Sneha P.", seller_dept:"MBA", verified:1, image:"🪑", description:"Comfortable adjustable height chair suitable for hostel room study desk."},
  {title:"Arduino Mega 2560 Starter Kit + Sensors", category:"Electronics", price:"₹950", condition:"Like New", seller_name:"Rohan D.", seller_dept:"ECE", verified:1, image:"🔌", description:"Complete with breadboard, ultrasonic sensors, jumper wires, and motor driver."},
  {title:"Handwritten Organic Chemistry Full Notes", category:"Notes", price:"₹250", condition:"New", seller_name:"Pooja K.", seller_dept:"B Pharma", verified:1, image:"📝", description:"Comprehensive color-coded chapter summaries with solved exam questions."},
];

const LOST_FOUND = [
  {type:"lost", title:"Black North Face Backpack", category:"Bags", location:"Central Library, 2nd Floor", date_time:"Today, 11:30 AM", description:"Contains a blue spiral notebook, scientific calculator, and water bottle.", image:"🎒", status:"Matching", contact:"stu-2025-042"},
  {type:"found", title:"Matte Black Backpack with Keyring", category:"Bags", location:"Library Study Room L-2", date_time:"Today, 12:15 PM", description:"Black bag found on table 4 with stationery and calculator inside.", image:"🎒", status:"Open", contact:"Campus Security (Desk 1)"},
  {type:"lost", title:"Apple AirPods Pro (Gen 2)", category:"Electronics", location:"Block A Cafeteria", date_time:"Yesterday, 4:00 PM", description:"White case with a small red silicon sleeve and initials 'AK'.", image:"🎧", status:"Open", contact:"stu-2025-119"},
  {type:"found", title:"Blue Water Flask (Milton 1L)", category:"Personal", location:"Block B Lab 104", date_time:"Today, 9:00 AM", description:"Stainless steel blue bottle left near workstation 12.", image:"🍶", status:"Claimed", contact:"Lab Assistant Block B"},
  {type:"lost", title:"Student ID Card & Metro Pass", category:"Documents", location:"Near Sports Complex", date_time:"Mar 11, 5:30 PM", description:"Lanyard with ID: STU-2025-089 (Electronics Dept).", image:"🪪", status:"Open", contact:"stu-2025-089"},
];

const NOTICES = [
  {title:"Library Extended Reading Hours", category:"Library", priority:"normal", body:"Central Library will remain open until 11:00 PM on all days leading up to mid-term examinations."},
  {title:"Lab Block C Maintenance Window", category:"Facilities", priority:"important", body:"Power backup testing scheduled on Sunday 6:00 AM – 9:00 AM. Server rigs will be offline."},
  {title:"Emergency Medical Drill Tomorrow", category:"Hospital", priority:"emergency", body:"Campus-wide emergency evacuation & ambulance response drill at 11:30 AM."},
  {title:"Smart Cafeteria Pre-Ordering Activated", category:"Food", priority:"normal", body:"You can now skip queue lines by placing orders directly on the CMS Smart Portal!"},
];

seedIfEmpty('books', BOOKS, (b) => {
  db.prepare(`INSERT INTO books (id,title,author,copies,shelf,category,year,icon) VALUES (@id,@title,@author,@copies,@shelf,@category,@year,@icon)`).run(b);
});

seedIfEmpty('doctors', DOCTORS, (d) => {
  db.prepare(`INSERT INTO doctors (id,name,spec,avail,room,type,icon,timing,exp) VALUES (@id,@name,@spec,@avail,@room,@type,@icon,@timing,@exp)`).run(d);
});

seedIfEmpty('food_menus', Object.entries(FOOD_MENUS).map(([key, m]) => ({key, ...m})), (m) => {
  db.prepare(`INSERT INTO food_menus (key,name,subtitle,tabs,items) VALUES (@key,@name,@subtitle,@tabs,@items)`)
    .run({ key: m.key, name: m.name, subtitle: m.subtitle, tabs: JSON.stringify(m.tabs), items: JSON.stringify(m.items) });
});

seedIfEmpty('events', EVENTS, (ev) => {
  db.prepare(`INSERT INTO events (title,date,time,location,category,image,description,attendees) VALUES (@title,@date,@time,@location,@category,@image,@description,@attendees)`).run(ev);
});

seedIfEmpty('marketplace_items', MARKETPLACE, (mp) => {
  db.prepare(`INSERT INTO marketplace_items (title,category,price,condition,seller_name,seller_dept,verified,image,description) VALUES (@title,@category,@price,@condition,@seller_name,@seller_dept,@verified,@image,@description)`).run(mp);
});

seedIfEmpty('lost_found_items', LOST_FOUND, (lf) => {
  db.prepare(`INSERT INTO lost_found_items (type,title,category,location,date_time,description,image,status,contact) VALUES (@type,@title,@category,@location,@date_time,@description,@image,@status,@contact)`).run(lf);
});

seedIfEmpty('campus_notices', NOTICES, (n) => {
  db.prepare(`INSERT INTO campus_notices (title,category,priority,body) VALUES (@title,@category,@priority,@body)`).run(n);
});

seedIfEmpty('lab_equipment', [
  {name:"Oscilloscope", department:"Electronics"},
  {name:"3D Printer", department:"Mechanical"},
  {name:"Spectrometer", department:"Chemistry"},
  {name:"VR Headset Rig", department:"Computer Science"},
  {name:"CNC Machine", department:"Mechanical"},
], (e) => {
  db.prepare(`INSERT INTO lab_equipment (name,department) VALUES (@name,@department)`).run(e);
});

const FACULTY = [
  {name:"Dr. Neha Gupta", department:"Computer Science", slot:"Mon & Wed 2:00 PM – 4:00 PM (Room B-204)"},
  {name:"Dr. Anil Kumar", department:"Computer Science", slot:"Tue & Thu 10:00 AM – 12:00 PM (Room A-102)"},
  {name:"Prof. Vikram Rao", department:"Electronics & Robotics", slot:"Mon–Fri 3:00 PM – 5:00 PM (Robotics Lab 3)"},
  {name:"Dr. Priya Mehta", department:"Mathematics & Computing", slot:"Daily 11:00 AM – 1:00 PM (Room C-302)"},
  {name:"Dr. Rajesh Verma", department:"Mechanical Engineering", slot:"Tue & Fri 2:00 PM – 4:00 PM (CAD Lab)"},
  {name:"Dr. Sunita Sharma", department:"Agriculture Science", slot:"Mon & Thu 1:00 PM – 3:00 PM (Block D-105)"},
  {name:"Dr. Amit Patel", department:"B Pharma & Chemistry", slot:"Wed & Fri 10:00 AM – 12:00 PM (Chem Lab 2)"},
  {name:"Prof. Kavya Nair", department:"Management & MBA", slot:"Mon–Thu 4:00 PM – 5:30 PM (MBA Suite 2)"}
];

seedIfEmpty('faculty_directory', FACULTY, (f) => {
  db.prepare(`INSERT INTO faculty_directory (name,department,slot,added_by) VALUES (?,?,?,?)`).run(f.name, f.department, f.slot, 1);
});

const CLASSROOMS = [
  {room_no:"Room A-101", location:"Block A", capacity:"40–60"},
  {room_no:"Room A-102", location:"Block A", capacity:"20–40"},
  {room_no:"Room B-204", location:"Block B", capacity:"40–60"},
  {room_no:"Lecture Hall 103", location:"Block C", capacity:"60+"},
  {room_no:"Seminar Suite D-101", location:"Block D", capacity:"10–20"}
];

seedIfEmpty('classrooms', CLASSROOMS, (c) => {
  db.prepare(`INSERT INTO classrooms (room_no,location,capacity,added_by) VALUES (?,?,?,?)`).run(c.room_no, c.location, c.capacity, 1);
});

module.exports = db;

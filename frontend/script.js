
/* ══════════════════════════════════════════════════════════
   CMS SMART PORTAL — MODERN AI CAMPUS OS CLIENT ENGINE
   Unified State, AI Engine, Map Navigation & Services
   Integrated with Firebase & Multi-Mode OTP Authentication
══════════════════════════════════════════════════════════ */

// ─── API CONFIG & CLIENT ───
const isLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'file:' ||
                !window.location.hostname;

const API_BASE = isLocal
  ? (window.location.protocol === 'file:' ? 'http://localhost:4000' : '')
  : 'https://cms-smart-portal.onrender.com';

if (window.location.protocol === 'file:') {
  console.warn('CMS Notice: Running directly from file://. Google and Phone SMS Auth require http://localhost:4000.');
  setTimeout(() => {
    showToast('⚠️ Opened via file://. For Google Sign-In & Phone SMS, please open http://localhost:4000', 'warn');
  }, 1200);
}

function getToken() { return localStorage.getItem('cms_token') || ''; }
function setToken(t) { localStorage.setItem('cms_token', t); }
function clearToken() { localStorage.removeItem('cms_token'); localStorage.removeItem('cms_user'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('cms_user') || 'null'); } catch(e) { return null; }
}
function setUser(u) { localStorage.setItem('cms_user', JSON.stringify(u)); }

// Resilient API Fetch with local state fallback
async function apiFetch(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  
  try {
    const res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
    let data = null;
    try { data = await res.json(); } catch(e) {}
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : ('Request failed (' + res.status + ')');
      throw new Error(msg);
    }
    return data;
  } catch(err) {
    return handleLocalFallback(path, options);
  }
}

// ─── FIREBASE CONFIGURATION & PHONE/GOOGLE AUTH (OG) ───
const firebaseConfig = {
  apiKey: "AIzaSyB1TokbG1axS7UDICCv8nckM_3tNCZ4wgE",
  authDomain: "cms-smart-portal.firebaseapp.com",
  projectId: "cms-smart-portal",
  storageBucket: "cms-smart-portal.firebasestorage.app",
  messagingSenderId: "619415646751",
  appId: "1:619415646751:web:fd2d22f4b368299c505b2a",
  measurementId: "G-V3Y20KCSXQ"
};

let fbAuth = null;
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  fbAuth = firebase.auth();
}

let confirmationResult = null;
let recaptchaVerifier = null;

function initRecaptcha() {
  if (!fbAuth) return;
  if (!recaptchaVerifier) {
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: () => {}
    });
  }
}

function getFullPhoneNumber(raw) {
  let p = (raw || '').trim().replace(/[\s\-()]/g, '');
  if (!p) return null;
  if (p.startsWith('+')) return p;
  if (p.length === 12 && p.startsWith('91')) return '+' + p;
  if (p.length === 10) return '+91' + p;
  return '+' + p;
}

// ─── DATA (Department Dropdowns) ───
const studentDepts = ["B.Tech – CSE","B.Tech – ECE","B.Tech – Mechanical","Agriculture","B Pharma","MBA","B.Sc","MCA"];
const teacherDepts = ["Computer Science","Electronics","Mechanical Engineering","Agriculture","B Pharma","Mathematics","Physics","Management"];

// ─── AUTH STATE & FLOWS (OG) ───
let currentRole = 'student';
let otp = '';
let currentOtpMode = 'email';

function goRoles() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('rolePage').style.display = 'flex';
}

function goLogin(role) {
  currentRole = role;
  document.getElementById('rolePage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
  const isTeacher = role === 'teacher';
  const studentSvg = '<svg class="mono-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></svg> ';
  const teacherSvg = '<svg class="mono-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> ';
  
  const roleInd = document.getElementById('roleIndicator');
  if (roleInd) roleInd.innerHTML = (isTeacher ? teacherSvg : studentSvg) + (isTeacher ? '<span>Faculty Portal</span>' : '<span>Student Portal</span>');
  
  const h2 = document.getElementById('lpHeading');
  if (h2) h2.textContent = isTeacher ? 'Faculty Sign In' : 'Welcome back';
  
  const h2Sub = document.getElementById('lpSubHeading');
  if (h2Sub) h2Sub.textContent = isTeacher ? 'Sign in to your faculty account' : 'Sign in to your student account';
  
  const idLbl = document.getElementById('idLabel');
  if (idLbl) idLbl.textContent = isTeacher ? 'Faculty ID (Optional)' : 'Student ID (Optional)';
  
  const regIdLbl = document.getElementById('regIdLabel');
  if (regIdLbl) regIdLbl.textContent = isTeacher ? 'Faculty ID' : 'Student ID';
  
  const logId = document.getElementById('loginId');
  if (logId) logId.placeholder = isTeacher ? 'e.g. FAC-2025-001' : 'e.g. STU-2025-001';
  
  const rId = document.getElementById('regId');
  if (rId) rId.placeholder = isTeacher ? 'e.g. FAC-2025-001' : 'e.g. STU-2025-001';
  
  const regTeacherFld = document.getElementById('regTeacherFld');
  if (regTeacherFld) regTeacherFld.style.display = isTeacher ? 'block' : 'none';
  
  const sel = document.getElementById('regDept');
  if (sel) {
    sel.innerHTML = '<option value="">Select department</option>';
    const depts = isTeacher ? teacherDepts : studentDepts;
    depts.forEach(d => { const o = document.createElement('option'); o.textContent = d; sel.appendChild(o); });
  }
  
  otp = '';
  confirmationResult = null;
  const otpBtn = document.getElementById('otpBtn');
  if (otpBtn) {
    otpBtn.textContent = 'Get OTP';
    otpBtn.disabled = false;
  }
}

function switchAuth(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  const signinSec = document.getElementById('authSignin');
  const regSec = document.getElementById('authRegister');
  if (signinSec) signinSec.style.display = tab === 'signin' ? 'block' : 'none';
  if (regSec) regSec.style.display = tab === 'register' ? 'block' : 'none';
}

function switchOtpMode(mode) {
  currentOtpMode = mode;
  const isEmail = mode === 'email';
  const emailBtn = document.getElementById('subtabEmail');
  const phoneBtn = document.getElementById('subtabPhone');
  if (emailBtn) emailBtn.classList.toggle('on', isEmail);
  if (phoneBtn) phoneBtn.classList.toggle('on', !isEmail);
  const emailSec = document.getElementById('otpEmailSection');
  const phoneSec = document.getElementById('otpPhoneSection');
  if (emailSec) emailSec.style.display = isEmail ? 'block' : 'none';
  if (phoneSec) phoneSec.style.display = isEmail ? 'none' : 'block';
}

async function sendEmailOTP() {
  const email = document.getElementById('loginEmail').value.trim();
  const id = document.getElementById('loginId').value.trim();
  if (!email || !email.includes('@')) {
    showToast('⚠️ Please enter a valid email address', 'warn');
    return;
  }
  const btn = document.getElementById('otpEmailBtn');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const data = await apiFetch('/api/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email, loginId: id || undefined, role: currentRole })
    });
    showToast('✉️ Verification code sent to your email inbox! Check spam if needed.', 'info');

    let t = 60;
    const iv = setInterval(() => {
      t--;
      btn.textContent = 'Wait ' + t + 's';
      if (t <= 0) {
        clearInterval(iv);
        btn.textContent = 'Resend';
        btn.disabled = false;
      }
    }, 1000);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Get OTP';
    showToast('❌ ' + err.message, 'warn');
  }
}

async function doEmailLogin(e) {
  if (e && e.currentTarget) addRipple(e.currentTarget, e);
  const email = document.getElementById('loginEmail').value.trim();
  const id = document.getElementById('loginId').value.trim();
  const inp = document.getElementById('otpEmailInput').value.trim();

  if (!email) {
    showToast('⚠️ Please enter your email address', 'warn');
    return;
  }
  if (!inp) {
    showToast('⚠️ Enter the 6-digit code received in your email', 'warn');
    return;
  }

  try {
    const data = await apiFetch('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, loginId: id || undefined, otp: inp, role: currentRole })
    });
    setToken(data.token);
    setUser(data.user);
    showToast('✅ Welcome, ' + data.user.name + '!');
    launchPortal(data.user.name, data.user.login_id, data.user.role);
  } catch (err) {
    showToast('❌ ' + err.message, 'warn');
  }
}

async function sendOTP() {
  const phone = document.getElementById('loginPhone').value.trim();
  if (!phone) {
    showToast('⚠️ Enter your mobile number first', 'warn');
    return;
  }
  const fullPhone = getFullPhoneNumber(phone);
  const btn = document.getElementById('otpBtn');
  btn.disabled = true;
  btn.textContent = 'Sending SMS…';

  if (!fbAuth) {
    showToast('❌ Firebase Auth is not initialized. Please refresh the page.', 'warn');
    btn.textContent = 'Get OTP';
    btn.disabled = false;
    return;
  }

  try {
    initRecaptcha();
    confirmationResult = await fbAuth.signInWithPhoneNumber(fullPhone, recaptchaVerifier);
    showToast('📲 Verification code sent via SMS to ' + fullPhone + '. Check your messages!', 'info');

    let t = 60;
    const iv = setInterval(() => {
      t--;
      btn.textContent = 'Wait ' + t + 's';
      if (t <= 0) {
        clearInterval(iv);
        btn.textContent = 'Resend';
        btn.disabled = false;
      }
    }, 1000);
  } catch (err) {
    console.error('Firebase SMS OTP Error:', err);
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch (e) {}
      recaptchaVerifier = null;
    }
    btn.textContent = 'Get OTP';
    btn.disabled = false;

    const msg = err.message || '';
    if (msg.includes('region') || msg.includes('OPERATION_NOT_ALLOWED') || err.code === 'auth/internal-error') {
      showToast('❌ SMS blocked by Firebase: Enable India (+91) in Firebase Console -> Authentication -> Settings', 'warn');
    } else if (err.code === 'auth/operation-not-allowed') {
      showToast('❌ Phone Auth not enabled in Firebase Console -> Authentication -> Sign-in method', 'warn');
    } else {
      showToast('❌ SMS Error: ' + (err.message || 'Could not send SMS to phone'), 'warn');
    }
  }
}

async function doLogin(e) {
  if (e && e.currentTarget) addRipple(e.currentTarget, e);
  const id = document.getElementById('loginId').value.trim();
  const inp = document.getElementById('otpInput').value.trim();

  if (!inp) {
    showToast('⚠️ Enter the 6-digit SMS code sent to your phone', 'warn');
    return;
  }

  // 1. Firebase SMS OTP Verification
  if (confirmationResult) {
    try {
      const result = await confirmationResult.confirm(inp);
      const idToken = await result.user.getIdToken();

      const data = await apiFetch('/api/auth/firebase-login', {
        method: 'POST',
        body: JSON.stringify({
          idToken,
          role: currentRole,
          loginId: id || undefined
        })
      });

      setToken(data.token);
      setUser(data.user);
      showToast('✅ Welcome, ' + data.user.name + '!');
      launchPortal(data.user.name, data.user.login_id, data.user.role);
      return;
    } catch (err) {
      console.error('Firebase OTP verify error:', err);
      showToast('❌ ' + (err.message || 'Invalid SMS code. Please check your messages.'), 'warn');
      return;
    }
  }

  showToast('⚠️ Click "Get OTP" first to receive an SMS verification code on your phone', 'warn');
}

async function signInWithGoogle() {
  if (!fbAuth) {
    showToast('⚠️ Firebase Auth is not available', 'warn');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await fbAuth.signInWithPopup(provider);
    const idToken = await result.user.getIdToken();

    const data = await apiFetch('/api/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({
        idToken,
        role: currentRole
      })
    });

    setToken(data.token);
    setUser(data.user);
    showToast('✅ Signed in as ' + data.user.name);
    launchPortal(data.user.name, data.user.login_id, data.user.role);
  } catch (err) {
    console.error('Google Sign-In Error:', err);
    if (err.code === 'auth/popup-closed-by-user') return;
    if (err.code === 'auth/operation-not-supported-in-this-environment') {
      showToast('⚠️ Google Sign-In requires http://localhost:4000 (cannot run from file://)', 'warn');
    } else {
      showToast('❌ ' + (err.message || 'Google Sign-In failed'), 'warn');
    }
  }
}

async function doRegister(e) {
  if (e && e.currentTarget) addRipple(e.currentTarget, e);
  const name = document.getElementById('regName').value.trim();
  const id = document.getElementById('regId').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail') ? document.getElementById('regEmail').value.trim() : '';
  const dept = document.getElementById('regDept').value;
  const desig = document.getElementById('regDesig') ? document.getElementById('regDesig').value : '';
  if (!name || !id || !phone || !dept) { showToast('⚠️ Fill all required fields', 'warn'); return; }
  try {
    await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        loginId: id, name, phone, email, role: currentRole, department: dept, designation: desig || null
      })
    });
    showToast('✅ Account created! Now sign in.');
    document.querySelector('.auth-tab:first-child').click();
    document.getElementById('loginId').value = id;
    const pEl = document.getElementById('loginPhone');
    if (pEl) pEl.value = phone;
    const eEl = document.getElementById('loginEmail');
    if (eEl) eEl.value = email;
  } catch (err) {
    showToast('❌ ' + err.message, 'warn');
  }
}

function launchPortal(name, id, role) {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('rolePage').style.display = 'none';
  const p = document.getElementById('portal');
  p.style.display = 'flex';
  p.classList.add('on');

  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';
  const roleLabel = isAdmin ? 'Admin Portal' : isTeacher ? 'Faculty Portal' : 'Student Portal';
  const avClass = isAdmin ? 'admin' : isTeacher ? 'teacher' : 'student';

  const user = getUser();
  const sbAv = document.getElementById('sbAv');
  const tbAv = document.getElementById('tbAv');

  if (user && user.avatar) {
    if (sbAv) sbAv.innerHTML = `<img src="${user.avatar}" alt="${name}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;">`;
    if (tbAv) tbAv.innerHTML = `<img src="${user.avatar}" alt="${name}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;">`;
  } else {
    const initial = (name[0] || 'A').toUpperCase();
    if (sbAv) { sbAv.textContent = initial; sbAv.className = 'sb-av ' + avClass; }
    if (tbAv) { tbAv.textContent = initial; tbAv.className = 'tb-av ' + avClass; }
  }

  const sbName = document.getElementById('sbName');
  const tbName = document.getElementById('tbName');
  const sbRole = document.getElementById('sbRole');
  const tbRole = document.getElementById('tbRole');
  const greeting = document.getElementById('dashGreeting');

  if (sbName) sbName.textContent = name;
  if (tbName) tbName.textContent = name;
  if (sbRole) sbRole.textContent = roleLabel;
  if (tbRole) tbRole.textContent = roleLabel;
  if (greeting) greeting.innerHTML = `Good day, <span id="dashUserName">${name.split(' ')[0]}</span> 👋`;

  // Dynamic User Binding for Digital Pass and Profile
  const dept = (user && user.department) ? user.department : (isTeacher ? 'Faculty · Computer Science & Eng.' : 'B.Tech – Computer Science');
  const userRoll = (user && user.rollNumber) ? user.rollNumber : (id || (isTeacher ? 'FAC-2025-042' : 'STU-2025-001'));
  const passName = document.getElementById('passName');
  const passId = document.getElementById('passId');
  const passDept = document.getElementById('passDept');
  const passAv = document.getElementById('passAvatar');
  const profName = document.getElementById('profName');
  const profId = document.getElementById('profId');
  const profDept = document.getElementById('profDept');
  const profRole = document.getElementById('profRole');
  const profInputName = document.getElementById('profInputName');
  const profInputId = document.getElementById('profInputId');
  const profInputDept = document.getElementById('profInputDept');
  const profAv = document.getElementById('profAvatar');

  if (passName) passName.textContent = name;
  if (passId) passId.textContent = userRoll;
  if (passDept) passDept.textContent = dept;
  if (profName) profName.textContent = name;
  if (profRole) profRole.textContent = `${roleLabel} · ${dept}`;
  if (profInputName) profInputName.value = name;
  if (profInputId) profInputId.value = userRoll;
  if (profInputDept) profInputDept.value = dept;

  if (user && user.avatar) {
    if (passAv) passAv.innerHTML = `<img src="${user.avatar}" alt="${name}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;">`;
    if (profAv) {
      profAv.innerHTML = `<img src="${user.avatar}" alt="${name}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;">`;
      profAv.className = 'sb-av';
    }
  } else {
    const initial = (name[0] || 'A').toUpperCase();
    if (passAv) passAv.textContent = isTeacher ? '👨‍🏫' : '👨‍🎓';
    if (profAv) { profAv.textContent = initial; profAv.className = 'sb-av ' + avClass; }
  }

  // Admin visibility toggle
  const adminLabel = document.getElementById('adminNavLabel');
  const adminItem = document.getElementById('adminNavItem');
  if (adminLabel) adminLabel.style.display = (isAdmin || isTeacher) ? 'block' : 'none';
  if (adminItem) adminItem.style.display = (isAdmin || isTeacher) ? 'flex' : 'none';

  const dateEl = document.getElementById('dashDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  navTo('dashboard', null);
  renderAllModules();
}

function logout() {
  clearToken();
  if (fbAuth) {
    try { fbAuth.signOut(); } catch(e) {}
  }
  const p = document.getElementById('portal');
  if (p) {
    p.style.display = 'none';
    p.classList.remove('on');
  }
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('rolePage').style.display = 'flex';
  showToast('Signed out successfully.');
}

function addRipple(btn, e) {
  const r = document.createElement('span');
  r.className = 'ripple-el';
  const rect = btn.getBoundingClientRect();
  r.style.left = (e.clientX - rect.left) + 'px';
  r.style.top = (e.clientY - rect.top) + 'px';
  btn.appendChild(r);
  setTimeout(() => r.remove(), 600);
}

// ─── LOCAL STATE STORE (Guarantees 100% Uptime for Demo) ───
const localStore = {
  theme: localStorage.getItem('cms_theme') || 'dark',
  role: 'student',
  cart: [],
  activeOrders: [],
  user: {
    id: 1,
    name: 'Alex Sharma',
    login_id: 'STU-2025-001',
    role: 'student',
    department: 'B.Tech – Computer Science',
    skills: 'Python, Machine Learning, UI/UX, React'
  },
  todaySchedule: [
    { time: '09:00 – 10:30 AM', subject: 'Compiler Design', room: 'Room B-204', faculty: 'Dr. Neha Gupta', building: 'Block B', status: 'Completed' },
    { time: '11:00 – 12:30 PM', subject: 'Data Structures & Algorithms', room: 'Lecture Hall 102', faculty: 'Dr. Anil Kumar', building: 'Block A', status: 'In Progress' },
    { time: '02:00 – 03:30 PM', subject: 'Machine Learning Lab', room: 'Robotics Lab 3', faculty: 'Prof. Vikram Rao', building: 'Block B', status: 'Upcoming' },
    { time: '04:00 – 05:00 PM', subject: 'Technical Communication', room: 'Room C-302', faculty: 'Dr. Priya Mehta', building: 'Block C', status: 'Upcoming' }
  ],
  notifications: [
    { id: 1, title: '🚨 Emergency Drill Scheduled', category: 'Emergency', priority: 'emergency', time: '10 mins ago', text: 'Campus-wide safety & evacuation drill tomorrow at 11:30 AM.' },
    { id: 2, title: '📅 Lab Reservation Confirmed', category: 'Bookings', priority: 'important', time: '45 mins ago', text: 'Robotics Lab 3 reserved for today 2:00 PM – 4:00 PM.' },
    { id: 3, title: '🍔 Cafeteria Pre-order Ready', category: 'Cafeteria', priority: 'normal', time: '2 hours ago', text: 'Your Cold Coffee & Poha are ready for pickup at Counter 2.' },
    { id: 4, title: '📚 Book Return Reminder', category: 'Library', priority: 'normal', time: 'Yesterday', text: 'CLRS Algorithms copy due for renewal in 3 days.' }
  ],
  bookings: [
    { id: 101, resource_name: 'Room B-204 (Block B)', resource_type: 'Classroom', block: 'Block B', slot_date: 'Today', time_slot: '02:00 PM – 04:00 PM', purpose: 'AI Project Sprint', status: 'Confirmed', qr_token: 'CMS-BK-918231' },
    { id: 102, resource_name: 'Robotics Lab 3', resource_type: 'Lab', block: 'Block B', slot_date: 'Tomorrow', time_slot: '11:00 AM – 01:00 PM', purpose: 'VR Headset Experiment', status: 'Confirmed', qr_token: 'CMS-BK-482019' }
  ],
  events: [
    { id: 1, title: 'AI & Robotics Hackathon 2026', date: 'Tomorrow, Mar 13', time: '10:00 AM – 6:00 PM', location: 'Innovation Lab, Block C', category: 'Technology', image: '🤖', description: '24-hour sprint building intelligent campus automation & robotics prototypes.', attendees: 142 },
    { id: 2, title: 'Guest Lecture: Quantum Computing', date: 'Friday, Mar 15', time: '2:00 PM – 4:00 PM', location: 'Auditorium Hall 1', category: 'Academic', image: '⚛️', description: 'Distinguished session by Dr. A. Raman on scalable quantum algorithms.', attendees: 210 },
    { id: 3, title: 'Annual Inter-College Sports Fest', date: 'Mon–Wed, Mar 18–20', time: '8:00 AM – 7:00 PM', location: 'Main Sports Complex', category: 'Sports', image: '🏆', description: 'Football, basketball, athletics & badminton tournaments across universities.', attendees: 580 },
    { id: 4, title: 'Campus Photography & Art Exhibition', date: 'Thursday, Mar 21', time: '11:00 AM – 5:00 PM', location: 'Central Library Atrium', category: 'Cultural', image: '🎨', description: 'Showcasing student visual arts, photo essays, and mixed media installations.', attendees: 95 }
  ],
  marketplace: [
    { id: 1, title: 'Casio FX-991EX Scientific Calculator', category: 'Electronics', price: '₹750', condition: 'Like New', seller_name: 'Rahul S.', seller_dept: 'B.Tech CSE', verified: 1, image: '🧮', description: 'Used for one semester only. Complete with original cover and fresh battery.' },
    { id: 2, title: 'CLRS Algorithms (4th Edition - Hardcover)', category: 'Books', price: '₹650', condition: 'Very Good', seller_name: 'Ananya M.', seller_dept: 'B.Tech CSE', verified: 1, image: '📚', description: 'Clean pages without highlights. Ideal for DSA and competitive programming.' },
    { id: 3, title: 'Hero Sprint Hybrid Bicycle (21-Speed)', category: 'Cycles', price: '₹3,200', condition: 'Good', seller_name: 'Karthik V.', seller_dept: 'Mechanical', verified: 1, image: '🚲', description: 'Great for campus commute. Includes security lock and front LED headlight.' },
    { id: 4, title: 'Arduino Mega 2560 Starter Kit + Sensors', category: 'Electronics', price: '₹950', condition: 'Like New', seller_name: 'Rohan D.', seller_dept: 'ECE', verified: 1, image: '🔌', description: 'Complete with breadboard, ultrasonic sensors, jumper wires, and motor driver.' }
  ],
  lostFound: [
    { id: 1, type: 'lost', title: 'Black North Face Backpack', category: 'Bags', location: 'Central Library, 2nd Floor', date_time: 'Today, 11:30 AM', description: 'Contains a blue spiral notebook, scientific calculator, and water bottle.', image: '🎒', status: 'Matching', contact: 'STU-2025-042' },
    { id: 2, type: 'found', title: 'Matte Black Backpack with Keyring', category: 'Bags', location: 'Library Study Room L-2', date_time: 'Today, 12:15 PM', description: 'Black bag found on table 4 with stationery and calculator inside.', image: '🎒', status: 'Open', contact: 'Campus Security (Desk 1)' },
    { id: 3, type: 'lost', title: 'Apple AirPods Pro (Gen 2)', category: 'Electronics', location: 'Block A Cafeteria', date_time: 'Yesterday, 4:00 PM', description: 'White case with a small red silicon sleeve and initials "AK".', image: '🎧', status: 'Open', contact: 'STU-2025-119' },
    { id: 4, type: 'found', title: 'Blue Water Flask (Milton 1L)', category: 'Personal', location: 'Block B Lab 104', date_time: 'Today, 9:00 AM', description: 'Stainless steel blue bottle left near workstation 12.', image: '🍶', status: 'Claimed', contact: 'Lab Assistant Block B' }
  ],
  tutors: [
    { name: 'Rahul Sharma', subject: 'Data Structures & Algorithms', time: '2:00 – 4:00 PM', dept: 'B.Tech 3rd yr', status: 'Available' },
    { name: 'Priya Singh', subject: 'Linear Algebra & Calculus', time: '10:00 AM – 12:00 PM', dept: 'B.Tech 4th yr', status: 'Available' },
    { name: 'Amit Kumar', subject: 'Physics & Electromagnetism', time: '3:00 – 5:00 PM', dept: 'B.Sc 2nd yr', status: 'Busy' },
    { name: 'Neha Patel', subject: 'Organic Chemistry', time: '11:00 AM – 1:00 PM', dept: 'B Pharma 3rd yr', status: 'Available' }
  ],
  discussionRooms: [
    { name: 'Discussion Suite D-101', capacity: 8, block: 'Block D (Ground Floor)', equip: 'A/C, Whiteboard, 4K Display', status: 'Free' },
    { name: 'Discussion Suite D-102', capacity: 6, block: 'Block D (Ground Floor)', equip: 'A/C, Whiteboard', status: 'Booked' },
    { name: 'Library Pod L-1', capacity: 4, block: 'Central Library 1st Floor', equip: 'Soundproof, High-Speed LAN', status: 'Free' },
    { name: 'Seminar Hall B-201', capacity: 24, block: 'Block B 2nd Floor', equip: 'Projector, Mic System, A/C', status: 'Free' }
  ],
  clubs: [
    { name: 'ACM & Coding Club', icon: '💻', members: 420, desc: 'Competitive programming, algorithmic contests & open source projects.' },
    { name: 'Robotics & Automation Society', icon: '🤖', members: 310, desc: 'Drones, microcontrollers, ROS2, and autonomous rover engineering.' },
    { name: 'AI & Data Science Guild', icon: '🧠', members: 380, desc: 'LLMs, Computer Vision, Kaggle competitions, and research workshops.' },
    { name: 'Cultural & Performing Arts Club', icon: '🎭', members: 520, desc: 'Music bands, theatre drama, classical dance, and annual fest organization.' },
    { name: 'Sports & Fitness Association', icon: '⚽', members: 640, desc: 'Football leagues, badminton, basketball, athletics, and fitness coaching.' },
    { name: 'E-Cell (Entrepreneurship)', icon: '🚀', members: 290, desc: 'Startup incubation, venture capital pitch days, and founder talks.' }
  ],
  books: [
    { id: 1, title: 'Data Structures & Algorithms', author: 'Thomas H. Cormen', copies: 4, shelf: 'A-12', category: 'Computer Science', year: '2022', icon: '📗' },
    { id: 2, title: 'Database Systems Concepts', author: 'Abraham Silberschatz', copies: 3, shelf: 'B-07', category: 'Computer Science', year: '2021', icon: '📘' },
    { id: 3, title: 'Operating System Concepts', author: 'Abraham Galvin', copies: 6, shelf: 'A-05', category: 'Computer Science', year: '2020', icon: '📙' },
    { id: 4, title: 'Computer Networks', author: 'James F. Kurose', copies: 2, shelf: 'C-14', category: 'Computer Science', year: '2021', icon: '📕' },
    { id: 5, title: 'Introduction to Machine Learning', author: 'Ethem Alpaydin', copies: 5, shelf: 'D-03', category: 'AI & ML', year: '2022', icon: '📗' },
    { id: 6, title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell', copies: 3, shelf: 'D-01', category: 'AI & ML', year: '2020', icon: '📘' },
    { id: 7, title: 'Design Patterns: Elements of Reusable Code', author: 'Gang of Four (GoF)', copies: 4, shelf: 'B-11', category: 'Programming', year: '2019', icon: '📙' },
    { id: 8, title: 'Clean Code: Handbook of Agile Craftsmanship', author: 'Robert C. Martin', copies: 7, shelf: 'B-14', category: 'Programming', year: '2008', icon: '📕' },
    { id: 9, title: 'Computer Organization & Architecture', author: 'William Stallings', copies: 3, shelf: 'A-08', category: 'Computer Science', year: '2019', icon: '📗' },
    { id: 10, title: 'Discrete Mathematics and Its Applications', author: 'Kenneth H. Rosen', copies: 5, shelf: 'E-02', category: 'Mathematics', year: '2018', icon: '📘' },
    { id: 11, title: 'Python Crash Course', author: 'Eric Matthes', copies: 6, shelf: 'A-02', category: 'Programming', year: '2019', icon: '📙' },
    { id: 12, title: 'Introduction to Algorithms (CLRS)', author: 'Cormen, Leiserson, Rivest, Stein', copies: 3, shelf: 'A-13', category: 'Computer Science', year: '2022', icon: '📗' }
  ],
  libraryReservations: [
    { id: 1, title: 'Introduction to Algorithms (CLRS)', author: 'Cormen, Leiserson, Rivest, Stein', shelf: 'A-13', status: 'Reserved', book_id: 12 }
  ],
  faculty: [
    { id: 1, name: 'Dr. Neha Gupta', department: 'Computer Science', slot: 'Mon & Wed 2:00 PM – 4:00 PM (Room B-204)', status: 'Available', designation: 'Professor' },
    { id: 2, name: 'Dr. Anil Kumar', department: 'Computer Science', slot: 'Tue & Thu 10:00 AM – 12:00 PM (Room A-102)', status: 'Available', designation: 'Associate Professor' },
    { id: 3, name: 'Prof. Vikram Rao', department: 'Electronics & Robotics', slot: 'Mon–Fri 3:00 PM – 5:00 PM (Robotics Lab 3)', status: 'Available', designation: 'Assistant Professor' },
    { id: 4, name: 'Dr. Priya Mehta', department: 'Mathematics & Computing', slot: 'Daily 11:00 AM – 1:00 PM (Room C-302)', status: 'Available', designation: 'Professor' },
    { id: 5, name: 'Dr. Rajesh Verma', department: 'Mechanical Engineering', slot: 'Tue & Fri 2:00 PM – 4:00 PM (CAD Lab)', status: 'Available', designation: 'Associate Professor' },
    { id: 6, name: 'Dr. Sunita Sharma', department: 'Agriculture Science', slot: 'Mon & Thu 1:00 PM – 3:00 PM (Block D-105)', status: 'Available', designation: 'Professor' },
    { id: 7, name: 'Dr. Amit Patel', department: 'B Pharma & Chemistry', slot: 'Wed & Fri 10:00 AM – 12:00 PM (Chem Lab 2)', status: 'Available', designation: 'Assistant Professor' },
    { id: 8, name: 'Prof. Kavya Nair', department: 'Management & MBA', slot: 'Mon–Thu 4:00 PM – 5:30 PM (MBA Suite 2)', status: 'Available', designation: 'Professor' }
  ],
  classrooms: [
    { id: 1, room_no: 'Room A-101', location: 'Block A', capacity: '40–60', status: 'Available' },
    { id: 2, room_no: 'Room A-102', location: 'Block A', capacity: '20–40', status: 'Available' },
    { id: 3, room_no: 'Room B-204', location: 'Block B', capacity: '40–60', status: 'Available' },
    { id: 4, room_no: 'Lecture Hall 103', location: 'Block C', capacity: '60+', status: 'Available' },
    { id: 5, room_no: 'Seminar Suite D-101', location: 'Block D', capacity: '10–20', status: 'Available' }
  ],
  doctors: [
    { id: 1, name: 'Dr. Anil Kumar', spec: 'General Medicine', avail: 'Available', room: 'Room 101', type: 'general', icon: '🩺', timing: '9:00 AM – 1:00 PM', exp: '15 yrs' },
    { id: 2, name: 'Dr. Priya Mehta', spec: 'Cardiology', avail: 'Available', room: 'Room 205', type: 'specialist', icon: '❤️', timing: '10:00 AM – 2:00 PM', exp: '12 yrs' },
    { id: 3, name: 'Dr. Rajesh Singh', spec: 'Dentistry', avail: 'Available', room: 'Room 108', type: 'general', icon: '🦷', timing: '9:00 AM – 12:00 PM', exp: '10 yrs' },
    { id: 4, name: 'Dr. Sunita Sharma', spec: 'Orthopedics', avail: 'Available', room: 'Room 302', type: 'specialist', icon: '🦴', timing: '2:00 PM – 6:00 PM', exp: '18 yrs' }
  ],
  doctorAppointments: [],
  labEquipment: [
    { id: 1, name: 'Digital Oscilloscope 100MHz', department: 'btech', slot: 'Daily 9 AM – 5 PM', icon: '⚡' },
    { id: 2, name: 'Ultimaker 3D Rapid Prototype Printer', department: 'btech', slot: 'Daily 10 AM – 6 PM', icon: '🖨️' },
    { id: 3, name: 'VR Headset Developer Rig', department: 'btech', slot: 'Daily 11 AM – 4 PM', icon: '🥽' },
    { id: 4, name: 'Precision UV Spectrometer', department: 'bpharma', slot: 'Daily 9 AM – 1 PM', icon: '🔬' },
    { id: 5, name: 'Automated Soil Moisture Analyzer', department: 'agriculture', slot: 'Daily 10 AM – 3 PM', icon: '🌱' },
    { id: 6, name: 'CNC Precision Milling Machine', department: 'btech', slot: 'Daily 1 PM – 5 PM', icon: '⚙️' }
  ],
  labReservations: []
};

function handleLocalFallback(path, options) {
  if (path.includes('/api/library/books')) {
    let list = [...localStore.books];
    if (path.includes('?q=')) {
      const q = decodeURIComponent(path.split('?q=')[1] || '').toLowerCase().trim();
      list = list.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.category || '').toLowerCase().includes(q) || (b.shelf || '').toLowerCase().includes(q));
    }
    return { books: list };
  }
  if (path.includes('/api/library/reservations')) return { reservations: localStore.libraryReservations };
  if (path.includes('/api/faculty')) {
    let list = [...localStore.faculty];
    if (path.includes('?q=')) {
      const q = decodeURIComponent(path.split('?q=')[1] || '').toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q) || (f.department || '').toLowerCase().includes(q) || (f.slot || '').toLowerCase().includes(q));
    }
    return { faculty: list };
  }
  if (path.includes('/api/classrooms')) return { classrooms: localStore.classrooms };
  if (path.includes('/api/hospital/doctors')) return { doctors: localStore.doctors };
  if (path.includes('/api/hospital/appointments')) return { appointments: localStore.doctorAppointments };
  if (path.includes('/api/lab/equipment')) return { equipment: localStore.labEquipment };
  if (path.includes('/api/lab/reservations')) return { reservations: localStore.labReservations };
  if (path.includes('/api/events')) return { events: localStore.events };
  if (path.includes('/api/marketplace')) return { items: localStore.marketplace };
  if (path.includes('/api/lost-found')) return { items: localStore.lostFound };
  if (path.includes('/api/bookings')) return { bookings: localStore.bookings };
  if (path.includes('/api/notices')) return { notices: localStore.notifications };
  if (path.includes('/api/intelligence/stats')) {
    return {
      metrics: { classroomUtilization: 78, labUtilization: 84, libraryUsage: 62, cafeteriaPeakWait: '8 mins', foodWasteReduction: '-28%' },
      peakHours: [{ time: '8 AM', traffic: 32 }, { time: '11 AM', traffic: 88 }, { time: '1 PM', traffic: 96 }, { time: '4 PM', traffic: 74 }, { time: '7 PM', traffic: 36 }],
      aiInsights: [
        { icon: '💡', title: 'High Block B Utilization', text: 'Block B classrooms are at 94% capacity between 11:00 AM and 2:00 PM.' },
        { icon: '🍔', title: 'Cafeteria Peak Surge Expected', text: 'Main Cafeteria queue will peak at 1:15 PM with ~120 orders.' }
      ]
    };
  }
  return { status: 'ok', data: [] };
}

/* ══════════════════════════════════════════
   THEME MANAGEMENT (Dark / Light)
══════════════════════════════════════════ */
function initTheme() {
  const saved = localStorage.getItem('cms_theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  localStore.theme = theme;
  localStorage.setItem('cms_theme', theme);
  const icon = document.getElementById('themeIcon');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    if (icon) icon.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    if (icon) icon.textContent = '🌙';
  }
}

function toggleTheme() {
  const next = localStore.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  showToast(`Switched to ${next === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}`);
}

/* ══════════════════════════════════════════

   NAVIGATION & PAGE SWITCHER
══════════════════════════════════════════ */
const pageMap = {
  dashboard: 'pageDashboard',
  map: 'pageMap',
  aitutor: 'pageAiTutor',
  ai: 'pageAiTutor',
  booking: 'pageBooking',
  pass: 'pagePass',
  food: 'pageFood',
  emergency: 'pageEmergency',
  lostfound: 'pageLostFound',
  marketplace: 'pageMarketplace',
  community: 'pageCommunity',
  intelligence: 'pageIntelligence',
  profile: 'pageProfile',
  library: 'pageLibrary',
  classroom: 'pageClassroom',
  faculty: 'pageFaculty',
  hospital: 'pageHospital',
  lab: 'pageLab',
  tutors: 'pageTutors',
  discussion: 'pageDiscussion',
  shops: 'pageShops',
  locations: 'pageLocations'
};

function navTo(pageKey, sbEl) {
  document.querySelectorAll('.sec-page').forEach(p => p.classList.remove('on'));
  const targetId = pageMap[pageKey] || 'pageDashboard';
  const targetPage = document.getElementById(targetId);
  if (targetPage) targetPage.classList.add('on');

  // Sidebar active state
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  if (sbEl) {
    sbEl.classList.add('active');
  } else {
    document.querySelectorAll('.sb-item').forEach(item => {
      const onclickAttr = item.getAttribute('onclick') || '';
      if (onclickAttr.includes(`'${pageKey}'`)) item.classList.add('active');
    });
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Trigger lazy renders
  if (pageKey === 'aitutor' || pageKey === 'ai') setTimeout(() => loadAiHistory(), 50);
  if (pageKey === 'food') renderFoodCards('cafeteria');
  if (pageKey === 'map') setTimeout(() => calculateMapRoute(), 100);
  if (pageKey === 'intelligence') renderIntelligenceDashboard();
  if (pageKey === 'marketplace') renderMarketplaceGrid();
  if (pageKey === 'lostfound') renderLostFoundGrid();
  if (pageKey === 'booking') renderUnifiedBookings();
  if (pageKey === 'library') renderLibrary();
  if (pageKey === 'faculty') renderFaculty();
  if (pageKey === 'classroom') renderClassrooms();
  if (pageKey === 'hospital') renderDoctors();
  if (pageKey === 'lab') renderLabEquipment();
  if (pageKey === 'tutors') renderTutors();
  if (pageKey === 'discussion') renderDiscussionRooms();
  if (pageKey === 'shops') renderShops();
  if (pageKey === 'locations') renderLocations();
}

/* ══════════════════════════════════════════
   INTERACTIVE CAMPUS MAP ENGINE
══════════════════════════════════════════ */
const buildingData = {
  'block-a': {
    title: 'Block A (Academic & Admin)',
    occupancy: '78% Occupancy',
    badgeClass: 'green',
    desc: 'Main administration, admissions, dean offices, and 12 general lecture classrooms.',
    stats: '🕒 Hours: 8:00 AM – 7:00 PM · 🚪 6 Free Classrooms · ♿ Wheelchair Accessible'
  },
  'library': {
    title: 'Central University Library',
    occupancy: '62% Occupancy',
    badgeClass: 'green',
    desc: '4-floor modern learning commons with 45,000+ books, quiet study pods & digital research labs.',
    stats: '🕒 Hours: 8:00 AM – 11:00 PM · 🚪 8 Free Discussion Pods · 📶 1 Gbps WiFi'
  },
  'block-b': {
    title: 'Block B (Innovation Labs & CSE)',
    occupancy: '84% Occupancy',
    badgeClass: 'orange',
    desc: 'Computer Science labs, Electronics testing workbench, VR headset rig & 3D prototyping center.',
    stats: '🕒 Hours: 8:00 AM – 8:00 PM · 🔬 Lab 102 & 104 Free · ⚡ High Power Workstations'
  },
  'block-c': {
    title: 'Block C (Lecture Theatres)',
    occupancy: '65% Occupancy',
    badgeClass: 'green',
    desc: 'Tiered multimedia auditoriums 1–8 for large classes, keynotes, and student club presentations.',
    stats: '🕒 Hours: 8:30 AM – 6:30 PM · 🚪 Hall 103 Available · 📽️ 4K Laser Projection'
  },
  'cafe': {
    title: 'Main Cafeteria & Food Court',
    occupancy: 'Queue: ~8 mins',
    badgeClass: 'orange',
    desc: 'Multi-cuisine food hub serving fresh breakfast, thali meals, coffee bar, and snack counters.',
    stats: '🕒 Hours: 7:00 AM – 9:00 PM · 🥗 Veg & Non-Veg · 📱 Mobile Pre-Order Active'
  },
  'hospital': {
    title: 'Health Centre & Emergency Clinic',
    occupancy: '24/7 Available',
    badgeClass: 'red',
    desc: 'Full-service campus clinic with general doctors, cardiology, dental unit, and 24/7 ambulance.',
    stats: '🕒 Hours: 24/7 Open · 🩺 6 Doctors on Duty · 🚑 Emergency Dispatch Desk'
  }
};

const mapCoords = {
  'bldg-block-a': { x: 170, y: 145 },
  'bldg-lib': { x: 500, y: 120 },
  'bldg-block-b': { x: 825, y: 145 },
  'bldg-cafe': { x: 185, y: 405 },
  'bldg-block-c': { x: 500, y: 405 },
  'bldg-hosp': { x: 830, y: 405 }
};

function openBuildingDetails(bldgKey) {
  const bldg = buildingData[bldgKey];
  if (!bldg) return;
  const drawer = document.getElementById('mapInfoDrawer');
  document.getElementById('midTitle').textContent = bldg.title;
  document.getElementById('midBadge').textContent = bldg.occupancy;
  document.getElementById('midBadge').className = `mid-badge badge ${bldg.badgeClass}`;
  document.getElementById('midDesc').textContent = bldg.desc;
  document.getElementById('midStats').innerHTML = bldg.stats.split(' · ').map(s => `<div>${s}</div>`).join('');
  drawer.classList.add('show');
}

function closeBuildingDetails() {
  document.getElementById('mapInfoDrawer').classList.remove('show');
}

function filterMapCategory(cat, btn) {
  document.querySelectorAll('#mapFilterRow .map-filter-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  showToast(`Showing ${cat === 'all' ? 'All Campus Buildings' : cat} on Map`, 'info');
}

function calculateMapRoute() {
  const fromKey = document.getElementById('routeFromSelect').value;
  const toKey = document.getElementById('routeToSelect').value;

  const c1 = mapCoords[fromKey] || { x: 500, y: 120 };
  const c2 = mapCoords[toKey] || { x: 825, y: 145 };

  const path = document.getElementById('activeRoutePath');
  if (path) {
    const midX = (c1.x + c2.x) / 2;
    const midY = 280;
    path.setAttribute('d', `M ${c1.x} ${c1.y} Q ${midX} ${midY} ${c2.x} ${c2.y}`);
    path.style.display = 'block';
  }
  showToast(`🚶 Approx. 4 min walk between ${fromKey.replace('bldg-', '')} and ${toKey.replace('bldg-', '')}`, 'info');
}

function setRouteDestination(bldgId) {
  document.getElementById('routeToSelect').value = bldgId;
  calculateMapRoute();
  closeBuildingDetails();
}

/* ══════════════════════════════════════════
   CAMPUS AI CORE INTELLIGENCE LAYER
══════════════════════════════════════════ */
let isChatOpen = false;

function toggleChat() {
  isChatOpen = !isChatOpen;
  document.getElementById('chatbot').classList.toggle('open', isChatOpen);
  if (isChatOpen) {
    setTimeout(() => {
      const inp = document.getElementById('chatInput');
      if (inp) inp.focus();
    }, 200);
  }
}

function quickAskAI() {
  goLogin('student');
  setTimeout(() => navTo('aitutor', null), 300);
}

function sendSug(el) {
  const inp = document.getElementById('chatInput');
  inp.value = el.textContent.replace(/^[^ ]+ /, '');
  sendChat();
}

function sendAiPrompt(promptText) {
  const inp = document.getElementById('fullChatInput');
  if (inp) {
    inp.value = promptText;
    sendFullChat();
  }
}

function sendChat() {
  const inp = document.getElementById('chatInput');
  const query = inp.value.trim();
  if (!query) return;
  inp.value = '';
  processAIQuery(query, 'chatBody');
}

function sendFullChat() {
  const inp = document.getElementById('fullChatInput');
  const query = inp.value.trim();
  if (!query) return;
  inp.value = '';
  processAIQuery(query, 'fullChatBody');
}

function processAIQuery(rawQuery, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Add User Message Bubble
  container.innerHTML += `
    <div class="cb-msg user">
      <span class="cb-av">🧑</span>
      <div class="cb-bub">${escapeHtml(rawQuery)}</div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;

  // Add Typing Indicator
  const tid = 't_' + Date.now();
  container.innerHTML += `
    <div class="cb-msg bot" id="${tid}">
      <span class="cb-av">🤖</span>
      <div class="cb-bub"><div class="typing-dots"><span></span><span></span><span></span></div></div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;

  setTimeout(() => {
    const typingEl = document.getElementById(tid);
    if (typingEl) typingEl.remove();

    const low = rawQuery.toLowerCase();
    let botHtml = '';

    if (low.includes('free room') || low.includes('classroom') || (low.includes('room') && (low.includes('6 people') || low.includes('5 people') || low.includes('3 pm')))) {
      botHtml = `
        Here are the best available rooms for your request:
        <div class="ai-card-group">
          <div class="ai-interactive-card">
            <div class="ai-ic-title">🏛️ Room B-204 (Block B)</div>
            <div class="ai-ic-meta">Capacity: 30 people · Distance: 120m · Available: 3:00 – 5:00 PM · A/C &amp; Projector</div>
            <div class="ai-ic-actions">
              <button class="ai-action-btn" onclick="quickBookAi('Room B-204 (Block B)', '02:00 PM – 04:00 PM')">Reserve Now</button>
              <button class="ai-action-btn secondary" onclick="navTo('map',null)">View on Map</button>
            </div>
          </div>
          <div class="ai-interactive-card">
            <div class="ai-ic-title">💬 Discussion Suite D-101 (Block D)</div>
            <div class="ai-ic-meta">Capacity: 8 people · Distance: 180m · Available: 3:00 – 4:30 PM · Whiteboard &amp; 4K Screen</div>
            <div class="ai-ic-actions">
              <button class="ai-action-btn" onclick="quickBookAi('Discussion Suite D-101', '02:00 PM – 04:00 PM')">Reserve Now</button>
              <button class="ai-action-btn secondary" onclick="navTo('map',null)">View on Map</button>
            </div>
          </div>
        </div>
      `;
    } else if (low.includes('food') || low.includes('cafeteria') || low.includes('lunch') || low.includes('canteen')) {
      botHtml = `
        Here is what's serving right now at the <b>Main Cafeteria</b> (Queue wait: ~8 mins):
        <div class="ai-card-group">
          <div class="ai-interactive-card">
            <div class="ai-ic-title">🍛 Dal Rice Special Thali (₹70)</div>
            <div class="ai-ic-meta">🟢 Veg · 520 kcal · Dal, basmati rice, sabzi, 2 rotis &amp; salad</div>
            <div class="ai-ic-actions">
              <button class="ai-action-btn" onclick="addToCart('Dal Rice Thali', 70, '🍛'); navTo('food',null);">Add to Cart</button>
              <button class="ai-action-btn secondary" onclick="navTo('food',null)">Open Cafeteria</button>
            </div>
          </div>
          <div class="ai-interactive-card">
            <div class="ai-ic-title">🍗 Chicken Curry Rice (₹90)</div>
            <div class="ai-ic-meta">🔴 Non-Veg · 640 kcal · Spicy tender curry with basmati rice</div>
            <div class="ai-ic-actions">
              <button class="ai-action-btn" onclick="addToCart('Chicken Curry Rice', 90, '🍗'); navTo('food',null);">Add to Cart</button>
              <button class="ai-action-btn secondary" onclick="navTo('food',null)">Open Cafeteria</button>
            </div>
          </div>
        </div>
      `;
    } else if (low.includes('library') || low.includes('where is the library')) {
      botHtml = `
        📚 <b>Central University Library</b> is located at North Atrium (4 min walk from Block A).
        <br>Current Occupancy: <strong>62% (Quiet)</strong> · Open until 11:00 PM today.
        <div class="ai-card-group">
          <div class="ai-interactive-card">
            <div class="ai-ic-title">Walking Route to Library</div>
            <div class="ai-ic-meta">Direct pathway via Main Plaza · 240 meters</div>
            <div class="ai-ic-actions">
              <button class="ai-action-btn" onclick="navTo('map',null)">Show Walk Path on Map</button>
              <button class="ai-action-btn secondary" onclick="navTo('library',null)">Browse Book Catalogue</button>
            </div>
          </div>
        </div>
      `;
    } else if (low.includes('schedule') || low.includes('class') || low.includes('classes')) {
      botHtml = `
        Here are your upcoming classes today:
        <div class="ai-card-group">
          <div class="ai-interactive-card">
            <div class="ai-ic-title">📚 Data Structures &amp; Algorithms (11:00 AM)</div>
            <div class="ai-ic-meta">Lecture Hall 102 · Block A · Dr. Anil Kumar · 🟢 In Progress</div>
          </div>
          <div class="ai-interactive-card">
            <div class="ai-ic-title">🔬 Machine Learning Lab (02:00 PM)</div>
            <div class="ai-ic-meta">Robotics Lab 3 · Block B · Prof. Vikram Rao · ⏳ Upcoming</div>
          </div>
        </div>
      `;
    } else if (low.includes('lost') || low.includes('backpack') || low.includes('found')) {
      botHtml = `
        🔍 <b>Lost &amp; Found AI Engine</b> has analyzed your description.
        <div class="ai-card-group">
          <div class="ai-interactive-card">
            <div class="ai-ic-title">🎒 94% Match: Matte Black Backpack</div>
            <div class="ai-ic-meta">Found at Library Study Room L-2 · Stationery &amp; Calculator inside</div>
            <div class="ai-ic-actions">
              <button class="ai-action-btn" onclick="navTo('lostfound',null)">View AI Match &amp; Claim</button>
            </div>
          </div>
        </div>
      `;
    } else if (low.includes('doctor') || low.includes('hospital') || low.includes('emergency') || low.includes('sick')) {
      botHtml = `
        🏥 <b>Campus Health Centre</b> is open 24/7 near Main Gate.
        <div class="ai-card-group">
          <div class="ai-interactive-card">
            <div class="ai-ic-title">🩺 Dr. Anil Kumar (General Medicine)</div>
            <div class="ai-ic-meta">Room 101 · ✅ Available Now (Until 1:00 PM)</div>
            <div class="ai-ic-actions">
              <button class="ai-action-btn" onclick="openDocModal(1)">Book Consultation</button>
              <button class="ai-action-btn secondary" onclick="triggerEmergencyMode()">Emergency SOS</button>
            </div>
          </div>
        </div>
      `;
    } else if (low.includes('ai tutor') || low.includes('pdf') || low.includes('quiz') || low.includes('study')) {
      botHtml = `
        🧠 <b>AI Tutor</b> is ready to help you study! Upload any PDF lecture or textbook chapter to get plain-language summaries, key points and interactive quizzes.
        <div class="ai-card-group">
          <div class="ai-interactive-card">
            <div class="ai-ic-title">AI Tutor PDF Study Workspace</div>
            <div class="ai-ic-meta">Auto-summarization · Memorization points · Multiple choice quiz</div>
            <div class="ai-ic-actions">
              <button class="ai-action-btn" onclick="navTo('aitutor', null)">Open AI Tutor →</button>
            </div>
          </div>
        </div>
      `;
    } else {
      botHtml = `
        I'm here to assist with all campus operations. You can ask me to:
        <br>• <strong>"Find a free classroom for 6 people at 3 PM"</strong>
        <br>• <strong>"Show today's lunch menu in cafeteria"</strong>
        <br>• <strong>"Navigate to Central Library"</strong>
        <br>• <strong>"Show my schedule for today"</strong>
        <br>• <strong>"Find a doctor or emergency help"</strong>
      `;
    }

    container.innerHTML += `
      <div class="cb-msg bot">
        <span class="cb-av">🤖</span>
        <div class="cb-bub">${botHtml}</div>
      </div>
    `;
    container.scrollTop = container.scrollHeight;
  }, 600);
}

function quickBookAi(resourceName, timeSlot) {
  const newBooking = {
    id: Date.now(),
    resource_name: resourceName,
    resource_type: resourceName.includes('Lab') ? 'Lab' : 'Classroom',
    block: resourceName.includes('Block B') ? 'Block B' : 'Block D',
    slot_date: 'Today',
    time_slot: timeSlot,
    purpose: 'AI Instant Reservation',
    status: 'Confirmed',
    qr_token: 'CMS-BK-' + Math.floor(100000 + Math.random() * 900000)
  };
  localStore.bookings.unshift(newBooking);
  showToast(`✅ ${resourceName} reserved! Added to your bookings & map.`);
  navTo('booking', null);
}

/* ══════════════════════════════════════════
   AI TUTOR (PDF STUDY & QUIZ ENGINE)
══════════════════════════════════════════ */
let currentQuiz = [];
let quizAnswers = {};

async function analyzePdf() {
  const fileInput = document.getElementById('aiPdfInput');
  const file = fileInput ? fileInput.files[0] : null;
  const status = document.getElementById('aiStatus');
  const btn = document.getElementById('aiAnalyzeBtn');
  if (!file) { showToast('⚠️ Choose a PDF file first', 'warn'); return; }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('⚠️ Please select a valid PDF file', 'warn');
    return;
  }

  if (btn) btn.disabled = true;
  if (status) {
    status.style.color = 'var(--brand)';
    status.textContent = '🧠 Reading and analyzing your PDF with AI Tutor — this can take a few seconds…';
  }

  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(API_BASE + '/api/ai-tutor/analyze', {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed');

    renderAiResults(data);
    if (status) {
      status.style.color = 'var(--green)';
      status.textContent = '✅ Analysis complete! Scroll down for your summary, key points and interactive quiz.';
    }
    showToast('✅ PDF analyzed successfully!');
    loadAiHistory();
  } catch (err) {
    if (status) {
      status.style.color = 'var(--red)';
      status.textContent = '❌ ' + err.message;
    }
    showToast('❌ ' + err.message, 'warn');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderAiResults(data) {
  const resultsEl = document.getElementById('aiResults');
  if (resultsEl) resultsEl.style.display = 'block';

  const sumText = document.getElementById('aiSummaryText');
  if (sumText) sumText.textContent = data.summary || 'No summary generated.';

  const kpEl = document.getElementById('aiKeyPoints');
  if (kpEl) {
    kpEl.innerHTML = (data.keyPoints || []).map(k => `<li>${k}</li>`).join('');
  }

  currentQuiz = data.quiz || [];
  quizAnswers = {};
  renderQuiz();
}

function renderQuiz() {
  const body = document.getElementById('aiQuizBody');
  const scoreEl = document.getElementById('aiQuizScore');
  if (!body) return;

  const answeredCount = Object.keys(quizAnswers).length;
  let correctCount = 0;
  Object.keys(quizAnswers).forEach(qi => {
    if (currentQuiz[qi] && quizAnswers[qi] === currentQuiz[qi].correctIndex) {
      correctCount++;
    }
  });

  if (scoreEl) {
    scoreEl.textContent = answeredCount === 0 
      ? `0 / ${currentQuiz.length} answered` 
      : `${correctCount} / ${answeredCount} correct (${answeredCount}/${currentQuiz.length})`;
  }

  if (!currentQuiz.length) {
    body.innerHTML = '<div style="color:var(--tx3);font-style:italic">No quiz questions generated for this document.</div>';
    return;
  }

  body.innerHTML = currentQuiz.map((q, qi) => {
    const answered = quizAnswers[qi];
    const optsHtml = q.options.map((opt, oi) => {
      let cls = 'quiz-opt';
      if (answered !== undefined) {
        if (oi === q.correctIndex) cls += ' correct';
        else if (oi === answered && oi !== q.correctIndex) cls += ' wrong';
      }
      return `<div class="${cls}" onclick="answerQuiz(${qi}, ${oi})">
        <span class="quiz-opt-letter">${String.fromCharCode(65 + oi)}</span>
        <span>${escapeHtml(opt)}</span>
      </div>`;
    }).join('');

    const explanation = answered !== undefined
      ? `<div class="quiz-explain ${answered === q.correctIndex ? 'correct' : 'wrong'}">
          ${answered === q.correctIndex ? '✅ Correct! ' : '❌ Incorrect. '}${escapeHtml(q.explanation || '')}
        </div>`
      : '';

    return `
      <div class="quiz-card">
        <div class="quiz-q">${qi + 1}. ${escapeHtml(q.question)}</div>
        <div class="quiz-opts">${optsHtml}</div>
        ${explanation}
      </div>
    `;
  }).join('');
}

function answerQuiz(qi, oi) {
  if (quizAnswers[qi] !== undefined) return; // lock after first answer
  quizAnswers[qi] = oi;
  renderQuiz();
}

async function loadAiHistory() {
  const list = document.getElementById('aiHistoryList');
  if (!list) return;
  try {
    const data = await apiFetch('/api/ai-tutor/sessions');
    if (!data.sessions || !data.sessions.length) {
      list.innerHTML = '<div class="empty" style="padding:16px 0">No PDFs analyzed yet. Upload a PDF above to begin.</div>';
      return;
    }
    list.innerHTML = data.sessions.map(s => `
      <div class="act-item" style="cursor:pointer;padding:12px 14px;border-radius:10px;background:var(--surface2);margin-bottom:8px;display:flex;align-items:center;gap:12px" onclick="loadAiSession(${s.id})">
        <div class="act-dot b"></div>
        <div class="act-info" style="flex:1">
          <div class="act-t" style="font-weight:600">${escapeHtml(s.filename)}</div>
          <div class="act-s" style="font-size:12px;color:var(--tx2)">${new Date(s.created_at).toLocaleString('en-IN')}</div>
        </div>
        <button class="del-btn" style="padding:6px 12px;font-size:12px" onclick="event.stopPropagation();deleteAiSession(${s.id})">Delete</button>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<div class="empty" style="padding:16px 0">Sign in to see past sessions.</div>';
  }
}

async function loadAiSession(id) {
  try {
    const data = await apiFetch('/api/ai-tutor/sessions/' + id);
    renderAiResults(data);
    const status = document.getElementById('aiStatus');
    if (status) {
      status.style.color = 'var(--brand)';
      status.textContent = `📂 Loaded "${data.filename}" from history.`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    showToast('❌ ' + err.message, 'warn');
  }
}

async function deleteAiSession(id) {
  try {
    await apiFetch('/api/ai-tutor/sessions/' + id, { method: 'DELETE' });
    showToast('Session deleted.');
    loadAiHistory();
  } catch (err) {
    showToast('❌ ' + err.message, 'warn');
  }
}

/* ══════════════════════════════════════════
   SMART UNIFIED BOOKING CONTROLLER
══════════════════════════════════════════ */
function updateBookingSlots() {
  const type = document.getElementById('bookResType').value;
  const nameSelect = document.getElementById('bookResName');
  if (type === 'classroom') {
    nameSelect.innerHTML = `
      <option value="Room A-101 (Block A)">Room A-101 (Cap: 40)</option>
      <option value="Room B-204 (Block B)">Room B-204 (Cap: 30)</option>
      <option value="Room C-302 (Block C)">Room C-302 (Cap: 60)</option>
    `;
  } else if (type === 'lab') {
    nameSelect.innerHTML = `
      <option value="Robotics Lab 3">Robotics Lab 3 (VR + 3D)</option>
      <option value="CSE Advanced Lab 102">CSE Advanced Lab 102 (GPU Rig)</option>
      <option value="Electronics Testing Lab">Electronics Testing Lab</option>
    `;
  } else if (type === 'discussion') {
    nameSelect.innerHTML = `
      <option value="Discussion Suite D-101">Discussion Suite D-101 (Cap: 8)</option>
      <option value="Discussion Suite D-201">Discussion Suite D-201 (Cap: 12)</option>
      <option value="Library Pod L-1">Library Pod L-1 (Cap: 4)</option>
    `;
  } else {
    nameSelect.innerHTML = `
      <option value="Oculus VR Rig (Lab 3)">Oculus VR Rig (Lab 3)</option>
      <option value="Ultimaker 3D Printer">Ultimaker 3D Printer</option>
      <option value="Digital Oscilloscope 100MHz">Digital Oscilloscope 100MHz</option>
    `;
  }
}

function doUnifiedBooking() {
  const resName = document.getElementById('bookResName').value;
  const dateVal = document.getElementById('bookDate').value || 'Today';
  const slotVal = document.getElementById('bookTimeSlot').value;
  const purpose = document.getElementById('bookPurpose').value || 'Study / Team Sprint';
  const resType = document.getElementById('bookResType').value;

  // Conflict Check
  const conflict = localStore.bookings.find(b => b.resource_name === resName && b.slot_date === dateVal && b.time_slot === slotVal && b.status !== 'Cancelled');
  if (conflict) {
    showToast(`⚠️ Conflict: ${resName} is already booked for this slot!`, 'warn');
    return;
  }

  const newBooking = {
    id: Date.now(),
    resource_name: resName,
    resource_type: resType,
    block: resName.includes('Block B') ? 'Block B' : resName.includes('Block C') ? 'Block C' : 'Block A',
    slot_date: dateVal,
    time_slot: slotVal,
    purpose,
    status: 'Confirmed',
    qr_token: 'CMS-BK-' + Math.floor(100000 + Math.random() * 900000)
  };

  localStore.bookings.unshift(newBooking);
  document.getElementById('bookPurpose').value = '';
  showToast(`✅ ${resName} successfully booked!`);
  renderUnifiedBookings();
}

function cancelUnifiedBooking(id) {
  const b = localStore.bookings.find(x => x.id == id);
  if (b) {
    b.status = 'Cancelled';
    showToast('Reservation cancelled.');
    renderUnifiedBookings();
  }
}

function renderUnifiedBookings() {
  const tb = document.getElementById('unifiedBookingBody');
  const cnt = document.getElementById('bookingCnt');
  if (!tb) return;

  const active = localStore.bookings.filter(b => b.status !== 'Cancelled');
  if (cnt) cnt.textContent = active.length;

  if (!localStore.bookings.length) {
    tb.innerHTML = '<tr><td colspan="7" class="empty">No active reservations. Book a room using the form above.</td></tr>';
    return;
  }

  tb.innerHTML = localStore.bookings.map(b => `
    <tr>
      <td><strong>${escapeHtml(b.resource_name)}</strong></td>
      <td>${escapeHtml(b.block)}</td>
      <td>${escapeHtml(b.slot_date)}<br><small style="color:var(--brand)">${escapeHtml(b.time_slot)}</small></td>
      <td>${escapeHtml(b.purpose)}</td>
      <td><span class="chip ${b.status === 'Confirmed' ? 'av' : 'busy'}">${b.status}</span></td>
      <td><span style="font-family:var(--mono);font-size:11px;color:var(--brand);background:var(--surface3);padding:3px 6px;border-radius:4px">${b.qr_token}</span></td>
      <td>
        ${b.status === 'Confirmed' ? `<button class="del-btn" onclick="cancelUnifiedBooking(${b.id})">Cancel</button>` : '—'}
      </td>
    </tr>
  `).join('');
}

/* ══════════════════════════════════════
   SMART CAFETERIA & CART ENGINE
══════════════════════════════════════ */
const foodOutlets = {
  cafeteria: [
    { name: 'Dal Rice Special Thali', price: 70, ico: '🍛', tag: 'veg', cal: '520 kcal', desc: 'Dal, basmati rice, seasonal sabzi, 2 rotis & salad' },
    { name: 'Chicken Curry Rice', price: 90, ico: '🍗', tag: 'non', cal: '640 kcal', desc: 'Spicy chicken curry with steamed basmati rice' },
    { name: 'Paneer Butter Masala', price: 80, ico: '🫓', tag: 'veg', cal: '480 kcal', desc: 'Cottage cheese cubes in rich tomato cashew gravy' },
    { name: 'Poha Breakfast Plate', price: 30, ico: '🥐', tag: 'veg', cal: '220 kcal', desc: 'Flattened rice tossed with roasted peanuts & lemon' },
    { name: 'Masala Chai / Coffee', price: 15, ico: '☕', tag: 'veg', cal: '80 kcal', desc: 'Fresh ginger cardamom brewed tea' },
    { name: 'Crispy French Fries', price: 40, ico: '🍟', tag: 'veg', cal: '320 kcal', desc: 'Golden potato fries with tangy dip' }
  ],
  canteen: [
    { name: 'Veg Kathi Roll', price: 45, ico: '🌯', tag: 'veg', cal: '260 kcal', desc: 'Spiced vegetable stuffing wrapped in paratha' },
    { name: 'Aloo Tikki Burger', price: 50, ico: '🍔', tag: 'veg', cal: '340 kcal', desc: 'Crisp patty with onion, tomato & mint mayo' },
    { name: 'Chicken Tikka Wrap', price: 70, ico: '🥙', tag: 'non', cal: '420 kcal', desc: 'Smoky grilled chicken pieces in flatbread' },
    { name: 'Cold Coffee Frappe', price: 50, ico: '🥤', tag: 'veg', cal: '190 kcal', desc: 'Blended iced espresso with dark chocolate drizzle' }
  ],
  mess: [
    { name: 'Daily Hostel Thali', price: 65, ico: '🍱', tag: 'veg', cal: '540 kcal', desc: 'Dal makhani, jeera rice, chapati & gulab jamun' },
    { name: 'Egg Curry Meal', price: 75, ico: '🍳', tag: 'non', cal: '510 kcal', desc: '2-egg masala gravy with rice & salad' }
  ],
  juice: [
    { name: 'Fresh Orange Juice (300ml)', price: 40, ico: '🍊', tag: 'veg', cal: '110 kcal', desc: 'Cold pressed organic sweet oranges' },
    { name: 'Mango Lassi', price: 45, ico: '🍹', tag: 'veg', cal: '230 kcal', desc: 'Thick yogurt shake with alphonso mango puree' },
    { name: 'Green Detox Juice', price: 55, ico: '🥬', tag: 'veg', cal: '65 kcal', desc: 'Cucumber, spinach, green apple & ginger' }
  ]
};

function switchOutletMenu(outletKey, btn) {
  document.querySelectorAll('#pageFood .suggest-trigger').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderFoodCards(outletKey);
}

function renderFoodCards(outletKey) {
  const grid = document.getElementById('outletFoodGrid');
  if (!grid) return;
  const items = foodOutlets[outletKey] || foodOutlets.cafeteria;
  grid.innerHTML = items.map(f => `
    <div class="food-card">
      <div class="fc-top">
        <span class="fc-ico">${f.ico}</span>
        <span class="fc-tag ${f.tag}">${f.tag === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}</span>
      </div>
      <div class="fc-name">${f.name}</div>
      <div class="fc-desc">${f.desc} · <small style="color:var(--tx3)">${f.cal}</small></div>
      <div class="fc-foot">
        <span class="fc-price">₹${f.price}</span>
        <button class="fc-add-btn" onclick="addToCart('${f.name}', ${f.price}, '${f.ico}')">+ Add to Cart</button>
      </div>
    </div>
  `).join('');
}

function addToCart(name, price, ico) {
  const existing = localStore.cart.find(item => item.name === name);
  if (existing) {
    existing.qty += 1;
  } else {
    localStore.cart.push({ name, price, ico: ico || '🍽️', qty: 1 });
  }
  updateCartBadge();
  showToast(`🛒 Added "${name}" to Cart!`);
}

function updateCartBadge() {
  const countEl = document.getElementById('cartCount');
  if (countEl) {
    const totalCount = localStore.cart.reduce((sum, item) => sum + item.qty, 0);
    countEl.textContent = totalCount;
  }
}

function openCartDrawer() {
  if (!localStore.cart.length) {
    showToast('🛒 Your cart is empty! Add items from the menu.', 'warn');
    return;
  }
  const total = localStore.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const itemsSummary = localStore.cart.map(i => `${i.qty}x ${i.name} (₹${i.price * i.qty})`).join(', ');

  if (confirm(`Order Summary:\n${itemsSummary}\n\nTotal: ₹${total}\n\nPlace Pre-Order now?`)) {
    localStore.cart = [];
    updateCartBadge();
    const orderNum = Math.floor(100 + Math.random() * 900);
    showToast(`✅ Order #CMS-${orderNum} placed! Preparing now (~8 mins wait).`);
  }
}

/* ══════════════════════════════════════════
   EMERGENCY & CLINIC CONTROLLER
══════════════════════════════════════════ */
function triggerEmergencyMode() {
  const overlay = document.getElementById('emergencyOverlay');
  if (overlay) overlay.classList.add('show');
}

function dismissEmergencyMode() {
  const overlay = document.getElementById('emergencyOverlay');
  if (overlay) overlay.classList.remove('show');
  showToast('Emergency SOS dismissed.');
}

/* ══════════════════════════════════════════
   LOST & FOUND CONTROLLER
══════════════════════════════════════ */
function renderLostFoundGrid() {
  const grid = document.getElementById('lostFoundGrid');
  if (!grid) return;
  grid.innerHTML = localStore.lostFound.map(item => `
    <div class="event-card">
      <div class="ev-top">
        <span class="ev-cat">${item.type.toUpperCase()}</span>
        <span class="chip ${item.status === 'Open' ? 'av' : 'pn'}">${item.status}</span>
      </div>
      <div class="ev-title">${item.image} ${item.title}</div>
      <div class="ev-desc">${item.description}</div>
      <div class="ev-meta">
        <div>📍 <strong>${item.location}</strong></div>
        <div>🕒 ${item.date_time}</div>
      </div>
      <button class="ev-btn" onclick="openClaimVerifyModal('${item.title}', '${item.contact}')">Verify &amp; Claim Item</button>
    </div>
  `).join('');
}

function openReportLostModal() {
  const title = prompt('Enter Lost Item Name (e.g. Blue HP Laptop Charger):');
  if (!title) return;
  const location = prompt('Where did you lose it? (e.g. Block C Lecture Hall 2):') || 'Campus Area';
  localStore.lostFound.unshift({
    id: Date.now(),
    type: 'lost',
    title,
    category: 'General',
    location,
    date_time: 'Just now',
    description: 'Reported via student portal.',
    image: '📦',
    status: 'Open',
    contact: 'STU-2025-001'
  });
  renderLostFoundGrid();
  showToast('✅ Lost item reported. AI matching engine is scanning campus inventory!');
}

function openReportFoundModal() {
  const title = prompt('Enter Found Item Name:');
  if (!title) return;
  const location = prompt('Where did you find it? (e.g. Cafeteria Table 6):') || 'Campus Area';
  localStore.lostFound.unshift({
    id: Date.now(),
    type: 'found',
    title,
    category: 'General',
    location,
    date_time: 'Just now',
    description: 'Found and handed to desk.',
    image: '📦',
    status: 'Open',
    contact: 'Campus Security Desk'
  });
  renderLostFoundGrid();
  showToast('✅ Found item logged. Thank you for reporting!');
}

function openClaimVerifyModal(title, contact) {
  prompt(`Claim Verification for "${title}"\nPlease enter your Verification PIN or Student ID:`, 'STU-2025-001');
  showToast(`✅ Claim request dispatched to ${contact}. Collect with your Digital Pass.`);
}

/* ══════════════════════════════════════════
   MARKETPLACE & COMMUNITY
══════════════════════════════════════════ */
function renderMarketplaceGrid() {
  const grid = document.getElementById('marketplaceGrid');
  if (!grid) return;
  grid.innerHTML = localStore.marketplace.map(m => `
    <div class="event-card">
      <div class="ev-top">
        <span class="ev-cat">${m.category}</span>
        <span class="chip av">Verified Student</span>
      </div>
      <div class="ev-title">${m.image} ${m.title}</div>
      <div class="ev-desc">${m.description}</div>
      <div class="ev-meta">
        <div>👤 Seller: <strong>${m.seller_name}</strong> (${m.seller_dept})</div>
        <div>🏷️ Condition: <strong>${m.condition}</strong></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto">
        <span style="font-size:18px;font-weight:800;color:var(--brand)">${m.price}</span>
        <button class="ev-btn" onclick="contactSeller('${m.seller_name}', '${m.title}')">Contact Seller</button>
      </div>
    </div>
  `).join('');
}

function filterMarketCat(cat, btn) {
  document.querySelectorAll('#marketCatFilters .map-filter-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderMarketplaceGrid();
}

function openCreateListingModal() {
  const title = prompt('Enter Item Name to Sell:');
  if (!title) return;
  const price = prompt('Enter Selling Price (e.g. ₹500):') || '₹500';
  const category = prompt('Category (Books, Electronics, Cycles, Notes, Furniture):') || 'General';
  localStore.marketplace.unshift({
    id: Date.now(),
    title,
    category,
    price,
    condition: 'Like New',
    seller_name: 'Alex S.',
    seller_dept: 'B.Tech CSE',
    verified: 1,
    image: '📦',
    description: 'Listed by student on campus marketplace.'
  });
  renderMarketplaceGrid();
  showToast('✅ Item listed on Campus Marketplace!');
}

function contactSeller(sellerName, itemTitle) {
  prompt(`Message to ${sellerName} regarding "${itemTitle}":`, 'Hi, is this item still available? Can we meet at Central Library?');
  showToast(`💬 Message sent to ${sellerName}! Check your notifications.`);
}

function findTeammates() {
  const skill = (document.getElementById('teamSearchSkill').value || 'Python').toLowerCase();
  const resBox = document.getElementById('teammateResults');
  resBox.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-top:10px">
      <div style="font-size:13px;font-weight:700;color:var(--brand);margin-bottom:8px">🤖 AI Suggested Teammates for "${escapeHtml(skill)}":</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface);padding:8px 12px;border-radius:8px">
          <div><strong>Karthik Varma</strong> (B.Tech CSE 3rd yr) · <em>Python, PyTorch, ROS2</em></div>
          <button class="badge purple" style="cursor:pointer" onclick="showToast('Invite sent to Karthik!')">Invite to Team</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface);padding:8px 12px;border-radius:8px">
          <div><strong>Sneha Patel</strong> (B.Tech ECE 4th yr) · <em>Embedded C, Circuit Design, IoT</em></div>
          <button class="badge purple" style="cursor:pointer" onclick="showToast('Invite sent to Sneha!')">Invite to Team</button>
        </div>
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════
   CAMPUS INTELLIGENCE (Admin Analytics)
══════════════════════════════════════════ */
function renderIntelligenceDashboard() {
  const list = document.getElementById('aiInsightsList');
  if (!list) return;
  list.innerHTML = `
    <div class="ai-insight-item">
      <span class="aii-ico">💡</span>
      <div>
        <div class="aii-title">Block B Classrooms Peak Footfall Alert</div>
        <div class="aii-text">Block B classrooms reach 94% occupancy between 11:00 AM – 2:00 PM. Reallocating 2 elective lectures to Block C Lecture Halls will reduce corridor congestion by 38%.</div>
      </div>
    </div>
    <div class="ai-insight-item">
      <span class="aii-ico">🍔</span>
      <div>
        <div class="aii-title">Cafeteria Demand Prediction: 1:15 PM Spike</div>
        <div class="aii-text">Anticipated surge of ~140 lunch orders at 1:15 PM. Mobile pre-ordering has reduced counter wait by 42% this week.</div>
      </div>
    </div>
    <div class="ai-insight-item">
      <span class="aii-ico">⚡</span>
      <div>
        <div class="aii-title">HVAC Energy Conservation Savings</div>
        <div class="aii-text">Auditorium Hall 1 is unbooked until 4:00 PM. Climate systems automated into Eco-Mode, saving 14.2 kWh today.</div>
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════
   GLOBAL COMMAND PALETTE (Ctrl+K)
══════════════════════════════════════════ */
function openCmdPalette() {
  const p = document.getElementById('cmdPalette');
  if (p) {
    p.classList.add('show');
    const inp = document.getElementById('cmdInput');
    if (inp) { inp.value = ''; inp.focus(); }
    filterCmdResults('');
  }
}

function closeCmdPalette() {
  const p = document.getElementById('cmdPalette');
  if (p) p.classList.remove('show');
}

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCmdPalette();
  }
  if (e.key === 'Escape') {
    closeCmdPalette();
  }
});

const cmdIndex = [
  { title: 'Dashboard & Schedule', cat: 'Navigation', icon: '🏠', action: () => navTo('dashboard', null) },
  { title: 'Interactive Campus Map', cat: 'Navigation', icon: '🗺️', action: () => navTo('map', null) },
  { title: 'AI Tutor (PDF Study & Quiz)', cat: 'AI', icon: '🧠', action: () => navTo('aitutor', null) },
  { title: 'Smart Room Booking', cat: 'Bookings', icon: '📅', action: () => navTo('booking', null) },
  { title: 'Digital Campus Pass', cat: 'Credentials', icon: '🎫', action: () => navTo('pass', null) },
  { title: 'Smart Cafeteria & Menu', cat: 'Dining', icon: '🍔', action: () => navTo('food', null) },
  { title: 'Emergency SOS Broadcast', cat: 'Emergency', icon: '🚨', action: () => triggerEmergencyMode() },
  { title: 'Lost & Found Matching', cat: 'Services', icon: '🔎', action: () => navTo('lostfound', null) },
  { title: 'Student Marketplace', cat: 'Community', icon: '🛒', action: () => navTo('marketplace', null) },
  { title: 'Campus Intelligence Analytics', cat: 'Admin', icon: '📊', action: () => navTo('intelligence', null) },
  { title: 'Central Library Catalogue', cat: 'Library', icon: '📚', action: () => navTo('library', null) },
  { title: 'Toggle Dark / Light Theme', cat: 'Settings', icon: '🌓', action: () => toggleTheme() }
];

function filterCmdResults(q) {
  const res = document.getElementById('cmdResults');
  if (!res) return;
  const low = (q || '').toLowerCase();
  const matched = cmdIndex.filter(c => c.title.toLowerCase().includes(low) || c.cat.toLowerCase().includes(low));
  
  res.innerHTML = matched.map((item, idx) => `
    <div class="cmd-item" onclick="executeCmd(${idx})">
      <span class="cmd-item-ico">${item.icon}</span>
      <span class="cmd-item-title">${item.title}</span>
      <span class="cmd-item-cat">${item.cat}</span>
    </div>
  `).join('');
}

function executeCmd(idx) {
  closeCmdPalette();
  if (cmdIndex[idx] && typeof cmdIndex[idx].action === 'function') {
    cmdIndex[idx].action();
  }
}

/* ══════════════════════════════════════════
   NOTIFICATIONS DRAWER
══════════════════════════════════════════ */
let isNotifOpen = false;

function toggleNotifDrawer() {
  isNotifOpen = !isNotifOpen;
  const d = document.getElementById('notifDrawer');
  if (d) d.classList.toggle('show', isNotifOpen);
  if (isNotifOpen) renderNotifications();
}

function renderNotifications() {
  const body = document.getElementById('notifBody');
  if (!body) return;
  body.innerHTML = localStore.notifications.map(n => `
    <div class="notif-card ${n.priority}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <strong style="font-size:13px;color:var(--tx)">${n.title}</strong>
        <small style="font-size:10px;color:var(--tx3)">${n.time}</small>
      </div>
      <div style="font-size:12px;color:var(--tx2);line-height:1.4">${n.text}</div>
    </div>
  `).join('');
}

/* Demo scenarios removed */

/* ══════════════════════════════════════════
   RENDER ALL MODULES & INITIALIZATION
══════════════════════════════════════════ */
function renderAllModules() {
  renderTodaySchedule();
  renderDashEvents();
  renderClubs();
  renderTutors();
  renderDiscussionRooms();
  renderShops();
  renderLocations();
  renderUnifiedBookings();
  renderMarketplaceGrid();
  renderLostFoundGrid();
  renderLibrary();
  renderFaculty();
  renderClassrooms();
  renderDoctors();
  renderLabEquipment();
  updateCartBadge();
}

/* ══════════════════════════════════════════
   LIBRARY MANAGEMENT & SMART BOOK SEARCH
══════════════════════════════════════════ */
let selectedBookCat = 'all';
let currentBookSearchQuery = '';

async function renderLibrary() {
  const catGrid = document.getElementById('catalogGrid');
  const libBody = document.getElementById('libBody');
  const libCnt = document.getElementById('libCnt');
  const countEl = document.getElementById('bookCountTotal');

  // Load reservations
  try {
    const resData = await apiFetch('/api/library/reservations');
    const reservations = (resData && resData.reservations) ? resData.reservations : localStore.libraryReservations;
    if (libCnt) libCnt.textContent = reservations.length;
    if (libBody) {
      if (!reservations.length) {
        libBody.innerHTML = '<tr><td class="empty" colspan="5">No active reservations. Search and reserve books below.</td></tr>';
      } else {
        libBody.innerHTML = reservations.map(r => `
          <tr>
            <td><strong>${escapeHtml(r.title)}</strong></td>
            <td>${escapeHtml(r.author || 'Author')}</td>
            <td><span class="chip av">📍 Shelf ${escapeHtml(r.shelf || 'A-10')}</span></td>
            <td><span class="badge blue">${escapeHtml(r.status || 'Reserved')}</span></td>
            <td><button class="del-btn" onclick="cancelBookReservation(${r.id}, '${escapeHtml(r.title)}')">Return / Cancel</button></td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {}

  // Load books catalog
  try {
    let books = [];
    if (currentBookSearchQuery) {
      const data = await apiFetch(`/api/library/books?q=${encodeURIComponent(currentBookSearchQuery)}`);
      books = (data && data.books) ? data.books : localStore.books;
    } else {
      const data = await apiFetch('/api/library/books/all');
      books = (data && data.books) ? data.books : localStore.books;
    }

    // Filter by selected category
    if (selectedBookCat !== 'all') {
      books = books.filter(b => (b.category || '').toLowerCase().includes(selectedBookCat.toLowerCase()) || (b.title || '').toLowerCase().includes(selectedBookCat.toLowerCase()));
    }

    if (countEl) countEl.textContent = books.length;

    if (catGrid) {
      if (!books.length) {
        catGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--tx2)">No books found matching "${escapeHtml(currentBookSearchQuery)}". Try another keyword.</div>`;
      } else {
        catGrid.innerHTML = books.map(b => `
          <div class="event-card">
            <div class="ev-top">
              <span class="ev-cat">${escapeHtml(b.category || 'General')}</span>
              <span class="chip ${b.copies > 0 ? 'av' : 'busy'}">${b.copies > 0 ? `${b.copies} Copies Avail` : 'Checked Out'}</span>
            </div>
            <div class="ev-title">${b.icon || '📚'} ${escapeHtml(b.title)}</div>
            <div class="ev-desc">Author: <strong>${escapeHtml(b.author)}</strong><br><small style="color:var(--tx3)">Published: ${b.year || '2022'}</small></div>
            <div class="ev-meta">
              <div>📍 Location: <strong>Shelf ${escapeHtml(b.shelf || 'Central Library')}</strong></div>
            </div>
            <div style="margin-top:auto">
              ${b.copies > 0
                ? `<button class="ev-btn" onclick="reserveBook(${b.id}, '${escapeHtml(b.title)}')">Reserve Copy →</button>`
                : `<button class="ev-btn" disabled style="opacity:0.5;cursor:not-allowed">Checked Out</button>`
              }
            </div>
          </div>
        `).join('');
      }
    }
  } catch(e) {}
}

async function handleBookSearch(val) {
  currentBookSearchQuery = (val || '').trim();
  const drop = document.getElementById('bookAcDrop');
  const itemsContainer = document.getElementById('acDropItems');

  if (!currentBookSearchQuery) {
    if (drop) drop.style.display = 'none';
    renderLibrary();
    return;
  }

  try {
    const data = await apiFetch(`/api/library/books?q=${encodeURIComponent(currentBookSearchQuery)}`);
    const matches = (data && data.books) ? data.books : localStore.books.filter(b => b.title.toLowerCase().includes(currentBookSearchQuery.toLowerCase()) || b.author.toLowerCase().includes(currentBookSearchQuery.toLowerCase()));

    if (drop && itemsContainer) {
      if (matches.length > 0) {
        drop.style.display = 'block';
        itemsContainer.innerHTML = matches.slice(0, 5).map(m => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border2);cursor:pointer;transition:background .2s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'" onclick="selectBookAC('${escapeHtml(m.title)}')">
            <div>
              <div style="font-weight:700;font-size:13.5px;color:var(--tx)">${m.icon || '📖'} ${escapeHtml(m.title)}</div>
              <div style="font-size:11.5px;color:var(--tx2)">By ${escapeHtml(m.author)} · <span style="color:var(--brand)">Shelf ${escapeHtml(m.shelf || 'A-12')}</span></div>
            </div>
            <div>
              ${m.copies > 0 ? `<span class="badge green" style="font-size:11px">${m.copies} in stock</span>` : `<span class="badge red" style="font-size:11px">Out</span>`}
            </div>
          </div>
        `).join('');
      } else {
        drop.style.display = 'block';
        itemsContainer.innerHTML = `<div style="padding:12px;text-align:center;font-size:12.5px;color:var(--tx3)">No matching books found for "${escapeHtml(currentBookSearchQuery)}"</div>`;
      }
    }
  } catch(e) {}

  renderLibrary();
}

function selectBookAC(title) {
  const inp = document.getElementById('bookSearchInput');
  if (inp) inp.value = title;
  closeBookAC();
  handleBookSearch(title);
}

function closeBookAC() {
  const drop = document.getElementById('bookAcDrop');
  if (drop) drop.style.display = 'none';
}

function handleBookKey(e) {
  if (e.key === 'Escape') closeBookAC();
  if (e.key === 'Enter') {
    closeBookAC();
    handleBookSearch(e.target.value);
  }
}

function clearBookSearch() {
  const inp = document.getElementById('bookSearchInput');
  if (inp) inp.value = '';
  currentBookSearchQuery = '';
  closeBookAC();
  renderLibrary();
}

function filterBookCat(cat, btn) {
  selectedBookCat = cat;
  document.querySelectorAll('#libCatPills .suggest-trigger').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderLibrary();
}

async function reserveBook(bookId, bookTitle) {
  try {
    await apiFetch('/api/library/reservations', {
      method: 'POST',
      body: JSON.stringify({ bookId })
    });
    // Update local state if needed
    const b = localStore.books.find(x => x.id == bookId);
    if (b && b.copies > 0) b.copies -= 1;
    localStore.libraryReservations.unshift({
      id: Date.now(),
      book_id: bookId,
      title: bookTitle,
      author: b ? b.author : 'Author',
      shelf: b ? b.shelf : 'Central Library',
      status: 'Reserved'
    });
    showToast(`✅ "${bookTitle}" reserved! Collect from Central Library shelf.`);
    renderLibrary();
  } catch(e) {
    showToast('⚠️ ' + e.message, 'warn');
  }
}

async function cancelBookReservation(resId, bookTitle) {
  try {
    await apiFetch(`/api/library/reservations/${resId}`, { method: 'DELETE' });
    const rIdx = localStore.libraryReservations.findIndex(x => x.id == resId);
    if (rIdx !== -1) {
      const bId = localStore.libraryReservations[rIdx].book_id;
      const b = localStore.books.find(x => x.id == bId);
      if (b) b.copies += 1;
      localStore.libraryReservations.splice(rIdx, 1);
    }
    showToast(`Reservation returned for "${bookTitle}".`);
    renderLibrary();
  } catch(e) {
    showToast('⚠️ ' + e.message, 'warn');
  }
}

/* ══════════════════════════════════════════
   FACULTY DIRECTORY & OFFICE HOURS SEARCH
══════════════════════════════════════════ */
let selectedFacDept = 'all';
let currentFacSearchQuery = '';

async function renderFaculty(searchTerm = '') {
  currentFacSearchQuery = (searchTerm !== undefined && searchTerm !== null) ? searchTerm : currentFacSearchQuery;
  const grid = document.getElementById('facultyGrid');
  const tableBody = document.getElementById('facBody');
  const cntEl = document.getElementById('facCnt');
  const totalEl = document.getElementById('facCountTotal');

  try {
    let faculty = [];
    if (currentFacSearchQuery) {
      const data = await apiFetch(`/api/faculty?q=${encodeURIComponent(currentFacSearchQuery)}`);
      faculty = (data && data.faculty) ? data.faculty : localStore.faculty;
    } else {
      const data = await apiFetch('/api/faculty');
      faculty = (data && data.faculty) ? data.faculty : localStore.faculty;
    }

    // Apply department filter
    if (selectedFacDept !== 'all') {
      faculty = faculty.filter(f => (f.department || '').toLowerCase().includes(selectedFacDept.toLowerCase()));
    }

    if (cntEl) cntEl.textContent = faculty.length;
    if (totalEl) totalEl.textContent = faculty.length;

    // Render Cards Grid
    if (grid) {
      if (!faculty.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--tx2)">No faculty found matching "${escapeHtml(currentFacSearchQuery)}". Try searching by name or department.</div>`;
      } else {
        grid.innerHTML = faculty.map(f => `
          <div class="event-card">
            <div class="ev-top">
              <span class="ev-cat">${escapeHtml(f.department || 'Academic')}</span>
              <span class="chip av">🟢 ${f.status || 'Available'}</span>
            </div>
            <div class="ev-title">👨‍🏫 ${escapeHtml(f.name)}</div>
            <div class="ev-desc">
              Designation: <strong>${escapeHtml(f.designation || 'Faculty Member')}</strong><br>
              <small style="color:var(--tx2)">Department of ${escapeHtml(f.department)}</small>
            </div>
            <div class="ev-meta">
              <div>🕒 Office Hours: <br><strong>${escapeHtml(f.slot || 'Mon–Fri 10:00 AM – 1:00 PM')}</strong></div>
            </div>
            <div style="margin-top:auto;display:flex;gap:8px">
              <button class="ev-btn" style="flex:1" onclick="bookFacultySlot('${escapeHtml(f.name)}', '${escapeHtml(f.slot || 'Office Hours')}', '${escapeHtml(f.department)}')">Book Consultation</button>
              <button class="ev-btn" style="width:auto;padding:0 12px;background:var(--surface3)" onclick="showToast('💬 Message sent to ${escapeHtml(f.name)}')">💬</button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render Table View
    if (tableBody) {
      if (!faculty.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty">No faculty slots found.</td></tr>';
      } else {
        tableBody.innerHTML = faculty.map(f => `
          <tr>
            <td><strong>👨‍🏫 ${escapeHtml(f.name)}</strong><br><small style="color:var(--tx3)">${escapeHtml(f.designation || 'Faculty')}</small></td>
            <td><span class="chip">${escapeHtml(f.department || 'General')}</span></td>
            <td>${escapeHtml(f.slot || 'Available by appointment')}</td>
            <td><span class="badge green">${f.status || 'Available'}</span></td>
            <td>
              <button class="badge blue" style="cursor:pointer;margin-right:6px" onclick="bookFacultySlot('${escapeHtml(f.name)}', '${escapeHtml(f.slot || 'Office Hours')}', '${escapeHtml(f.department)}')">Book Slot</button>
              <button class="del-btn" onclick="deleteFacSlot(${f.id})">Remove</button>
            </td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {}
}

function handleFacultySearch(q) {
  renderFaculty(q);
}

function filterFacultyDept(dept, btn) {
  selectedFacDept = dept;
  document.querySelectorAll('#facDeptPills .suggest-trigger').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  const inp = document.getElementById('facSearchInput');
  renderFaculty(inp ? inp.value : '');
}

function clearFacultySearch() {
  const inp = document.getElementById('facSearchInput');
  if (inp) inp.value = '';
  currentFacSearchQuery = '';
  renderFaculty('');
}

async function addFac() {
  const name = document.getElementById('facName').value.trim();
  const dept = document.getElementById('facDept').value.trim();
  const slot = document.getElementById('facSlot').value.trim();

  if (!name) {
    showToast('⚠️ Please enter Faculty Name', 'warn');
    return;
  }

  try {
    await apiFetch('/api/faculty', {
      method: 'POST',
      body: JSON.stringify({ name, department: dept, slot })
    });
    localStore.faculty.unshift({
      id: Date.now(),
      name,
      department: dept || 'General',
      slot: slot || 'By Appointment',
      status: 'Available',
      designation: 'Faculty Member'
    });
    document.getElementById('facName').value = '';
    document.getElementById('facDept').value = '';
    document.getElementById('facSlot').value = '';
    showToast(`✅ Faculty slot added for ${name}!`);
    renderFaculty();
  } catch(e) {
    showToast('⚠️ ' + e.message, 'warn');
  }
}

function bookFacultySlot(name, slot, dept) {
  const purpose = prompt(`Schedule Academic Consultation with ${name}\nSlot: ${slot}\n\nEnter discussion topic / purpose:`, 'Semester Project Review & Guidance');
  if (!purpose) return;

  localStore.bookings.unshift({
    id: Date.now(),
    resource_name: `Consultation with ${name}`,
    resource_type: 'Faculty Office Hours',
    block: dept || 'Academic Block',
    slot_date: 'This Week',
    time_slot: slot,
    purpose: purpose,
    status: 'Confirmed',
    qr_token: 'CMS-FAC-' + Math.floor(100000 + Math.random() * 900000)
  });

  localStore.todaySchedule.push({
    time: slot.split('(')[0].trim() || '2:00 PM – 3:00 PM',
    subject: `Meeting: ${name}`,
    room: slot.includes('(') ? slot.split('(')[1].replace(')', '') : 'Faculty Office',
    faculty: name,
    building: dept || 'Block B',
    status: 'Upcoming'
  });

  showToast(`✅ Consultation scheduled with ${name}! Added to your Schedule & Bookings.`);
  renderTodaySchedule();
  renderUnifiedBookings();
}

async function deleteFacSlot(id) {
  try {
    await apiFetch(`/api/faculty/${id}`, { method: 'DELETE' });
    const idx = localStore.faculty.findIndex(x => x.id == id);
    if (idx !== -1) localStore.faculty.splice(idx, 1);
    showToast('Faculty slot removed.');
    renderFaculty();
  } catch(e) {
    showToast('⚠️ ' + e.message, 'warn');
  }
}

/* ══════════════════════════════════════════
   CLASSROOMS, HOSPITAL & LABORATORY MODULES
══════════════════════════════════════════ */
async function renderClassrooms() {
  const tb = document.getElementById('roomBody');
  const cnt = document.getElementById('roomCnt');
  try {
    const data = await apiFetch('/api/classrooms');
    const rooms = (data && data.classrooms) ? data.classrooms : localStore.classrooms;
    if (cnt) cnt.textContent = rooms.length;
    if (tb) {
      if (!rooms.length) {
        tb.innerHTML = '<tr><td colspan="5" class="empty">No classrooms listed.</td></tr>';
      } else {
        tb.innerHTML = rooms.map(r => `
          <tr>
            <td><strong>🚪 ${escapeHtml(r.room_no)}</strong></td>
            <td><span class="chip">${escapeHtml(r.location || 'Block A')}</span></td>
            <td>${escapeHtml(r.capacity || '40')} Seats</td>
            <td><span class="badge green">Available Now</span></td>
            <td><button class="ev-btn" style="padding:4px 12px;font-size:11px" onclick="quickBookAi('${escapeHtml(r.room_no)}', '02:00 PM – 04:00 PM')">Instant Reserve</button></td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {}
}

async function addRoom() {
  const no = document.getElementById('roomNo').value.trim();
  const loc = document.getElementById('roomLoc').value.trim();
  const cap = document.getElementById('roomCap').value;

  if (!no) { showToast('⚠️ Enter room number', 'warn'); return; }

  try {
    await apiFetch('/api/classrooms', { method: 'POST', body: JSON.stringify({ room_no: no, location: loc, capacity: cap }) });
    localStore.classrooms.unshift({ id: Date.now(), room_no: no, location: loc || 'Block A', capacity: cap || '30' });
    document.getElementById('roomNo').value = '';
    document.getElementById('roomLoc').value = '';
    showToast(`✅ Room ${no} added!`);
    renderClassrooms();
  } catch(e) {
    showToast('⚠️ ' + e.message, 'warn');
  }
}

async function renderDoctors(filterType = 'all') {
  const grid = document.getElementById('doctorGrid');
  const apptBody = document.getElementById('apptBody');
  const apptCnt = document.getElementById('apptCnt');

  try {
    const data = await apiFetch(`/api/hospital/doctors?type=${filterType}`);
    let docs = (data && data.doctors) ? data.doctors : localStore.doctors;
    if (filterType === 'available') docs = docs.filter(d => d.avail === 'Available');
    if (filterType === 'general') docs = docs.filter(d => d.type === 'general');
    if (filterType === 'specialist') docs = docs.filter(d => d.type === 'specialist');

    if (grid) {
      grid.innerHTML = docs.map(d => `
        <div class="event-card">
          <div class="ev-top">
            <span class="ev-cat">${escapeHtml(d.spec)}</span>
            <span class="chip ${d.avail === 'Available' ? 'av' : 'pn'}">${d.avail}</span>
          </div>
          <div class="ev-title">${d.icon || '🩺'} ${escapeHtml(d.name)}</div>
          <div class="ev-desc">Timing: <strong>${d.timing || '9 AM – 2 PM'}</strong><br>Experience: ${d.exp || '10+ yrs'} · ${d.room}</div>
          <button class="ev-btn" onclick="bookDoctorAppt(${d.id}, '${escapeHtml(d.name)}')">Book Appointment</button>
        </div>
      `).join('');
    }

    if (apptCnt) apptCnt.textContent = localStore.doctorAppointments.length;
    if (apptBody) {
      if (!localStore.doctorAppointments.length) {
        apptBody.innerHTML = '<tr><td colspan="5" class="empty">No clinic appointments booked yet.</td></tr>';
      } else {
        apptBody.innerHTML = localStore.doctorAppointments.map(a => `
          <tr>
            <td><strong>${escapeHtml(a.name)}</strong></td>
            <td>${escapeHtml(a.spec)}</td>
            <td>${escapeHtml(a.date)}</td>
            <td><span class="badge green">Confirmed</span></td>
            <td><button class="del-btn" onclick="showToast('Appointment cancelled.')">Cancel</button></td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {}
}

function filterDocCards(type, btn) {
  document.querySelectorAll('#docFilterRow .suggest-trigger').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderDoctors(type);
}

function bookDoctorAppt(docId, docName) {
  const d = localStore.doctors.find(x => x.id == docId);
  localStore.doctorAppointments.unshift({
    id: Date.now(),
    doctor_id: docId,
    name: docName,
    spec: d ? d.spec : 'General Medicine',
    date: 'Today, Next Free Slot (30m)'
  });
  showToast(`✅ Appointment confirmed with ${docName}! Check Health Centre Room ${d ? d.room : '101'}.`);
  renderDoctors();
}

let currentLabDept = 'btech';
async function renderLabEquipment(dept = 'btech') {
  currentLabDept = dept;
  const grid = document.getElementById('equipGrid');
  const labBody = document.getElementById('labBody');
  const labCnt = document.getElementById('labCnt');

  try {
    const data = await apiFetch(`/api/lab/equipment?dept=${dept}`);
    let items = (data && data.equipment) ? data.equipment : localStore.labEquipment;
    if (dept) items = items.filter(e => !e.department || e.department === dept);

    if (grid) {
      grid.innerHTML = items.map(eq => `
        <div class="event-card">
          <div class="ev-title">${eq.icon || '🔬'} ${escapeHtml(eq.name)}</div>
          <div class="ev-desc">Department: <strong>${escapeHtml(eq.department ? eq.department.toUpperCase() : 'Engineering')}</strong><br>Slot: ${eq.slot || 'Daily 9 AM – 5 PM'}</div>
          <button class="ev-btn" onclick="reserveLabEquipment('${escapeHtml(eq.name)}')">Reserve Equipment</button>
        </div>
      `).join('');
    }

    if (labCnt) labCnt.textContent = localStore.labReservations.length;
    if (labBody) {
      if (!localStore.labReservations.length) {
        labBody.innerHTML = '<tr><td colspan="4" class="empty">No lab reservations.</td></tr>';
      } else {
        labBody.innerHTML = localStore.labReservations.map(r => `
          <tr>
            <td><strong>${escapeHtml(r.equipment)}</strong></td>
            <td>${escapeHtml(r.slot)}</td>
            <td><span class="badge green">Confirmed</span></td>
            <td><button class="del-btn" onclick="showToast('Lab slot cancelled.')">Cancel</button></td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {}
}

function showDept(deptKey, btn) {
  document.querySelectorAll('#deptBtns .map-filter-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderLabEquipment(deptKey);
}

function reserveLabEquipment(name) {
  localStore.labReservations.unshift({
    id: Date.now(),
    equipment: name,
    slot: 'Today, 2:00 PM – 4:00 PM'
  });
  showToast(`✅ Reserved "${name}"! Badge pass active on your profile.`);
  renderLabEquipment(currentLabDept);
}

/* ─── ADD HANDLERS FOR ALL CAMPUS MODULES ─── */
async function addBook() {
  const title = (document.getElementById('newBookTitle') ? document.getElementById('newBookTitle').value : '').trim();
  const author = (document.getElementById('newBookAuthor') ? document.getElementById('newBookAuthor').value : '').trim();
  const shelf = (document.getElementById('newBookShelf') ? document.getElementById('newBookShelf').value : 'A-10').trim();
  const category = (document.getElementById('newBookCategory') ? document.getElementById('newBookCategory').value : 'Computer Science');
  const copies = parseInt((document.getElementById('newBookCopies') ? document.getElementById('newBookCopies').value : '4') || '4');

  if (!title || !author) {
    showToast('⚠️ Please enter Book Title and Author', 'warn');
    return;
  }

  try {
    await apiFetch('/api/library/books', {
      method: 'POST',
      body: JSON.stringify({ title, author, shelf, category, copies, year: '2025' })
    });
    localStore.books.unshift({
      id: Date.now(),
      title,
      author,
      shelf: shelf || 'A-10',
      category: category || 'Computer Science',
      copies,
      year: '2025',
      icon: '📘'
    });
    if (document.getElementById('newBookTitle')) document.getElementById('newBookTitle').value = '';
    if (document.getElementById('newBookAuthor')) document.getElementById('newBookAuthor').value = '';
    if (document.getElementById('newBookShelf')) document.getElementById('newBookShelf').value = '';
    showToast(`✅ Added "${title}" to Library Catalogue!`);
    renderLibrary();
  } catch(e) {
    showToast('⚠️ ' + e.message, 'warn');
  }
}

async function addDoctor() {
  const name = (document.getElementById('docNameInput') ? document.getElementById('docNameInput').value : '').trim();
  const spec = (document.getElementById('docSpecInput') ? document.getElementById('docSpecInput').value : '').trim();
  const room = (document.getElementById('docRoomInput') ? document.getElementById('docRoomInput').value : 'Room 101').trim();
  const timing = (document.getElementById('docTimingInput') ? document.getElementById('docTimingInput').value : '9:00 AM – 1:00 PM').trim();
  const type = (document.getElementById('docTypeInput') ? document.getElementById('docTypeInput').value : 'general');

  if (!name || !spec) {
    showToast('⚠️ Please enter Doctor Name and Specialization', 'warn');
    return;
  }

  try {
    await apiFetch('/api/hospital/doctors', {
      method: 'POST',
      body: JSON.stringify({ name, spec, room, timing, type, avail: 'Available', exp: '10 yrs' })
    });
    localStore.doctors.unshift({
      id: Date.now(),
      name,
      spec,
      room: room || 'Room 101',
      timing: timing || '9:00 AM – 1:00 PM',
      type: type || 'general',
      avail: 'Available',
      icon: '🩺',
      exp: '10 yrs'
    });
    if (document.getElementById('docNameInput')) document.getElementById('docNameInput').value = '';
    if (document.getElementById('docSpecInput')) document.getElementById('docSpecInput').value = '';
    if (document.getElementById('docRoomInput')) document.getElementById('docRoomInput').value = '';
    showToast(`✅ Registered ${name} to Health Centre!`);
    renderDoctors();
  } catch(e) {
    showToast('⚠️ ' + e.message, 'warn');
  }
}

async function addLabEquipment() {
  const name = (document.getElementById('equipNameInput') ? document.getElementById('equipNameInput').value : '').trim();
  const department = (document.getElementById('equipDeptInput') ? document.getElementById('equipDeptInput').value : 'btech');
  const slot = (document.getElementById('equipSlotInput') ? document.getElementById('equipSlotInput').value : 'Daily 9 AM – 5 PM').trim();

  if (!name) {
    showToast('⚠️ Please enter Equipment Name', 'warn');
    return;
  }

  try {
    await apiFetch('/api/lab/equipment', {
      method: 'POST',
      body: JSON.stringify({ name, department })
    });
    localStore.labEquipment.unshift({
      id: Date.now(),
      name,
      department,
      slot: slot || 'Daily 9 AM – 5 PM',
      icon: '🔬'
    });
    if (document.getElementById('equipNameInput')) document.getElementById('equipNameInput').value = '';
    if (document.getElementById('equipSlotInput')) document.getElementById('equipSlotInput').value = '';
    showToast(`✅ Added "${name}" to Lab Inventory!`);
    renderLabEquipment(department);
  } catch(e) {
    showToast('⚠️ ' + e.message, 'warn');
  }
}

function addPeerTutor() {
  const name = (document.getElementById('tutorNameInput') ? document.getElementById('tutorNameInput').value : '').trim();
  const subject = (document.getElementById('tutorSubjectInput') ? document.getElementById('tutorSubjectInput').value : '').trim();
  const dept = (document.getElementById('tutorDeptInput') ? document.getElementById('tutorDeptInput').value : 'B.Tech').trim();
  const time = (document.getElementById('tutorTimeInput') ? document.getElementById('tutorTimeInput').value : '3:00 – 5:00 PM').trim();

  if (!name || !subject) {
    showToast('⚠️ Please enter Name and Subject', 'warn');
    return;
  }

  localStore.tutors.unshift({
    name,
    subject,
    dept: dept || 'B.Tech',
    time: time || '3:00 – 5:00 PM',
    status: 'Available'
  });
  if (document.getElementById('tutorNameInput')) document.getElementById('tutorNameInput').value = '';
  if (document.getElementById('tutorSubjectInput')) document.getElementById('tutorSubjectInput').value = '';
  showToast(`✅ Registered ${name} as Peer Tutor!`);
  renderTutors();
}

function addDiscussionSuite() {
  const name = (document.getElementById('suiteNameInput') ? document.getElementById('suiteNameInput').value : '').trim();
  const block = (document.getElementById('suiteBlockInput') ? document.getElementById('suiteBlockInput').value : 'Block D').trim();
  const cap = parseInt((document.getElementById('suiteCapInput') ? document.getElementById('suiteCapInput').value : '6') || '6');
  const equip = (document.getElementById('suiteEquipInput') ? document.getElementById('suiteEquipInput').value : 'A/C, Whiteboard').trim();

  if (!name) {
    showToast('⚠️ Please enter Suite Name', 'warn');
    return;
  }

  localStore.discussionRooms.unshift({
    name,
    block: block || 'Block D',
    capacity: cap,
    equip: equip || 'A/C, Smart Display',
    status: 'Free'
  });
  if (document.getElementById('suiteNameInput')) document.getElementById('suiteNameInput').value = '';
  if (document.getElementById('suiteBlockInput')) document.getElementById('suiteBlockInput').value = '';
  showToast(`✅ Added Discussion Suite "${name}"!`);
  renderDiscussionRooms();
}

function addFoodMenuItem() {
  const name = (document.getElementById('foodNameInput') ? document.getElementById('foodNameInput').value : '').trim();
  const price = parseInt((document.getElementById('foodPriceInput') ? document.getElementById('foodPriceInput').value : '50') || '50');
  const outlet = (document.getElementById('foodOutletInput') ? document.getElementById('foodOutletInput').value : 'cafeteria');
  const tag = (document.getElementById('foodTagInput') ? document.getElementById('foodTagInput').value : 'veg');
  const cal = (document.getElementById('foodCalInput') ? document.getElementById('foodCalInput').value : '250 kcal').trim();

  if (!name) {
    showToast('⚠️ Please enter Dish Name', 'warn');
    return;
  }

  if (!foodOutlets[outlet]) foodOutlets[outlet] = [];
  foodOutlets[outlet].unshift({
    name,
    price,
    ico: tag === 'veg' ? '🥗' : '🍗',
    tag,
    cal: cal || '280 kcal',
    desc: 'Fresh campus specialty prepared daily.'
  });
  if (document.getElementById('foodNameInput')) document.getElementById('foodNameInput').value = '';
  showToast(`✅ Added "${name}" (₹${price}) to ${outlet} menu!`);
  renderFoodCards(outlet);
}

function addCampusClub() {
  const name = (document.getElementById('clubNameInput') ? document.getElementById('clubNameInput').value : '').trim();
  const desc = (document.getElementById('clubDescInput') ? document.getElementById('clubDescInput').value : '').trim();
  const icon = (document.getElementById('clubIconInput') ? document.getElementById('clubIconInput').value : '🚀').trim() || '🚀';

  if (!name) {
    showToast('⚠️ Please enter Club Name', 'warn');
    return;
  }

  localStore.clubs.unshift({
    name,
    icon,
    members: 1,
    desc: desc || 'Student campus interest and activity group.'
  });
  if (document.getElementById('clubNameInput')) document.getElementById('clubNameInput').value = '';
  if (document.getElementById('clubDescInput')) document.getElementById('clubDescInput').value = '';
  showToast(`✅ Created "${name}" club!`);
  renderClubs();
}

function renderTodaySchedule() {
  const list = document.getElementById('todayScheduleList');
  if (!list) return;
  list.innerHTML = localStore.todaySchedule.map(s => `
    <div class="sch-item">
      <div class="sch-time">${s.time}</div>
      <div class="sch-info">
        <div class="sch-sub">${s.subject}</div>
        <div class="sch-meta">🚪 ${s.room} · ${s.building} · 👨‍🏫 ${s.faculty}</div>
      </div>
      <span class="sch-status ${s.status === 'In Progress' ? 'live' : s.status === 'Completed' ? 'done' : 'upcoming'}">
        ${s.status}
      </span>
    </div>
  `).join('');
}

function renderDashEvents() {
  const grid = document.getElementById('dashEventsGrid');
  if (!grid) return;
  grid.innerHTML = localStore.events.map(e => `
    <div class="event-card">
      <div class="ev-top">
        <span class="ev-cat">${e.category}</span>
        <span class="badge orange">${e.attendees} Registered</span>
      </div>
      <div class="ev-title">${e.image} ${e.title}</div>
      <div class="ev-desc">${e.description}</div>
      <div class="ev-meta">
        <div>📅 <strong>${e.date}</strong> · ${e.time}</div>
        <div>📍 ${e.location}</div>
      </div>
      <button class="ev-btn" onclick="registerForEvent(${e.id}, this)">Register for Event →</button>
    </div>
  `).join('');
}

function registerForEvent(id, btn) {
  const ev = localStore.events.find(x => x.id === id);
  if (ev) {
    ev.attendees += 1;
    if (btn) { btn.textContent = '✅ Registered'; btn.disabled = true; }
    showToast(`✅ Registered for "${ev.title}"! Added to your schedule.`);
  }
}

function renderClubs() {
  const grid = document.getElementById('clubsGrid');
  if (!grid) return;
  grid.innerHTML = localStore.clubs.map(c => `
    <div class="event-card">
      <div class="ev-top"><span class="badge purple">${c.members} Members</span></div>
      <div class="ev-title">${c.icon} ${c.name}</div>
      <div class="ev-desc">${c.desc}</div>
      <button class="ev-btn" onclick="showToast('Joined ${c.name}!')">Join Club</button>
    </div>
  `).join('');
}

function renderTutors() {
  const grid = document.getElementById('tutorsGrid');
  if (!grid) return;
  grid.innerHTML = localStore.tutors.map(t => `
    <div class="event-card">
      <div class="ev-top"><span class="chip ${t.status === 'Available' ? 'av' : 'pn'}">${t.status}</span></div>
      <div class="ev-title">👤 ${t.name}</div>
      <div class="ev-desc">Subject: <strong>${t.subject}</strong><br>Time: ${t.time} · ${t.dept}</div>
      <button class="ev-btn" onclick="showToast('Session booked with ${t.name}!')">Book 1-on-1 Session</button>
    </div>
  `).join('');
}

function renderDiscussionRooms() {
  const grid = document.getElementById('discussionGrid');
  if (!grid) return;
  grid.innerHTML = localStore.discussionRooms.map(r => `
    <div class="event-card">
      <div class="ev-top"><span class="chip ${r.status === 'Free' ? 'av' : 'pn'}">${r.status}</span></div>
      <div class="ev-title">🚪 ${r.name}</div>
      <div class="ev-desc">Capacity: ${r.capacity} people · ${r.block}<br><small style="color:var(--tx3)">${r.equip}</small></div>
      <button class="ev-btn" onclick="quickBookAi('${r.name}', '03:00 PM – 05:00 PM')">Reserve Suite</button>
    </div>
  `).join('');
}

function renderShops() {
  const grid = document.getElementById('shopsGrid');
  if (!grid) return;
  const shops = [
    { name: 'University Stationery & Printing', time: '8:00 AM – 8:00 PM', loc: 'Block A Ground Floor', ico: '✏️' },
    { name: 'Campus 24/7 Pharmacy', time: '24/7 Open', loc: 'Near Health Centre', ico: '💊' },
    { name: 'Electronics & Component Store', time: '9:00 AM – 6:00 PM', loc: 'Block B Innovation Hub', ico: '💻' }
  ];
  grid.innerHTML = shops.map(s => `
    <div class="event-card">
      <div class="ev-title">${s.ico} ${s.name}</div>
      <div class="ev-desc">📍 ${s.loc}<br>🕒 ${s.time}</div>
      <button class="ev-btn" onclick="navTo('map',null)">Find on Map</button>
    </div>
  `).join('');
}

function renderLocations() {
  const grid = document.getElementById('locationsGrid');
  if (!grid) return;
  const locs = [
    { name: 'Block A (Admin & General Classes)', ico: '🏢', desc: 'Central administrative offices & 12 lecture rooms.' },
    { name: 'Block B (Innovation Labs & Robotics)', ico: '🔬', desc: 'Engineering testbenches & computer science labs.' },
    { name: 'Central University Library', ico: '📚', desc: '4 floors of books, digital pods & study commons.' },
    { name: 'Campus Health Centre', ico: '🏥', desc: '24/7 emergency clinic and specialist doctors.' }
  ];
  grid.innerHTML = locs.map(l => `
    <div class="event-card">
      <div class="ev-title">${l.ico} ${l.name}</div>
      <div class="ev-desc">${l.desc}</div>
      <button class="ev-btn" onclick="navTo('map',null)">Navigate Here</button>
    </div>
  `).join('');
}

function saveProfileChanges() {
  const name = document.getElementById('profInputName').value.trim();
  const dept = document.getElementById('profInputDept').value.trim();
  const skills = document.getElementById('profInputSkills').value.trim();
  if (!localStore.user) localStore.user = getUser() || {};
  localStore.user.name = name;
  localStore.user.department = dept;
  localStore.user.skills = skills;
  setUser(localStore.user);

  const sbName = document.getElementById('sbName');
  const tbName = document.getElementById('tbName');
  const passName = document.getElementById('passName');
  const profName = document.getElementById('profName');
  const passDept = document.getElementById('passDept');
  const profDept = document.getElementById('profDept');
  const dashGreeting = document.getElementById('dashUserName');
  if (sbName) sbName.textContent = name;
  if (tbName) tbName.textContent = name;
  if (passName) passName.textContent = name;
  if (profName) profName.textContent = name;
  if (passDept) passDept.textContent = dept;
  if (profDept) profDept.textContent = dept;
  if (dashGreeting) dashGreeting.textContent = name.split(' ')[0];

  showToast('✅ Profile updated successfully!');
}

/* ─── TOAST NOTIFICATIONS ─── */
let toastTimer;
function showToast(msg, type = 'info') {
  let t = document.getElementById('cmsToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'cmsToast';
    t.style.cssText = 'position:fixed;bottom:84px;left:50%;transform:translateX(-50%) translateY(20px);z-index:99999;background:var(--surface);border:1px solid var(--border2);padding:12px 22px;border-radius:12px;font-size:13.5px;font-weight:600;font-family:var(--font);color:var(--tx);box-shadow:var(--shadow-lg);opacity:0;transition:all .25s ease;pointer-events:none;max-width:90vw;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.borderColor = type === 'warn' ? 'rgba(245,158,11,0.5)' : 'rgba(255,107,44,0.5)';
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(10px)';
  }, 3200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── INITIALIZATION ON PAGE LOAD ───
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  // If user already signed in, auto-launch
  const savedUser = getUser();
  if (savedUser && savedUser.name) {
    launchPortal(savedUser.name, savedUser.login_id, savedUser.role || 'student');
  }
});


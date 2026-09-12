# cms-smart-portal

A Campus Management System with a static frontend and a Node.js/Express + SQLite backend.

```
cms-smart-portal/
├── frontend/              ← your existing site (unchanged)
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   └── favicon1.png
│
├── backend/               ← the API server
│   ├── server.js          entry point
│   ├── db.js              SQLite schema + seed data
│   ├── middleware/
│   │   └── auth.js        JWT auth middleware
│   ├── routes/
│   │   ├── auth.js        register / OTP send+verify / me
│   │   ├── library.js     books + reservations
│   │   ├── hospital.js    doctors + appointments
│   │   ├── food.js        cafeteria/canteen/mess/juice menus
│   │   ├── classrooms.js  room listings
│   │   ├── faculty.js     faculty directory
│   │   └── lab.js         lab equipment + reservations
│   ├── data/               SQLite file lives here at runtime (gitignored)
│   ├── package.json
│   ├── .env.example
│   └── README.md          full API reference + setup instructions
│
└── .gitignore
```

## Quick start

**Backend:**
```bash
cd backend
npm install
cp .env.example .env      # set JWT_SECRET
npm start                 # runs on http://localhost:4000
```

**Frontend:**
The `frontend/` folder is plain HTML/CSS/JS — open `frontend/index.html` directly in a browser, or serve it with any static server (e.g. `npx serve frontend`, GitHub Pages, Vercel, Netlify).

To connect the two, update the `fetch` calls in `frontend/script.js` to point at your backend's URL (`http://localhost:4000` locally, or your deployed Render URL in production). See `backend/README.md` for the exact endpoints and example `fetch` snippets.

## Deploying
- **Frontend** → GitHub Pages / Vercel / Netlify (static hosting)
- **Backend** → Render, Railway, or any Node host (see `backend/README.md`)

Push this whole folder as one GitHub repo, then point Render's "Root Directory" setting at `backend` when creating the web service, since that's where `package.json` lives.

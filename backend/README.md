# CMS Backend (Campus Management System)

A REST API backend for your `cms-smart-portal` frontend, built with **Node.js + Express + SQLite** (via `better-sqlite3`, so there's no external database server to install — it's just a file).

It replaces the in-browser `BOOKS`, `DOCTORS`, `FOOD_MENUS`, and `window._apptDB` arrays in `script.js` with real, persistent, multi-user data and adds login/registration with OTP + JWT auth.

## 1. Setup

```bash
cd cms-backend
npm install
cp .env.example .env      # then edit JWT_SECRET to a long random string
npm start                 # or: npm run dev  (auto-restarts on file changes)
```

The server starts on `http://localhost:4000` and creates `data/cms.db` automatically on first run, pre-seeded with the same books/doctors/food menus that were hardcoded in your `script.js`.

Health check: `GET http://localhost:4000/api/health`

## 2. Auth flow

This mirrors the Student/Teacher OTP login screen already in your `index.html`:

| Step | Endpoint |
|---|---|
| Register | `POST /api/auth/register` `{ loginId, name, phone, role, department, designation }` |
| Send OTP | `POST /api/auth/otp/send` `{ loginId, phone }` → `{ devOtp }` (swap for a real SMS provider later — see the `TODO` in `routes/auth.js`) |
| Verify OTP | `POST /api/auth/otp/verify` `{ loginId, otp }` → `{ token, user }` |
| Current user | `GET /api/auth/me` (header: `Authorization: Bearer <token>`) |

Store the returned `token` (e.g. in `localStorage`) and send it as a Bearer token on every protected request.

## 3. API reference

All responses are JSON. Protected routes require `Authorization: Bearer <token>`.

### Library
- `GET /api/library/books?q=algorithms` — smart search (used by the autocomplete box)
- `GET /api/library/books/all` — full catalogue grid
- `GET /api/library/books/:id`
- `POST /api/library/reservations` 🔒 `{ bookId }`
- `GET /api/library/reservations` 🔒 — "My Reservations" table
- `DELETE /api/library/reservations/:id` 🔒

### Hospital
- `GET /api/hospital/doctors?type=general&q=cardio`
- `GET /api/hospital/doctors/:id`
- `POST /api/hospital/appointments` 🔒 `{ doctorId }`
- `GET /api/hospital/appointments` 🔒
- `DELETE /api/hospital/appointments/:id` 🔒

### Food
- `GET /api/food/menus` — all outlets (cafeteria/canteen/mess/juice)
- `GET /api/food/menus/:key`

### Classrooms
- `GET /api/classrooms`
- `POST /api/classrooms` 🔒 `{ roomNo, location, capacity }`
- `DELETE /api/classrooms/:id` 🔒

### Faculty directory
- `GET /api/faculty`
- `POST /api/faculty` 🔒 `{ name, department, slot }`
- `DELETE /api/faculty/:id` 🔒

### Lab equipment
- `GET /api/lab/equipment?department=Electronics`
- `POST /api/lab/reservations` 🔒 `{ equipment, slot }`
- `GET /api/lab/reservations` 🔒
- `DELETE /api/lab/reservations/:id` 🔒

## 4. Wiring it into your existing `script.js`

Right now the frontend reads from local arrays. Swap those reads for `fetch` calls. Example for the book search box:

```js
// before: sugs = getBookSuggestions(val)  (local array filter)
async function handleBookSearch(val) {
  const res = await fetch(`http://localhost:4000/api/library/books?q=${encodeURIComponent(val)}`);
  const { books } = await res.json();
  // ...render `books` the same way the old `sugs` array was rendered
}
```

And for booking, attach the saved JWT:

```js
const token = localStorage.getItem('cms_token');
await fetch('http://localhost:4000/api/library/reservations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ bookId: b.id })
});
```

Do the same pattern for doctors/appointments, classrooms, faculty, and lab equipment — the shapes of the JSON returned match the field names already used in your rendering functions (`title`, `author`, `copies`, `name`, `spec`, `avail`, `room`, etc.), so the HTML-building code barely needs to change, just the data source.

## 5. Notes on choices made

- **SQLite** was used instead of Postgres/MySQL so you can run this immediately without provisioning a database server. For production/scale, swap `better-sqlite3` for `pg` and the same route logic mostly carries over.
- **OTP is simulated**: `/api/auth/otp/send` returns the OTP directly in `devOtp` for local testing. Wire in Twilio/MSG91/etc. where marked with `TODO` before going live, and stop returning `devOtp` in the response.
- **JWT** (`jsonwebtoken`) is used for stateless auth so you don't need server-side sessions.
- Deleting a reservation/appointment restores the book copy / doesn't affect doctor availability (kept simple, matching original frontend behavior).

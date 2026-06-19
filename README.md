# Maison Restaurant

Full-stack restaurant management system built with Node.js, Fastify, and SQLite. Covers public guest-facing booking, real-time floor management, per-role staff cabinets, and admin controls.

---

## Features

| Area | What it does |
|---|---|
| **Public site** | Landing page, full menu with filters (vegan / vegetarian / gluten-free), about page |
| **Reservation flow** | Multi-step booking form with live slot availability via AJAX; guest self-service manage/edit/cancel page via token link |
| **Host cabinet** | Real-time SVG floor map (SSE), reservation confirm/reject/seat, walk-in seating, waitlist |
| **Waiter cabinet** | Claim unassigned tables, close visits with bill + tip recording |
| **Chef cabinet** | Menu CRUD with image upload (webp 1200 px + 400 px thumb via Sharp) |
| **Admin** | Floor layout drag-and-drop editor, staff CRUD with temp-password flow, shift scheduling with overlap guard, settings (hours, tip mode), tip-pool distribution |
| **Security** | `argon2id` password hashing, session-based auth, CSRF protection on every POST form, rate-limit on booking endpoint |
| **Email** | Confirmation / cancellation / rejection emails via Nodemailer; logs to console in dev if SMTP is not configured |

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 LTS, ESM (`"type":"module"`) |
| Server | Fastify v4 |
| Database | better-sqlite3 (SQLite, synchronous) |
| Templates | eta v3 via `@fastify/view` |
| Auth | `@node-rs/argon2` + `@fastify/session` (memory store) |
| CSRF | `@fastify/csrf-protection` v6 |
| Rate limit | `@fastify/rate-limit` |
| Images | `@fastify/multipart` + `sharp` |
| Email | `nodemailer` |
| Validation | `zod` (server-side, all mutating routes) |
| Client | Vanilla JS / HTML / CSS — no frameworks, no bundler |
| SSE | In-memory pub/sub hub (`src/services/events.js`) |

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.example .env

# 3. Create database and seed demo data
npm run setup

# 4. Start in development mode (file-watch)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).  
Staff login: [http://localhost:3000/login](http://localhost:3000/login).

Default seed credentials:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@maison.ru` | `adminpass123` |
| Host | `host@maison.ru` | `hostpass123` |
| Waiter | `waiter@maison.ru` | `waiterpass123` |
| Chef | `chef@maison.ru` | `chefpass123` |

---

## Environment variables

Create a `.env` file (never commit it):

```dotenv
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Session (generate a random 32-char string)
SESSION_SECRET=change_me_to_a_random_32_char_secret

# Email — leave blank to print to console instead
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@maison.ru

# App URL used in email links
APP_URL=http://localhost:3000
```

---

## NPM scripts

```bash
npm run dev      # node --watch server.js
npm start        # node server.js (production)
npm test         # node:test suite
npm run setup    # run migrations + seed
npm run lint     # eslint
npm run format   # prettier
```

---

## Project structure

```
server.js              # Entry point — registers all Fastify plugins and routes
src/
  config.js            # Reads process.env, validates and exports
  db.js                # better-sqlite3 singleton + WAL pragma
  auth.js              # Session helpers, requireRole middleware
  mail.js              # Nodemailer transport; console fallback in dev
  validators/          # Zod schemas (reservation, staff, shift, menu, …)
  services/            # Pure functions over db — no HTTP context
    reservations.js    # Availability, CRUD, status transitions
    visits.js          # Table visits (seat / close)
    menu.js            # Menu items and categories
    staff.js           # Users, shifts, password reset
    tips.js            # Tip records and pool logic
    waitlist.js        # Walk-in waitlist
    events.js          # In-memory SSE pub/sub hub
  routes/
    reserve.js         # Public booking + manage-by-token
    api.js             # /api/floor, /api/availability, /api/events (SSE)
    auth.js            # /login, /logout, /change-password
    host.js            # /host — floor map, reservations, walkins, waitlist
    waiter.js          # /waiter — visits, close with tips
    chef.js            # /chef/menu — CRUD + image upload
    admin.js           # /admin — staff, shifts, floor editor, tips pool, settings
  views/
    layout.eta         # Public layout (Google Fonts, tokens.css, main.js)
    layout-staff.eta   # Staff layout (same + staff-nav partial)
    pages/             # One .eta file per page
    partials/          # staff-nav.eta, etc.
db/
  migrate.js           # Runs all migrations/*.sql in order
  seed.js              # Inserts demo data
  migrations/
    001_init.sql       # Full schema
public/
  css/
    tokens.css         # CSS custom properties (color, space, type scale)
    base.css           # Reset + typography
    components.css     # Forms, buttons, cards, badges, tables
  js/
    main.js            # Shared public JS (minimal)
    reservation.js     # Slot-picker AJAX for reserve page
    floor-map.js       # SSE client — live floor state for host
    floor-editor.js    # Drag-and-drop SVG editor (admin)
  img/                 # Static assets
  uploads/menu/        # Generated by Sharp — in .gitignore
data/app.db            # SQLite file — in .gitignore
tests/                 # node:test integration tests
```

---

## Architecture decisions

### Database

SQLite with WAL journal mode. All queries use prepared statements (zero string concatenation). Transactions are used for atomics: reservation conflicts check + insert, tip pool distribution.

Reservation conflict query:

```sql
SELECT COUNT(*) FROM reservations
WHERE table_id = @tableId
  AND status NOT IN ('CANCELLED','REJECTED','NO_SHOW')
  AND starts_at < @endsAt
  AND ends_at > @startsAt
```

### Authentication & roles

Roles: `ADMIN`, `HOST`, `WAITER`, `CHEF`. Stored in `users.role`. Session holds `{ userId, role }`. Each route file imports `requireRole('ROLE')` from `src/auth.js` as a preHandler.

Password reset flow:
1. Admin creates staff → random 12-char temp password generated, hashed with argon2id, stored; raw password flashed once via `req.session.staffFlash`.
2. `must_change_password = 1` is set. After login, middleware redirects to `/change-password`.
3. On successful change, flag is cleared.

### CSRF

`@fastify/csrf-protection` registered after `@fastify/session`. A global `preHandler` hook monkey-patches `reply.view` on every request to merge `csrfToken` into template data automatically — no route code needs to pass it manually. A global `preValidation` hook validates the token on all non-GET, non-`/api/` requests; returns 403 on failure.

### SSE (real-time floor map)

`GET /api/events` upgrades to an SSE stream. The host floor map subscribes on page load. Events emitted:

| Event | Trigger | Action in client |
|---|---|---|
| `visit.seated` | Walk-in or reservation seated | Mark table OCCUPIED, remove from walk-in select |
| `visit.closed` | Waiter closes visit | Mark table NEEDS_CLEANUP |
| `reservation.updated` | Host confirms/rejects | Reload page |

Fallback: on SSE error the client falls back to 30-second polling reload and tries to reconnect after 10 seconds.

### Image processing

Chef uploads via `multipart/form-data`. `@fastify/multipart` streams parts; the image buffer is piped to Sharp which produces:
- `public/uploads/menu/{id}.webp` — 1200 px wide, quality 85
- `public/uploads/menu/{id}_thumb.webp` — 400 px wide, quality 80

Paths stored in `image_url` / `thumb_url` columns.

### Tip modes

Configured globally in `settings.tip_model`:
- **DIRECT** — tip amount recorded directly against the waiter who closed the visit.
- **POOL** — amount added to the day's `tip_pools` row. Admin distributes once, proportionally by hours worked per role using the split percentages in `settings.tip_pool_default_split` (JSON, e.g. `{"WAITER":70,"HOST":15,"CHEF":15}`).

### Rate limiting

`@fastify/rate-limit` registered globally with `global: false`. Per-route config applied to `POST /reserve`: 10 requests / hour per IP.

Login already protected by a separate per-IP+email limit: 10 attempts / 15 minutes.

---

## Build phases

| Phase | Commit | Summary |
|---|---|---|
| 0 | `chore(phase-0)` | Fastify scaffold, CSS design tokens, layout templates |
| 1 | `feat(phase-1)` | SQLite migrations + service layer + tests |
| 2 | `feat(phase-2)` | Public pages: home, menu, about |
| 3 | `feat(phase-3)` | Guest reservation form + slot API + manage-by-token |
| 4 | `feat(phase-4)` | Login, sessions, role middleware, staff layout stubs |
| 5 | `feat(phase-5)` | Host floor map with SSE + waitlist |
| 6 | `feat(phase-6)` | Admin floor editor (drag-and-drop SVG) |
| 7 | `feat(phase-7)` | Waiter visits — claim tables, close with tips |
| 8 | `feat(phase-8)` | Chef menu CRUD with image uploads (Sharp) |
| 9 | `feat(phase-9)` | Staff CRUD, temp password, reset, shift scheduling |
| 10 | `feat(phase-10)` | Tip pool — POOL routing, admin distribution screen |
| 11 | `feat(phase-11)` | CSRF protection, rate-limit on `/reserve` |

---

## Security hardening checklist

- [x] Passwords hashed with `argon2id`
- [x] CSRF token on every POST form, validated server-side
- [x] `httpOnly` session cookies (no JS access)
- [x] Prepared statements everywhere — no SQL injection surface
- [x] Role enforcement server-side only
- [x] Rate limit on public booking endpoint
- [x] Rate limit on login endpoint
- [x] `@fastify/helmet` sets security headers (CSP, HSTS, X-Frame-Options, …)
- [x] Image uploads validate MIME type via `sharp` (will throw on non-image)
- [x] File upload size capped at 5 MB
- [x] `.env`, `data/app.db`, `public/uploads/` in `.gitignore`

---

## Running tests

```bash
npm test
```

Tests live in `tests/` and use Node.js's built-in `node:test` + `assert`. They cover:
- Reservation slot availability logic
- Conflict detection
- Status transition guards
- Tip pool distribution math

---

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for full Caddy + PM2 + SQLite backup instructions.

-- 001_init.sql — Начальная схема Maison Restaurant

-- ============================================================
-- Персонал
-- ============================================================
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('WAITER','HOST','CHEF','ADMIN')),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Столы и план зала
-- ============================================================
CREATE TABLE tables (
  id        TEXT PRIMARY KEY,
  label     TEXT NOT NULL,
  seats     INTEGER NOT NULL,
  section   TEXT,
  shape     TEXT NOT NULL CHECK (shape IN ('round','square','rect')),
  x         REAL NOT NULL DEFAULT 10,
  y         REAL NOT NULL DEFAULT 10,
  width     REAL NOT NULL DEFAULT 8,
  height    REAL NOT NULL DEFAULT 8,
  rotation  REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- Брони
-- ============================================================
CREATE TABLE reservations (
  id            TEXT PRIMARY KEY,
  manage_token  TEXT NOT NULL UNIQUE,
  guest_name    TEXT NOT NULL,
  guest_phone   TEXT NOT NULL,
  guest_email   TEXT,
  party_size    INTEGER NOT NULL CHECK (party_size > 0),
  starts_at     TEXT NOT NULL,
  ends_at       TEXT NOT NULL,
  table_id      TEXT REFERENCES tables(id),
  status        TEXT NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','CONFIRMED','SEATED','COMPLETED',
                                  'REJECTED','CANCELLED','NO_SHOW')),
  notes         TEXT,
  staff_note    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_reservations_starts_at ON reservations(starts_at);
CREATE INDEX idx_reservations_table_starts ON reservations(table_id, starts_at);
CREATE INDEX idx_reservations_token ON reservations(manage_token);

-- ============================================================
-- Лист ожидания
-- ============================================================
CREATE TABLE waitlist (
  id           TEXT PRIMARY KEY,
  guest_name   TEXT NOT NULL,
  guest_phone  TEXT NOT NULL,
  party_size   INTEGER NOT NULL,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
);

-- ============================================================
-- Визиты («гости сели»)
-- ============================================================
CREATE TABLE visits (
  id              TEXT PRIMARY KEY,
  reservation_id  TEXT REFERENCES reservations(id),
  table_id        TEXT NOT NULL REFERENCES tables(id),
  waiter_id       TEXT REFERENCES users(id),
  party_size      INTEGER NOT NULL,
  seated_at       TEXT NOT NULL,
  closed_at       TEXT,
  bill_cents      INTEGER,
  status          TEXT NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN','CLOSED'))
);

CREATE INDEX idx_visits_table_open ON visits(table_id) WHERE closed_at IS NULL;
CREATE INDEX idx_visits_waiter ON visits(waiter_id);

-- ============================================================
-- Меню
-- ============================================================
CREATE TABLE menu_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id             TEXT PRIMARY KEY,
  category_id    TEXT NOT NULL REFERENCES menu_categories(id),
  name           TEXT NOT NULL,
  description    TEXT,
  price_cents    INTEGER NOT NULL CHECK (price_cents >= 0),
  image_url      TEXT,
  thumb_url      TEXT,
  is_vegan       INTEGER NOT NULL DEFAULT 0,
  is_vegetarian  INTEGER NOT NULL DEFAULT 0,
  is_gluten_free INTEGER NOT NULL DEFAULT 0,
  allergens      TEXT,
  is_available   INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Смены
-- ============================================================
CREATE TABLE shifts (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id),
  starts_at TEXT NOT NULL,
  ends_at   TEXT NOT NULL,
  role      TEXT NOT NULL,
  notes     TEXT
);

CREATE INDEX idx_shifts_user_starts ON shifts(user_id, starts_at);
CREATE INDEX idx_shifts_date ON shifts(starts_at);

-- ============================================================
-- Чаевые
-- ============================================================
CREATE TABLE tip_pools (
  id             TEXT PRIMARY KEY,
  shift_date     TEXT NOT NULL UNIQUE,
  total_cents    INTEGER NOT NULL DEFAULT 0,
  distributed_at TEXT
);

CREATE TABLE tips (
  id           TEXT PRIMARY KEY,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  method       TEXT NOT NULL CHECK (method IN ('CASH','CARD','TRANSFER')),
  visit_id     TEXT REFERENCES visits(id),
  recipient_id TEXT REFERENCES users(id),
  pool_id      TEXT REFERENCES tip_pools(id),
  shift_date   TEXT NOT NULL,
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tips_recipient ON tips(recipient_id, shift_date);
CREATE INDEX idx_tips_pool ON tips(pool_id);

-- ============================================================
-- Настройки ресторана
-- ============================================================
CREATE TABLE settings (
  id                    TEXT PRIMARY KEY DEFAULT 'singleton',
  timezone              TEXT NOT NULL DEFAULT 'Europe/Moscow',
  open_hours_json       TEXT NOT NULL DEFAULT '{"1":[{"open":"12:00","close":"23:00"}],"2":[{"open":"12:00","close":"23:00"}],"3":[{"open":"12:00","close":"23:00"}],"4":[{"open":"12:00","close":"23:00"}],"5":[{"open":"12:00","close":"23:00"}],"6":[{"open":"11:00","close":"00:00"}],"0":[]}',
  slot_granularity_min  INTEGER NOT NULL DEFAULT 15,
  dining_minutes        INTEGER NOT NULL DEFAULT 90,
  buffer_min            INTEGER NOT NULL DEFAULT 15,
  min_lead_hours        INTEGER NOT NULL DEFAULT 2,
  max_advance_days      INTEGER NOT NULL DEFAULT 60,
  cancel_cutoff_hours   INTEGER NOT NULL DEFAULT 4,
  tip_model             TEXT NOT NULL DEFAULT 'DIRECT' CHECK (tip_model IN ('DIRECT','POOL')),
  tip_pool_default_split TEXT NOT NULL DEFAULT '{"WAITER":70,"HOST":15,"CHEF":15}'
);

INSERT INTO settings (id) VALUES ('singleton');

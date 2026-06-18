import db from '../db.js'

const stmtAll = db.prepare(
  `SELECT id, role, name, email, phone, is_active, must_change_password, created_at
   FROM users ORDER BY name`
)
const stmtActive = db.prepare(
  `SELECT id, role, name, email, phone, is_active, created_at
   FROM users WHERE is_active=1 ORDER BY name`
)
const stmtById = db.prepare(
  `SELECT id, role, name, email, phone, is_active, must_change_password, password_hash, created_at
   FROM users WHERE id=?`
)
const stmtByEmail = db.prepare(`SELECT * FROM users WHERE email=?`)

const stmtInsert = db.prepare(`
  INSERT INTO users (id, role, name, email, password_hash, phone, must_change_password)
  VALUES (@id, @role, @name, @email, @passwordHash, @phone, @mustChangePassword)
`)
const stmtUpdate = db.prepare(`
  UPDATE users SET role=@role, name=@name, email=@email, phone=@phone,
    is_active=@isActive
  WHERE id=@id
`)
const stmtUpdatePassword = db.prepare(`
  UPDATE users SET password_hash=@passwordHash, must_change_password=0 WHERE id=@id
`)
const stmtDeactivate = db.prepare(`UPDATE users SET is_active=0 WHERE id=?`)

// ---- Shifts ----

const stmtShiftById = db.prepare(`SELECT * FROM shifts WHERE id=?`)
const stmtShiftsByUser = db.prepare(
  `SELECT * FROM shifts WHERE user_id=? ORDER BY starts_at`
)
const stmtShiftsByDate = db.prepare(
  `SELECT s.*, u.name AS user_name, u.role AS user_role
   FROM shifts s JOIN users u ON s.user_id = u.id
   WHERE s.starts_at BETWEEN ? AND ?
   ORDER BY s.starts_at`
)
const stmtActiveShifts = db.prepare(
  `SELECT s.*, u.name AS user_name
   FROM shifts s JOIN users u ON s.user_id = u.id
   WHERE s.starts_at <= ? AND s.ends_at >= ?
   ORDER BY s.starts_at`
)

const stmtInsertShift = db.prepare(`
  INSERT INTO shifts (id, user_id, starts_at, ends_at, role, notes)
  VALUES (@id, @userId, @startsAt, @endsAt, @role, @notes)
`)
const stmtUpdateShift = db.prepare(`
  UPDATE shifts SET user_id=@userId, starts_at=@startsAt, ends_at=@endsAt,
    role=@role, notes=@notes
  WHERE id=@id
`)
const stmtDeleteShift = db.prepare(`DELETE FROM shifts WHERE id=?`)

// ---- Users ----

export function listAllStaff() {
  return stmtAll.all()
}

export function listActiveStaff() {
  return stmtActive.all()
}

export function findUserById(id) {
  return stmtById.get(id) ?? null
}

export function findUserByEmail(email) {
  return stmtByEmail.get(email) ?? null
}

export function createUser(data) {
  stmtInsert.run(data)
  return findUserById(data.id)
}

export function updateUser(data) {
  stmtUpdate.run(data)
  return findUserById(data.id)
}

export function updatePassword(id, passwordHash) {
  stmtUpdatePassword.run({ id, passwordHash })
}

export function deactivateUser(id) {
  stmtDeactivate.run(id)
}

// ---- Shifts ----

export function findShiftById(id) {
  return stmtShiftById.get(id) ?? null
}

export function listShiftsByUser(userId) {
  return stmtShiftsByUser.all(userId)
}

export function listShiftsByDate(from, to) {
  return stmtShiftsByDate.all(from, to)
}

export function listActiveShifts(now = new Date()) {
  const iso = now.toISOString()
  return stmtActiveShifts.all(iso, iso)
}

export function createShift(data) {
  stmtInsertShift.run(data)
  return findShiftById(data.id)
}

export function updateShift(data) {
  stmtUpdateShift.run(data)
  return findShiftById(data.id)
}

export function deleteShift(id) {
  stmtDeleteShift.run(id)
}

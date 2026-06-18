import db from '../db.js'

const stmtAdd = db.prepare(`
  INSERT INTO waitlist (id, guest_name, guest_phone, party_size, notes)
  VALUES (@id, @guestName, @guestPhone, @partySize, @notes)
`)

const stmtList = db.prepare(`
  SELECT * FROM waitlist WHERE resolved_at IS NULL ORDER BY created_at
`)

const stmtResolve = db.prepare(`
  UPDATE waitlist SET resolved_at=datetime('now') WHERE id=?
`)

export function addToWaitlist(data) {
  stmtAdd.run(data)
  return data
}

export function listWaitlist() {
  return stmtList.all()
}

export function resolveWaitlist(id) {
  stmtResolve.run(id)
}

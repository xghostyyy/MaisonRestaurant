import db from '../db.js'

const stmtById = db.prepare(`
  SELECT v.*, t.label AS table_label, u.name AS waiter_name
  FROM visits v
  JOIN tables t ON v.table_id = t.id
  LEFT JOIN users u ON v.waiter_id = u.id
  WHERE v.id=?
`)
const stmtOpenByTable = db.prepare(
  `SELECT * FROM visits WHERE table_id=? AND status='OPEN' LIMIT 1`
)
const stmtOpenByWaiter = db.prepare(
  `SELECT v.*, t.label AS table_label
   FROM visits v JOIN tables t ON v.table_id = t.id
   WHERE v.waiter_id=? AND v.status='OPEN'
   ORDER BY v.seated_at`
)
const stmtTodayByWaiter = db.prepare(
  `SELECT v.*, t.label AS table_label
   FROM visits v JOIN tables t ON v.table_id = t.id
   WHERE v.waiter_id=? AND v.seated_at BETWEEN ? AND ?
   ORDER BY v.seated_at DESC`
)
const stmtAllOpen = db.prepare(
  `SELECT v.*, t.label AS table_label, u.name AS waiter_name
   FROM visits v
   JOIN tables t ON v.table_id = t.id
   LEFT JOIN users u ON v.waiter_id = u.id
   WHERE v.status='OPEN'
   ORDER BY v.seated_at`
)

const stmtInsert = db.prepare(`
  INSERT INTO visits (id, reservation_id, table_id, waiter_id, party_size, seated_at)
  VALUES (@id, @reservationId, @tableId, @waiterId, @partySize, @seatedAt)
`)
const stmtClose = db.prepare(`
  UPDATE visits SET status='CLOSED', closed_at=@closedAt, bill_cents=@billCents
  WHERE id=@id
`)
const stmtAssignWaiter = db.prepare(
  `UPDATE visits SET waiter_id=? WHERE id=?`
)

export function findVisitById(id) {
  return stmtById.get(id) ?? null
}

export function findOpenVisitByTable(tableId) {
  return stmtOpenByTable.get(tableId) ?? null
}

export function listOpenVisitsByWaiter(waiterId) {
  return stmtOpenByWaiter.all(waiterId)
}

export function listTodayVisitsByWaiter(waiterId, date) {
  const start = `${date}T00:00:00.000Z`
  const end = `${date}T23:59:59.999Z`
  return stmtTodayByWaiter.all(waiterId, start, end)
}

export function listAllOpenVisits() {
  return stmtAllOpen.all()
}

export const openVisit = db.transaction((data) => {
  stmtInsert.run(data)
  return findVisitById(data.id)
})

export function closeVisit(id, billCents) {
  stmtClose.run({
    id,
    closedAt: new Date().toISOString(),
    billCents,
  })
  return findVisitById(id)
}

export function assignWaiter(visitId, waiterId) {
  stmtAssignWaiter.run(waiterId, visitId)
}

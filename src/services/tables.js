import db from '../db.js'

const stmtAll = db.prepare(
  `SELECT * FROM tables WHERE is_active = 1 ORDER BY section, label`
)
const stmtById = db.prepare(`SELECT * FROM tables WHERE id = ?`)
const stmtAllIncludingInactive = db.prepare(`SELECT * FROM tables ORDER BY section, label`)

const stmtInsert = db.prepare(`
  INSERT INTO tables (id, label, seats, section, shape, x, y, width, height, rotation)
  VALUES (@id, @label, @seats, @section, @shape, @x, @y, @width, @height, @rotation)
`)

const stmtUpdate = db.prepare(`
  UPDATE tables
  SET label=@label, seats=@seats, section=@section, shape=@shape,
      x=@x, y=@y, width=@width, height=@height, rotation=@rotation, is_active=@isActive
  WHERE id=@id
`)

const stmtDelete = db.prepare(`UPDATE tables SET is_active=0 WHERE id=?`)

const stmtUpsertFloor = db.prepare(`
  INSERT INTO tables (id, label, seats, section, shape, x, y, width, height, rotation, is_active)
  VALUES (@id, @label, @seats, @section, @shape, @x, @y, @width, @height, @rotation, @isActive)
  ON CONFLICT(id) DO UPDATE SET
    label=excluded.label, seats=excluded.seats, section=excluded.section,
    shape=excluded.shape, x=excluded.x, y=excluded.y,
    width=excluded.width, height=excluded.height, rotation=excluded.rotation,
    is_active=excluded.is_active
`)

export function listActiveTables() {
  return stmtAll.all()
}

export function listAllTables() {
  return stmtAllIncludingInactive.all()
}

export function findTableById(id) {
  return stmtById.get(id) ?? null
}

export function createTable(data) {
  stmtInsert.run(data)
  return findTableById(data.id)
}

export function updateTable(data) {
  stmtUpdate.run(data)
  return findTableById(data.id)
}

export function deactivateTable(id) {
  stmtDelete.run(id)
}

export const saveFloorLayout = db.transaction((tables) => {
  for (const t of tables) {
    stmtUpsertFloor.run({
      id: t.id,
      label: t.label,
      seats: t.seats,
      section: t.section ?? null,
      shape: t.shape,
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      rotation: t.rotation ?? 0,
      isActive: t.isActive ?? 1,
    })
  }
})

// Compute table state from live data (no stored state)
const stmtOpenVisit = db.prepare(
  `SELECT id FROM visits WHERE table_id=? AND status='OPEN' LIMIT 1`
)
const stmtRecentlyClosed = db.prepare(
  `SELECT closed_at FROM visits
   WHERE table_id=? AND status='CLOSED' AND closed_at >= ?
   ORDER BY closed_at DESC LIMIT 1`
)
const stmtUpcomingConfirmed = db.prepare(
  `SELECT id FROM reservations
   WHERE table_id=? AND status IN ('CONFIRMED')
   AND starts_at BETWEEN ? AND ?
   LIMIT 1`
)

export function getTableState(tableId, settings, now = new Date()) {
  const nowIso = now.toISOString()
  const { buffer_min } = settings

  const openVisit = stmtOpenVisit.get(tableId)
  if (openVisit) return 'OCCUPIED'

  const bufferCutoff = new Date(now.getTime() - buffer_min * 60 * 1000).toISOString()
  const recentClose = stmtRecentlyClosed.get(tableId, bufferCutoff)
  if (recentClose) return 'NEEDS_CLEANUP'

  const soonEnd = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
  const upcoming = stmtUpcomingConfirmed.get(tableId, nowIso, soonEnd)
  if (upcoming) return 'RESERVED_SOON'

  return 'FREE'
}

export function getFloorWithStates(settings, now) {
  const tables = listActiveTables()
  return tables.map((t) => ({
    ...t,
    state: getTableState(t.id, settings, now),
  }))
}

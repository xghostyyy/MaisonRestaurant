import db from '../db.js'

// ---- Prepared statements ----

const stmtById = db.prepare(`SELECT * FROM reservations WHERE id=?`)
const stmtByToken = db.prepare(`SELECT * FROM reservations WHERE manage_token=?`)

const stmtInsert = db.prepare(`
  INSERT INTO reservations
    (id, manage_token, guest_name, guest_phone, guest_email,
     party_size, starts_at, ends_at, table_id, notes, status)
  VALUES
    (@id, @manageToken, @guestName, @guestPhone, @guestEmail,
     @partySize, @startsAt, @endsAt, @tableId, @notes, @status)
`)

const stmtUpdateStatus = db.prepare(`
  UPDATE reservations
  SET status=@status, staff_note=@staffNote, table_id=@tableId,
      updated_at=datetime('now')
  WHERE id=@id
`)

const stmtUpdateGuest = db.prepare(`
  UPDATE reservations
  SET guest_name=@guestName, guest_phone=@guestPhone, guest_email=@guestEmail,
      party_size=@partySize, starts_at=@startsAt, ends_at=@endsAt,
      status=@status, updated_at=datetime('now')
  WHERE id=@id
`)

const stmtListByDate = db.prepare(`
  SELECT r.*, t.label AS table_label, t.section AS table_section, t.seats AS table_seats
  FROM reservations r
  LEFT JOIN tables t ON r.table_id = t.id
  WHERE r.starts_at BETWEEN ? AND ?
  ORDER BY r.starts_at
`)

const stmtPending = db.prepare(`
  SELECT r.*, t.label AS table_label
  FROM reservations r
  LEFT JOIN tables t ON r.table_id = t.id
  WHERE r.status IN ('PENDING','CONFIRMED')
    AND r.starts_at BETWEEN ? AND ?
  ORDER BY r.starts_at
`)

// ---- Conflict check ----
const stmtConflict = db.prepare(`
  SELECT id FROM reservations
  WHERE table_id=@tableId
    AND status IN ('PENDING','CONFIRMED','SEATED')
    AND starts_at < @windowEnd
    AND ends_at   > @windowStart
    AND id != @excludeId
  LIMIT 1
`)

function hasConflict(tableId, startsAt, endsAt, bufferMin, excludeId = '') {
  const windowEnd = new Date(
    new Date(endsAt).getTime() + bufferMin * 60 * 1000
  ).toISOString()
  return !!stmtConflict.get({ tableId, windowEnd, windowStart: startsAt, excludeId })
}

// ---- getAvailableSlots (core algorithm) ----

export function getAvailableSlots(
  { date, partySize, settings, tables },
  nowOverride = null
) {
  const now = nowOverride ?? new Date()
  const {
    open_hours_json,
    slot_granularity_min,
    dining_minutes,
    buffer_min,
    min_lead_hours,
    max_advance_days,
  } = settings

  const hours = JSON.parse(open_hours_json)

  // Parse date in local midnight
  const [year, month, day] = date.split('-').map(Number)
  const dayOfWeek = new Date(year, month - 1, day).getDay()
  const intervals = hours[String(dayOfWeek)] ?? []
  if (intervals.length === 0) return []

  const minLeadMs = min_lead_hours * 60 * 60 * 1000
  const maxAdvanceMs = max_advance_days * 24 * 60 * 60 * 1000
  const diningMs = dining_minutes * 60 * 1000

  // Eligible tables
  if (!partySize || partySize <= 0) return []

  const eligible = tables.filter(
    (t) => t.is_active && t.seats >= partySize && t.seats <= partySize + 2
  )
  if (eligible.length === 0) return []

  const slots = []

  for (const { open, close } of intervals) {
    const [oh, om] = open.split(':').map(Number)
    const [ch, cm] = close.split(':').map(Number)

    // Handle midnight rollover (e.g. close = "00:00" means next day 00:00)
    const openMs = (oh * 60 + om) * 60 * 1000
    let closeMs = (ch * 60 + cm) * 60 * 1000
    if (closeMs === 0) closeMs = 24 * 60 * 60 * 1000
    if (closeMs <= openMs) closeMs += 24 * 60 * 60 * 1000

    // Last start = close - dining_minutes
    const lastStartMs = closeMs - diningMs

    let cursor = openMs
    while (cursor <= lastStartMs) {
      const slotH = Math.floor(cursor / 3600000)
      const slotM = Math.floor((cursor % 3600000) / 60000)

      const slotStart = new Date(year, month - 1, day, slotH, slotM)
      const slotEnd = new Date(slotStart.getTime() + diningMs)

      // lead time check
      if (slotStart.getTime() - now.getTime() < minLeadMs) {
        cursor += slot_granularity_min * 60 * 1000
        continue
      }
      // max advance check
      if (slotStart.getTime() - now.getTime() > maxAdvanceMs) {
        cursor += slot_granularity_min * 60 * 1000
        continue
      }

      const startsAt = slotStart.toISOString()
      const endsAt = slotEnd.toISOString()

      const available = eligible.filter(
        (t) => !hasConflict(t.id, startsAt, endsAt, buffer_min)
      )

      if (available.length > 0) {
        const time = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`
        // Sort by seats ascending (pick tightest fit first)
        available.sort((a, b) => a.seats - b.seats)
        slots.push({ time, tables: available, startsAt, endsAt })
      }

      cursor += slot_granularity_min * 60 * 1000
    }
  }

  return slots
}

// ---- CRUD ----

export function findReservationById(id) {
  return stmtById.get(id) ?? null
}

export function findReservationByToken(token) {
  return stmtByToken.get(token) ?? null
}

export function listReservationsForDay(date) {
  const start = `${date}T00:00:00`
  const end = `${date}T23:59:59`
  return stmtListByDate.all(start, end)
}

export function listPendingAndConfirmed(fromIso, toIso) {
  return stmtPending.all(fromIso, toIso)
}

export const createReservation = db.transaction((data, settings) => {
  // Re-check availability inside transaction
  if (
    data.tableId &&
    hasConflict(data.tableId, data.startsAt, data.endsAt, settings.buffer_min)
  ) {
    throw Object.assign(new Error('SLOT_CONFLICT'), { status: 409 })
  }
  stmtInsert.run(data)
  return findReservationById(data.id)
})

export function updateReservationStatus(id, status, staffNote = null, tableId = undefined) {
  const res = findReservationById(id)
  if (!res) throw Object.assign(new Error('NOT_FOUND'), { status: 404 })
  stmtUpdateStatus.run({
    id,
    status,
    staffNote: staffNote ?? res.staff_note,
    tableId: tableId !== undefined ? tableId : res.table_id,
  })
  return findReservationById(id)
}

export const editReservationGuest = db.transaction((id, data, settings) => {
  const res = findReservationById(id)
  if (!res) throw Object.assign(new Error('NOT_FOUND'), { status: 404 })

  if (
    data.tableId &&
    hasConflict(data.tableId, data.startsAt, data.endsAt, settings.buffer_min, id)
  ) {
    throw Object.assign(new Error('SLOT_CONFLICT'), { status: 409 })
  }

  stmtUpdateGuest.run({
    id,
    guestName: data.guestName,
    guestPhone: data.guestPhone,
    guestEmail: data.guestEmail ?? res.guest_email,
    partySize: data.partySize,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    status: data.status ?? 'PENDING',
  })
  return findReservationById(id)
})

// Valid status transitions
const TRANSITIONS = {
  PENDING:   ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['SEATED', 'CANCELLED', 'NO_SHOW', 'PENDING'],
  SEATED:    ['COMPLETED', 'NO_SHOW'],
  COMPLETED: [],
  REJECTED:  [],
  CANCELLED: [],
  NO_SHOW:   [],
}

export function validateTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to)
}

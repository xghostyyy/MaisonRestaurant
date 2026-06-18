import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationSQL = readFileSync(join(__dirname, '../db/migrations/001_init.sql'), 'utf8')

// We test getAvailableSlots as a pure function over a test DB
let db
const { getAvailableSlots } = await import('../src/services/reservations.js')

// Build isolated in-memory DB for tests
function buildTestDb() {
  const testDb = new Database(':memory:')
  testDb.pragma('foreign_keys = ON')
  testDb.exec(migrationSQL)
  return testDb
}

const DEFAULT_SETTINGS = {
  open_hours_json: JSON.stringify({
    0: [], 1: [{ open: '12:00', close: '23:00' }],
    2: [{ open: '12:00', close: '23:00' }],
    3: [{ open: '12:00', close: '23:00' }],
    4: [{ open: '12:00', close: '23:00' }],
    5: [{ open: '12:00', close: '23:00' }],
    6: [{ open: '11:00', close: '00:00' }],
  }),
  slot_granularity_min: 30,
  dining_minutes: 90,
  buffer_min: 15,
  min_lead_hours: 2,
  max_advance_days: 60,
}

// Use a fixed Monday in the future
const FUTURE_MONDAY = '2026-08-03' // Known Monday

function makeNow(hoursBeforeSlot, slotHour = 12) {
  const slot = new Date(`${FUTURE_MONDAY}T${String(slotHour).padStart(2,'0')}:00:00Z`)
  return new Date(slot.getTime() - hoursBeforeSlot * 60 * 60 * 1000)
}

describe('getAvailableSlots', () => {
  let tables

  before(() => {
    // We use the shared db (from src/db.js) but we need to add test tables
    // Actually we pass tables directly, so we just need a compatible structure
    tables = [
      { id: 't1', label: '1', seats: 2, section: 'main', is_active: 1 },
      { id: 't2', label: '2', seats: 4, section: 'main', is_active: 1 },
      { id: 't3', label: '3', seats: 6, section: 'main', is_active: 1 },
      { id: 't4', label: '4', seats: 8, section: 'bar',  is_active: 0 }, // inactive
    ]
  })

  test('happy path — free table returns slot', () => {
    // 10 hours before first slot = plenty of lead time
    const now = makeNow(10)
    const slots = getAvailableSlots(
      { date: FUTURE_MONDAY, partySize: 2, settings: DEFAULT_SETTINGS, tables },
      now
    )
    assert.ok(slots.length > 0, 'Should return at least one slot')
    assert.ok(slots[0].time, 'Slot should have time')
    assert.ok(slots[0].tables.length > 0, 'Slot should have tables')
    // smallest fitting table should be first (seats=2 for partySize=2)
    assert.equal(slots[0].tables[0].seats, 2)
  })

  test('inactive table is not returned', () => {
    const now = makeNow(10)
    const slots = getAvailableSlots(
      { date: FUTURE_MONDAY, partySize: 7, settings: DEFAULT_SETTINGS, tables },
      now
    )
    // partySize=7 fits seats=8 (within +2), but t4 is inactive → no slot
    assert.equal(slots.length, 0)
  })

  test('party too small ratio — seats > partySize + 2 excluded', () => {
    const now = makeNow(10)
    // partySize=2, only 6-seat table available → seats=6 > 2+2=4, not eligible
    const narrowTables = [{ id: 'big', label: 'B', seats: 6, section: 'main', is_active: 1 }]
    const slots = getAvailableSlots(
      { date: FUTURE_MONDAY, partySize: 2, settings: DEFAULT_SETTINGS, tables: narrowTables },
      now
    )
    assert.equal(slots.length, 0)
  })

  test('lead time — slot too soon is excluded', () => {
    // now is 1 hour before 12:00, but min_lead_hours=2 → 12:00 slot excluded
    const now = makeNow(1, 12)
    const slots = getAvailableSlots(
      { date: FUTURE_MONDAY, partySize: 2, settings: DEFAULT_SETTINGS, tables },
      now
    )
    // First slot at 12:00 should be excluded
    if (slots.length > 0) {
      assert.notEqual(slots[0].time, '12:00', 'Slot within lead time should be excluded')
    }
  })

  test('max advance — date too far in future is excluded', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const farDate = '2026-06-01'
    const slots = getAvailableSlots(
      { date: farDate, partySize: 2, settings: DEFAULT_SETTINGS, tables },
      now
    )
    assert.equal(slots.length, 0, 'Date beyond max_advance_days should return no slots')
  })

  test('Sunday (day 0) with no hours returns empty', () => {
    const now = makeNow(10)
    const slots = getAvailableSlots(
      { date: '2026-08-02', partySize: 2, settings: DEFAULT_SETTINGS, tables }, // Sunday
      now
    )
    assert.equal(slots.length, 0)
  })

  test('last valid slot ends at closing time', () => {
    const now = makeNow(12)
    const slots = getAvailableSlots(
      { date: FUTURE_MONDAY, partySize: 2, settings: DEFAULT_SETTINGS, tables },
      now
    )
    // Last slot should be at 21:30 (23:00 - 90min = 21:30)
    const times = slots.map(s => s.time)
    assert.ok(times.includes('21:30'), `Expected 21:30 slot, got: ${times.join(', ')}`)
    assert.ok(!times.includes('22:00'), 'Slot at 22:00 would overlap closing')
  })

  test('party size 0 or negative returns no slots', () => {
    const now = makeNow(10)
    const slots = getAvailableSlots(
      { date: FUTURE_MONDAY, partySize: 0, settings: DEFAULT_SETTINGS, tables },
      now
    )
    assert.equal(slots.length, 0)
  })
})

const { validateTransition } = await import('../src/services/reservations.js')

describe('validateTransition', () => {

  test('PENDING → CONFIRMED is valid', () => {
    assert.ok(validateTransition('PENDING', 'CONFIRMED'))
  })
  test('PENDING → CANCELLED is valid', () => {
    assert.ok(validateTransition('PENDING', 'CANCELLED'))
  })
  test('COMPLETED → CANCELLED is invalid', () => {
    assert.ok(!validateTransition('COMPLETED', 'CANCELLED'))
  })
  test('REJECTED → CONFIRMED is invalid', () => {
    assert.ok(!validateTransition('REJECTED', 'CONFIRMED'))
  })
  test('SEATED → COMPLETED is valid', () => {
    assert.ok(validateTransition('SEATED', 'COMPLETED'))
  })
})

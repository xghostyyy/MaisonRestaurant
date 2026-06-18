import db from '../db.js'

const stmtInsert = db.prepare(`
  INSERT INTO tips (id, amount_cents, method, visit_id, recipient_id, pool_id, shift_date, note)
  VALUES (@id, @amountCents, @method, @visitId, @recipientId, @poolId, @shiftDate, @note)
`)

const stmtById = db.prepare(`SELECT * FROM tips WHERE id=?`)

const stmtByRecipient = db.prepare(`
  SELECT * FROM tips WHERE recipient_id=? AND shift_date BETWEEN ? AND ?
  ORDER BY created_at DESC
`)

const stmtSumByRecipient = db.prepare(`
  SELECT COALESCE(SUM(amount_cents), 0) AS total
  FROM tips WHERE recipient_id=? AND shift_date BETWEEN ? AND ?
`)

const stmtByVisit = db.prepare(`SELECT * FROM tips WHERE visit_id=?`)

// --- Tip pools ---

const stmtPoolByDate = db.prepare(`SELECT * FROM tip_pools WHERE shift_date=?`)
const stmtPoolById = db.prepare(`SELECT * FROM tip_pools WHERE id=?`)

const stmtInsertPool = db.prepare(`
  INSERT INTO tip_pools (id, shift_date, total_cents)
  VALUES (@id, @shiftDate, @totalCents)
`)
const stmtAddToPool = db.prepare(`
  UPDATE tip_pools SET total_cents = total_cents + ? WHERE shift_date = ?
`)
const stmtMarkDistributed = db.prepare(`
  UPDATE tip_pools SET distributed_at=? WHERE id=?
`)

// ---- Direct tip (DIRECT mode) ----

export function recordTip(data) {
  stmtInsert.run(data)
  return stmtById.get(data.id)
}

export function listTipsByRecipient(recipientId, fromDate, toDate) {
  return stmtByRecipient.all(recipientId, fromDate, toDate)
}

export function sumTipsByRecipient(recipientId, fromDate, toDate) {
  return stmtSumByRecipient.get(recipientId, fromDate, toDate)?.total ?? 0
}

export function listTipsByVisit(visitId) {
  return stmtByVisit.all(visitId)
}

// ---- Tip pool (POOL mode) ----

export function findOrCreatePool(id, shiftDate) {
  let pool = stmtPoolByDate.get(shiftDate)
  if (!pool) {
    stmtInsertPool.run({ id, shiftDate, totalCents: 0 })
    pool = stmtPoolByDate.get(shiftDate)
  }
  return pool
}

export function addToPool(shiftDate, amountCents) {
  stmtAddToPool.run(amountCents, shiftDate)
  return stmtPoolByDate.get(shiftDate)
}

export const distributePool = db.transaction((poolId, recipients, newTipIds) => {
  const pool = stmtPoolById.get(poolId)
  if (!pool) throw Object.assign(new Error('NOT_FOUND'), { status: 404 })
  if (pool.distributed_at) throw Object.assign(new Error('ALREADY_DISTRIBUTED'), { status: 409 })

  for (let i = 0; i < recipients.length; i++) {
    const { userId, amountCents } = recipients[i]
    stmtInsert.run({
      id: newTipIds[i],
      amountCents,
      method: 'TRANSFER',
      visitId: null,
      recipientId: userId,
      poolId,
      shiftDate: pool.shift_date,
      note: `Распределено из пула ${pool.shift_date}`,
    })
  }

  stmtMarkDistributed.run(new Date().toISOString(), poolId)
  return stmtPoolById.get(poolId)
})

// ---- Reports ----

const stmtReport = db.prepare(`
  SELECT t.*, u.name AS recipient_name, u.role AS recipient_role
  FROM tips t
  LEFT JOIN users u ON t.recipient_id = u.id
  WHERE t.shift_date BETWEEN ? AND ?
  ORDER BY t.shift_date DESC, t.created_at DESC
`)

export function getTipsReport(fromDate, toDate) {
  return stmtReport.all(fromDate, toDate)
}

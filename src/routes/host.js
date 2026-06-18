import { requireAuth, requireRole } from '../auth.js'
import { listActiveTables, getFloorWithStates } from '../services/tables.js'
import { listReservationsForDay, listPendingAndConfirmed, updateReservationStatus, validateTransition } from '../services/reservations.js'
import { openVisit, findOpenVisitByTable } from '../services/visits.js'
import { getSettings } from '../services/settings.js'
import { publish } from '../services/events.js'
import { randomBytes } from 'crypto'

function cuid() { return 'c' + randomBytes(8).toString('hex') }

export default async function hostRoutes(app) {
  const authHook = requireAuth(app)
  const roleHook = requireRole('HOST')

  // GET /host
  app.get('/host', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const settings = getSettings()
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const tables = getFloorWithStates(settings, now)
    const reservations = listReservationsForDay(todayStr)
    const pending = reservations.filter(r => r.status === 'PENDING')
    const confirmed = reservations.filter(r => r.status === 'CONFIRMED')

    return reply.view('pages/host/index', {
      title: 'План зала — Maison',
      pageTitle: 'План зала',
      user: req.user,
      activeSection: 'host',
      tables,
      reservations,
      pending,
      confirmed,
      todayStr,
      pageJS: 'floor-map',
    }, { layout: 'layout-staff' })
  })

  // POST /host/reservations/:id/confirm
  app.post('/host/reservations/:id/confirm', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const updated = updateReservationStatus(req.params.id, 'CONFIRMED')
    publish('reservation.updated', { id: updated.id, status: 'CONFIRMED', tableId: updated.table_id })
    return reply.redirect('/host')
  })

  // POST /host/reservations/:id/reject
  app.post('/host/reservations/:id/reject', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const reason = req.body?.reason || null
    const updated = updateReservationStatus(req.params.id, 'REJECTED', reason)
    publish('reservation.updated', { id: updated.id, status: 'REJECTED' })
    return reply.redirect('/host')
  })

  // POST /host/reservations/:id/seat — посадить гостей (создать визит)
  app.post('/host/reservations/:id/seat', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const settings = getSettings()
    const tables = listActiveTables()

    // Find reservation
    const { findReservationById } = await import('../services/reservations.js')
    const res = findReservationById(req.params.id)
    if (!res) return reply.status(404).view('pages/404', { title: 'Не найдено' })

    const tableId = req.body?.tableId || res.table_id
    if (!tableId) return reply.redirect('/host?error=notable')

    // Check no open visit on table
    const existing = findOpenVisitByTable(tableId)
    if (existing) return reply.redirect('/host?error=occupied')

    const visit = openVisit({
      id: cuid(),
      reservationId: res.id,
      tableId,
      waiterId: null,
      partySize: res.party_size,
      seatedAt: new Date().toISOString(),
    })

    updateReservationStatus(res.id, 'SEATED', null, tableId)
    publish('visit.seated', { id: visit.id, tableId, partySize: res.party_size })
    return reply.redirect('/host')
  })

  // POST /host/walkins — walk-in guest
  app.post('/host/walkins', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const tableId = req.body?.tableId
    const partySize = parseInt(req.body?.partySize || 2)
    if (!tableId) return reply.redirect('/host?error=notable')

    const existing = findOpenVisitByTable(tableId)
    if (existing) return reply.redirect('/host?error=occupied')

    const visit = openVisit({
      id: cuid(),
      reservationId: null,
      tableId,
      waiterId: null,
      partySize,
      seatedAt: new Date().toISOString(),
    })

    publish('visit.seated', { id: visit.id, tableId, partySize })
    return reply.redirect('/host')
  })
}

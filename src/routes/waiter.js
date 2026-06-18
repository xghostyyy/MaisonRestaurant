import { requireAuth, requireRole } from '../auth.js'
import { listOpenVisitsByWaiter, listTodayVisitsByWaiter, listAllOpenVisits, closeVisit, findVisitById, assignWaiter } from '../services/visits.js'
import { listShiftsByUser } from '../services/staff.js'
import { sumTipsByRecipient, listTipsByRecipient, recordTip } from '../services/tips.js'
import { publish } from '../services/events.js'
import { randomBytes } from 'crypto'

function cuid() { return 'c' + randomBytes(8).toString('hex') }

export default async function waiterRoutes(app) {
  const authHook = requireAuth(app)
  const roleHook = requireRole('WAITER')

  // GET /waiter
  app.get('/waiter', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const openVisits = listOpenVisitsByWaiter(req.user.id)
    const allOpen = listAllOpenVisits()
    const unassigned = allOpen.filter(v => !v.waiter_id)
    const todayVisits = listTodayVisitsByWaiter(req.user.id, todayStr)

    return reply.view('pages/waiter/index', {
      title: 'Мои столы — Maison',
      pageTitle: 'Мои столы',
      user: req.user,
      activeSection: 'waiter',
      openVisits,
      unassigned,
      todayVisits,
      todayStr,
    }, { layout: 'layout-staff' })
  })

  // POST /waiter/visits/:id/open — claim unassigned visit
  app.post('/waiter/visits/:id/open', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const visit = findVisitById(req.params.id)
    if (!visit) return reply.status(404).view('pages/404', { title: 'Не найдено' })
    if (visit.waiter_id && visit.waiter_id !== req.user.id) {
      return reply.status(409).redirect('/waiter?error=claimed')
    }
    assignWaiter(visit.id, req.user.id)
    return reply.redirect('/waiter')
  })

  // POST /waiter/visits/:id/close
  app.post('/waiter/visits/:id/close', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const visit = findVisitById(req.params.id)
    if (!visit || visit.waiter_id !== req.user.id) {
      return reply.status(403).view('pages/error', { title: 'Нет доступа', message: 'Нет доступа к этому визиту' })
    }

    const billCents = Math.round(parseFloat(req.body.billAmount || 0) * 100)
    const tipCents = Math.round(parseFloat(req.body.tipAmount || 0) * 100)
    const tipMethod = req.body.tipMethod || 'CASH'

    closeVisit(visit.id, billCents)
    publish('visit.closed', { id: visit.id, tableId: visit.table_id, closedAt: new Date().toISOString() })

    if (tipCents > 0) {
      const shiftDate = new Date().toISOString().slice(0, 10)
      recordTip({
        id: cuid(),
        amountCents: tipCents,
        method: tipMethod,
        visitId: visit.id,
        recipientId: req.user.id,
        poolId: null,
        shiftDate,
        note: null,
      })
    }

    return reply.redirect('/waiter')
  })

  // GET /waiter/tips
  app.get('/waiter/tips', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const today = new Date().toISOString().slice(0, 10)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekStartStr = weekStart.toISOString().slice(0, 10)
    const monthStart = today.slice(0, 8) + '01'

    const todayTips = listTipsByRecipient(req.user.id, today, today)
    const todaySum = sumTipsByRecipient(req.user.id, today, today)
    const weekSum = sumTipsByRecipient(req.user.id, weekStartStr, today)
    const monthSum = sumTipsByRecipient(req.user.id, monthStart, today)

    return reply.view('pages/waiter/tips', {
      title: 'Мои чаевые — Maison',
      pageTitle: 'Мои чаевые',
      user: req.user,
      activeSection: 'tips',
      todayTips,
      todaySum,
      weekSum,
      monthSum,
    }, { layout: 'layout-staff' })
  })

  // GET /waiter/shifts
  app.get('/waiter/shifts', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const shifts = listShiftsByUser(req.user.id)
    return reply.view('pages/waiter/shifts', {
      title: 'Мои смены — Maison',
      pageTitle: 'Мои смены',
      user: req.user,
      activeSection: 'shifts',
      shifts,
    }, { layout: 'layout-staff' })
  })
}

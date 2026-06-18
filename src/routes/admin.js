import { z } from 'zod'
import { requireAuth, requireRole } from '../auth.js'
import { listAllStaff, createUser, updateUser, deactivateUser, listShiftsByDate, createShift, deleteShift, findUserById, hasShiftOverlap, resetPassword } from '../services/staff.js'
import { updatePassword } from '../services/staff.js'
import { getSettings, updateSettings } from '../services/settings.js'
import { listActiveTables, listAllTables, saveFloorLayout } from '../services/tables.js'
import { getTipsReport, findOrCreatePool, distributePool } from '../services/tips.js'
import { hashPassword } from '../auth.js'
import { randomBytes } from 'crypto'

const TableSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(20),
  seats: z.coerce.number().int().min(1).max(30),
  section: z.string().nullable().optional(),
  shape: z.enum(['round', 'square', 'rect']),
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  width: z.coerce.number().min(1).max(50),
  height: z.coerce.number().min(1).max(50),
  rotation: z.coerce.number().optional().default(0),
  isActive: z.coerce.number().optional().default(1),
})
const FloorSchema = z.array(TableSchema).max(100)

function cuid() { return 'c' + randomBytes(8).toString('hex') }

export default async function adminRoutes(app) {
  const authHook = requireAuth(app)
  const roleHook = requireRole('ADMIN')

  // GET /admin
  app.get('/admin', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    return reply.view('pages/admin/index', {
      title: 'Дашборд — Maison',
      pageTitle: 'Дашборд',
      user: req.user,
      activeSection: 'admin',
    }, { layout: 'layout-staff' })
  })

  // ---- Staff CRUD ----

  app.get('/admin/staff', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const staff = listAllStaff()
    const flash = req.session.staffFlash || null
    delete req.session.staffFlash
    return reply.view('pages/admin/staff', {
      title: 'Персонал — Maison',
      pageTitle: 'Персонал',
      user: req.user,
      activeSection: 'staff',
      staff,
      flash,
    }, { layout: 'layout-staff' })
  })

  app.post('/admin/staff', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const { name, email, role, phone } = req.body
    const tempPassword = randomBytes(8).toString('hex')
    const passwordHash = await hashPassword(tempPassword)
    createUser({ id: cuid(), role, name, email, passwordHash, phone: phone || null, mustChangePassword: 1 })
    req.session.staffFlash = `Сотрудник ${name} создан. Временный пароль: ${tempPassword}`
    return reply.redirect('/admin/staff')
  })

  app.post('/admin/staff/:id', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const { name, email, role, phone, isActive } = req.body
    updateUser({ id: req.params.id, name, email, role, phone: phone || null, isActive: isActive ? 1 : 0 })
    return reply.redirect('/admin/staff')
  })

  app.post('/admin/staff/:id/deactivate', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    deactivateUser(req.params.id)
    return reply.redirect('/admin/staff')
  })

  app.post('/admin/staff/:id/reset-password', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const tempPassword = randomBytes(8).toString('hex')
    const passwordHash = await hashPassword(tempPassword)
    resetPassword(req.params.id, passwordHash)
    const user = findUserById(req.params.id)
    req.session.staffFlash = `Пароль сотрудника ${user?.name || req.params.id} сброшен. Новый пароль: ${tempPassword}`
    return reply.redirect('/admin/staff')
  })

  // ---- Shifts ----

  app.get('/admin/shifts', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const weekStart = req.query.week || new Date().toISOString().slice(0, 10)
    const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString().slice(0, 10)
    const shifts = listShiftsByDate(`${weekStart}T00:00:00`, `${weekEnd}T23:59:59`)
    const staff = listAllStaff()
    return reply.view('pages/admin/shifts', {
      title: 'Расписание — Maison',
      pageTitle: 'Расписание смен',
      user: req.user,
      activeSection: 'admin-shifts',
      shifts, staff, weekStart,
    }, { layout: 'layout-staff' })
  })

  app.post('/admin/shifts', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const { userId, startsAt, endsAt, role, notes } = req.body
    if (!userId || !startsAt || !endsAt) return reply.redirect('/admin/shifts?error=missing')
    if (new Date(startsAt) >= new Date(endsAt)) return reply.redirect('/admin/shifts?error=order')

    if (hasShiftOverlap(userId, startsAt, endsAt)) {
      const weekStart = req.query.week || new Date().toISOString().slice(0, 10)
      const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString().slice(0, 10)
      const shifts = listShiftsByDate(`${weekStart}T00:00:00`, `${weekEnd}T23:59:59`)
      const staff = listAllStaff()
      return reply.status(409).view('pages/admin/shifts', {
        title: 'Расписание — Maison',
        pageTitle: 'Расписание смен',
        user: req.user,
        activeSection: 'admin-shifts',
        shifts, staff, weekStart,
        error: 'У этого сотрудника уже есть пересекающаяся смена в это время',
      }, { layout: 'layout-staff' })
    }

    createShift({ id: cuid(), userId, startsAt, endsAt, role, notes: notes || null })
    return reply.redirect('/admin/shifts')
  })

  app.post('/admin/shifts/:id/delete', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    deleteShift(req.params.id)
    return reply.redirect('/admin/shifts')
  })

  // ---- Floor plan ----

  app.get('/admin/floor', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const tables = listAllTables()
    return reply.view('pages/admin/floor', {
      title: 'Редактор зала — Maison',
      pageTitle: 'Редактор плана зала',
      user: req.user,
      activeSection: 'floor',
      tables,
      tablesJson: JSON.stringify(tables),
      pageJS: 'floor-editor',
      pageCSS: 'floor',
    }, { layout: 'layout-staff' })
  })

  app.post('/admin/floor', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    let raw
    try {
      raw = JSON.parse(req.body.tablesJson || '[]')
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON' })
    }
    const parsed = FloorSchema.safeParse(raw)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', issues: parsed.error.issues })
    }
    saveFloorLayout(parsed.data)
    return reply.send({ ok: true })
  })

  // ---- Reports ----

  app.get('/admin/reports', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const today = new Date().toISOString().slice(0, 10)
    const fromDate = req.query.from || today.slice(0, 8) + '01'
    const toDate = req.query.to || today
    const tips = getTipsReport(fromDate, toDate)

    return reply.view('pages/admin/reports', {
      title: 'Отчёты — Maison',
      pageTitle: 'Отчёты',
      user: req.user,
      activeSection: 'reports',
      tips, fromDate, toDate,
    }, { layout: 'layout-staff' })
  })

  // ---- Settings ----

  app.get('/admin/settings', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const settings = getSettings()
    return reply.view('pages/admin/settings', {
      title: 'Настройки — Maison',
      pageTitle: 'Настройки ресторана',
      user: req.user,
      activeSection: 'settings',
      settings,
    }, { layout: 'layout-staff' })
  })

  app.post('/admin/settings', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const b = req.body
    updateSettings({
      timezone: b.timezone || 'Europe/Moscow',
      openHoursJson: b.openHoursJson || getSettings().open_hours_json,
      slotGranularityMin: parseInt(b.slotGranularityMin) || 15,
      diningMinutes: parseInt(b.diningMinutes) || 90,
      bufferMin: parseInt(b.bufferMin) || 15,
      minLeadHours: parseInt(b.minLeadHours) || 2,
      maxAdvanceDays: parseInt(b.maxAdvanceDays) || 60,
      cancelCutoffHours: parseInt(b.cancelCutoffHours) || 4,
      tipModel: b.tipModel || 'DIRECT',
      tipPoolDefaultSplit: b.tipPoolDefaultSplit || getSettings().tip_pool_default_split,
    })
    return reply.redirect('/admin/settings?saved=1')
  })

  // ---- Tip pool distribution ----

  app.get('/admin/tips/pool', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const today = new Date().toISOString().slice(0, 10)
    const date = req.query.date || today
    const settings = getSettings()

    const pool = findOrCreatePool(cuid(), date)
    const dayShifts = listShiftsByDate(`${date}T00:00:00`, `${date}T23:59:59`)

    return reply.view('pages/admin/tips-pool', {
      title: 'Пул чаевых — Maison',
      pageTitle: 'Пул чаевых',
      user: req.user,
      activeSection: 'reports',
      pool,
      date,
      dayShifts,
      settings,
    }, { layout: 'layout-staff' })
  })

  app.post('/admin/tips/pool/:date/distribute', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const { date } = req.params
    const settings = getSettings()
    const pool = findOrCreatePool(cuid(), date)

    if (pool.distributed_at) return reply.redirect('/admin/tips/pool?date=' + date + '&error=already')
    if (!pool.total_cents || pool.total_cents === 0) return reply.redirect('/admin/tips/pool?date=' + date + '&error=empty')

    let split
    try { split = JSON.parse(settings.tip_pool_default_split) } catch { split = { WAITER: 70, HOST: 15, CHEF: 15 } }

    const dayShifts = listShiftsByDate(`${date}T00:00:00`, `${date}T23:59:59`)

    const recipients = []
    for (const [role, pct] of Object.entries(split)) {
      const roleCents = Math.floor(pool.total_cents * Number(pct) / 100)
      const roleShifts = dayShifts.filter(s => s.role === role)
      if (!roleShifts.length) continue

      const hours = roleShifts.map(s => ({
        userId: s.user_id,
        h: (new Date(s.ends_at) - new Date(s.starts_at)) / 3600000,
      }))
      const totalH = hours.reduce((sum, p) => sum + p.h, 0)
      let remaining = roleCents

      hours.forEach((p, i) => {
        const share = i === hours.length - 1
          ? remaining
          : Math.floor(roleCents * p.h / (totalH || 1))
        remaining -= share
        if (share > 0) recipients.push({ userId: p.userId, amountCents: share })
      })
    }

    const tipIds = recipients.map(() => cuid())
    distributePool(pool.id, recipients, tipIds)
    return reply.redirect('/admin/tips/pool?date=' + date + '&distributed=1')
  })
}

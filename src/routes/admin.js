import { z } from 'zod'
import { requireAuth, requireRole } from '../auth.js'
import { listAllStaff, createUser, updateUser, deactivateUser, listShiftsByDate, createShift, deleteShift, findUserById } from '../services/staff.js'
import { getSettings, updateSettings } from '../services/settings.js'
import { listActiveTables, listAllTables, saveFloorLayout } from '../services/tables.js'
import { getTipsReport } from '../services/tips.js'
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
    return reply.view('pages/admin/staff', {
      title: 'Персонал — Maison',
      pageTitle: 'Персонал',
      user: req.user,
      activeSection: 'staff',
      staff,
    }, { layout: 'layout-staff' })
  })

  app.post('/admin/staff', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const { name, email, role, phone } = req.body
    const tempPassword = randomBytes(8).toString('hex')
    const passwordHash = await hashPassword(tempPassword)
    createUser({ id: cuid(), role, name, email, passwordHash, phone: phone || null, mustChangePassword: 1 })
    return reply.redirect('/admin/staff?created=1')
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
}

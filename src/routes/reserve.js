import { randomBytes } from 'crypto'
import {
  getAvailableSlots,
  createReservation,
  findReservationByToken,
  editReservationGuest,
  updateReservationStatus,
} from '../services/reservations.js'
import { listActiveTables } from '../services/tables.js'
import { getSettings } from '../services/settings.js'
import { ReserveSchema, EditReservationSchema } from '../validators/reserve.js'
import { sendReservationConfirmation } from '../mail.js'

function cuid() {
  return 'c' + randomBytes(8).toString('hex')
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function reserveRoutes(app) {
  // GET /reserve — booking form
  app.get('/reserve', async (req, reply) => {
    const { date, partySize } = req.query
    const settings = getSettings()
    const tables = listActiveTables()
    let slots = []

    if (date && partySize) {
      slots = getAvailableSlots({ date, partySize: parseInt(partySize), settings, tables })
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const defaultDate = date || tomorrow.toISOString().slice(0, 10)

    return reply.view('pages/reserve', {
      title: 'Бронирование — Maison',
      pageCSS: 'reserve',
      pageJS: 'reservation',
      slots,
      values: req.query,
      defaultDate,
      settings,
    })
  })

  // POST /reserve — create reservation (rate-limited: 10/hour per IP)
  app.post('/reserve', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
        keyGenerator: (req) => `reserve:${req.ip}`,
      },
    },
  }, async (req, reply) => {
    const result = ReserveSchema.safeParse(req.body)
    if (!result.success) {
      const settings = getSettings()
      return reply.status(400).view('pages/reserve', {
        title: 'Бронирование — Maison',
        pageCSS: 'reserve',
        pageJS: 'reservation',
        errors: result.error.flatten().fieldErrors,
        values: req.body,
        slots: [],
        defaultDate: req.body.date || new Date().toISOString().slice(0, 10),
        settings,
      })
    }

    const { guestName, guestPhone, guestEmail, partySize, date, time, tableId, notes } =
      result.data
    const settings = getSettings()
    const tables = listActiveTables()

    const startsAt = new Date(`${date}T${time}:00`).toISOString()
    const endsAt = new Date(
      new Date(startsAt).getTime() + settings.dining_minutes * 60 * 1000
    ).toISOString()

    // Determine best table if not specified
    let chosenTableId = tableId
    if (!chosenTableId) {
      const slots = getAvailableSlots({ date, partySize, settings, tables })
      const slot = slots.find((s) => s.time === time)
      chosenTableId = slot?.tables[0]?.id ?? null
    }

    const reservationData = {
      id: cuid(),
      manageToken: randomBytes(24).toString('base64url'),
      guestName,
      guestPhone,
      guestEmail: guestEmail || null,
      partySize,
      startsAt,
      endsAt,
      tableId: chosenTableId,
      notes: notes || null,
      status: 'PENDING',
    }

    let reservation
    try {
      reservation = createReservation(reservationData, settings)
    } catch (err) {
      if (err.status === 409) {
        return reply.status(409).view('pages/reserve', {
          title: 'Бронирование — Maison',
          pageCSS: 'reserve',
          pageJS: 'reservation',
          flashError: 'Это время уже занято. Пожалуйста, выберите другое.',
          values: req.body,
          slots: getAvailableSlots({ date, partySize, settings, tables }),
          defaultDate: date,
          settings,
        })
      }
      throw err
    }

    // Send confirmation email if email provided
    if (guestEmail) {
      sendReservationConfirmation(reservation).catch((e) =>
        app.log.error({ err: e }, 'Failed to send confirmation email')
      )
    }

    return reply.redirect(`/reserve/${reservation.manage_token}?created=1`)
  })

  // GET /reserve/:token — manage reservation
  app.get('/reserve/:token', async (req, reply) => {
    const reservation = findReservationByToken(req.params.token)
    if (!reservation) return reply.status(404).view('pages/404', { title: 'Бронь не найдена' })

    return reply.view('pages/reserve-manage', {
      title: 'Управление бронью — Maison',
      pageCSS: 'reserve',
      reservation,
      created: req.query.created === '1',
      cancelled: req.query.cancelled === '1',
      edited: req.query.edited === '1',
      formatDate,
      formatTime,
    })
  })

  // POST /reserve/:token/cancel
  app.post('/reserve/:token/cancel', async (req, reply) => {
    const reservation = findReservationByToken(req.params.token)
    if (!reservation) return reply.status(404).view('pages/404', { title: 'Бронь не найдена' })

    const settings = getSettings()
    const cutoff = settings.cancel_cutoff_hours * 60 * 60 * 1000
    const timeLeft = new Date(reservation.starts_at).getTime() - Date.now()

    if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
      return reply.redirect(`/reserve/${req.params.token}?error=nocancel`)
    }
    if (timeLeft < cutoff) {
      return reply.redirect(`/reserve/${req.params.token}?error=toolate`)
    }

    updateReservationStatus(reservation.id, 'CANCELLED')
    return reply.redirect(`/reserve/${req.params.token}?cancelled=1`)
  })

  // POST /reserve/:token/edit
  app.post('/reserve/:token/edit', async (req, reply) => {
    const reservation = findReservationByToken(req.params.token)
    if (!reservation) return reply.status(404).view('pages/404', { title: 'Бронь не найдена' })

    if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
      return reply.redirect(`/reserve/${req.params.token}?error=noedit`)
    }

    const result = EditReservationSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(400).view('pages/reserve-manage', {
        title: 'Управление бронью — Maison',
        pageCSS: 'reserve',
        reservation,
        editErrors: result.error.flatten().fieldErrors,
        editValues: req.body,
        formatDate,
        formatTime,
      })
    }

    const settings = getSettings()
    const tables = listActiveTables()
    const { guestName, guestPhone, guestEmail, partySize, date, time, notes } = result.data
    const startsAt = new Date(`${date}T${time}:00`).toISOString()
    const endsAt = new Date(
      new Date(startsAt).getTime() + settings.dining_minutes * 60 * 1000
    ).toISOString()

    // Find new table
    const slots = getAvailableSlots({ date, partySize, settings, tables })
    const slot = slots.find((s) => s.time === time)
    const tableId = slot?.tables[0]?.id ?? reservation.table_id

    try {
      editReservationGuest(
        reservation.id,
        { guestName, guestPhone, guestEmail, partySize, startsAt, endsAt, tableId, status: 'PENDING', notes },
        settings
      )
    } catch (err) {
      if (err.status === 409) {
        return reply.status(409).view('pages/reserve-manage', {
          title: 'Управление бронью — Maison',
          pageCSS: 'reserve',
          reservation,
          editError: 'Это время уже занято. Пожалуйста, выберите другое.',
          formatDate,
          formatTime,
        })
      }
      throw err
    }

    return reply.redirect(`/reserve/${req.params.token}?edited=1`)
  })
}

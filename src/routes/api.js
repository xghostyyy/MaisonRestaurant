import { getAvailableSlots } from '../services/reservations.js'
import { listActiveTables, getFloorWithStates } from '../services/tables.js'
import { getSettings } from '../services/settings.js'
import { subscribe } from '../services/events.js'

export default async function apiRoutes(app) {
  // GET /api/availability?date=YYYY-MM-DD&partySize=N
  app.get('/api/availability', async (req, reply) => {
    const { date, partySize } = req.query
    if (!date || !partySize) {
      return reply.status(400).send({ error: 'date and partySize required' })
    }

    const settings = getSettings()
    const tables = listActiveTables()
    const slots = getAvailableSlots({
      date,
      partySize: parseInt(partySize),
      settings,
      tables,
    })

    return reply.send({ slots })
  })

  // GET /api/floor — current floor state (HOST/ADMIN)
  app.get('/api/floor', async (req, reply) => {
    if (!req.session?.user?.role || !['HOST', 'ADMIN'].includes(req.session.user.role)) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const settings = getSettings()
    const tables = getFloorWithStates(settings, new Date())
    return reply.send({ tables })
  })

  // GET /api/events — SSE stream for HOST/ADMIN
  app.get('/api/events', async (req, reply) => {
    // Session check — authenticated users only
    if (!req.session?.user?.role || !['HOST', 'ADMIN'].includes(req.session.user.role)) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    reply.raw.write('retry: 3000\n\n')

    const unsubscribe = subscribe(reply)

    const ping = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n')
      } catch {
        clearInterval(ping)
      }
    }, 25000)

    req.raw.on('close', () => {
      clearInterval(ping)
      unsubscribe()
    })

    return reply
  })
}

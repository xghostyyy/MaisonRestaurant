import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyFormbody from '@fastify/formbody'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyHelmet from '@fastify/helmet'
import fastifyView from '@fastify/view'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyMultipart from '@fastify/multipart'
import fastifyCsrf from '@fastify/csrf-protection'
import { Eta } from 'eta'
import { config } from './src/config.js'
import publicRoutes from './src/routes/public.js'
import reserveRoutes from './src/routes/reserve.js'
import apiRoutes from './src/routes/api.js'
import authRoutes from './src/routes/auth.js'
import waiterRoutes from './src/routes/waiter.js'
import hostRoutes from './src/routes/host.js'
import chefRoutes from './src/routes/chef.js'
import adminRoutes from './src/routes/admin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = Fastify({
  logger: {
    level: config.isProd ? 'info' : 'debug',
    transport: config.isProd
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
  },
})

// Security headers
await app.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
})

// Static files from /public → accessible at /
await app.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
  decorateReply: false,
})

// Rate limiting
await app.register(fastifyRateLimit, {
  global: false,
  max: 200,
  timeWindow: '1 minute',
})

// Form body parser
await app.register(fastifyFormbody)

// Multipart (for file uploads — chef menu photos)
await app.register(fastifyMultipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
})

// Cookies
await app.register(fastifyCookie)

// Sessions (memory store for now; replaced with SQLite store in phase 4)
await app.register(fastifySession, {
  secret: config.SESSION_SECRET,
  cookie: {
    secure: config.isProd,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
  saveUninitialized: false,
})

// CSRF protection (must be after session)
await app.register(fastifyCsrf, { sessionPlugin: '@fastify/session' })

// Eta template engine
const eta = new Eta({ views: join(__dirname, 'src/views'), cache: config.isProd })
await app.register(fastifyView, {
  engine: { eta },
  root: join(__dirname, 'src/views'),
  layout: 'layout',
  defaultContext: {
    year: new Date().getFullYear(),
  },
})

// Auto-inject csrfToken into all reply.view calls
app.addHook('preHandler', async (req, reply) => {
  const _view = reply.view.bind(reply)
  reply.view = async function (template, data = {}, opts) {
    let csrfToken = ''
    try { csrfToken = await reply.generateCsrf() } catch { /* skip if session not ready */ }
    return _view(template, { csrfToken, ...data }, opts)
  }
})

// Validate CSRF on all mutating requests except /api/* (JSON API)
app.addHook('preValidation', async (req, reply) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return
  if (req.url.startsWith('/api/')) return
  try {
    await req.csrfProtection()
  } catch {
    const status = reply.statusCode === 200 ? 403 : reply.statusCode
    return reply.status(status).view('pages/error', {
      title: 'Ошибка безопасности',
      message: 'Недействительный или отсутствующий CSRF-токен. Обновите страницу и попробуйте снова.',
    })
  }
})

// Routes
await app.register(publicRoutes)
await app.register(reserveRoutes)
await app.register(apiRoutes)
await app.register(authRoutes)
await app.register(waiterRoutes)
await app.register(hostRoutes)
await app.register(chefRoutes)
await app.register(adminRoutes)

// 404 handler
app.setNotFoundHandler(async (_req, reply) => {
  return reply.status(404).view('pages/404', { title: 'Страница не найдена' })
})

// Error handler
app.setErrorHandler(async (err, _req, reply) => {
  app.log.error(err)
  const status = err.status || err.statusCode || 500
  return reply.status(status).view('pages/error', {
    title: 'Ошибка',
    message: config.isProd ? 'Что-то пошло не так. Мы уже разбираемся.' : err.message,
  })
})

// Start
try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
  console.log(`\n  Maison запущен → http://localhost:${config.PORT}\n`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

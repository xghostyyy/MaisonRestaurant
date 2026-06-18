import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyFormbody from '@fastify/formbody'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyHelmet from '@fastify/helmet'
import fastifyView from '@fastify/view'
import { Eta } from 'eta'
import { config } from './src/config.js'
import publicRoutes from './src/routes/public.js'

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

// Form body parser
await app.register(fastifyFormbody)

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

// Routes
await app.register(publicRoutes)

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

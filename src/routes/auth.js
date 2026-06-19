import { authenticate, hashPassword } from '../auth.js'
import { updatePassword } from '../services/staff.js'

export default async function authRoutes(app) {
  // GET /login
  app.get('/login', async (req, reply) => {
    if (req.session?.user) {
      return reply.redirect(roleHome(req.session.user.role))
    }
    return reply.view('pages/login', {
      title: 'Вход — Maison',
      pageCSS: 'login',
    })
  })

  // POST /login
  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
          keyGenerator: (req) => `login:${req.ip}:${(req.body?.email || '').toLowerCase()}`,
          errorResponseBuilder: (_req, context) => ({
            error: `Слишком много попыток входа. Попробуйте через ${Math.ceil(context.ttl / 60000)} мин.`,
          }),
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body || {}
      if (!email || !password) {
        return reply.status(400).view('pages/login', {
          title: 'Вход — Maison',
          pageCSS: 'login',
          error: 'Введите email и пароль',
          values: { email },
        })
      }

      const user = await authenticate(email.trim().toLowerCase(), password)
      if (!user) {
        return reply.status(401).view('pages/login', {
          title: 'Вход — Maison',
          pageCSS: 'login',
          error: 'Неверный email или пароль',
          values: { email },
        })
      }

      // Rotate session ID on login
      await req.session.regenerate()
      req.session.user = {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        mustChangePassword: user.must_change_password === 1,
      }

      if (user.must_change_password) {
        return reply.redirect('/change-password')
      }

      const returnTo = req.session.returnTo || roleHome(user.role)
      delete req.session.returnTo
      return reply.redirect(returnTo)
    }
  )

  // POST /logout
  app.post('/logout', async (req, reply) => {
    await req.session.destroy()
    return reply.redirect('/login')
  })

  // GET /change-password
  app.get('/change-password', async (req, reply) => {
    if (!req.session?.user) return reply.redirect('/login')
    return reply.view('pages/change-password', {
      title: 'Смена пароля — Maison',
      pageCSS: 'login',
    })
  })

  // POST /change-password
  app.post('/change-password', async (req, reply) => {
    if (!req.session?.user) return reply.redirect('/login')
    const { password, passwordConfirm } = req.body || {}

    if (!password || password.length < 10) {
      return reply.status(400).view('pages/change-password', {
        title: 'Смена пароля — Maison',
        pageCSS: 'login',
        error: 'Пароль должен быть не короче 10 символов',
      })
    }
    if (password !== passwordConfirm) {
      return reply.status(400).view('pages/change-password', {
        title: 'Смена пароля — Maison',
        pageCSS: 'login',
        error: 'Пароли не совпадают',
      })
    }

    const newHash = await hashPassword(password)
    updatePassword(req.session.user.id, newHash)
    req.session.user.mustChangePassword = false
    return reply.redirect(roleHome(req.session.user.role))
  })
}

function roleHome(role) {
  const homes = {
    ADMIN: '/admin',
    HOST: '/host',
    WAITER: '/waiter',
    CHEF: '/chef',
  }
  return homes[role] || '/'
}

import { hash, verify } from '@node-rs/argon2'
import { findUserByEmail, findUserById } from './services/staff.js'

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
}

export async function hashPassword(password) {
  return hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(password, storedHash) {
  try {
    return await verify(storedHash, password, ARGON2_OPTIONS)
  } catch {
    return false
  }
}

export async function authenticate(email, password) {
  const user = findUserByEmail(email)
  if (!user || !user.is_active) return null
  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return null
  return user
}

// ---- Fastify middleware factories ----

export function requireAuth(app) {
  return async function (req, reply) {
    if (!req.session?.user) {
      req.session.returnTo = req.url
      return reply.redirect('/login')
    }
    // Refresh user from DB (in case deactivated)
    const user = findUserById(req.session.user.id)
    if (!user || !user.is_active) {
      req.session.destroy()
      return reply.redirect('/login')
    }
    req.user = user
  }
}

export function requireRole(...roles) {
  return async function (req, reply) {
    if (!req.user) {
      return reply.redirect('/login')
    }
    if (!roles.includes(req.user.role) && req.user.role !== 'ADMIN') {
      return reply.status(403).view('pages/error', {
        title: 'Нет доступа',
        message: 'У вас нет прав для этой страницы.',
      })
    }
  }
}

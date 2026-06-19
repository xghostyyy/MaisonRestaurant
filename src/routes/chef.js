import { requireAuth, requireRole } from '../auth.js'
import { listAllItems, listCategories, findItemById, createItem, updateItem, toggleItemAvailability } from '../services/menu.js'
import { verifyCsrfToken } from '../csrf.js'
import { randomBytes } from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdir } from 'fs/promises'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '../../public/uploads/menu')

function cuid() { return 'c' + randomBytes(8).toString('hex') }

async function ensureUploadsDir() {
  await mkdir(UPLOADS_DIR, { recursive: true })
}

async function processImage(buffer, id) {
  await ensureUploadsDir()
  const imgFile = join(UPLOADS_DIR, `${id}.webp`)
  const thumbFile = join(UPLOADS_DIR, `${id}-thumb.webp`)

  await sharp(buffer).resize(1200, null, { withoutEnlargement: true }).webp({ quality: 85 }).toFile(imgFile)
  await sharp(buffer).resize(400, null, { withoutEnlargement: true }).webp({ quality: 80 }).toFile(thumbFile)

  return {
    imageUrl: `/uploads/menu/${id}.webp`,
    thumbUrl: `/uploads/menu/${id}-thumb.webp`,
  }
}

async function parseMultipart(req) {
  const body = {}
  let imageBuffer = null

  for await (const part of req.parts()) {
    if (part.type === 'file') {
      if (part.fieldname === 'image' && part.mimetype.startsWith('image/')) {
        imageBuffer = await part.toBuffer()
      } else {
        await part.toBuffer()
      }
    } else {
      body[part.fieldname] = part.value
    }
  }

  return { body, imageBuffer }
}

export default async function chefRoutes(app) {
  const authHook = requireAuth(app)
  const roleHook = requireRole('CHEF')

  // GET /chef/menu
  app.get('/chef/menu', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const items = listAllItems()
    const categories = listCategories()
    return reply.view('pages/chef/menu', {
      title: 'Управление меню — Maison',
      pageTitle: 'Меню',
      user: req.user,
      activeSection: 'chef-menu',
      items,
      categories,
      pageJS: 'chef-menu',
    }, { layout: 'layout-staff' })
  })

  // POST /chef/menu — create item (multipart/form-data)
  app.post('/chef/menu', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const { body, imageBuffer } = await parseMultipart(req)
    if (!verifyCsrfToken(req.session && req.session._csrf, body._csrf)) {
      return reply.status(403).view('pages/error', {
        title: 'Ошибка безопасности',
        message: 'Истёк срок действия формы. Обновите страницу и попробуйте снова.',
      })
    }
    const id = cuid()

    let imageUrl = null
    let thumbUrl = null
    if (imageBuffer) {
      try {
        const urls = await processImage(imageBuffer, id)
        imageUrl = urls.imageUrl
        thumbUrl = urls.thumbUrl
      } catch {
        // Ignore image processing errors — item saved without image
      }
    }

    createItem({
      id,
      categoryId: body.categoryId,
      name: body.name,
      description: body.description || null,
      priceCents: Math.round(parseFloat(body.price || 0) * 100),
      imageUrl,
      thumbUrl,
      isVegan: body.isVegan ? 1 : 0,
      isVegetarian: body.isVegetarian ? 1 : 0,
      isGlutenFree: body.isGlutenFree ? 1 : 0,
      allergens: body.allergens || null,
      isAvailable: 1,
      sortOrder: parseInt(body.sortOrder || 0),
    })
    return reply.redirect('/chef/menu')
  })

  // POST /chef/menu/:id — update item (multipart/form-data)
  app.post('/chef/menu/:id', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const item = findItemById(req.params.id)
    if (!item) return reply.status(404).view('pages/404', { title: 'Блюдо не найдено' })

    const { body, imageBuffer } = await parseMultipart(req)
    if (!verifyCsrfToken(req.session && req.session._csrf, body._csrf)) {
      return reply.status(403).view('pages/error', {
        title: 'Ошибка безопасности',
        message: 'Истёк срок действия формы. Обновите страницу и попробуйте снова.',
      })
    }

    let imageUrl = item.image_url
    let thumbUrl = item.thumb_url

    if (imageBuffer) {
      try {
        // Validate it's a real image first
        const meta = await sharp(imageBuffer).metadata()
        if (meta.width) {
          const urls = await processImage(imageBuffer, item.id)
          imageUrl = urls.imageUrl
          thumbUrl = urls.thumbUrl
        }
      } catch {
        // Keep existing image on error
      }
    }

    updateItem({
      id: item.id,
      categoryId: body.categoryId || item.category_id,
      name: body.name || item.name,
      description: body.description ?? item.description,
      priceCents: body.price ? Math.round(parseFloat(body.price) * 100) : item.price_cents,
      imageUrl,
      thumbUrl,
      isVegan: body.isVegan ? 1 : 0,
      isVegetarian: body.isVegetarian ? 1 : 0,
      isGlutenFree: body.isGlutenFree ? 1 : 0,
      allergens: body.allergens ?? item.allergens,
      isAvailable: body.isAvailable !== undefined ? (body.isAvailable ? 1 : 0) : item.is_available,
      sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder) : item.sort_order,
    })
    return reply.redirect('/chef/menu')
  })

  // POST /chef/menu/:id/stop — toggle stop-list
  app.post('/chef/menu/:id/stop', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    toggleItemAvailability(req.params.id)
    return reply.redirect('/chef/menu')
  })
}

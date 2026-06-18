import { requireAuth, requireRole } from '../auth.js'
import { listAllItems, listCategories, findItemById, createItem, updateItem, toggleItemAvailability, deleteItem, createCategory } from '../services/menu.js'
import { randomBytes } from 'crypto'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { unlink } from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '../../public/uploads/menu')

function cuid() { return 'c' + randomBytes(8).toString('hex') }

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
    }, { layout: 'layout-staff' })
  })

  // POST /chef/menu — create item
  app.post('/chef/menu', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const body = req.body
    const id = cuid()
    createItem({
      id,
      categoryId: body.categoryId,
      name: body.name,
      description: body.description || null,
      priceCents: Math.round(parseFloat(body.price || 0) * 100),
      imageUrl: null,
      thumbUrl: null,
      isVegan: body.isVegan ? 1 : 0,
      isVegetarian: body.isVegetarian ? 1 : 0,
      isGlutenFree: body.isGlutenFree ? 1 : 0,
      allergens: body.allergens || null,
      isAvailable: 1,
      sortOrder: parseInt(body.sortOrder || 0),
    })
    return reply.redirect('/chef/menu')
  })

  // POST /chef/menu/:id — update item
  app.post('/chef/menu/:id', { preHandler: [authHook, roleHook] }, async (req, reply) => {
    const item = findItemById(req.params.id)
    if (!item) return reply.status(404).view('pages/404', { title: 'Блюдо не найдено' })
    const body = req.body
    updateItem({
      id: item.id,
      categoryId: body.categoryId || item.category_id,
      name: body.name || item.name,
      description: body.description ?? item.description,
      priceCents: body.price ? Math.round(parseFloat(body.price) * 100) : item.price_cents,
      imageUrl: item.image_url,
      thumbUrl: item.thumb_url,
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

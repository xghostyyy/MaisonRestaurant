import { getMenuGrouped } from '../services/menu.js'
import { getSettings } from '../services/settings.js'

export default async function publicRoutes(app) {
  // Home page
  app.get('/', async (_req, reply) => {
    const menu = getMenuGrouped(true).slice(0, 2).map((cat) => ({
      ...cat,
      items: cat.items.slice(0, 3),
    }))
    return reply.view('pages/index', {
      title: 'Maison — Ресторан',
      description: 'Авторская кухня в уютной атмосфере. Забронируйте столик онлайн.',
      menu,
      pageCSS: 'home',
    })
  })

  // Menu page
  app.get('/menu', async (req, reply) => {
    const menu = getMenuGrouped(true)
    const filters = {
      vegan: req.query.vegan === '1',
      vegetarian: req.query.vegetarian === '1',
      glutenFree: req.query.glutenFree === '1',
    }
    const filtered = menu.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        if (filters.vegan && !item.is_vegan) return false
        if (filters.vegetarian && !item.is_vegetarian) return false
        if (filters.glutenFree && !item.is_gluten_free) return false
        return true
      }),
    }))
    return reply.view('pages/menu', {
      title: 'Меню — Maison',
      description: 'Авторская кухня с сезонными продуктами. Полное меню ресторана Maison.',
      menu: filtered,
      filters,
      pageCSS: 'menu',
    })
  })

  // About page
  app.get('/about', async (_req, reply) => {
    return reply.view('pages/about', {
      title: 'О нас — Maison',
      description: 'История ресторана Maison, наша команда и ценности.',
      pageCSS: 'about',
    })
  })
}

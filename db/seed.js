import { hash } from '@node-rs/argon2'
import { randomBytes } from 'crypto'
import Database from 'better-sqlite3'
import { config } from '../src/config.js'

const db = new Database(config.DB_PATH)
db.pragma('foreign_keys = ON')

function cuid() {
  return 'c' + randomBytes(8).toString('hex')
}

console.log('Seeding database...\n')

// ---- Settings ----
db.prepare(`
  UPDATE settings SET
    open_hours_json='{"1":[{"open":"12:00","close":"23:00"}],"2":[{"open":"12:00","close":"23:00"}],"3":[{"open":"12:00","close":"23:00"}],"4":[{"open":"12:00","close":"23:00"}],"5":[{"open":"12:00","close":"23:00"}],"6":[{"open":"11:00","close":"00:00"}],"0":[]}',
    dining_minutes=90,
    buffer_min=15,
    slot_granularity_min=15,
    min_lead_hours=2,
    max_advance_days=60,
    cancel_cutoff_hours=4,
    tip_model='DIRECT'
  WHERE id='singleton'
`).run()

// ---- Staff ----
const passwordHash = await hash('changeme', { memoryCost: 65536, timeCost: 3, parallelism: 1 })

const staffMembers = [
  { id: cuid(), role: 'ADMIN',  name: 'Александр Управляющий', email: 'admin@maison.ru' },
  { id: cuid(), role: 'HOST',   name: 'Мария Хостес',         email: 'host@maison.ru' },
  { id: cuid(), role: 'WAITER', name: 'Иван Официант',        email: 'waiter@maison.ru' },
  { id: cuid(), role: 'CHEF',   name: 'Анна Шеф-повар',      email: 'chef@maison.ru' },
]

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, role, name, email, password_hash, phone)
  VALUES (@id, @role, @name, @email, @passwordHash, @phone)
`)

for (const s of staffMembers) {
  insertUser.run({ ...s, passwordHash, phone: '+7 000 000-00-00' })
  console.log(`  ✓ User: ${s.role} — ${s.email}`)
}

// ---- Tables (floor plan) ----
const tables = [
  // Основной зал
  { id: cuid(), label: '1',  seats: 2, section: 'main', shape: 'round', x: 10, y: 10, width: 8, height: 8, rotation: 0 },
  { id: cuid(), label: '2',  seats: 2, section: 'main', shape: 'round', x: 22, y: 10, width: 8, height: 8, rotation: 0 },
  { id: cuid(), label: '3',  seats: 4, section: 'main', shape: 'square', x: 35, y: 10, width: 10, height: 10, rotation: 0 },
  { id: cuid(), label: '4',  seats: 4, section: 'main', shape: 'square', x: 50, y: 10, width: 10, height: 10, rotation: 0 },
  { id: cuid(), label: '5',  seats: 6, section: 'main', shape: 'rect', x: 65, y: 10, width: 14, height: 10, rotation: 0 },
  { id: cuid(), label: '6',  seats: 4, section: 'main', shape: 'square', x: 10, y: 30, width: 10, height: 10, rotation: 0 },
  { id: cuid(), label: '7',  seats: 4, section: 'main', shape: 'square', x: 25, y: 30, width: 10, height: 10, rotation: 0 },
  { id: cuid(), label: '8',  seats: 6, section: 'main', shape: 'rect', x: 40, y: 30, width: 14, height: 10, rotation: 0 },
  { id: cuid(), label: '9',  seats: 8, section: 'main', shape: 'rect', x: 60, y: 30, width: 18, height: 10, rotation: 0 },
  // Веранда
  { id: cuid(), label: 'V1', seats: 2, section: 'veranda', shape: 'round', x: 10, y: 60, width: 8, height: 8, rotation: 0 },
  { id: cuid(), label: 'V2', seats: 2, section: 'veranda', shape: 'round', x: 22, y: 60, width: 8, height: 8, rotation: 0 },
  { id: cuid(), label: 'V3', seats: 4, section: 'veranda', shape: 'square', x: 35, y: 60, width: 10, height: 10, rotation: 0 },
  { id: cuid(), label: 'V4', seats: 4, section: 'veranda', shape: 'square', x: 50, y: 60, width: 10, height: 10, rotation: 0 },
  // Бар
  { id: cuid(), label: 'B1', seats: 2, section: 'bar', shape: 'round', x: 10, y: 82, width: 7, height: 7, rotation: 0 },
  { id: cuid(), label: 'B2', seats: 2, section: 'bar', shape: 'round', x: 22, y: 82, width: 7, height: 7, rotation: 0 },
  { id: cuid(), label: 'B3', seats: 3, section: 'bar', shape: 'round', x: 34, y: 82, width: 8, height: 8, rotation: 0 },
]

const insertTable = db.prepare(`
  INSERT OR IGNORE INTO tables (id, label, seats, section, shape, x, y, width, height, rotation)
  VALUES (@id, @label, @seats, @section, @shape, @x, @y, @width, @height, @rotation)
`)
for (const t of tables) {
  insertTable.run(t)
}
console.log(`  ✓ Tables: ${tables.length} столов`)

// ---- Menu ----
const categories = [
  { id: cuid(), name: 'Закуски', sortOrder: 1 },
  { id: cuid(), name: 'Супы', sortOrder: 2 },
  { id: cuid(), name: 'Основные блюда', sortOrder: 3 },
  { id: cuid(), name: 'Десерты', sortOrder: 4 },
]

const insertCat = db.prepare(
  `INSERT OR IGNORE INTO menu_categories (id, name, sort_order) VALUES (@id, @name, @sortOrder)`
)
for (const c of categories) insertCat.run(c)
console.log(`  ✓ Categories: ${categories.length}`)

const menuItems = [
  // Закуски
  { catIdx: 0, name: 'Тартар из говядины',      desc: 'С трюфельным маслом, каперсами, желтком', price: 89000 },
  { catIdx: 0, name: 'Карпаччо из лосося',      desc: 'С авокадо, цитрусовым соусом', price: 74000, veg: true },
  { catIdx: 0, name: 'Брускетта с томатами',    desc: 'Свежие томаты, базилик, оливковое масло', price: 42000, veg: true, vegan: true },
  { catIdx: 0, name: 'Осьминог на гриле',       desc: 'С бататом и соусом чимичурри', price: 96000 },
  { catIdx: 0, name: 'Сырная тарелка',          desc: 'Бри, пармезан, горгонзола, виноград, орехи', price: 87000, veg: true },
  // Супы
  { catIdx: 1, name: 'Суп из белых грибов',     desc: 'С трюфелем и взбитыми сливками', price: 63000, veg: true },
  { catIdx: 1, name: 'Уха из судака',           desc: 'Традиционная, с расстегаями', price: 58000 },
  { catIdx: 1, name: 'Том Ям',                  desc: 'Тигровые креветки, кокосовое молоко, лемонграсс', price: 71000, gf: true },
  // Основные
  { catIdx: 2, name: 'Стейк рибай',             desc: 'Мраморная говядина, картофель гратен, соус беарнез', price: 196000 },
  { catIdx: 2, name: 'Утиная грудка',           desc: 'С вишнёвым соусом и пюре из пастернака', price: 134000 },
  { catIdx: 2, name: 'Лосось конфи',            desc: 'Медленное приготовление, шпинат, лимонный бёр-блан', price: 143000, gf: true },
  { catIdx: 2, name: 'Ризотто с грибами',       desc: 'Ассорти грибов, пармезан, трюфельное масло', price: 89000, veg: true },
  { catIdx: 2, name: 'Паста Каччо э Пепе',      desc: 'Тонкие спагетти, пекорино, черный перец', price: 76000, veg: true },
  { catIdx: 2, name: 'Ягнёнок в ароматах прованса', desc: 'Чеснок, розмарин, корнеплоды', price: 167000, gf: true },
  // Десерты
  { catIdx: 3, name: 'Шоколадный фондан',       desc: 'Горький шоколад, ванильное мороженое', price: 54000, veg: true },
  { catIdx: 3, name: 'Крем-брюле',              desc: 'Классический, с сезонными ягодами', price: 48000, veg: true, gf: true },
  { catIdx: 3, name: 'Тарт татен',              desc: 'Яблочный, с кальвадосом и сметаной', price: 52000, veg: true },
  { catIdx: 3, name: 'Панна котта с манго',     desc: 'Кокосовая, с сорбетом манго', price: 46000, veg: true },
  { catIdx: 3, name: 'Мороженое, 3 шарика',     desc: 'На выбор: ванильное, шоколадное, фисташковое', price: 38000, veg: true, gf: true },
]

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO menu_items
    (id, category_id, name, description, price_cents, is_vegan, is_vegetarian, is_gluten_free, sort_order)
  VALUES
    (@id, @categoryId, @name, @description, @priceCents, @isVegan, @isVegetarian, @isGlutenFree, @sortOrder)
`)

menuItems.forEach((item, i) => {
  insertItem.run({
    id: cuid(),
    categoryId: categories[item.catIdx].id,
    name: item.name,
    description: item.desc,
    priceCents: item.price,
    isVegan: item.vegan ? 1 : 0,
    isVegetarian: item.veg ? 1 : 0,
    isGlutenFree: item.gf ? 1 : 0,
    sortOrder: i,
  })
})
console.log(`  ✓ Menu items: ${menuItems.length}`)

// ---- Demo reservations (today & tomorrow) ----
const todayStr = new Date().toISOString().slice(0, 10)
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = tomorrow.toISOString().slice(0, 10)

const mainTables = db.prepare(`SELECT id FROM tables WHERE section='main' LIMIT 3`).all()

const insertRes = db.prepare(`
  INSERT OR IGNORE INTO reservations
    (id, manage_token, guest_name, guest_phone, party_size, starts_at, ends_at, table_id, status)
  VALUES
    (@id, @manageToken, @guestName, @guestPhone, @partySize, @startsAt, @endsAt, @tableId, @status)
`)

const demoReservations = [
  {
    guestName: 'Николай Петров', guestPhone: '+7 901 234-56-78',
    partySize: 2, date: todayStr, time: '19:00', tableIdx: 0, status: 'CONFIRMED',
  },
  {
    guestName: 'Семья Ивановых', guestPhone: '+7 912 345-67-89',
    partySize: 4, date: todayStr, time: '20:00', tableIdx: 1, status: 'PENDING',
  },
  {
    guestName: 'Анна Смирнова', guestPhone: '+7 923 456-78-90',
    partySize: 2, date: tomorrowStr, time: '13:00', tableIdx: 2, status: 'CONFIRMED',
  },
  {
    guestName: 'Деловой ужин (Ком. Карпов)', guestPhone: '+7 934 567-89-01',
    partySize: 6, date: tomorrowStr, time: '19:30', tableIdx: 0, status: 'PENDING',
  },
]

for (const r of demoReservations) {
  const startsAt = new Date(`${r.date}T${r.time}:00`).toISOString()
  const endsAt = new Date(new Date(startsAt).getTime() + 90 * 60 * 1000).toISOString()
  insertRes.run({
    id: cuid(),
    manageToken: randomBytes(24).toString('base64url'),
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    partySize: r.partySize,
    startsAt,
    endsAt,
    tableId: mainTables[r.tableIdx]?.id ?? null,
    status: r.status,
  })
}
console.log(`  ✓ Demo reservations: ${demoReservations.length}`)

// ---- Shifts ----
const [admin, host, waiter] = [staffMembers[0], staffMembers[1], staffMembers[2]]
const insertShift = db.prepare(`
  INSERT OR IGNORE INTO shifts (id, user_id, starts_at, ends_at, role)
  VALUES (@id, @userId, @startsAt, @endsAt, @role)
`)

for (const date of [todayStr, tomorrowStr]) {
  insertShift.run({
    id: cuid(), userId: host.id,
    startsAt: `${date}T10:00:00`, endsAt: `${date}T23:00:00`, role: 'HOST',
  })
  insertShift.run({
    id: cuid(), userId: waiter.id,
    startsAt: `${date}T11:00:00`, endsAt: `${date}T23:00:00`, role: 'WAITER',
  })
  insertShift.run({
    id: cuid(), userId: admin.id,
    startsAt: `${date}T09:00:00`, endsAt: `${date}T22:00:00`, role: 'ADMIN',
  })
}
console.log(`  ✓ Shifts: demo shifts for today & tomorrow`)

db.close()
console.log('\nSeed complete!\n')
console.log('Staff accounts (password: changeme):')
for (const s of staffMembers) {
  console.log(`  ${s.role.padEnd(6)} → ${s.email}`)
}

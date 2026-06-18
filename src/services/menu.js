import db from '../db.js'

const stmtCategories = db.prepare(
  `SELECT * FROM menu_categories ORDER BY sort_order, name`
)
const stmtCategoryById = db.prepare(`SELECT * FROM menu_categories WHERE id=?`)

const stmtItems = db.prepare(
  `SELECT * FROM menu_items WHERE category_id=? ORDER BY sort_order, name`
)
const stmtAllItems = db.prepare(
  `SELECT mi.*, mc.name AS category_name
   FROM menu_items mi
   JOIN menu_categories mc ON mi.category_id = mc.id
   ORDER BY mc.sort_order, mi.sort_order, mi.name`
)
const stmtAvailableItems = db.prepare(
  `SELECT mi.*, mc.name AS category_name
   FROM menu_items mi
   JOIN menu_categories mc ON mi.category_id = mc.id
   WHERE mi.is_available = 1
   ORDER BY mc.sort_order, mi.sort_order, mi.name`
)
const stmtItemById = db.prepare(`SELECT * FROM menu_items WHERE id=?`)

const stmtInsertCategory = db.prepare(`
  INSERT INTO menu_categories (id, name, sort_order) VALUES (@id, @name, @sortOrder)
`)
const stmtUpdateCategory = db.prepare(`
  UPDATE menu_categories SET name=@name, sort_order=@sortOrder WHERE id=@id
`)

const stmtInsertItem = db.prepare(`
  INSERT INTO menu_items
    (id, category_id, name, description, price_cents, image_url, thumb_url,
     is_vegan, is_vegetarian, is_gluten_free, allergens, is_available, sort_order)
  VALUES
    (@id, @categoryId, @name, @description, @priceCents, @imageUrl, @thumbUrl,
     @isVegan, @isVegetarian, @isGlutenFree, @allergens, @isAvailable, @sortOrder)
`)

const stmtUpdateItem = db.prepare(`
  UPDATE menu_items SET
    category_id=@categoryId, name=@name, description=@description,
    price_cents=@priceCents, image_url=@imageUrl, thumb_url=@thumbUrl,
    is_vegan=@isVegan, is_vegetarian=@isVegetarian, is_gluten_free=@isGlutenFree,
    allergens=@allergens, is_available=@isAvailable, sort_order=@sortOrder
  WHERE id=@id
`)

const stmtToggleStop = db.prepare(
  `UPDATE menu_items SET is_available = CASE WHEN is_available=1 THEN 0 ELSE 1 END WHERE id=?`
)

const stmtDeleteItem = db.prepare(`DELETE FROM menu_items WHERE id=?`)

// ---- Categories ----

export function listCategories() {
  return stmtCategories.all()
}

export function findCategoryById(id) {
  return stmtCategoryById.get(id) ?? null
}

export function createCategory(data) {
  stmtInsertCategory.run(data)
  return findCategoryById(data.id)
}

export function updateCategory(data) {
  stmtUpdateCategory.run(data)
  return findCategoryById(data.id)
}

// ---- Items ----

export function listItemsByCategory(categoryId) {
  return stmtItems.all(categoryId)
}

export function listAllItems() {
  return stmtAllItems.all()
}

export function listAvailableItems() {
  return stmtAvailableItems.all()
}

export function findItemById(id) {
  return stmtItemById.get(id) ?? null
}

export function createItem(data) {
  stmtInsertItem.run(data)
  return findItemById(data.id)
}

export function updateItem(data) {
  stmtUpdateItem.run(data)
  return findItemById(data.id)
}

export function toggleItemAvailability(id) {
  stmtToggleStop.run(id)
  return findItemById(id)
}

export function deleteItem(id) {
  stmtDeleteItem.run(id)
}

// ---- Grouped for public menu ----

export function getMenuGrouped(onlyAvailable = true) {
  const categories = listCategories()
  return categories.map((cat) => {
    const items = stmtItems.all(cat.id).filter((i) => !onlyAvailable || i.is_available)
    return { ...cat, items }
  })
}

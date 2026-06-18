---
name: sqlite-service-patterns
description: better-sqlite3: prepared statements, транзакции, singleton, миграции, паттерны сервисов
---

## Singleton DB (src/db.js)

```js
import Database from 'better-sqlite3'
import { config } from './config.js'

const db = new Database(config.DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

export default db
```

Один экземпляр на весь процесс. Синхронный — не нужны Promise/async.

## Паттерн сервиса

```js
// src/services/reservations.js
import db from '../db.js'

// Подготовленные запросы — один раз при импорте модуля
const stmtFindById = db.prepare('SELECT * FROM reservations WHERE id = ?')
const stmtInsert = db.prepare(`
  INSERT INTO reservations (id, manage_token, guest_name, guest_phone,
    guest_email, party_size, starts_at, ends_at, table_id, notes)
  VALUES (@id, @manageToken, @guestName, @guestPhone,
    @guestEmail, @partySize, @startsAt, @endsAt, @tableId, @notes)
`)

export function findReservationById(id) {
  return stmtFindById.get(id) ?? null
}

export const createReservation = db.transaction((data) => {
  // Повторная проверка внутри транзакции
  const conflict = checkConflict(data.tableId, data.startsAt, data.endsAt)
  if (conflict) throw Object.assign(new Error('CONFLICT'), { status: 409 })
  stmtInsert.run(data)
  return findReservationById(data.id)
})
```

## Именование

- `stmt*` — prepared statement переменные (модульный уровень)
- Колонки в snake_case в БД, JS-объекты в camelCase
- Параметры `@named` (не `?`) везде где > 1 параметр
- Функции сервисов: `findX`, `createX`, `updateX`, `deleteX`, `listX`

## Миграции (db/migrate.js)

```js
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import db from '../src/db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, 'migrations')

// Таблица версий
db.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT)`)

const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map(r => r.name))

const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
for (const file of files) {
  if (applied.has(file)) continue
  const sql = readFileSync(join(migrationsDir, file), 'utf8')
  db.exec(sql)
  db.prepare('INSERT INTO _migrations VALUES (?, ?)').run(file, new Date().toISOString())
  console.log(`Applied migration: ${file}`)
}
```

## Правила транзакций

- Любое действие с несколькими INSERT/UPDATE — в транзакции
- `db.transaction(fn)()` — синхронный вызов
- Конфликты: `throw Object.assign(new Error('msg'), { status: 409 })`
- Никогда не вызывать `db.exec` в маршрутах — только prepared statements

## Чистые функции сервисов

Сервисы НЕ знают о HTTP:
- Принимают plain объекты, возвращают plain объекты или бросают ошибки
- Маршруты вызывают сервисы, ловят ошибки и формируют HTTP-ответ
- Тесты тестируют сервисы напрямую (не через HTTP)

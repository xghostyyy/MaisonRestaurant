import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { config } from '../src/config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, 'migrations')

const db = new Database(config.DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(
  `CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`
)

const applied = new Set(
  db.prepare('SELECT name FROM _migrations').all().map((r) => r.name)
)

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

let ran = 0
for (const file of files) {
  if (applied.has(file)) continue
  const sql = readFileSync(join(migrationsDir, file), 'utf8')
  db.exec(sql)
  db.prepare('INSERT INTO _migrations VALUES (?, ?)').run(file, new Date().toISOString())
  console.log(`  ✓ Applied: ${file}`)
  ran++
}

if (ran === 0) {
  console.log('  All migrations already applied.')
} else {
  console.log(`\n  Migrations complete (${ran} applied).`)
}

db.close()

import Database from 'better-sqlite3'
import { config } from './config.js'

const db = new Database(config.DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')
db.pragma('synchronous = NORMAL')

export default db

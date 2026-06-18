import db from '../db.js'

const stmtGet = db.prepare(`SELECT * FROM settings WHERE id='singleton'`)
const stmtUpdate = db.prepare(`
  UPDATE settings SET
    timezone=@timezone,
    open_hours_json=@openHoursJson,
    slot_granularity_min=@slotGranularityMin,
    dining_minutes=@diningMinutes,
    buffer_min=@bufferMin,
    min_lead_hours=@minLeadHours,
    max_advance_days=@maxAdvanceDays,
    cancel_cutoff_hours=@cancelCutoffHours,
    tip_model=@tipModel,
    tip_pool_default_split=@tipPoolDefaultSplit
  WHERE id='singleton'
`)

let _cache = null

export function getSettings() {
  if (!_cache) _cache = stmtGet.get()
  return _cache
}

export function updateSettings(data) {
  stmtUpdate.run(data)
  _cache = null
  return getSettings()
}

// Maison — reservation slot picker (progressive enhancement).
// The form works without JS via normal GET/POST; this adds live slot lookup.

const btn = document.getElementById('check-slots-btn')
const dateEl = document.getElementById('date')
const partySizeEl = document.getElementById('partySize')
const grid = document.getElementById('slots-grid')

function renderSlots(slots) {
  if (!grid) return
  if (slots.length === 0) {
    grid.innerHTML =
      '<p class="slots-empty">На выбранную дату нет свободных столов. Попробуйте другую дату.</p>'
    return
  }
  grid.innerHTML = slots
    .map(
      (slot) => `
    <label class="slot-option">
      <input type="radio" name="time" value="${slot.time}" required />
      <span class="slot-option__time">${slot.time}</span>
      <span class="slot-option__seats">${slot.tables[0].seats} мест</span>
    </label>
  `
    )
    .join('')

  const hidden = document.getElementById('hidden-table-id')
  grid.querySelectorAll('input[type="radio"]').forEach((radio, i) => {
    radio.addEventListener('change', () => {
      if (hidden) hidden.value = slots[i]?.tables?.[0]?.id || ''
    })
  })
}

async function checkSlots() {
  if (!dateEl.value || !partySizeEl.value) {
    dateEl.reportValidity()
    return
  }

  btn.disabled = true
  btn.textContent = 'Загрузка…'
  grid.innerHTML = '<p class="slots-hint">Ищем свободные столики…</p>'

  try {
    const res = await fetch(
      `/api/availability?date=${dateEl.value}&partySize=${partySizeEl.value}`
    )
    const data = await res.json()
    renderSlots(data.slots || [])
  } catch {
    grid.innerHTML =
      '<p class="slots-hint" style="color:var(--burgundy)">Не удалось загрузить слоты. Попробуйте снова.</p>'
  } finally {
    btn.disabled = false
    btn.textContent = 'Показать доступное время'
  }
}

if (btn) btn.addEventListener('click', checkSlots)

// Admin floor plan editor — drag-and-drop SVG table placement
;(function () {
  const dataEl = document.getElementById('floor-data')
  if (!dataEl) return

  let tables = JSON.parse(dataEl.textContent)
  let selectedId = null
  const svg = document.getElementById('floor-editor-svg')
  const panel = document.getElementById('selection-panel')
  const saveStatus = document.getElementById('save-status')

  const STATE_CLASSES_MAP = {
    round: (t) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      el.setAttribute('cx', t.width / 2)
      el.setAttribute('cy', t.height / 2)
      el.setAttribute('r', (Math.min(t.width, t.height) / 2) * 0.85)
      return el
    },
    default: (t) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      el.setAttribute('width', t.width)
      el.setAttribute('height', t.height)
      el.setAttribute('rx', '1.5')
      return el
    },
  }

  function render() {
    svg.innerHTML = ''
    tables.forEach(t => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('transform', `translate(${t.x},${t.y})`)
      g.setAttribute('data-id', t.id)
      g.style.cursor = 'move'
      if (t.id === selectedId) g.classList.add('editor-selected')

      const shape = (STATE_CLASSES_MAP[t.shape] || STATE_CLASSES_MAP.default)(t)
      shape.setAttribute('fill', t.id === selectedId ? 'rgba(217,138,43,0.3)' : 'rgba(62,74,46,0.15)')
      shape.setAttribute('stroke', t.id === selectedId ? '#D98A2B' : '#3E4A2E')
      shape.setAttribute('stroke-width', '0.5')

      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      lbl.setAttribute('x', t.width / 2)
      lbl.setAttribute('y', t.height / 2 + 0.8)
      lbl.setAttribute('text-anchor', 'middle')
      lbl.setAttribute('font-size', '2.8')
      lbl.setAttribute('fill', '#231F1B')
      lbl.setAttribute('font-weight', '600')
      lbl.setAttribute('pointer-events', 'none')
      lbl.textContent = t.label

      const seats = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      seats.setAttribute('x', t.width / 2)
      seats.setAttribute('y', t.height / 2 + 3.5)
      seats.setAttribute('text-anchor', 'middle')
      seats.setAttribute('font-size', '1.8')
      seats.setAttribute('fill', '#8B8580')
      seats.setAttribute('pointer-events', 'none')
      seats.textContent = t.seats

      g.appendChild(shape)
      g.appendChild(lbl)
      g.appendChild(seats)
      makeDraggable(g, t)
      g.addEventListener('click', (e) => { e.stopPropagation(); selectTable(t.id) })
      svg.appendChild(g)
    })
  }

  function svgPoint(e) {
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }

  function makeDraggable(el, tableObj) {
    let startSVG, startPos
    el.addEventListener('mousedown', e => {
      e.preventDefault()
      startSVG = svgPoint(e)
      startPos = { x: tableObj.x, y: tableObj.y }

      const onMove = e2 => {
        const cur = svgPoint(e2)
        tableObj.x = Math.max(0, Math.min(100 - tableObj.width, startPos.x + cur.x - startSVG.x))
        tableObj.y = Math.max(0, Math.min(100 - tableObj.height, startPos.y + cur.y - startSVG.y))
        render()
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  function selectTable(id) {
    selectedId = id
    const t = tables.find(t => t.id === id)
    if (!t) return
    panel.style.display = 'flex'

    document.getElementById('prop-label').value = t.label
    document.getElementById('prop-seats').value = t.seats
    document.getElementById('prop-section').value = t.section || ''
    document.getElementById('prop-shape').value = t.shape

    const syncProps = () => {
      t.label = document.getElementById('prop-label').value
      t.seats = parseInt(document.getElementById('prop-seats').value) || t.seats
      t.section = document.getElementById('prop-section').value
      t.shape = document.getElementById('prop-shape').value
      render()
    }

    ;['prop-label', 'prop-seats', 'prop-section', 'prop-shape'].forEach(id => {
      const el = document.getElementById(id)
      el.onchange = syncProps
      el.oninput = syncProps
    })

    render()
  }

  svg.addEventListener('click', () => {
    selectedId = null
    panel.style.display = 'none'
    render()
  })

  window.addTable = function () {
    const id = 'c' + Math.random().toString(36).slice(2, 10)
    tables.push({
      id, label: String(tables.length + 1), seats: 4,
      section: 'main', shape: 'square',
      x: 10, y: 10, width: 10, height: 10, rotation: 0, isActive: 1,
    })
    render()
    selectTable(id)
  }

  window.deleteSelected = function () {
    if (!selectedId) return
    if (!confirm('Удалить стол?')) return
    tables = tables.filter(t => t.id !== selectedId)
    selectedId = null
    panel.style.display = 'none'
    render()
  }

  window.saveFloor = async function () {
    const btn = document.querySelector('[onclick="saveFloor()"]')
    if (btn) btn.disabled = true
    try {
      const fd = new FormData()
      fd.append('tablesJson', JSON.stringify(tables))
      const res = await fetch('/admin/floor', { method: 'POST', body: fd })
      if (res.ok) {
        saveStatus.style.display = 'block'
        setTimeout(() => (saveStatus.style.display = 'none'), 2500)
      } else {
        alert('Ошибка при сохранении')
      }
    } finally {
      if (btn) btn.disabled = false
    }
  }

  render()
})()

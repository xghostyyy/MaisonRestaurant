// Host floor map — SSE live updates with 30s poll fallback
;(function () {
  const svg = document.getElementById('floor-map')
  if (!svg) return

  const STATE_CLASSES = [
    'table-state-free',
    'table-state-reserved-soon',
    'table-state-occupied',
    'table-state-needs-cleanup',
  ]

  function tableEl(tableId) {
    return svg.querySelector(`[data-table-id="${CSS.escape(tableId)}"]`)
  }

  function setState(tableId, state) {
    const g = tableEl(tableId)
    if (!g) return
    STATE_CLASSES.forEach(c => g.classList.remove(c))
    g.classList.add('table-state-' + state.toLowerCase().replace(/_/g, '-'))
    g.dataset.state = state
    const label = state === 'FREE' ? 'свободен'
      : state === 'RESERVED_SOON' ? 'скоро займётся'
      : state === 'OCCUPIED' ? 'занят'
      : 'убирается'
    g.setAttribute('aria-label', `Стол ${g.querySelector('.table-label')?.textContent || ''}, ${label}`)
  }

  function removeFromWalkin(tableId) {
    const opt = document.querySelector(`#walkin-table option[value="${CSS.escape(tableId)}"]`)
    if (opt) opt.remove()
  }

  let fallbackTimer = null

  function startFallback() {
    if (fallbackTimer) return
    fallbackTimer = setInterval(() => location.reload(), 30000)
  }

  function stopFallback() {
    if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null }
  }

  let es = null
  let reconnectTimer = null

  function connect() {
    if (es) return
    try {
      es = new EventSource('/api/events')

      es.addEventListener('open', () => {
        stopFallback()
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      })

      es.addEventListener('visit.seated', e => {
        try {
          const { tableId } = JSON.parse(e.data)
          setState(tableId, 'OCCUPIED')
          removeFromWalkin(tableId)
        } catch { /* ignore parse errors */ }
      })

      es.addEventListener('visit.closed', e => {
        try {
          const { tableId } = JSON.parse(e.data)
          setState(tableId, 'NEEDS_CLEANUP')
        } catch { /* ignore parse errors */ }
      })

      es.addEventListener('reservation.updated', () => {
        // Reservation list changes (confirm/reject/seat) — reload for full re-render
        location.reload()
      })

      es.addEventListener('error', () => {
        es.close()
        es = null
        startFallback()
        reconnectTimer = setTimeout(connect, 10000)
      })
    } catch {
      startFallback()
    }
  }

  // Start SSE; begin fallback timer while connecting (cancelled on first 'open')
  startFallback()
  connect()
})()

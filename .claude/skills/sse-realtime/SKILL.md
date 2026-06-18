---
name: sse-realtime
description: SSE-хаб (in-memory pub/sub), формат событий, авторизация по ролям, фолбэк
---

## SSE-хаб (src/services/events.js)

```js
// In-memory Set подписчиков — Map<role[], Reply[]>
const subscribers = new Set()

export function subscribe(reply) {
  subscribers.add(reply)
  return () => subscribers.delete(reply)
}

export function publish(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const reply of subscribers) {
    try { reply.raw.write(payload) } catch { subscribers.delete(reply) }
  }
}
```

## Маршрут /api/events (server-side)

```js
// src/routes/api.js
app.get('/api/events', { preHandler: [requireRole('HOST', 'ADMIN')] }, async (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // для Nginx/Caddy
  })
  reply.raw.write('retry: 3000\n\n')

  const unsubscribe = subscribe(reply)

  // keep-alive ping
  const ping = setInterval(() => {
    try { reply.raw.write(': ping\n\n') } catch { clearInterval(ping) }
  }, 25000)

  req.raw.on('close', () => {
    clearInterval(ping)
    unsubscribe()
  })

  return reply
})
```

## Формат событий

```
event: reservation.created
data: {"id":"...","guestName":"...","partySize":4,"startsAt":"...","status":"PENDING"}

event: reservation.updated
data: {"id":"...","status":"CONFIRMED","tableId":"..."}

event: visit.seated
data: {"id":"...","tableId":"...","waiterId":"...","partySize":4}

event: visit.closed
data: {"id":"...","tableId":"...","closedAt":"..."}
```

## Клиент (public/js/floor-map.js)

```js
let es
function connectSSE() {
  es = new EventSource('/api/events')

  es.addEventListener('reservation.updated', e => {
    const data = JSON.parse(e.data)
    patchTableState(data.tableId, data.status)
  })

  es.addEventListener('visit.seated', e => {
    const data = JSON.parse(e.data)
    patchTableState(data.tableId, 'OCCUPIED')
  })

  // Фолбэк: если SSE не работает — перезагрузка раз в 30 сек
  es.onerror = () => {
    es.close()
    setTimeout(() => location.reload(), 30_000)
  }
}

connectSSE()
```

## Авторизация подписки

- SSE-маршрут защищён `preHandler: requireRole('HOST', 'ADMIN')`
- При истечении сессии → `es.onerror` → фолбэк перезагрузка (пользователь увидит /login)
- Если JS недоступен — страница `/host` показывает статичную карту зала без SSE

## Правила

- НЕ хранить состояние в SSE-хабе — он только шлёт события, состояние — в БД
- Публикуй события ПОСЛЕ успешного коммита в БД
- `X-Accel-Buffering: no` обязателен для работы за reverse proxy
- `retry: 3000` — клиент переподключается через 3 сек при обрыве

---
name: form-security
description: CSRF, Zod-валидация, прогрессивное улучшение форм, rate-limit, ошибки с сохранением значений
---

## CSRF (обязательно на каждом POST)

### Сервер (маршрут)
```js
// В GET: передать токен в шаблон
const csrf = await reply.generateCsrf()
return reply.view('pages/reserve', { csrf, ...data })

// В POST: @fastify/csrf-protection автоматически проверяет
// (если плагин зарегистрирован глобально)
```

### Шаблон
```html
<form method="post" action="/reserve">
  <input type="hidden" name="_csrf" value="<%= it.csrf %>" />
  <!-- остальные поля -->
</form>
```

### Регистрация плагина (server.js)
```js
await app.register(fastifyCsrf, { sessionPlugin: '@fastify/session' })
// Автоматически проверяет _csrf на POST/PUT/DELETE/PATCH
```

## Zod-валидация (сервер)

```js
import { z } from 'zod'

const ReserveSchema = z.object({
  guestName:  z.string().min(2).max(100),
  guestPhone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/),
  guestEmail: z.string().email().optional().or(z.literal('')),
  partySize:  z.coerce.number().int().min(1).max(20),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time:       z.string().regex(/^\d{2}:\d{2}$/),
  notes:      z.string().max(500).optional(),
})

// В маршруте:
const result = ReserveSchema.safeParse(req.body)
if (!result.success) {
  return reply.status(400).view('pages/reserve', {
    errors: result.error.flatten().fieldErrors,
    values: req.body,  // сохранить введённое
    csrf: await reply.generateCsrf(),
  })
}
```

## Прогрессивное улучшение

Каждая публичная форма ОБЯЗАНА работать без JS:
1. `<form method="post">` с `action=` на правильный маршрут
2. POST → редирект (PRG-паттерн) или повторный рендер с ошибками
3. JS только перехватывает `submit`, шлёт `fetch`, обновляет UI без перезагрузки

```js
// public/js/main.js — шаблон перехвата
document.querySelectorAll('[data-ajax-form]').forEach(form => {
  form.addEventListener('submit', async e => {
    e.preventDefault()
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
    })
    if (res.redirected) { location.href = res.url; return }
    // иначе показать ошибки/тосты
  })
})
```

## Rate-limit

```js
// /login: 5 попыток / 15 минут / IP+email
await app.register(rateLimit, { global: false })

app.post('/login', {
  config: {
    rateLimit: { max: 5, timeWindow: '15 minutes', keyGenerator: (req) =>
      `${req.ip}:${req.body?.email ?? ''}` }
  }
}, loginHandler)

// /reserve: 10 / час / IP
app.post('/reserve', {
  config: { rateLimit: { max: 10, timeWindow: '1 hour' } }
}, reserveHandler)
```

## Ошибки — правила

- **400** — валидация не прошла (отрендерить форму с ошибками + сохранёнными значениями)
- **403** — CSRF-ошибка или нет прав
- **409** — конфликт (слот уже занят)
- **404** — не найдено (кастомная страница)
- Ошибки в полях: `<p class="form-error" id="field-name-error" role="alert">текст</p>`
  и `aria-describedby="field-name-error"` на инпуте
- Никогда не показывать stack trace в продакшене

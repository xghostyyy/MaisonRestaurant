# CLAUDE.md — Maison Restaurant

## Стек (менять нельзя)

- **Рантайм:** Node.js LTS (≥20), ESM (`"type":"module"`)
- **Сервер:** Fastify v4 + плагины (@fastify/*)
- **БД:** better-sqlite3 (синхронный SQLite, файл `data/app.db`)
- **Шаблоны:** eta v3 через @fastify/view
- **Клиент:** ванильный JS/HTML/CSS, никаких фреймворков, никаких бандлеров
- **Валидация:** zod на сервере, всегда
- **Пароли:** argon2id
- **Письма:** nodemailer
- **Изображения:** sharp (webp 1200px + 400px thumb)

## Команды

```bash
npm run dev      # node --watch server.js
npm start        # node server.js
npm test         # node:test
npm run setup    # db/migrate.js + db/seed.js
npm run lint     # eslint
npm run format   # prettier
```

## Структура

```
server.js          # точка входа
src/
  config.js        # env-переменные
  db.js            # better-sqlite3 singleton + прагмы
  auth.js          # сессии, middleware ролей
  mail.js          # nodemailer
  validators/      # zod-схемы
  services/        # бизнес-логика (чистые ф-ции над db)
  routes/          # Fastify route handlers
  views/           # eta-шаблоны
    layout.eta
    pages/
    partials/
db/
  migrate.js       # запускает migrations/*.sql
  seed.js          # демо-данные
  migrations/      # 001_init.sql, ...
public/
  css/             # tokens.css, base.css, components.css
  js/              # main.js, reservation.js, floor-map.js
  img/
  uploads/menu/    # в .gitignore
data/app.db        # в .gitignore
tests/
```

## Конвенции

1. **Prepared statements везде** — никакой конкатенации SQL.
2. **Zod на каждом мутирующем маршруте** — parse или safeParse, затем отвечать ошибкой 400.
3. **CSRF токен** на каждой POST-форме (`<input name="_csrf" value="...">`).
4. **Прогрессивное улучшение** — форма работает через `<form method="post">`, JS только улучшает UX.
5. **Роли и переходы статусов** проверяются только на сервере.
6. **Никакого TypeScript** — vanilla ESM, JSDoc-комментарии для сложных мест.
7. **Транзакции** для create/update, где нужна атомарность (бронирование, распределение чаевых).
8. **SSE** вместо WebSocket для живых обновлений (plan зала).
9. **Mobile-first** CSS, `prefers-reduced-motion` везде где есть анимации.
10. **Коммиты** по Conventional Commits: `feat(phase-N): описание`.

## Правила перед каждой фазой

1. Перечитай нужный раздел `SPEC.md`.
2. Активируй нужный skill (`/skill <name>`).
3. Убедись, что существующие тесты зелёные (`npm test`).
4. Коммить только когда `npm start` стартует без ошибок.

## Решения (архитектурные)

- Session store: начинаем с memory-store, в Фазе 4 — SQLite-стор через @fastify/session.
- CSRF: @fastify/csrf-protection с токенами в hidden input.
- Конфликты броней: транзакция better-sqlite3 с повторной проверкой → 409 если слот занят.
- SSE авторизация: проверка сессии при установке EventSource.
- Типографика: Fraunces (display) + Inter (body) через Google Fonts.
- Email в dev: если SMTP не настроен, письмо логируется в консоль.

## Состояние (обновляется после каждой фазы)

- **Текущая фаза:** 0 — Каркас
- **Завершено:** —
- **Следующее:** Фаза 1 — БД и сервисный слой

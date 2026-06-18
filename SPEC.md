# SPEC.md — Ресторан «Maison» (рабочее имя)

> Единый источник правды для проекта. Положи этот файл в корень репозитория.
> Claude Code должен читать его перед каждой фазой и сверять реализацию с ним.

---

## 1. Концепция и принципы

Сайт-витрина + операционная панель для ресторана: гости смотрят меню и бронируют столик,
персонал работает в своих кабинетах, администрация управляет всем.

**Главные принципы:**
- **Простота инфраструктуры важнее модных абстракций.** Никаких фронтенд-фреймворков,
  никаких сборщиков-монстров, никакой ORM. Только: Node.js, ванильный JS/HTML/CSS, SQLite.
- **Прогрессивное улучшение.** Серверный HTML работает без JS; JS добавляет интерактив
  (план зала, живые слоты, тосты).
- **Мобайл-first.** Большинство броней приходят с телефона.
- **Эстетика «вкусно».** Тёплая, аппетитная палитра, типографика как у хорошего меню,
  фотографии блюд — герой страницы.

---

## 2. Роли и права

| Роль | Может |
|------|-------|
| **GUEST** (без входа) | Смотреть меню, читать о ресторане, бронировать столик (вводит имя/телефон), управлять броней по ссылке-токену из письма |
| **WAITER** (официант) | Видеть свою смену, столы своей секции, открывать/закрывать визиты, принимать заказы (опционально v2), отмечать чаевые, видеть свою статистику и итог по сменам |
| **HOST** (хостес) | Видеть весь план зала в реальном времени, сажать гостей, подтверждать/отклонять брони, переназначать столы, работать с листом ожидания |
| **CHEF** (шеф/менеджер кухни) | Управлять меню: позиции, категории, наличие/стоп-лист, аллергены, фото; видеть прогноз загрузки на день |
| **ADMIN** (управляющий) | Всё вышеперечисленное + CRUD персонала и ролей, план зала (столы и их расположение), смены, отчёты, чаевые, настройки ресторана |

Один пользователь — одна роль. ADMIN может выполнять действия любых других ролей.

---

## 3. Стек технологий

Принцип: **минимум зависимостей, всё стандартное, легко развернуть на любом VPS за €5/мес.**

**Сервер:**
- **Node.js LTS** (последняя LTS) — рантайм.
- **Fastify** — HTTP-сервер. Не Express: быстрее, встроенная валидация схем, плагины, логирование.
- **@fastify/static** — отдача `/public`.
- **@fastify/formbody** — парсинг форм (для прогрессивного улучшения без JS).
- **@fastify/cookie** + **@fastify/session** — сессии в SQLite-сторе.
- **@fastify/csrf-protection** — CSRF-токены на формах.
- **@fastify/rate-limit** — защита публичных эндпоинтов (бронирование, логин).
- **better-sqlite3** — синхронный, быстрый, без отдельного сервера БД. Один файл.
- **eta** — лёгкий шаблонизатор HTML (можно заменить на @fastify/view + любой движок; eta — быстрый и читаемый).
- **zod** — валидация входа на всех мутирующих маршрутах.
- **argon2** — хэширование паролей персонала.
- **pino** — логирование (встроено в Fastify).
- **nodemailer** — отправка писем (подтверждение брони, ссылка управления).

**Клиент (в `/public`):**
- HTML, CSS (одна папка стилей, CSS-переменные, никаких препроцессоров).
- Ванильный JS, модули ES (`<script type="module">`), без бандлера.
- Прогрессивное улучшение: формы работают по `<form method="post">`; JS перехватывает `submit` и шлёт `fetch` для плавного UX, но fallback всегда есть.
- Для живых обновлений плана зала — **SSE (Server-Sent Events)**. Это один поток `text/event-stream`, поддерживается браузерами нативно, не требует библиотек и проще WebSocket-ов.

**Тесты:**
- **node:test** (встроенный) + **supertest** для HTTP. Никакого Jest.

**Дев-инструменты:**
- `node --watch` для горячей перезагрузки (встроено).
- `eslint` (плоский конфиг) + `prettier`. Без TypeScript — по условию задачи.

**Хранилище файлов:**
- Фото блюд — локально в `/public/uploads/menu/`, имена — `cuid`. Обработка размера через **sharp** (resize до webp 1200px и 400px thumb).

**Деплой:**
- Один VPS (Hetzner/Timeweb/любой). Процесс под **PM2** или systemd-юнит, **Caddy** как reverse-proxy с автоматическим HTTPS.
- Один файл БД `data/app.db`, бэкап cron-ом раз в сутки (`sqlite3 .backup`).

**Зависимости намеренно отсутствуют:** React/Vue/Svelte, Next/Nuxt, Webpack/Vite, Prisma/Drizzle, Redis, отдельный фронтенд-роутер.

---

## 4. Структура проекта

```
restaurant/
├── package.json
├── server.js                 # точка входа: создаёт Fastify, подключает плагины и роуты
├── data/
│   └── app.db                # SQLite (в .gitignore)
├── db/
│   ├── migrate.js            # прогон .sql из migrations/
│   ├── seed.js               # демо-данные
│   └── migrations/           # 001_init.sql, 002_*.sql ...
├── src/
│   ├── config.js             # чтение env
│   ├── db.js                 # better-sqlite3 instance + prepared statements
│   ├── auth.js               # сессии, проверка ролей, middleware
│   ├── csrf.js               # хелпер для шаблонов
│   ├── mail.js               # nodemailer
│   ├── validators/           # zod-схемы по доменам
│   ├── services/             # бизнес-логика (чистые функции над db)
│   │   ├── reservations.js   # доступность, создание, перенос, отмена
│   │   ├── tables.js         # план зала, состояния
│   │   ├── menu.js           # позиции, стоп-лист
│   │   ├── staff.js          # сотрудники, смены
│   │   ├── tips.js           # чаевые: запись, распределение, отчёт
│   │   └── events.js         # SSE-хаб (in-memory pub/sub)
│   ├── routes/
│   │   ├── public.js         # /, /menu, /reserve, /reserve/:token
│   │   ├── auth.js           # /login, /logout
│   │   ├── waiter.js         # /waiter/*
│   │   ├── host.js           # /host/*
│   │   ├── chef.js           # /chef/*
│   │   ├── admin.js          # /admin/*
│   │   └── api.js            # /api/* (JSON для JS-клиента и SSE)
│   └── views/                # eta-шаблоны
│       ├── layout.eta
│       ├── partials/
│       └── pages/
├── public/
│   ├── css/
│   │   ├── tokens.css        # CSS-переменные, типографика
│   │   ├── base.css          # reset + базовые элементы
│   │   ├── components.css    # кнопки, карточки, формы, тосты
│   │   └── pages/            # стили отдельных страниц
│   ├── js/
│   │   ├── main.js           # общий бутстрап (тосты, формы)
│   │   ├── reservation.js    # пикер даты/времени, шаги
│   │   ├── floor-map.js      # план зала (SVG), DnD, SSE-подписка
│   │   └── lib/              # маленькие утилиты
│   ├── img/                  # статичные изображения
│   └── uploads/menu/         # фото блюд (в .gitignore)
└── tests/
    ├── reservations.test.js
    ├── tables.test.js
    ├── tips.test.js
    └── http.test.js
```

---

## 5. Маршруты

**Публичные (HTML):**
- `GET /` — главная: hero с блюдом дня, ценности, краткое меню, CTA «Забронировать»
- `GET /menu` — полное меню по категориям, фильтры (вег., без глютена), стоп-лист скрыт автоматически
- `GET /about` — о ресторане, команда, контакты
- `GET /reserve` — форма брони (шаги: дата → размер компании → время → контакты)
- `POST /reserve` — создание брони, редирект на страницу управления
- `GET /reserve/:token` — управление своей броней по ссылке из письма
- `POST /reserve/:token/cancel` — отмена
- `POST /reserve/:token/edit` — перенос

**Аутентификация:**
- `GET /login`, `POST /login`, `POST /logout`

**Кабинет официанта** `/waiter`:
- `GET /waiter` — текущая смена: мои столы, список визитов, активные заказы
- `POST /waiter/visits/:id/open` — посадить (если хостес ещё не посадил)
- `POST /waiter/visits/:id/close` — закрыть визит (сумма + чаевые)
- `GET /waiter/tips` — мои чаевые: за смену, за неделю, за месяц
- `GET /waiter/shifts` — мои будущие смены

**Кабинет хостес** `/host`:
- `GET /host` — план зала «здесь и сейчас» (SVG-карта), список сегодняшних броней, лист ожидания
- `POST /host/reservations/:id/confirm` — подтвердить
- `POST /host/reservations/:id/reject` — отклонить с причиной
- `POST /host/reservations/:id/seat` — посадить (привязать к столу → создаёт Visit)
- `POST /host/walkins` — гость без брони, посадить сразу
- `POST /host/waitlist` — добавить в лист ожидания

**Кабинет шефа** `/chef`:
- `GET /chef/menu` — все позиции с быстрыми переключателями стоп-листа
- `POST /chef/menu` — создать позицию
- `POST /chef/menu/:id` — обновить (форма)
- `POST /chef/menu/:id/stop` — переключить стоп-лист
- Загрузка фото — multipart, сжатие через sharp.

**Админка** `/admin`:
- `GET /admin` — дашборд: занятость зала по часам, выручка, чаевые
- `/admin/staff` — CRUD сотрудников
- `/admin/shifts` — расписание смен
- `/admin/floor` — редактор плана зала (расстановка столов, секции)
- `/admin/reports` — отчёты (бронь, чаевые, посещаемость)
- `/admin/settings` — `RestaurantSettings`

**API (JSON, только для JS-клиента сайта):**
- `GET /api/availability?date=&partySize=` — доступные слоты на день
- `GET /api/floor` — текущее состояние плана зала
- `GET /api/events` — **SSE-поток** (новые брони, изменения столов)
- `POST /api/host/seat` — то же, что форма, но JSON

Все мутирующие маршруты требуют CSRF-токена; все API под ролями — проверка на сервере.

---

## 6. Схема БД (SQLite, DDL)

```sql
-- users (персонал)
CREATE TABLE users (
  id            TEXT PRIMARY KEY,                       -- cuid
  role          TEXT NOT NULL CHECK (role IN ('WAITER','HOST','CHEF','ADMIN')),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- столы и план зала
CREATE TABLE tables (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,                            -- «12», «B-3»
  seats        INTEGER NOT NULL,
  section      TEXT,                                     -- секция (зал, веранда, бар)
  shape        TEXT NOT NULL CHECK (shape IN ('round','square','rect')),
  x            REAL NOT NULL,                            -- координаты на SVG-карте (0..100)
  y            REAL NOT NULL,
  width        REAL NOT NULL,
  height       REAL NOT NULL,
  rotation     REAL NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1
);

-- брони
CREATE TABLE reservations (
  id            TEXT PRIMARY KEY,
  manage_token  TEXT NOT NULL UNIQUE,                    -- 32 случайных байта в base64url
  guest_name    TEXT NOT NULL,
  guest_phone   TEXT NOT NULL,
  guest_email   TEXT,
  party_size    INTEGER NOT NULL CHECK (party_size > 0),
  starts_at     TEXT NOT NULL,                           -- ISO UTC
  ends_at       TEXT NOT NULL,                           -- starts_at + dining_minutes
  table_id      TEXT REFERENCES tables(id),              -- может быть NULL до посадки
  status        TEXT NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','CONFIRMED','SEATED','COMPLETED',
                                  'REJECTED','CANCELLED','NO_SHOW')),
  notes         TEXT,                                    -- пожелания гостя
  staff_note    TEXT,                                    -- причина отказа и т.п.
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reservations_starts_at ON reservations(starts_at);
CREATE INDEX idx_reservations_table_starts ON reservations(table_id, starts_at);

-- лист ожидания (на день, без точного времени)
CREATE TABLE waitlist (
  id           TEXT PRIMARY KEY,
  guest_name   TEXT NOT NULL,
  guest_phone  TEXT NOT NULL,
  party_size   INTEGER NOT NULL,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
);

-- визиты: «гости пришли и сели за стол»
CREATE TABLE visits (
  id              TEXT PRIMARY KEY,
  reservation_id  TEXT REFERENCES reservations(id),     -- NULL для walk-in
  table_id        TEXT NOT NULL REFERENCES tables(id),
  waiter_id       TEXT REFERENCES users(id),
  party_size      INTEGER NOT NULL,
  seated_at       TEXT NOT NULL,
  closed_at       TEXT,
  bill_cents      INTEGER,                              -- итог по счёту
  status          TEXT NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN','CLOSED'))
);
CREATE INDEX idx_visits_table_open ON visits(table_id) WHERE closed_at IS NULL;

-- меню
CREATE TABLE menu_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES menu_categories(id),
  name          TEXT NOT NULL,
  description   TEXT,
  price_cents   INTEGER NOT NULL,
  image_url     TEXT,                                    -- /uploads/menu/<id>.webp
  thumb_url     TEXT,
  is_vegan      INTEGER NOT NULL DEFAULT 0,
  is_vegetarian INTEGER NOT NULL DEFAULT 0,
  is_gluten_free INTEGER NOT NULL DEFAULT 0,
  allergens     TEXT,                                    -- CSV: 'nuts,dairy'
  is_available  INTEGER NOT NULL DEFAULT 1,              -- стоп-лист = 0
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- смены
CREATE TABLE shifts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  starts_at   TEXT NOT NULL,
  ends_at     TEXT NOT NULL,
  role        TEXT NOT NULL,                             -- иногда официант работает хостес
  notes       TEXT
);
CREATE INDEX idx_shifts_user_starts ON shifts(user_id, starts_at);

-- чаевые: одна запись = транзакция
-- источник: visit (наличные/карта по конкретному визиту) или pool (общая ёмкость)
CREATE TABLE tips (
  id              TEXT PRIMARY KEY,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  method          TEXT NOT NULL CHECK (method IN ('CASH','CARD','TRANSFER')),
  visit_id        TEXT REFERENCES visits(id),
  recipient_id    TEXT REFERENCES users(id),             -- кому начислено (после распределения)
  pool_id         TEXT REFERENCES tip_pools(id),         -- если пришли в общий пул
  shift_date      TEXT NOT NULL,                         -- YYYY-MM-DD, для отчётов
  note            TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- общая ёмкость чаевых, которую потом распределяют
CREATE TABLE tip_pools (
  id            TEXT PRIMARY KEY,
  shift_date    TEXT NOT NULL UNIQUE,
  total_cents   INTEGER NOT NULL DEFAULT 0,
  distributed_at TEXT
);

CREATE TABLE settings (
  id                      TEXT PRIMARY KEY DEFAULT 'singleton',
  timezone                TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  open_hours_json         TEXT NOT NULL,                 -- JSON: дни недели → интервалы
  slot_granularity_min    INTEGER NOT NULL DEFAULT 15,
  dining_minutes          INTEGER NOT NULL DEFAULT 90,   -- сколько держим стол под бронь
  buffer_min              INTEGER NOT NULL DEFAULT 15,   -- уборка между броними
  min_lead_hours          INTEGER NOT NULL DEFAULT 2,
  max_advance_days        INTEGER NOT NULL DEFAULT 60,
  cancel_cutoff_hours     INTEGER NOT NULL DEFAULT 4,
  tip_pool_default_split  TEXT NOT NULL DEFAULT '{}'     -- JSON: {"WAITER":70,"HOST":15,"CHEF":15}
);
```

Все timestamp'ы — ISO UTC. Локальное время считается на границах (рендер) через настройку `timezone`.

---

## 7. Ключевая логика

### 7.1 Доступность столов (ядро бронирования)

Функция `getAvailableSlots(date, partySize) → Slot[]`, где `Slot = { time, tableOptions[] }`.

Алгоритм:
1. Из `settings.open_hours_json` берём рабочие интервалы на день недели.
2. Нарезаем интервалы шагом `slot_granularity_min` — получаем кандидатов на время `t`.
3. Для каждого `t` ищем столы с `seats ≥ partySize` И `seats ≤ partySize + 2` (не сажаем компанию из 2 за стол на 8), у которых нет конфликтующих броней в окне `[t, t + dining_minutes + buffer_min]` со статусом `PENDING/CONFIRMED/SEATED`.
4. Если `t` — сегодня, отбрасываем те, что ближе `min_lead_hours`. Если `t > now + max_advance_days` — тоже.
5. Возвращаем массив `{time, tableOptions[]}` (клиенту достаточно одного — назначаем «лучший» = с минимальным запасом мест; точный стол можем не показывать и назначить при подтверждении).

**Гонки.** SQLite + `better-sqlite3` синхронный, один процесс Node — гонок практически нет на уровне приложения. На всякий случай при `POST /reserve`:
```js
db.transaction(() => {
  // 1. перепроверить доступность времени и стола
  // 2. вставить reservation
})();
```
Транзакция better-sqlite3 атомарна. Если перепроверка показала конфликт — кидаем 409.

### 7.2 Жизненный цикл брони

```
PENDING ──(hostess confirm)──► CONFIRMED ──(гости пришли, seat)──► SEATED ──(close)──► COMPLETED
   │                                │                                 │
   ├──(reject)──► REJECTED          ├──(гость отменил)──► CANCELLED   └──(не пришли)──► NO_SHOW
   │
   └──(гость отменил)──► CANCELLED
```

- Гость по `manage_token` может менять время/размер компании и отменять до `cancel_cutoff_hours`.
- Изменение времени `CONFIRMED` сбрасывает в `PENDING`.
- Все переходы валидируются на сервере (таблица допустимых переходов).

### 7.3 План зала и состояния в реальном времени

Состояние стола вычисляется, не хранится:
- `FREE` — нет открытого `visit` и нет броней в ближайшие `dining_minutes`.
- `RESERVED_SOON` — есть `CONFIRMED` бронь в окне `[now, now + 30 мин]`.
- `OCCUPIED` — есть открытый `visit`.
- `NEEDS_CLEANUP` — закрыли визит меньше `buffer_min` минут назад.

Хостес работает на странице `/host`, которая держит **SSE-подключение** к `/api/events`.
События: `reservation.created`, `reservation.updated`, `visit.seated`, `visit.closed`.
Сервер шлёт их всем подключённым клиентам ролей `HOST`/`ADMIN`. На клиенте — лёгкий
in-place патч SVG-карты без перезагрузки.

### 7.4 Редактор плана зала (ADMIN)

`/admin/floor` — SVG-холст 100×100 (нормализованные координаты). Столы — `<g>`-элементы,
перетаскиваются мышью/тачем, изменяют размер и поворот. Сохранение — `POST /admin/floor`
с массивом столов. Гости и хостес видят тот же SVG, отрисованный из той же таблицы `tables`.

### 7.5 Чаевые

Две модели одновременно (выбор в `settings`):

**Прямая (DIRECT):** официант, закрывая визит, указывает сумму чаевых и метод. Запись идёт в `tips` сразу с `recipient_id = waiter_id`. Это его личные чаевые.

**Пул (POOL):** все чаевые за день складываются в `tip_pools[shift_date]`. В конце смены ADMIN запускает распределение:
1. Берёт `total_cents` и `tip_pool_default_split` (`{WAITER: 70, HOST: 15, CHEF: 15}`).
2. Считает доли по ролям и распределяет внутри роли пропорционально отработанным часам в этот день (`shifts`).
3. Создаёт по записи в `tips` для каждого получателя с `pool_id`.
4. Помечает пул `distributed_at = now`.

Отчёт `/admin/reports` — выгрузка `tips` за период, группировка по сотруднику.

Личный экран `/waiter/tips` показывает:
- сегодня (сумма + список визитов),
- за текущую неделю,
- за месяц,
- средние чаевые в % от чека.

### 7.6 Управление меню

Шеф редактирует через формы. Стоп-лист — это просто `is_available = 0`, скрывает позицию на публичной странице, но сохраняет историю. Фото проходит через sharp:
- сохраняем оригинал в webp 1200px (`image_url`),
- сохраняем превью 400px (`thumb_url`),
- удаляем загруженный временный файл.

---

## 8. Безопасность

- **Сессии**: HttpOnly + Secure + SameSite=Lax cookies, ротация ID при логине.
- **CSRF**: токен на каждой POST-форме, проверка перед обработкой.
- **Пароли**: argon2id, минимум 10 символов, без верхнего лимита.
- **Rate limit**: `/login` — 5 попыток / 15 минут / IP+email; `/reserve` — 10 / час / IP.
- **Manage-token брони**: 32 байта `crypto.randomBytes`, base64url. Только владелец ссылки может менять/отменять.
- **Загрузки**: проверка MIME и расширения, sharp-валидация что это реально изображение, лимит 5 МБ.
- **SQL**: только prepared statements better-sqlite3, никакой конкатенации.
- **Заголовки**: helmet-аналог через @fastify/helmet (CSP, HSTS, X-Content-Type-Options).
- **Логи**: pino без PII в продакшене (телефон/email маскируем).

---

## 9. Дизайн-направление «вкусно»

Цель — тепло, аппетитно, с характером ресторана; **не** дефолтный «кремовый фон + Playfair».

**Концепция:** журнал о еде, открытый на развороте. Крупная типографика как в меню,
много воздуха, контрастные фото блюд. Никакого глянца и градиентов-«вебтри».

**Палитра (CSS-переменные в `tokens.css`):**
- `--paper` `#F4EDE3` — фон, тёплая бумага
- `--ink` `#231F1B` — основной текст, почти чёрный с тёплым уклоном
- `--olive` `#3E4A2E` — тёмная зелень, бренд
- `--saffron` `#D98A2B` — акцент (CTA, теги)
- `--burgundy` `#6B1E2A` — глубокий бордо для редких акцентов
- `--cream` `#FBF7F1` — карточки на фоне `--paper`

**Типографика:**
- Display — **Tobias** или **Editorial New** (характерный современный serif). Запасной свободный вариант — **Fraunces**.
- Body — **Söhne** или свободная альтернатива **Inter** с настроенным трекингом.
- Цены и числа — табличные цифры (`font-variant-numeric: tabular-nums`).
- Eyebrow/категории в меню — капс, увеличенный трекинг, мелко.

**Сетка и ритм:**
- Базовый ритм 8px, типографическая шкала с явными размерами.
- Меню рендерим как разворот: две колонки на десктопе, одна на мобайле, точки-лидеры между названием и ценой (`flex` + `border-bottom: dotted`).

**Фотография:** одна большая фотография блюда на hero, остальные — сдержанные кадры. Без stock-эстетики.

**Анимация (сдержанно):**
- мягкий fade-in секций при скролле,
- hover-приподнимание карточек блюд,
- плавные переходы шагов формы брони,
- pulse на стол, на который хостес наводит при назначении.
- Обязательно `prefers-reduced-motion`. Не переанимировать.

**Тон копирайта:** на «вы», тепло, без рекламной шумихи. Кнопка говорит, что произойдёт: «Забронировать столик», «Перенести бронь», «Закрыть визит». Пустые состояния — приглашение к действию.

---

## 10. Нефункциональные требования

- ESLint без ошибок, Prettier применён.
- Сервисы (`src/services/*`) — максимально чистые функции, покрыты `node:test`.
- HTTP-слой — интеграционные тесты через supertest на ключевые сценарии (бронь, посадка, чаевые).
- Без JS публичные страницы должны быть полностью функциональны (форма брони отправляется обычным POST).
- Доступность: семантический HTML, видимый focus, контраст AA, навигация с клавиатуры.
- Адаптивность: mobile-first, ломаемся не реже трёх брейкпоинтов.
- Сид: 4 сотрудника (по одному на роль) с паролем `changeme`, ~20 позиций меню в 4 категориях, расставленный план зала на ~16 столов, демо-брони на сегодня/завтра.
- Один скрипт `npm run setup` = миграции + сид. `npm start` поднимает сервер.

---

## 11. План фаз (для Claude Code)

0. **Каркас**: Node + Fastify + плагины, структура папок, eta-шаблон с layout, CSS-токены, `npm scripts`, ESLint/Prettier, базовый `/` отдаёт «Hello». CLAUDE.md и проектные skills.
1. **БД и сервисный слой**: миграции, `src/db.js`, сервисы-обёртки с prepared statements, сид, тесты на сервисы.
2. **Дизайн-система и публичные страницы**: tokens.css, типографика, лендинг, /about, /menu (читает из БД).
3. **Доступность и бронирование (ядро)**: алгоритм `getAvailableSlots` как чистая функция + тесты на все кейсы, форма брони (с прогрессивным улучшением), письмо с manage-token, страница `/reserve/:token`.
4. **Аутентификация и роли**: /login, сессии, middleware, базовые «пустые» кабинеты под каждую роль.
5. **Хостес и план зала**: страница `/host`, SVG-карта, состояния столов, подтверждение/отказ/посадка, walk-in, лист ожидания, SSE-обновления.
6. **Редактор плана зала (ADMIN)**: `/admin/floor`, перетаскивание столов, сохранение, валидация.
7. **Кабинет официанта и визиты**: открытие/закрытие визита, ввод суммы и чаевых, статистика смены.
8. **Меню для шефа**: CRUD позиций, стоп-лист, загрузка и обработка фото через sharp.
9. **Персонал и смены (ADMIN)**: CRUD сотрудников, редактор смен, простой график на неделю.
10. **Чаевые: пул и распределение**: реализация POOL-режима, экран распределения, отчёты.
11. **Финальный проход**: безопасность (CSRF, rate-limit, helmet), доступность, мобайл, README, инструкции деплоя на VPS (Caddy + PM2/systemd).

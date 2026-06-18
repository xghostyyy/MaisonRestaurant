---
name: maison-design-system
description: Дизайн-система «Maison»: токены, типографика, компоненты, анимации, доступность, mobile-first
---

## Палитра (tokens.css)

```css
--paper: #F4EDE3;      /* основной фон */
--ink: #231F1B;        /* основной текст */
--olive: #3E4A2E;      /* бренд-зелёный */
--saffron: #D98A2B;    /* акцент, CTA */
--burgundy: #6B1E2A;   /* редкий акцент */
--cream: #FBF7F1;      /* карточки */
--ink-soft: #5C5650;   /* вторичный текст */
--border: #DDD5C8;     /* разделители */
```

## Типографика

- **Display**: `Fraunces` (serif, характерный, свободный) — заголовки h1–h3
- **Body**: `Inter` (sans-serif) — основной текст, формы, навигация
- Шрифты через Google Fonts: `<link>` в `<head>` layout.eta
- Цены: `font-variant-numeric: tabular-nums`
- Eyebrow/категории: uppercase, letter-spacing 0.08em, font-size 0.75rem

## Сетка и ритм

- Базовый ритм 8px
- Контейнер: max-width 1200px, padding 0 1.5rem
- Mobile-first: min-width breakpoints
  - `sm`: 640px, `md`: 768px, `lg`: 1024px
- Меню: две колонки на md+, одна на mobile
- Точки-лидеры: `flex` + пунктир между названием и ценой

## Компоненты

- `.btn`, `.btn--primary` (olive bg), `.btn--accent` (saffron bg)
- `.card` на `--cream` фоне
- `.form-group`, `.form-label`, `.form-input`
- `.toast` (JS-уведомления, `role="alert"`)
- `.tag` (аллергены, vegan, GF)

## Анимации (обязательно с prefers-reduced-motion)

```css
@media (prefers-reduced-motion: no-preference) {
  /* fade-in при скролле через IntersectionObserver */
  /* hover-приподнимание карточек */
  /* плавные переходы шагов формы */
  /* pulse на столе при наведении в floor map */
}
```

- Максимум: transform + opacity, duration ≤ 300ms, easing ease-out
- НЕ переанимировать. Один эффект на элемент.

## Доступность (обязательно)

- Видимый `:focus-visible` (outline 2px saffron, offset 2px)
- Контраст AA (ink на paper: ≥4.5:1)
- Семантический HTML: `<nav>`, `<main>`, `<article>`, `<section aria-label>`
- Формы: `<label for>` + `aria-describedby` для ошибок
- Toast: `role="alert"` + `aria-live="polite"`
- SVG план зала: `role="img"` с `<title>` и `aria-label` на интерактивных столах

## Тон копирайта

- На «вы», тепло, конкретно. Кнопки описывают действие: «Забронировать столик», «Перенести бронь».
- Пустые состояния — приглашение, не ошибка.
- Не использовать: «Нет данных», «Ошибка 404». Вместо: «Столы ещё не добавлены — добавьте первый».

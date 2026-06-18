---
name: availability-engine
description: Алгоритм getAvailableSlots: контракт, правила SPEC 7.1, обязательные тест-кейсы
---

## Контракт

```js
// src/services/reservations.js
getAvailableSlots(db, { date, partySize, settings, tables }) => Slot[]

// Slot = { time: 'HH:MM', tables: Table[] }
// Table = { id, label, seats, section }
```

## Алгоритм (раздел 7.1 SPEC)

1. Из `settings.open_hours_json` взять рабочие интервалы на день недели (0=вс…6=сб).
2. Нарезать интервал шагом `slot_granularity_min` → массив кандидатов `t`.
3. Для каждого `t`:
   - Найти столы: `seats >= partySize AND seats <= partySize + 2`
   - Исключить столы с конфликтующей бронью (статус `IN ('PENDING','CONFIRMED','SEATED')`
     и пересечение с окном `[t, t + dining_minutes + buffer_min]`)
   - Если сегодня и `t < now + min_lead_hours` — пропустить
   - Если `t > now + max_advance_days` — пропустить
4. Если подходящих столов нет — слот не включаем.
5. Возвращаем слоты с `tables` — клиент видит первый (минимум мест).

## Правила буфера

- Блокируется окно: `[starts_at, starts_at + dining_minutes + buffer_min)`
- `buffer_min` — уборка между броньями (default 15)
- `dining_minutes` — время стола под бронь (default 90)

## Гонки (транзакция)

При `POST /reserve`:
```js
db.transaction(() => {
  // 1. повторно проверить слот
  // 2. если конфликт → throw conflict
  // 3. INSERT reservation
})()
// конфликт → 409 Conflict
```

## Обязательные тест-кейсы (tests/reservations.test.js)

1. **happy path**: свободный стол → возвращает слот
2. **occupied**: конфликтующая бронь в том же окне → слот отсутствует
3. **buffer**: бронь заканчивается, но не прошёл buffer_min → слот отсутствует
4. **lead time**: слот раньше min_lead_hours от now → слот отсутствует
5. **max advance**: слот дальше max_advance_days → слот отсутствует
6. **party too big**: `partySize > seats` → стол не подходит
7. **party too small ratio**: `seats > partySize + 2` → стол не подходит
8. **rejected/cancelled брони не блокируют** → слот есть
9. **SEATED бронь блокирует** → слот отсутствует
10. **граница дня**: последний слот = `closeTime - dining_minutes` (слот заканчивается до закрытия)

## Формат open_hours_json

```json
{
  "1": [{"open":"12:00","close":"23:00"}],
  "2": [{"open":"12:00","close":"23:00"}],
  "0": [],
  "6": [{"open":"11:00","close":"00:00"}]
}
```
Ключ — `getDay()` (0=вс). Пустой массив — выходной.

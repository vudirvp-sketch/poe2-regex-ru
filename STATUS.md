# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **In-game верификация:** ✅ завершена | **Cross-family FP:** 0
> **Тесты:** ✅ 761/761 (25/25 файлов) | **Build:** ✅ проходит

---

## Исправлено (итерация 2)

| # | Баг | Исправление |
|---|-----|-------------|
| B1 | Vitest не резолвит path aliases — 24/25 тестов падают | Добавлен `resolve.alias` в секцию `test` в `vite.config.ts` |
| B2 | `FilterStoreApi` не экспортируется | ❌ Ложное срабатывание — интерфейс уже экспортирован |
| B3 | `pnpm-lock.yaml` + `package-lock.json` одновременно | Удалён `package-lock.json` |
| B4 | `.etl-cache/` не в `.gitignore` | Добавлен `.etl-cache/` в `.gitignore` |
| B5 | DP-factorizer генерирует `()?` — `?` не поддерживается в PoE2 regex | Заменён `()?` на `(|)` во всех местах dp-factorizer |

---

## Техдолг — исправлено (итерация 3)

| # | Проблема | Исправление |
|---|----------|-------------|
| D1 | VendorPage дублирует логику фильтров | Создан хук `useVendorPage` — бизнес-логика вынесена из компонента. VendorPage стал чистым рендером |
| D2 | Light theme CSS — ~100 строк `!important` с хардкоженными цветами | Добавлены CSS variables (`--lt-*`) для всех light-theme цветов. Хардкоженные значения заменены на `var(--lt-*)` |
| D3 | `profileCounter` не персистентится — коллизии ID | Счётчик вычисляется из существующих ID профилей через `deriveNextCounter()` — больше не зависит от памяти |
| D4 | `DIALECT_PAIRS` включает `['о', 'в', 'ов']` — лингвистически неверно | Удалена пара `о→в` (не фонологическая пара). Остальные пары подтверждены анализом данных |

---

## Дополнительные исправления (итерация 3)

| # | Проблема | Исправление |
|---|----------|-------------|
| B6 | `pnpm build` падает — `defineConfig` из `vite` не типизирует `test` | Рефакторинг `vite.config.ts` — alias-конфиг вынесен в переменную, `test` получает его через spread |

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser doesn't extract modCode for jewels → `jewelType` always "shared" | Open | Low |
| 2 | Enumerated ranges can FP on range notation numbers | Mitigated by `^`/`%` anchors | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**

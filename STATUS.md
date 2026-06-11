# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **In-game верификация:** ✅ завершена | **Cross-family FP:** 0
> **Тесты:** ✅ 761/761 (25/25 файлов) — vitest path aliases настроены

---

## Исправлено (итерация 2)

| # | Баг | Исправление |
|---|-----|-------------|
| B1 | Vitest не резолвит path aliases — 24/25 тестов падают | Добавлен `resolve.alias` в секцию `test` в `vite.config.ts` |
| B2 | `FilterStoreApi` не экспортируется | ❌ Ложное срабатывание — интерфейс уже экспортирован (`export interface FilterStoreApi`) |
| B3 | `pnpm-lock.yaml` + `package-lock.json` одновременно | Удалён `package-lock.json` |
| B4 | `.etl-cache/` не в `.gitignore` | Добавлен `.etl-cache/` в `.gitignore` |
| B5 | DP-factorizer генерирует `()?` — `?` не поддерживается в PoE2 regex | Заменён `()?` на `(|)` во всех местах dp-factorizer + обновлены комментарии в compute-optimizations.ts |

---

## Технический долг

| # | Проблема | Приоритет |
|---|----------|-----------|
| D1 | VendorPage дублирует логику фильтров вместо использования `useCategoryPage` | Средний |
| D2 | Light theme CSS — ~100 строк `!important` override вместо CSS variables | Низкий |
| D3 | `profileCounter` в profile-store не персистентится — коллизии ID профилей | Низкий |
| D4 | `DIALECT_PAIRS` включает `а→я`, `ы→е` — лингвистически спорные замены | Низкий |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**

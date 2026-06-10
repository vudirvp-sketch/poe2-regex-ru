# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 757 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Block model B1-B2 VERIFIED: `.*` НЕ пересекает границы аффикс-блоков
- Waystone/Tablet implicit reversed regex VERIFIED в игре
- ETL pipeline: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash
- VirtualizedModList v6: двухколоночный макет + scroll preservation (shared для ВСЕХ категорий)
- **Colon anchor VERIFIED в игре** — T1 и T3 подтверждены: `suffix.*: (number)` → FP больше не возникает
- **Scroll fix v7** — улучшенное scroll preservation: cleanup pending RAF/timeout, progressive measure+restore, setTimeout(0) safety net

---

## In-game верификация colon anchor (T1, T3) — ПОДТВЕРЖДЕНО

| # | Мод | Regex | Порог | Значение | Ожидание | Результат |
|---|-----|-------|-------|----------|----------|-----------|
| T1 | дополнительных редких монстров | `появляется.*: ([2-9]\|...)` | ≥2 | 1 | Не подсветить | ✅ Ничего не подсвечивает |
| T3 | дополнительных редких сундуков | `х редких с.*: ([3-9]\|...)` | ≥3 | 2 | Не подсветить | ✅ Ничего не подсвечивает |

**Старый regex (без colon anchor):** `suffix.*(number)` → FP от range notation `1(1-2)`, `2(2-3)`
**Новый regex (с colon anchor):** `suffix.*: (number)` → число обязано стоять после `: `, где rolled value

---

## Scroll fix верификация на проде

Результат: **плюс минус работает, но не идеально**. Улучшения в v7:
- Cleanup pending RAF/timeout при повторных кликах
- Progressive `virtualizer.measure()` + `scrollTop` restore (immediate → RAF → RAF → setTimeout(0))
- Оба режима (two-column и single-column) используют одинаковый паттерн

---

## Известные ограничения

Нет активных.

---

## ETL Commands

| Команда | Описание |
|---------|----------|
| `pnpm etl` | Запуск ETL с кешем (24h TTL) |
| `pnpm etl:fresh` | Очистка кеша + полный re-fetch |
| `pnpm etl:check-stale` | Проверка устаревания кеша |
| `pnpm etl -- --validate` | ETL + flat-text Oracle validation |
| `pnpm etl -- --validate-item` | ETL + block-based Oracle validation |

---

## ETL Results

| Категория | Токенов | Cross-family FP |
|-----------|---------|-----------------|
| amulet | 428 | 0 |
| belt | 298 | 0 |
| jewel | 193 | 0 |
| jewel-corrupted | 10 | 0 |
| jewel-desecrated | 47 | 0 |
| relic | 58 | 0 |
| ring | 369 | 0 |
| tablet | 84 | 0 |
| waystone | 156 | 0 |
| waystone-desecrated | 32 | 0 |
| **Итого** | **1675** | **0** |

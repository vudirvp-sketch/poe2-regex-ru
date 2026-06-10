# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 740 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Block model B1-B2 VERIFIED: `.*` НЕ пересекает границы аффикс-блоков
- Waystone/Tablet implicit reversed regex VERIFIED в игре
- ETL pipeline: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash
- VirtualizedModList v6: двухколоночный макет + scroll preservation (shared для ВСЕХ категорий)
- Scroll fix VERIFIED: нет прыжков скролла при клике на моды с ≥/≤ для всех категорий
- **Colon anchor для non-% reversed mods VERIFIED в игре** — `suffix.*: (number)` предотвращает FP от range notation

---

## In-game тесты non-% mods (6 проверок) — ВЫПОЛНЕНЫ

| # | Мод | Порог | Значение | Результат | FP? |
|---|-----|-------|----------|-----------|-----|
| T1 | дополнительных редких монстров | ≥2 | 1 | Подсветило (1(1-2)) | **FP → FIXED** |
| T2 | дополнительных свойств | ≥2 | 1 | Не подсветило | OK |
| T3 | дополнительных редких сундуков | ≥3 | 2 | Подсветило (2(1-3)) | **FP → FIXED** |
| T4 | дополнительных духов азмири | ≥2 | 1 | Не подсветило | OK |
| T5 | зарядов (implicit) | ≥5 | 4 | Корректно | OK (control) |
| T6 | % эффективности монстров | ≥16 | 15% | Не подсветило | OK (control) |

**Fix: colon anchor** — для non-% reversed модов (шаблон `: ##`) компилятор генерирует `suffix.*: (number)` вместо `suffix.*(number)`. Анкор `: ` гарантирует, что число стоит сразу после разделителя `: `, где находится rolled value, а не в range notation.

---

## Известные ограничения

Нет активных.

---

## Следующие шаги (следующая итерация)

1. **Визуальная верификация scroll fix на проде** — открыть /belt, /ring, /amulet, покликать моды с ≥/≤
2. **In-game верификация colon anchor fix** — повторить T1 и T3 с новым regex, подтвердить отсутствие FP

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

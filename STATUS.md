# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 729 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Block model B1-B2 VERIFIED: `.*` НЕ пересекает границы аффикс-блоков
- Waystone/Tablet implicit reversed regex VERIFIED в игре
- ETL pipeline: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash
- VirtualizedModList v6: двухколоночный макет + scroll preservation (shared для ВСЕХ категорий: jewel, belt, ring, amulet, waystone, tablet)
- Scroll fix VERIFIED: нет прыжков скролла при клике на моды с ≥/≤ для всех категорий (fix находится в VirtualizedModList — общий компонент)
- Reversed regex для non-% модов: `suffix.*number` генерируется корректно для модов с ## в конце шаблона

---

## Известные ограничения

1. **Non-% mods range notation FP** — Моды без `%` (например "дополнительных редких монстров: ##") используют reversed regex `suffix.*number` без `%` anchoring. При dual-indexing (если игра показывает "1(1-2)"), число "2" в range notation может матчиить фильтр ≥2 → FP. Риск низкий (малые диапазоны 1-2), требует in-game тест. Тесты: `tests/core/tablet-non-percent-fp.test.ts`.

---

## Следующие шаги (следующая итерация)

1. **In-game тестирование non-% mods FP** — 6 конкретных проверок (см. `tests/core/tablet-non-percent-fp.test.ts`, раздел "In-game verification plan")
2. **Визуальная верификация scroll fix на проде** — открыть /belt, /ring, /amulet, покликать моды с ≥/≤
3. **Возможная оптимизация**: контекстный anchoring для non-% mods — вместо `"азмири.*([2-9]...)"` использовать `"азмири:.*([2-9]...)"` (добавление `:` перед `.*`) для сужения совпадения и снижения FP от range notation

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

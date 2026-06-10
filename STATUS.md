# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 729 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Block model B1-B2 VERIFIED: `.*` НЕ пересекает границы аффикс-блоков
- Waystone/Tablet implicit reversed regex VERIFIED в игре
- ETL pipeline автоматизация: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash
- Icon normalization: все иконки 128x128 квадратный canvas
- VirtualizedModList v6: двухколоночный макет + useLayoutEffect scroll preservation + double-RAF restoration
- Chip expansion: мгновенное раскрытие (нет CSS-анимаций на layout-свойствах) + scroll position preservation при virtualizer.measure()
- JewelPage v4: двухколоночный макет с semantic sub-grouping + priority filter
- SPA hash fix: history.replaceState сохраняет hash при восстановлении маршрута
- **BUG FIX: reversed flag для non-implicit модов с ## в конце шаблона** — раньше `reversed=true` ставился только для `affix==='implicit'`, теперь также для модов типа "suffix: ##" (число в конце). Это критично для корректной генерации regex: `suffix.*number` вместо `number.*suffix`.

---

## Известные ограничения

1. **Non-% mods range notation FP** — Моды без `%` (например "дополнительных редких монстров: ##") используют reversed regex `suffix.*number` без `%` anchoring. При dual-indexing (если игра показывает "1(1-2)"), число "2" в range notation может матчить фильтр ≥2 → FP. Риск низкий (малые диапазоны 1-2), требует тест в игре. Тесты: `tests/core/tablet-non-percent-fp.test.ts`.

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

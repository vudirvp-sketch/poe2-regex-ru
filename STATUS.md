# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 693 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Sessions 50-82: Oracle validation, cross-family FP repair, ETL audit, VirtualizedModList, dual-slot ranges, jewel sub-headers, UI audit, profile panel, Ctrl+Shift+X, anchorStart (^), anchorEnd (%), chip-with-range CSS
- Block model B1-B2 VERIFIED: `.*` НЕ пересекает границы аффикс-блоков
- Waystone/Tablet implicit reversed regex VERIFIED в игре
- ETL pipeline автоматизация: normalize.ts + run-etl.ts фильтруют implicit-set бонусы и генерируют implicit токены
- Deploy починен: tsconfig.app.json — только `src/` в include
- ETL refresh: `--fresh` (очистка кеша), `--check-stale` (проверка устаревания), sourceHash в JSON
- Icon normalization: все иконки приведены к 128x128 квадратным canvas с прозрачным padding
- **VirtualizedModList layout fix v4**: переход с absolute на normal flow — устраняет наезжание категорий и модов при клике на чипах с диапазонами (belt, ring, amulet, jewel)

---

## Известные ограничения

1. **+## non-% mods range notation FP** — `+##` без `%` — ни `^`, ни `%` anchoring. FP возможен от range notation в описательной строке моды. Принято как ограничение. Требуется тест в игре для подтверждения.

---

## ETL Refresh Commands

| Команда | Описание |
|---------|----------|
| `pnpm etl` | Запуск ETL с кешем (24h TTL) |
| `pnpm etl:fresh` | Очистка кеша + полный re-fetch |
| `pnpm etl:check-stale` | Проверка устаревания кеша (exit 1 если stale) |
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

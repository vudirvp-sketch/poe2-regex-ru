# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 666 (Vitest) | **ETL токенов:** 1823 | **Cross-family FP:** 0

---

## Выполнено

- ✅ Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- ✅ Sessions 50-68: Oracle validation, cross-family FP repair, ETL audit, VirtualizedModList, dual-slot ranges, jewel sub-headers, UI audit, profile panel, Ctrl+Shift+X
- ✅ Session 69-70: Иерархия популярности аффиксов (S/A/B/C) + интеграция в UI
- ✅ Session 71-72: Аудит + багфикс (priorityFilter, waystone suffix classification)
- ✅ Session 74-75: Visual hierarchy fix, origin icons (webp), Level 1 decorative frames, mobile improvements
- ✅ Session 76: Decade grouping optimization (4.5x shorter), integration tests (16), orphaned tokens tests
- ✅ Session 77: Range warnings UI (⚠ Округл., ⚠ Диапазон), Phase 9a FP investigation
- ✅ Phase 9b (Session 78): `^` anchor verified in-game. `anchorStart` flag. 14 new tests.
- ✅ Phase 9c (Session 79): `%` suffix anchor verified. `anchorEnd` flag. 23 new tests.
- ✅ Session 80: Values-only token fix, FilterChip overflow, icon normalization
- ✅ Session 81: Per-chip range propagation, anchorEnd expanded to `##%` only, FilterChip overflow v2
- ✅ Session 82: excludeMode for ranged tokens, #% values-only anchorEnd fix, chip-with-range CSS

---

## Следующие шаги

### P1: Browser-тестирование (ручное)
- Запустить `pnpm dev`, проверить все страницы
- 3-уровневая визуальная иерархия, origin icons, decorative frames
- Priority tier filter toggle (ring/amulet/belt/waystone/tablet)
- Range warnings, per-token ranges, dual-slot ranges
- Jewel type sub-headers, search, scroll

### P2: ✅ DONE

### P3: ✅ DONE (^ anchor)

### P4: ✅ DONE (% suffix anchor)

### P5: Priority tier валидация
- Сопоставить тиры с живыми данными торговли

### P6: Мобильное тестирование
- Touch targets, scroll behavior, origin icon sizing

---

## Known Bugs / Limitations

1. **+## non-% mods range notation FP** — `+##` без `%` (напр. "+## к силе") — ни `^`, ни `%` anchoring. FP возможен. Known limitation.
2. **anchorEnd FN риск** — предметы где актуальный ролл имеет range notation (напр. `+27(22-27)%`) — после `27` стоит `(`, не `%`. Редкий случай.
3. **Waystone #% values-only** — enumeration без `%` anchor может иметь FP. Нужна in-game проверка.
4. **VendorPage numeric-only без чекбокса** — свойство с numericInput но без selectedIds может не попасть в regex.

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
| tablet | 82 | 0 |
| waystone | 311 | 0 |
| waystone-desecrated | 27 | 0 |
| **Итого** | **1823** | **0** |

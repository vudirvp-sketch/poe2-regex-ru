# PoE2 Regex RU — План реализации

> **Версия:** 1.9 | **Дата:** 2026-06-07
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (Session 50)

### Выполнено
- ✅ **Фаза 0-6:** Regex Oracle, number-regex fix, Trie/DP factorization, dialect optimizations, iterative optimizer
- ✅ **Фаза 7 (частично):** 86 hypothesis-driven тестов на реальных предметах
- ✅ **Фаза 8 (частично):** Mixed-conflict excludes, `!(A|B)` format, word truncation, post-i18n-override FP repair
- ✅ **Фаза 9 (Session 49):** AND-composed regex support via `regexPrefixContext` field — ETL + UI + documentation
- ✅ **Session 50:** Oracle validation now compiles regexPrefixContext; repairCrossFamilyFP() limit raised to 5 excludes; CONFLICT_MARKERS expanded

### Ключевые изменения Session 50
1. **Oracle validation fix** — `validateGeneratedRegexesItem()` now compiles regexPrefixContext as AND(context, regex) when present, matching UI behavior. This gives accurate FP counts.
2. **repairCrossFamilyFP() limit 3→5** — More excludes can be added, covering weapon-specific variants and projectile gem conflicts.
3. **CONFLICT_MARKERS expanded** — Added: самострелами, кинжалами, посохами, копьями, для.
4. **In-game tests** — Group M added to IN_GAME_TESTS.md (| inside (), number range with |).
5. **TS build fix** — `regexPrefixContext` default added to test helper.

### Ожидаемые FP после ETL re-run (~20-25 cross-family FP)
| Категория | Ожидаемый FP | Причина | Решение |
|-----------|-------------|---------|---------|
| amulet | ~7 | corrupted_5 (снарядов fix), minion mods (fixed by context) | ETL re-run покажет реальный счёт |
| jewel | ~6 | mod_am4lla, mod_4mxucf (нет context) | Увеличенный лимит excludes может помочь |
| jewel-desecrated | ~0 | Fixed by regexPrefixContext | — |
| ring | ~0 | Fixed by regexPrefixContext | — |
| tablet | ~3 | "быстрее", generic prefixes | i18n overrides если останутся |

---

## Следующие шаги (P1 → P2)

### P0: ETL re-run
Запустить `pnpm etl -- --validate-item` чтобы увидеть реальный эффект Session 50. Ожидается ~20-25 cross-family FP (вместо 62).

### P1: In-game тесты Group M
1. `|` внутри `()` — проверить `"([5-9]|[1-9].)"` в PoE2
2. Number range с `|` — `([4-9][0-9]|[0-9][0-9][0-9])`
3. Combined negate: `"!снарядов|чар"`

### P1: Optimizer expansion
Truncated forms в compute-optimizations.ts — учитывать regexPrefixContext при объединении.

### P2: UI/UX
1. List virtualization — belt (298), ring (366), amulet (427)
2. HomePage hardcoded counts
3. Multi-line mod handling

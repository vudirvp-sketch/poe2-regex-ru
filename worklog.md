# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 33 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (278/278 tests)

**Key Changes This Session:**

1. **ETL перегенерация JSON** — `pnpm etl` выполнен с новыми `[0-9]` паттернами:
   - Все 10 категорий перегенерированы: amulet(427), belt(298), jewel(193), jewel-desecrated(32), jewel-corrupted(10), relic(58), ring(366), tablet(75), waystone(97), waystone-desecrated(17)
   - 55 i18n-override токенов наложены

2. **ETL --validate** — Oracle-валидация всех регексов:
   - FP=1054 (ожидаемо: family-regex мэтчит все тиры одной семьи)
   - FN=73 (реальные баги в нескольких категориях: jewel-desecrated 15 FN, waystone 10 FN)
   - jewel-corrupted: все literal regexes валидны

3. **Проверка лимита 250 символов:**
   - Ни один regex в JSON не превышает 250 символов
   - Максимальная длина: tablet=57, amulet=47, belt=47
   - Худший случай компиляции RANGE (prefix + numberRegex + suffix): < 200 символов

4. **Фаза 2: Trie-факторизация** — `src/core/trie-factorizer.ts` создан:
   - `buildTrie()` / `buildReverseTrie()` — построение Trie
   - `findCommonPrefixes()` / `findCommonSuffixes()` — поиск общих групп
   - `factorize()` — факторизация набора строк (prefix, suffix, combined)
   - `batchFactorize()` — пакетная факторизация по категориям
   - `estimateSavings()` — оценка потенциальной экономии
   - `longestCommonPrefix()` / `longestCommonSuffix()` — утилиты
   - `tests/core/trie-factorizer.test.ts` — 40 тестов (Trie, prefix/suffix, factorization, PoE2 scenarios)

**NOT YET DONE:**
- Фаза 3: DP на Trie (`src/core/dp-factorizer.ts`)
- Фаза 4: Оптимизации диалекта PoE2
- Фаза 5: Итеративный цикл оптимизации
- Фаза 6: Интеграция Trie-факторизации в ETL пайплайн
- In-game тесты групп A-G из `docs/IN_GAME_TESTS.md`
- Исправление FN багов (73 false negatives в Oracle-валидации)

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
4. **FilterStoreApi type mismatch:** VendorPage must wrap Zustand store in FilterStoreApi adapter
5. **Number regex `.` bug:** FIXED — `.` was matching any char, now `[0-9]` matches only digits
6. **hasMultiPlaceholder missing in tests:** Always include `hasMultiPlaceholder: false` in test helpers
7. **Oracle FN in jewel-desecrated:** Regex suffix missing prefix parts (e.g., "брони, увеличение урона от атак" doesn't match "(5—10)% повышение брони, (4—8)% увеличение урона от атак")

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (278)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL with Oracle validation
npx tsx scripts/analyze-regexes.ts  # Analyze regex quality
pnpm dev                         # Development server
```

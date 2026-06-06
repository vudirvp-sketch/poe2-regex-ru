# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 32 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (238/238 tests)

**Key Changes This Session:**

1. **Фаза 0: Regex Oracle** — `src/core/regex-oracle.ts` создан:
   - `validateRegex()` — проверяет регекс на FP/FN против целевых/исключаемых текстов + лимит 250
   - `batchValidate()` — пакетная валидация всех регексов категории
   - `tests/core/regex-oracle.test.ts` — 25 тестов (basic, factorization, number patterns, FP, length limit, comprehensive, batch)
   - `--validate` флаг добавлен в `run-etl.ts` — шаг 8 ETL пайплайна

2. **Фаза 1: Исправление number-regex.ts** — критический багфикс:
   - `.` в числовых паттернах заменён на `[0-9]` (`.` матчит ЛЮБОЙ символ в PoE2, не только цифры)
   - `[4-9].` → `[4-9][0-9]`, `[0-9]..` → `[0-9][0-9][0-9]`, и т.д.
   - `round10` с однозначным числом: `.` → `[0-9]`
   - Все зависимые тесты обновлены: `compiler.test.ts`, `poe2-regex-matcher.test.ts`, `vendor-patterns.test.ts`, `tablet-patterns.test.ts`
   - Это УВЕЛИЧИТ длину регексов, но сделает их ПРАВИЛЬНЫМИ

3. **OPTIMIZER_PLAN.md** добавлен в корень проекта — план реализации оптимизатора

**NOT YET DONE:**
- Фаза 2: Trie-факторизация (`src/core/trie-factorizer.ts`)
- Фаза 3: DP на Trie
- `pnpm etl` для перегенерации JSON с новыми числовыми паттернами
- In-game тесты групп A-G из `docs/IN_GAME_TESTS.md`

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
4. **FilterStoreApi type mismatch:** VendorPage must wrap Zustand store in FilterStoreApi adapter
5. **Number regex `.` bug:** FIXED — `.` was matching any char, now `[0-9]` matches only digits
6. **hasMultiPlaceholder missing in tests:** Always include `hasMultiPlaceholder: false` in test helpers

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (238)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL with Oracle validation
npx tsx scripts/analyze-regexes.ts  # Analyze regex quality
pnpm dev                         # Development server
```

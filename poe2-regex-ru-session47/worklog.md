# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 47 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (471/471 tests)
**Oracle:** ETL re-run done (Session 46 output): 1490/1573 valid, 83 cross-family FP, 1042 family-tier FP, 0 FN. Re-run with Session 47 changes needed to see improvement.

**Key Changes This Session (Phase 8 — Mixed-conflict exclude + `!(A|B)` format):**

1. **Mixed-conflict `computeExcludePatterns()`** — Previously, minion marker and compound separator only triggered when ALL conflicts were the same type. Now: partial coverage is allowed. The algorithm accumulates short markers (minion `"Приспеш"`, compound `" и"`, short universal markers) until all conflicts are covered, instead of falling through to long specific patterns when types are mixed. This directly addresses the 39 cross-family FP in amulet where "повышение шанса критического удара" conflicted with both minion AND non-minion variants.

2. **`"!(A|B)"` combined exclude format** (`useCategoryPage.ts`) — Multiple exclude patterns are now combined into a single `EXCLUDE(OR([...]))` node, compiling to `"!A|B"` instead of separate `"!A" "!B"`. Semantically equivalent (both exclude items containing A OR B), but saves ~3 chars per additional exclude. The compiler already supported this format; the change was in how the AST is built from `regexExclude` arrays.

3. **Extended known markers** in `findShortUniversalMarker()` — Added: `"состояния"` (ailment/DOT), `"заканчив"` (debuff duration), `"воскреш"` (resurrect), `"во время"` (flask-effect), `"флакона"` (flask), `"умения"` (skill). These cover common cross-family FP patterns in jewel, ring, and amulet categories.

4. **Short-form excludes in Priority 4** — Instead of always generating `"suffix + firstWord"` (long specific pattern), Priority 4 now tries the first word after suffix alone as a short exclude first. Only falls back to the longer form if the short word isn't valid.

5. **Added 2 new tests** for mixed-conflict scenarios in `compute-regex.test.ts`.

**NOT YET DONE:**
- ⬜ Run ETL pipeline with Session 47 changes to measure Oracle improvement (expected: cross-family FP reduction from 83 to ~50-60)
- ⬜ Re-test `|` inside `()` with correct `"!X"` syntax in-game
- ⬜ Number range with `|` — verify `([6-9][0-9]|[0-9][0-9][0-9])` works in PoE2
- ⬜ Optimizer expansion — try truncated forms in `compute-optimizations.ts` for family grouping shared regex

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes.
3. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
4. **Description text not indexed:** Tooltip text like "Можно использовать в Машине картоходца" is NOT searchable — verified in-game.
5. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block. Use AND for cross-block search.
6. **Waystone implicits are NOT affixes:** Properties like "Уровень путевого камня" are base item properties, not from the mod system. Not in ETL data.
7. **`()` in regex = PoE2 grouping:** `containsPoE2Grouping()` filters `(` and `)` at generation time.
8. **Negate syntax `"!X"` only:** `!"X"` does NOT work in PoE2 — `!` must be inside quotes. Compiler already generates correct format.
9. **Word truncation = trailing substring only:** Mid-word extraction does NOT work in PoE2 substring search. "силе"→"сил"→"си" OK, but "еличен" from "увеличение" does NOT uniquely target the word.
10. **Mixed exclude types need combined markers:** When FP comes from both minion AND compound variants, a single exclude type won't cover all conflicts. The algorithm now accumulates markers.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (471)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation (accurate in-game sim)
pnpm analyze-fn                  # Analyze FN cases per category
pnpm optimize                    # Run iterative optimizer on generated JSON
pnpm optimize:dry                # Dry-run optimizer with verbose output
pnpm dev                         # Development server
```

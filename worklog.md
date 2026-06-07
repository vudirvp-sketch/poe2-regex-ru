# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 45 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (459/459 tests)
**Oracle:** Block-based: 1484/1573 valid, 89 cross-family FP, 1032 family-tier FP, 0 FN

**Key Changes This Session (cross-family FP fix):**

1. **Removed `isCompoundFamily()` exemption** — Previously, compound-family overlap (e.g., `к силе` matching `+(9—15) к силе и интеллекту`) was treated as "intentional". This was the #1 source of cross-family FP (155 out of 194). Now compound-family conflicts are real conflicts, forcing the algorithm to find disambiguated regexes.

2. **Added Strategy 1d: Negation for cross-family FP** (`compute-regex.ts`) — When a template suffix is not unique because it also appears in compound-family tokens, `computeExcludePatterns()` generates negation patterns. Example: `к силе` → `"к силе" !"к силе и" !"к силе,"`. New `regexExclude` field in `RegexResult` and `GameToken` stores these patterns.

3. **Fixed `substringSearchFallback()` paren-handling bug** — Cleaned text like `на %` (from `на (10—20)%`) didn't match rawText via PoE2 engine. Added multi-level fallback: cleaned text → further cleaned (trailing non-letters) → text before first paren → last resort full text. Each level validates via `regexMatchesRawText()` and `containsPoE2Grouping()`.

4. **Fixed waystone FN** — 4 mods with `Меткость монстров повышена на (##)%` now correctly use `Меткость монстров повышена на` as regex (text before first paren).

5. **Added 4 new tests** for negation regex in `regex-oracle.test.ts` (total: 459).

6. **Updated `applyI18nOverrides()`** in `run-etl.ts` — Removed compound-family exemption there too.

**Oracle improvement (Session 44 → 45):**

| Category | Before | After | Delta |
|----------|--------|-------|-------|
| amulet | 332/427 (95 FP) | 427/427 (0 FP) | ✅ Fixed |
| belt | 287/298 (11 FP) | 298/298 (0 FP) | ✅ Fixed |
| ring | 320/366 (46 FP) | 352/366 (14 FP) | +32 valid, -32 FP |
| jewel | 176/193 (17 FP) | 180/193 (11 FP) | +4 valid, -6 FP |
| jewel-desecrated | 16/32 (16 FP) | 17/32 (15 FP) | +1 valid |
| tablet | 70/75 (5 FP) | 71/75 (4 FP) | +1 valid |
| waystone | 93/97 (0 FP, 4 FN) | 97/97 (0 FP, 0 FN) | ✅ Fixed |
| waystone-desecrated | 16/17 (1 FP) | 17/17 (0 FP) | ✅ Fixed |
| **Total** | **1378/1573 (191 FP, 4 FN)** | **1484/1573 (89 FP, 0 FN)** | **+106 valid, -102 FP, -4 FN** |

**NOT YET DONE:**
- ⬜ Remaining 89 cross-family FP (mostly: minion mods matching across families, short generic suffixes like `увеличение урона` matching many composites, `к сопротивлению всем стихиям` matching minion variants)
- ⬜ jewel-desecrated 15 cross-family FP — dual-stat mods with short suffixes
- ⬜ Further optimize `regexExclude` patterns — some generate too many negation groups (e.g., jewel `увеличение области действия` gets 5+ exclude patterns)

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes.
3. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
4. **Description text not indexed:** Tooltip text like "Можно использовать в Машине картоходца" is NOT searchable — verified in-game.
5. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block. Use AND for cross-block search.
6. **Waystone implicits are NOT affixes:** Properties like "Уровень путевого камня", "размер групп", "количество предметов" are base item properties, not from the mod system. Not in ETL data. Verified.
7. **`()` in regex = PoE2 grouping (FIXED Session 44):** `containsPoE2Grouping()` now filters `(` and `)` at generation time.
8. **Compound-family FP (FIXED Session 45):** `isCompoundFamily()` exemption removed. Cross-family FP now use negation (`regexExclude`).

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (459)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation (accurate in-game sim)
pnpm analyze-fn                  # Analyze FN cases per category
pnpm optimize                    # Run iterative optimizer on generated JSON
pnpm optimize:dry                # Dry-run optimizer with verbose output
pnpm dev                         # Development server
```

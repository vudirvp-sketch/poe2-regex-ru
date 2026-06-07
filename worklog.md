# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 48 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (471/471 tests)
**Oracle:** 1511/1573 valid, 62 cross-family FP, 1062 family-tier FP, 0 FN (was 77 cross-family FP in Session 47)

**Key Changes This Session (Phase 8 — Post-i18n-override FP repair):**

1. **`repairCrossFamilyFP()` in run-etl.ts** — New ETL step after i18n overrides that detects and fixes cross-family FP caused by rawText changes. The core issue: i18n overrides replace rawText of some tokens AFTER regex computation, making previously-unique regexes match the new (Russian) text of other families. The repair step:
   - Scans ALL tokens for cross-family FP (regex matches other-family rawText)
   - Tries lengthening the regex to the full template suffix (e.g., "скорости сотворения чар" → "повышение скорости сотворения чар" for cast speed)
   - Adds missing exclude patterns from known markers and first-word-after-suffix extraction
   - Iterates until no more improvements can be made
   - Always writes `regexExclude` in locale-object format `{ru: [...]}` for Oracle compatibility

2. **Known conflict markers** for `repairCrossFamilyFP()`: `Приспеш` (minion), `во время` (flask-effect), `флакона` (flask), `снарядов` (projectile gems), `всем стихиям` (all-resist), `умений` (gem skills vs skills).

**ETL Pipeline Order (updated):**
```
fetch → parse → normalize → compute-regex → compute-optimizations → generate JSON
→ jewel type map → i18n overrides → repairCrossFamilyFP → validate
```

**Per-category FP (Session 48):**
| Category | valid/total | cross-family FP |
|----------|-------------|-----------------|
| amulet | 408/427 | 19 (was 33) |
| belt | 298/298 | 0 |
| jewel-corrupted | 10/10 | 0 |
| jewel-desecrated | 17/32 | 15 (unchanged) |
| jewel | 182/193 | 11 (unchanged) |
| relic | 58/58 | 0 |
| ring | 352/366 | 14 (unchanged) |
| tablet | 72/75 | 3 (was 4) |
| waystone | 97/97 | 0 |
| waystone-desecrated | 17/17 | 0 |

**Remaining cross-family FP breakdown (62 total):**
- **amulet (19):** minion elemental resist FP, minion damage vs flask-effect, corrupted gem level
- **ring (14):** minion damage matches generic "увеличение урона" (8), minion elemental resist matches "всем стихиям" (4), other (2)
- **jewel-desecrated (15):** composite dual-stat mods sharing second-stat suffixes — needs AND-composed regex support
- **jewel (11):** short generic suffixes ("быстрее", "увеличение урона", "повышение скорости атаки") matching across families
- **tablet (3):** "быстрее", "увеличение количества находимых", "путевых кам"

**NOT YET DONE:**
- ⬜ Ring minion damage FP (8) — needs AND-composed regex or positive context anchor (e.g., `"имеют" "увеличение урона"`)
- ⬜ Ring minion elemental resist FP (4) — exclude "всем стихиям" is invalid (appears in target family); needs different regex strategy
- ⬜ Jewel-desecrated composite FP (15) — fundamental: dual-stat mods share suffix across different composite families. Needs AND-composed regex like `"повышение брони" "увеличение урона от атак"`
- ⬜ Jewel generic suffix FP (11) — needs more specific excludes or longer regexes
- ⬜ Re-test `|` inside `()` with correct `"!X"` syntax in-game
- ⬜ Number range with `|` — verify `([6-9][0-9]|[0-9][0-9][0-9])` works in PoE2
- ⬜ Optimizer expansion — truncated forms in compute-optimizations.ts family grouping

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
11. **i18n overrides cause cross-family FP:** Overrides change rawText AFTER regex computation. The `repairCrossFamilyFP()` step fixes this, but AND-composed regex support is needed for cases where excludes alone can't help.
12. **regexExclude format must be locale-object:** Always write `{ru: [...]}` not plain array `[...]`. The Oracle validation reads `token.regexExclude?.ru`.

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

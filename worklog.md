# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 28 — 2026-06-06)

**Build:** `npx vite build` passes, `npx vitest run` passes (213/213 tests)

**ETL Results (latest run — Session 27 data, needs re-run):**

| Category | Tokens | Optimizations | Short regex (<5) |
|----------|--------|---------------|-------------------|
| waystone | 96 | 52 | 0 |
| waystone-desecrated | 16 | 4 | 0 |
| tablet | 75 | 363 | 0 |
| jewel | 193 | 1,466 | 0 |
| jewel-desecrated | 21 | 3 | 0 |
| jewel-corrupted | 10 | 0 | 0 |
| relic | 58 | 28 | 0 |
| belt | 298 | 231 | 0 |
| ring | 366 | 458 | 0 |
| amulet | 427 | 389 | 1 (i18n override) |
| **Total** | **1,560** | | |

---

### Session 28 Changes — Iteration 22

**`\d` revert (VERIFIED IN-GAME):**
- `number-regex.ts`: Reverted `[0-9]` → `\d` (saves 2 chars × 7 occurrences = 14 chars)
- In-game test confirmed `\d` works in PoE2 search engine

**Dual-number mod ETL:**
- `compute-regex.ts`: `extractTemplatePrefix()` min prefix = 2 for dual-number templates ("до" pattern)
- New field `hasMultiPlaceholder` in `RegexResult`, `GameToken`, `FamilyGroup`
- New field `filterSlotIndex` in `FamilyGroup` (always 0 = first placeholder)
- `generate-dictionary.ts`: passes `hasMultiPlaceholder` to GameToken

**Desecrated dual-stat regex:**
- `compute-regex.ts` Strategy 1b: Extract text after comma from rawText, strip leading numbers
- Strategy 1c: Full second stat fallback for dual-stat mods
- Prevents garbage regexes like `"и, (4—8)% увеличение урона о"`

**Breachborn familyKey fix:**
- `run-etl.ts`: Recompute `familyKey.ru`, `hasMultiPlaceholder`, `regexPrefix.ru` in `applyI18nOverrides()`
- Fixes 42 tokens with English familyKey in amulet/ring/belt

---

## Known Issues (Remaining)

| Priority | Issue | Status |
|----------|-------|--------|
| HIGH | Full ETL re-run needed to populate `regexPrefix`, `hasMultiPlaceholder`, fix `familyKey` in JSONs | Run `pnpm etl` locally |
| MEDIUM | Number boundary false positives: `[4-9].` matches `6%` (single-digit + non-digit) | PoE2 regex limitation, no fix |
| MEDIUM | UI for dual-number mods: `hasMultiPlaceholder`/`filterSlotIndex` not yet in UI | Next iteration |
| INFO | 1 i18n override token has regex <5 chars | Acceptable |
| INFO | 51 tokens use i18n overrides | Handled by i18n-overrides.json |
| LOW | VendorPage GROUP_ORDER + GROUP_COLORS hardcoded Russian | By design |

---

## Build & Run Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Production build
pnpm test             # Run all tests (213)
pnpm etl              # Run ETL pipeline (needs network or .etl-cache/)
pnpm dev              # Development server
```

## Key Architecture

- **ETL:** `scripts/run-etl.ts` → fetch → parse → normalize → compute-regex → compute-optimizations → generate JSON → i18n overrides
- **Data:** `public/generated/*.json` (10 files)
- **UI Pages:** `src/ui/pages/{category}/` — each uses `useCategoryPage()` hook (except VendorPage)
- **Components:** `src/ui/components/` — ModList, FilterChip, RegexOutput, CategoryControlPanel, ProfilePanel, VendorChip, PageStateWrapper
- **i18n:** `src/shared/i18n.ts` — t() function with 130+ keys
- **Classifier:** `src/shared/mod-classifier.ts` — semantic, sentiment, tablet-type, jewel-type (static lookup + weighted scoring fallback)
- **Regex Engine:** `src/core/` — AST, compiler, optimizer, number-regex
- **Store:** `src/store/` — Zustand filter store, profile store, URL sync

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json` and `run-etl.ts` `applyI18nOverrides()`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
4. **FilterStoreApi type mismatch:** VendorPage must wrap Zustand store in FilterStoreApi adapter (not pass .getState())
5. **Number boundary:** `[4-9].` matches `6%` in PoE2 — known limitation, use prefix anchoring to mitigate

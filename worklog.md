# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 25 — 2026-06-06)

**Build:** `pnpm build` passes, `pnpm test` passes (204/204 tests)

**ETL Results (latest run):**

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

### Session 25 Changes — Jewel Type Sub-Grouping UX + Scoring Cleanup + Docs Compress

**FEATURE — Jewel type sub-grouping UX:**
- Added `'jewel-type'` to `ModGroupMode` union in mod-classifier.ts
- `classifyGroups()` now handles `'jewel-type'` mode — groups by ruby/emerald/sapphire/shared
- ModList.tsx: new `showJewelTypeSubGroups` + `jewelTypeFilter` props
- When specific type selected: only that type + "Общие" sub-headers shown (empty headers hidden)
- When "all" selected: all 4 sub-headers shown
- JewelPage passes `showJewelTypeSubGroups` + `jewelTypeFilter={jewelTypeFilter}`
- Layout: Обычные → Префикс/Суффикс → Рубин/Изумруд/Сапфир/Общие sub-headers

**CLEANUP — Weighted scoring rules:**
- Fixed "крич" → "клич" warcry typo (was 0 matches, now matches correctly)
- Fixed `/сил[ауе].*поджог/` → added `ы` declension + `увеличен.*силы.*поджог` alternation
- Removed ~15 duplicate/overlapping rules across RUBY/EMERALD/SAPPHIRE scores:
  - RUBY: removed generic /поджог/ w=1 (subsumed), /порог.*оглушен/ w=1 (subsumed by /оглушен/),
    /урон.*по.*враг.*разрушен.*брон/ w=3 (subsumed by /разруш.*брон/ w=3)
  - EMERALD: removed duplicate /порог.*оглушен.*парир/ (inside Парирован alternation),
    duplicate /восстановлен.*ман.*флакон/ (in flask alternation),
    /цепи.*окруж/, /урон.*снарядами.*если.*ближн.*бо/, /урон.*ближн.*бо.*если.*снаряд/ (subsumed by снаряд rules)
  - SAPPHIRE: removed duplicate /сопротивлен.*холод/ w=1, /максимальн.*сопротивлен.*холод/ w=2 (subsumed),
    /приспешник.*скорост.*атак.*сотворени/ (subsumed by /скорост.*сотворени.*чар/),
    /приспешник.*сопротивлен.*стих/ w=2 (exact duplicate of w=3),
    /порог.*оглушен.*максимум.*энергетическ/, /порог.*состоян.*максимум.*энергетическ/ (subsumed by ES threshold)
- Zero classification accuracy loss (JEWEL_TYPE_LOOKUP covers 100% of current mods)

**UI — Tablet Экспедиция:**
- Added tooltip + opacity-60 to "Экспедиция" button in TabletPage
- Note: "Экспедиционные плитки временно отсутствуют в игре (лига Руны Альдура). Кнопка оставлена для будущего контента."
- Button kept functional for future content

**DOCS — Architecture compression:**
- ARCHITECTURE.md: 1023 → 518 lines (~49% reduction)
- Compressed iterations 2-6 from ~440 lines to ~30 lines
- Removed duplicate Per-Tab tables, Invariants Preserved blocks, DONE Remaining items
- Added Iteration 17 section
- Updated Per-Tab Grouping Modes table (Jewel: origin + showJewelTypeSubGroups)
- Updated AGENT_NAVIGATION.md to version 22.0, iteration 17

---

## Known Issues (Remaining)

| Priority | Issue | Status |
|----------|-------|--------|
| INFO | 1 i18n override token has regex <5 chars (amulet fire spell crit breachborn) | Acceptable |
| INFO | 51 tokens use i18n overrides (poe2db.tw lacks Russian text) | Handled by i18n-overrides.json |
| LOW | VendorPage GROUP_ORDER + GROUP_COLORS labels are hardcoded Russian | By design (vendor-specific) |
| LOW | Remaining pages that might still use inline loading/error: none left | All refactored |

---

## Build & Run Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Production build
pnpm test             # Run all tests (204)
pnpm etl              # Run ETL pipeline (needs network or .etl-cache/)
pnpm dev              # Development server
```

## Key Architecture

- **ETL:** `scripts/run-etl.ts` → fetch → parse → normalize → compute-regex → compute-optimizations → generate JSON
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

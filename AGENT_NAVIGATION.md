# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 90.0 | **Date:** 2026-06-10 | **Tests:** 693 (Vitest)

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Business logic. Pure TS, no React. | **Tests mandatory.** No DOM/React/Zustand imports. |
| `src/strategies/` | Locale-specific logic. Currently only RU. | Can import from `src/shared/` and `src/core/`. |
| `src/ui/` | React components. | Each file < 300 lines. Import from `@core`, `@shared`, `@data`, `@store`. |
| `src/store/` | Zustand stores. | One store per domain. Import from `@shared`. |
| `src/data/` | JSON loading + vendor-properties. | Proxies `fetch()` → typed objects. Import from `@shared`. |
| `src/shared/` | Types, i18n, classifier, priority tiers. | **No imports from other src/ directories.** |
| `scripts/etl/` | ETL pipeline + iterative optimizer. | Run via `pnpm etl`. Output to `public/generated/`. |
| `public/generated/` | Read-only artifacts. | **NEVER edit manually.** Created only by ETL. |
| `public/icons/` | Category + origin icons (128x128, square). | Pre-normalized with transparent padding. |
| `tests/` | Test files mirror `src/` structure. | 23 files, 693 tests. |
| `регис/` | Reference: Russian mod lists, analysis reports, affix hierarchy. | Cross-validation data for ETL. |

**Key source files:**
- `src/shared/types.ts` — All public types (GameToken, FamilyGroup, ASTNode, CategoryData with sourceHash)
- `src/shared/mod-classifier.ts` — Origin/semantic classification, ORIGIN_SECTION_LABELS
- `src/store/filter-store.ts` — FilterStore, TokenRangeOverride, SlotRangeOverride
- `src/data/vendor-properties.ts` — VendorProperty interface (canonical source, do not duplicate)
- `src/core/compiler.ts` — AST → regex string compilation
- `src/core/ast.ts` — AST node builders including `range()` with anchors
- `src/core/regex-oracle.ts` — Validation (flat-text + block-based)
- `scripts/etl/fetch-poe2db.ts` — Fetch with cache, `clearCache()`, `getCacheInfo()`, `hashContent()`

---

## 2. Build & Test Commands

```bash
pnpm install                                                          # Install dependencies
pnpm dev                                                              # Start dev server
pnpm build                                                            # Production build
npx vitest run                                                        # Run tests (693, Vitest)
pnpm etl                                                              # Run ETL pipeline (uses cache, 24h TTL)
pnpm etl:fresh                                                        # Clear cache + full re-fetch from poe2db
pnpm etl:check-stale                                                  # Check cache staleness (exit 1 if stale)
pnpm etl -- --validate                                                # ETL + flat-text Oracle validation
pnpm etl -- --validate-item                                           # ETL + block-based Oracle validation
pnpm optimize                                                         # Run iterative optimizer on generated JSON
pnpm optimize:dry                                                     # Dry-run optimizer with verbose output
```

---

## 3. Agent Workflow

1. Read `AGENT_NAVIGATION.md` (this file)
2. Execute the current iteration's tasks
3. Write tests for new code
4. Run `npx vitest run` and `pnpm build` — both must pass
5. **NEVER** touch `public/generated/` manually

---

## 4. Pre-Commit Checklist

- [ ] `pnpm build` passes without errors
- [ ] `npx vitest run` passes (693 tests)
- [ ] No `any` types (except merge functions)
- [ ] No hardcoded mod strings in UI/Engine code
- [ ] New files are in the correct directories per §1

---

## 5. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
  ^        ^        ^          ^       ^      ^
  +--------+--------+----------+-------+------+
  (shared can be imported by everyone, nothing imports from ui)
```

- `shared` → imports nothing from `src/`
- `core` → imports only from `shared`
- `strategies` → imports from `shared`, `core`
- `store` → imports from `shared`, `core`, `strategies`
- `data` → imports from `shared`
- `ui` → imports from everyone

---

## 6. Invariants (NEVER VIOLATE)

- Character limit = 250 (`str.length`, NOT `TextEncoder`)
- Core Layer (`src/core/`) — ZERO dependencies. No React, DOM, or Zustand imports.
- `public/generated/` — READ-ONLY. Created ONLY by ETL scripts.
- No hardcoded mod strings in UI or Engine code. Only internal_id references and i18n lookups.
- pnpm is the ONLY package manager. Never use npm or yarn.
- Locale type is `'ru'` now. Type system must support extension (`Locale = 'ru' | 'en' | ...`).
- PoE2 regex dialect is NOT standard PCRE — see `docs/ARCHITECTURE.md` §5.
- **tsconfig.app.json includes ONLY `src/`** — tests and scripts are NOT compiled by `tsc -b`.
- **@tanstack/react-virtual: `getSize()` is private** — use `virtualItem.start`/`.end` + `getTotalSize()` instead.

---

## 7. Known Issues & Remaining Work

### TODO (next iterations)
1. **+## non-% mods range notation FP** — Known limitation, needs in-game test.
2. **Mobile adaptation** — Not a priority per user request.

### CONFIRMED INTENTIONAL
1. **Waystone corrupted+delirious** — Both selectable simultaneously; a waystone CAN be both.
2. **Tablet rarity regex** — Patterns 'обычн', 'волшебн', 'редк' are specific enough.
3. **Origin color mapping** — Очернённые=emerald, Осквернённые=red, Сущность=amber, Разлом=violet.
4. **GitHub Pages 404 in DevTools** — SPA routes show 404 in Network tab; `404.html` handles redirect. Not a bug.

---

## 8. FP Prevention Strategy (3 Levels)

| Level | Method | When used | FP prevented | FN risk |
|-------|--------|-----------|-------------|---------|
| 1 | `^` (anchorStart) | Template starts with `##` | Numbers from range notation at non-zero positions | None |
| 2 | `%` suffix anchor (anchorEnd) | Template has `##%` AND anchorStart=false | Numbers not followed by `%` | Items where actual roll has range notation |
| 3 | Enumeration | Range ≤ 50 (compact decade grouping) | Secondary numbers not matching enumerated values | None |

---

## 9. ETL Refresh & Source Change Detection

### Cache Management
- ETL caches HTML pages in `.etl-cache/` with 24h TTL
- `--fresh` clears all cache before fetching
- `--check-stale` reports cache status per URL, exits with code 1 if any stale

### Source Hash (Change Detection)
- Each ETL run computes a `sourceHash` — SHA-256 prefix of all cached HTML
- Stored in `CategoryData.sourceHash` in generated JSON
- When hashes differ → source data changed → re-run ETL

### API (`scripts/etl/fetch-poe2db.ts`)
- `fetchPage(url, useCache)` — fetch with retry + cache
- `clearCache()` — delete all cached HTML files
- `getCacheInfo(url)` — returns `CacheEntryInfo`
- `hashContent(content)` — SHA-256 16-char prefix

---

## 10. Icon Normalization

All icons in `public/icons/` are **128x128** square canvases with transparent padding.

---

## 11. Regex Strategy Pipeline (ETL)

| Strategy | Name | Description |
|----------|------|-------------|
| 1 | Template-family suffix | Text after last `##` |
| 1b | Suffix lengthening | Include text between `##` and suffix |
| 1c | Full second stat | Dual-stat suffix join |
| 1d | Negation | Suffix + short exclude patterns |
| 1e | Word Truncation | Truncate words + optional negate |
| 1f | AND-composed Context | regexPrefixContext + regex |
| 2 | Substring fallback | Brute-force unique substring search |

---

## 12. Oracle API

| Function | Matching | Use case |
|----------|----------|----------|
| `validateRegex()` | Flat-text | ETL single-mod validation |
| `validateRegexItem()` | Block-based | In-game behavior simulation |
| `batchValidate()` | Flat-text, batch | ETL `--validate` |
| `batchValidateItem()` | Block-based, batch | ETL `--validate-item` |

FP categorization: `familyTierFP` = same familyKey (by design), `crossFamilyFP` = different familyKey (real bugs).

---

## 13. VirtualizedModList Architecture (v5)

### Two-column layout
- Prefix and suffix columns rendered side by side via `grid grid-cols-[2fr_3fr]`
- Each column has its own `@tanstack/react-virtual` virtualizer
- Both virtualizers share the same scroll container (`<main id="main-content">`)
- When affix filter narrows to one type → falls back to single full-width column

### Spacer calculation
- Uses `virtualItem.start` / `virtualItem.end` + `getTotalSize()` (public API)
- **Never** use `virtualizer.getSize(i)` — it's private in newer @tanstack/react-virtual

### Chip expansion (scroll-safe)
- FilterChip adds `chip-with-range` CSS class when selected with range inputs
- CSS forces `flex-basis: 100%` for expanded chips (prevents overlap)
- **Instant expansion** — no CSS transitions on layout properties (flex-basis/width/max-width)
- `transition-[background-color,border-color,color,opacity]` — only visual properties animate
- `virtualizer.measure()` preserves scroll position (capture before, restore after)
- `chip-range-slide-in` keyframe: subtle opacity+translateY for range inputs only

---

## 14. Documentation Map

| File | Purpose |
|------|---------|
| `AGENT_NAVIGATION.md` | This file — start here, rules, structure, known issues |
| `docs/ARCHITECTURE.md` | Layer diagram, data flow, PoE2 regex dialect, compiler |
| `docs/DATA_CONTRACTS.md` | TypeScript interfaces for all data types |
| `docs/ETL_GUIDE.md` | ETL pipeline, source URLs, parsers, i18n overrides |
| `docs/IN_GAME_TESTS.md` | In-game regex verification results |
| `STATUS.md` | Project status summary |
| `регис/` | Reference data for cross-validation |

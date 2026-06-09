# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 85.0 | **Date:** 2026-06-10 | **Tests:** 693 (Vitest)

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
| `tests/` | Test files mirror `src/` structure. | 23 files, 693 tests. |
| `регис/` | Reference: Russian mod lists, analysis reports, affix hierarchy. | Cross-validation data for ETL. |

**Key source files:**
- `src/shared/types.ts` — All public types (GameToken, FamilyGroup, ASTNode, etc.)
- `src/shared/mod-classifier.ts` — Origin/semantic classification, ORIGIN_SECTION_LABELS
- `src/store/filter-store.ts` — FilterStore, TokenRangeOverride, SlotRangeOverride
- `src/data/vendor-properties.ts` — VendorProperty interface (canonical source, do not duplicate)
- `src/core/compiler.ts` — AST → regex string compilation
- `src/core/ast.ts` — AST node builders including `range()` with anchors
- `src/core/regex-oracle.ts` — Validation (flat-text + block-based)

---

## 2. Build & Test Commands

```bash
pnpm install                                                          # Install dependencies
pnpm dev                                                              # Start dev server
pnpm build                                                            # Production build
npx vitest run --root /home/z/my-project/poe2-regex-ru               # Run tests (693, Vitest)
pnpm etl                                                              # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate                                                # ETL + flat-text Oracle validation
pnpm etl -- --validate-item                                           # ETL + block-based Oracle validation
pnpm analyze-fn                                                       # Analyze FN/FP per category
pnpm optimize                                                         # Run iterative optimizer on generated JSON
pnpm optimize:dry                                                     # Dry-run optimizer with verbose output
```

---

## 3. Agent Workflow

1. Read `AGENT_NAVIGATION.md` (this file)
2. Execute the current iteration's tasks
3. Write tests for new code
4. Run `npx vitest run --root /home/z/my-project/poe2-regex-ru` and `pnpm build` — both must pass
5. **NEVER** touch `public/generated/` manually

---

## 4. Pre-Commit Checklist

- [ ] `pnpm build` passes without errors
- [ ] `npx vitest run --root /home/z/my-project/poe2-regex-ru` passes (693 tests)
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
- **tsconfig.app.json includes ONLY `src/`** — tests and scripts are NOT compiled by `tsc -b` (production build). Tests run via vitest, scripts via tsx.

---

## 7. Known Issues & Remaining Work

### TODO (next iterations)
1. **Priority tier refinement** — Validate tier classifications against live trade data.
2. **+## non-% mods range notation FP** — For `+##` mods without `%` (e.g. "+## к силе"), neither `^` nor `%` anchoring is available. FP from range notation possible. Known limitation, no current solution.
3. **Icon normalization** — Icons have different aspect ratios (relic 45×89, belt 94×39). CSS maxHeight/maxWidth handles display, but could pre-normalize to square canvases.

### CONFIRMED INTENTIONAL
1. **Waystone corrupted+delirious** — Both selectable simultaneously; a waystone CAN be both.
2. **Tablet rarity regex** — Patterns 'обычн', 'волшебн', 'редк' are specific enough.
3. **Jewel/relic/vendor no priority filter** — These categories return 'C' for all mods, toggle not shown.
4. **Origin color mapping** — Очернённые=emerald, Осквернённые=red, Сущность=amber, Разлом=violet.
5. **GitHub Pages 404 in DevTools** — SPA routes show 404 in Network tab; `404.html` handles redirect. Not a bug.

---

## 8. FP Prevention Strategy (3 Levels)

| Level | Method | When used | FP prevented | FN risk |
|-------|--------|-----------|-------------|---------|
| 1 | `^` (anchorStart) | Template starts with `##` | Numbers from range notation at non-zero positions | None |
| 2 | `%` suffix anchor (anchorEnd) | Template has `##%` AND anchorStart=false | Numbers not followed by `%` | Items where actual roll has range notation |
| 3 | Enumeration | Range ≤ 50 (compact decade grouping) | Secondary numbers not matching enumerated values | None |

**Detection logic in `useCategoryPage.ts`:**
- `anchorStart=true` when `/^##/.test(rawTextTemplate[locale])`
- `anchorEnd='%'` when `anchorStart=false` AND `/##%/.test(rawTextTemplate[locale])` (double-hash only — `#%` values-only excluded because it causes 100% FN)

---

## 9. Regex Strategy Pipeline (ETL)

`computeMinimalUniqueSubstring()` in `scripts/etl/compute-regex.ts`:

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

## 10. Oracle API

Two validation modes in `src/core/regex-oracle.ts`:

| Function | Matching | Use case |
|----------|----------|----------|
| `validateRegex()` | Flat-text | ETL single-mod validation |
| `validateRegexItem()` | Block-based | In-game behavior simulation |
| `batchValidate()` | Flat-text, batch | ETL `--validate` |
| `batchValidateItem()` | Block-based, batch | ETL `--validate-item` |

FP categorization: `familyTierFP` = same familyKey (by design), `crossFamilyFP` = different familyKey (real bugs).

---

## 11. i18n Conventions

- `home.title` = "Генератор поисковых строк" (no "PoE2 Regex" — avoids triple duplication)
- `home.subtitle` = "Для Path of Exile 2 — русский клиент"
- Sidebar: "PoE2 Regex" appears once in logo, "Русский клиент" as muted subtitle
- All other labels use generic Russian without client qualifiers

---

## 12. Numeric Input Rules

All `<input type="number">` must include `step={1}` (or `step="1"`). PoE2 mod values are always integers. Applies to: FilterChip range inputs, CategoryControlPanel global range, VendorChip numeric threshold, TabletPage remaining input.

---

## 13. Keyboard Shortcuts

- **Ctrl+Shift+X** — Copy regex to clipboard (also handles Russian layout: X→Ч)

---

## 14. Cross-Family FP Repair (Post-ETL)

After i18n overrides, `repairCrossFamilyFP()` in `run-etl.ts` iterates per token:
1. **Suffix lengthening** — upgrade to full template suffix
2. **Exclude patterns** — add short negation markers (CONFLICT_MARKERS)
3. **regexPrefixContext** — AND-composed context substring

**Known exclude markers:** Приспеш, и, состояния, заканчив, воскреш, во время, флакона, умения, and weapon types.

**Exclude limit:** 8 patterns per token.

---

## 15. Documentation Map

| File | Purpose |
|------|---------|
| `AGENT_NAVIGATION.md` | This file — start here, rules, structure, known issues |
| `docs/ARCHITECTURE.md` | Layer diagram, data flow, PoE2 regex dialect, compiler, visual hierarchy |
| `docs/DATA_CONTRACTS.md` | TypeScript interfaces for all data types |
| `docs/ETL_GUIDE.md` | ETL pipeline, source URLs, parsers, i18n overrides |
| `docs/IN_GAME_TESTS.md` | In-game regex verification results |
| `регис/` | Reference data for cross-validation (Russian mod lists, affix hierarchy) |

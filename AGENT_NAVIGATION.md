# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 72.0 | **Date:** 2026-06-08

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Business logic. Pure TS, no React. | **Tests mandatory.** No DOM/React/Zustand imports. |
| `src/strategies/` | Locale-specific logic. Currently only RU. | Can import from `src/shared/` and `src/core/`. |
| `src/ui/` | React components. | Each file < 300 lines. Import from `@core`, `@shared`, `@data`, `@store`. |
| `src/store/` | Zustand stores. | One store per domain. Import from `@shared`. |
| `src/data/` | JSON loading + vendor-properties. | Proxies `fetch()` -> typed objects. Import from `@shared`. |
| `src/shared/` | Types, i18n, classifier, priority tiers. | **No imports from other src/ directories.** |
| `scripts/etl/` | ETL pipeline + iterative optimizer. | Run via `pnpm etl`. Output to `public/generated/`. |
| `scripts/analyze-fn.ts` | FN/FP analysis per category. | Run via `pnpm analyze-fn`. |
| `scripts/etl/iterative-optimizer.ts` | Iterative regex optimizer (Phase 5). | Run via `pnpm optimize` or `pnpm optimize:dry`. |
| `public/generated/` | Read-only artifacts. | **NEVER edit manually.** Created only by ETL. |
| `tests/` | Test files. | Mirror `src/` structure. 576 tests. |
| `регис/` | Manual Russian mod lists + analysis reports + affix hierarchy. | Reference data for cross-validation. Priority tiers for affix popularity. |

## 2. Build Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server
pnpm build           # Production build
npx vitest run --root /home/z/my-project/poe2-regex-ru  # Run tests (576 tests, Vitest)
pnpm etl             # Run ETL pipeline (requires network or .etl-cache/)
pnpm etl -- --validate       # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item  # Run ETL + block-based Oracle validation (accurate in-game sim)
pnpm analyze-fn      # Analyze FN/FP per category
pnpm optimize        # Run iterative optimizer on generated JSON
pnpm optimize:dry    # Dry-run optimizer with verbose output
```

## 3. Agent Workflow

1. Read `AGENT_NAVIGATION.md` and `новый_план.md`
2. Read `worklog.md` to understand what's already done
3. Execute the current iteration's tasks
4. Write tests for new code
5. Run `npx vitest run --root .` and `pnpm build` — both must pass
6. Update `worklog.md` with what was done
7. **NEVER** touch `public/generated/` manually

## 4. Pre-Commit Checklist

- [ ] `pnpm build` passes without errors
- [ ] `npx vitest run --root .` passes (576 tests)
- [ ] No `any` types (except merge functions)
- [ ] No hardcoded mod strings in UI/Engine code
- [ ] New files are in the correct directories
- [ ] `worklog.md` is updated

## 5. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
  ^        ^        ^          ^       ^      ^
  +--------+--------+----------+-------+------+
  (shared can be imported by everyone, nothing imports from ui)
```

## 6. Known Issues & Remaining Work

### TODO (next iterations)
1. **Browser functional testing** — VirtualizedModList needs manual testing: scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers, priority tier filter.
2. **Mobile-specific testing** — touch targets, scroll behavior (needs real device).
3. **Priority tier refinement** — Validate tier classifications against live trade data.

### CONFIRMED INTENTIONAL
1. **Waystone corrupted+delirious** — Both can be selected simultaneously; a waystone CAN be both corrupted AND delirious in-game. Regex `"оскверн" "делир"` is correct.
2. **Tablet rarity regex** — Patterns 'обычн', 'волшебн', 'редк' are specific enough for tablet category; no cross-family FP expected.
3. **Jewel/relic/vendor no priority filter** — These categories return 'C' for all mods, so priority filter toggle is not shown.

## 7. Regex Strategy Pipeline

The `computeMinimalUniqueSubstring()` function in `scripts/etl/compute-regex.ts` tries strategies in order:

| Strategy | Name | Description |
|----------|------|-------------|
| 1 | Template-family suffix | Text after last `##` in template |
| 1b | Suffix lengthening | Include text between `##` and suffix |
| 1c | Full second stat | Dual-stat template suffix join |
| 1d | Negation | Suffix + short exclude patterns |
| 1e | Word Truncation | Truncate words + optional negate |
| 1f | AND-composed Context | regexPrefixContext + regex |
| 2 | Substring fallback | Brute-force unique substring search |

## 8. Optimization Pipeline

`computeOptimizations()` in `scripts/etl/compute-optimizations.ts`:

| Phase | Name | Description |
|-------|------|-------------|
| A | Family-based grouping | Tokens sharing a familyKey get one shared regex |
| A1 | Word truncation | Try Strategy 1e truncation on Phase A shared regexes |
| B | DP factorization | Cross-family groups factorized via `batchDPFactorize()` |
| C | Dialect optimization | `[её]`, `[юя]`, `ь?` applied to all regexes |

## 9. Oracle API

Two validation modes in `src/core/regex-oracle.ts`:

| Function | Matching | Use case |
|----------|----------|----------|
| `validateRegex()` | Flat-text (`matchQuotedGroup`) | ETL single-mod validation |
| `validateRegexItem()` | Block-based (`matchPoE2RegexItem`) | In-game behavior simulation |
| `batchValidate()` | Flat-text, batch | ETL --validate |
| `batchValidateItem()` | Block-based, batch | ETL --validate-item |

FP categorization: `familyTierFP` = same familyKey (by design), `crossFamilyFP` = different familyKey (real bugs).

## 10. Dual-Slot Range Filtering

`TokenRangeOverride` supports `slotOverrides` for simultaneous filtering of both placeholders in dual-number mods.

- `slotOverrides: Record<number, SlotRangeOverride>` — per-slot min/max overrides
- When `slotOverrides` is set, `filterSlotIndex`/`min`/`max` are ignored
- AST builder generates separate RANGE nodes for each active slot, ANDed together
- FilterChip shows two rows of inputs (1е/2е) for multi-placeholder mods
- Aria labels: `range.min_aria_dual_1` / `range.max_aria_dual_1` for slot 0, `range.min_aria_dual_2` / `range.max_aria_dual_2` for slot 1
- Serialization format: `[tokenId, min, max, filterSlotIndex, slotIdx, sMin, sMax, ...]`

## 11. regexExclude & regexPrefixContext

Two mechanisms for cross-family FP prevention. Excludes preferred for short markers; context preferred when suffix appears in both target and conflicts. Can combine both.

**OR-suffix edge case:** When ranged tokens with same (min,max) but different suffixes are merged, ALL excludes are unioned. This is correct because `!X` is item-wide in PoE2 — over-excluding is safer than missing FP.

## 12. Optimizer Collapse Indicator

When the runtime optimizer replaces multiple selected tokens with a shared regex from the optimization table, a ⚡ indicator appears on the corresponding FilterChip.

- `collectCollapsedTokenIds(ast, optimizationTable)` — walks optimized AST to find `opt:` prefixed LITERAL nodes
- `collapsedTokenIds: Set<string>` — returned by `useCategoryPage`, passed through to `FilterChip`
- Tooltip: "Оптимизатор: regex этого мода уже включён в общее выражение"

## 13. ARIA Patterns

- **VendorChip**: Switch (label) + input (sibling) — valid ARIA tree
- **FilterChip**: Switch (label + badges) + inputs (siblings) — same sibling pattern
- **Radio groups**: Arrow key navigation implemented per ARIA spec
- **PageStateWrapper**: `role="status"` for loading, `role="alert"` for error
- **ProfilePanel**: Delete confirmation uses `onMouseDown` (not `onClick`) to prevent onBlur race condition

## 14. VendorProperty Canonical Source

`VendorProperty` interface is defined **only** in `src/data/vendor-properties.ts`. All consumers import from there. Do NOT create local duplicates.

## 15. Keyboard Shortcuts

- **Ctrl+Shift+X** — Copy regex to clipboard (also handles Russian layout: X→Ч)

## 16. Numeric Input Rules

All `<input type="number">` must include `step={1}` (or `step="1"`) to prevent fractional input. PoE2 mod values are always integers. This applies to:
- FilterChip range inputs (6 per dual-number chip)
- CategoryControlPanel global range inputs
- VendorChip numeric threshold input
- TabletPage uses remaining input

## 17. Priority Tier System

Affix popularity tiers (S/A/B/C) integrated into UI based on research (`регис/Иерархия популярности аффиксов.md`).

| Component | Role |
|-----------|------|
| `PriorityTier` type | `'S' | 'A' | 'B' | 'C'` — defined in `types.ts` |
| `PriorityFilter` type | `'all' | 'S+A' | 'S'` — filter mode in UI |
| `classifyPriorityTier(group, category)` | Text-based heuristic per category (ring/amulet/belt/waystone/tablet). Others return 'C'. |
| `FamilyGroup.priorityTier` | Set during grouping by `family-grouper.ts`, used for default sort (S→C) |
| `CategoryControlPanel` | Toggle group: «Все | S+A | S» with amber accent for active filter |
| `FilterChip` | S-tier gets amber border-l, C-tier gets opacity-80 dimming |
| `filter-store.ts` | `priorityFilter` persisted in URL via `p` key |

**Categories with priority classification:** ring, amulet, belt, waystone, tablet (show toggle in CategoryControlPanel). Others (jewel, relic, vendor) return 'C' for all mods — no toggle shown, no priorityFilter passed to ModList.

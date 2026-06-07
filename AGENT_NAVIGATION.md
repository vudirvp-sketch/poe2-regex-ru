# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 49.0 | **Date:** 2026-06-07

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Business logic. Pure TS, no React. | **Tests mandatory.** No DOM/React/Zustand imports. |
| `src/strategies/` | Locale-specific logic. Currently only RU. | Can import from `src/shared/` and `src/core/`. |
| `src/ui/` | React components. | Each file < 250 lines. Import from `@core`, `@shared`, `@data`, `@store`. |
| `src/store/` | Zustand stores. | One store per domain. Import from `@shared`. |
| `src/data/` | JSON loading. | Proxies `fetch()` -> typed objects. Import from `@shared`. |
| `src/shared/` | Types, constants, i18n, classifier. | **No imports from other src/ directories.** |
| `scripts/etl/` | ETL pipeline + iterative optimizer. | Run via `pnpm etl`. Output to `public/generated/`. |
| `scripts/analyze-regexes.ts` | Regex quality analysis. | Run via `npx tsx scripts/analyze-regexes.ts`. |
| `scripts/analyze-fn.ts` | FN/FP analysis per category. | Run via `pnpm analyze-fn`. |
| `scripts/etl/iterative-optimizer.ts` | Iterative regex optimizer (Phase 5). | Run via `pnpm optimize` or `pnpm optimize:dry`. |
| `public/generated/` | Read-only artifacts. | **NEVER edit manually.** Created only by ETL. |
| `tests/` | Test files. | Mirror `src/` structure. 471 tests. |
| `регис/` | Manual Russian mod lists + analysis reports. | Reference data for cross-validation. |

## 2. Build Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server
pnpm build           # Production build
npx vitest run --root . # Run tests (459 tests, Vitest)
pnpm etl             # Run ETL pipeline (requires network)
pnpm etl -- --validate       # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item  # Run ETL + block-based Oracle validation (accurate in-game sim)
pnpm analyze-fn      # Analyze FN/FP per category
pnpm optimize        # Run iterative optimizer on generated JSON
pnpm optimize:dry    # Dry-run optimizer with verbose output
```

## 3. Agent Workflow

1. Read `docs/ARCHITECTURE.md` and `docs/DATA_CONTRACTS.md`
2. Read `worklog.md` to understand what's already done
3. Execute the current iteration's tasks
4. Write tests for new code
5. Run `npx vitest run --root .` and `pnpm build` — both must pass
6. Update `worklog.md` with what was done
7. **NEVER** touch `public/generated/` manually

## 4. Pre-Commit Checklist

- [ ] `pnpm build` passes without errors
- [ ] `npx vitest run --root .` passes (459 tests)
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

### HIGH

1. **Remaining ~39 cross-family FP** — Down from 62. P0 (AND-composed regex via `regexPrefixContext`) eliminated ~23 FP in ring minion damage and jewel-desecrated composites. Breakdown: amulet 19, ring 0 (was 14, fixed by regexPrefixContext), jewel-desecrated 0 (was 15, fixed), jewel 11, tablet 3. Remaining amulet and jewel FP need detailed i18n-overrides analysis.

### MEDIUM

2. **ringPrefixContext system implemented** — `regexPrefixContext` field added to GameToken (Phase 9). ETL `repairCrossFamilyFP()` Step 3 fills it when excludes can't eliminate all FP. UI compiles `AND(LITERAL(context), LITERAL(regex))` → `"context" "suffix"`. Covers ring minion damage and jewel-desecrated composites.
3. **Ring minion elemental res** — Fixed by regexPrefixContext="имеют" → `"имеют" "стихия"` eliminates FP from non-minion "к сопротивлению всем стихиям" tokens.
4. **`|` inside `()` with correct quote syntax** — Needs re-testing in-game with `"!X"` format.
5. **Number range with `|`** — `([6-9][0-9]|[0-9][0-9][0-9])` — verify works in PoE2, or find alternative approach.
6. **Per-token dual-number RANGE filtering** — Second placeholder overrides not supported
7. **HomePage hardcoded mod counts** — Category cards show stale counts

### LOW

6. **Jewel classification accuracy** — ETL lookup for normal jewels; heuristic fallback (~84%) for desecrated/corrupted
7. **List virtualization** — belt (298), ring (366), amulet (427) tokens
8. **Number regex length** — `[0-9]` is 5 chars vs `.` (1 char). Some RANGE regexes may exceed 250 limit after ETL re-run

## 7. Regex Strategy Pipeline (Phase 8)

The `computeMinimalUniqueSubstring()` function in `scripts/etl/compute-regex.ts` tries strategies in order:

| Strategy | Name | Description | Example |
|----------|------|-------------|---------|
| 1 | Template-family suffix | Text after last `##` in template | `"к сопротивлению огню"` |
| 1b | Suffix lengthening | Include text between `##` and suffix | `"увеличение урона к атакам"` |
| 1c | Full second stat | Dual-stat template suffix join | `"повышение брони, увеличение урона"` |
| 1d | Negation | Suffix + short exclude patterns | `"к силе" "! и"` |
| **1e** | **Word Truncation** | **Truncate words + optional negate** | **`"к си" "! и"` (9 chars vs 40)** |
| **1f** | **AND-composed Context** | **regexPrefixContext + regex** | **`"имеют" "увеличение урона"` (−23 FP)** |
| 2 | Substring fallback | Brute-force unique substring search | `"огню"` |

Strategy 1e is new in Phase 8. It produces dramatically shorter regexes by combining word truncation with short negate markers.

## 8. Oracle API (Phase 8)

Two validation modes in `src/core/regex-oracle.ts`:

| Function | Matching | Use case |
|----------|----------|----------|
| `validateRegex()` | Flat-text (`matchQuotedGroup`) | ETL single-mod validation |
| `validateRegexItem()` | Block-based (`matchPoE2RegexItem`) | In-game behavior simulation |
| `batchValidate()` | Flat-text, batch | ETL --validate |
| `batchValidateItem()` | Block-based, batch | ETL --validate-item |

FP categorization (all functions):
- `OracleResult.familyTierFP` — FP from same familyKey (by design)
- `OracleResult.crossFamilyFP` — FP from different familyKey (real bugs)
- `valid = true` when NO cross-family FP and no FN

## 9. regexExclude & regexPrefixContext System (Phase 8-9)

Two mechanisms for cross-family FP prevention:

### regexExclude (Phase 8)
New field `regexExclude` on `GameToken` stores negation patterns for cross-family FP prevention.

**Priority order for exclude patterns (verified in-game Phase 8):**

1. **Minion marker:** `"Приспеш"` — if ALL conflicts are minion variants, one short marker replaces all specific excludes
2. **Compound separator:** `" и"` — if ALL conflicts are compound-family (suffix + separator + extension), the separator alone excludes all
3. **Short universal markers:** single word appearing in ALL conflicts but NOT in target family (e.g., `"ловк"` for dexterity compounds)
4. **Specific full-phrase patterns:** fallback, e.g., `"к силе и"` (least preferred, longest)

**How it works in UI:**
- Non-ranged tokens: `useCategoryPage.ts` wraps `LITERAL` with `EXCLUDE` nodes from `regexExclude`
- Ranged tokens with min/max: RANGE node wrapped in `AND(RANGE, EXCLUDE...)` — Phase 8 fix
- Ranged tokens without min/max: same as non-ranged tokens

**Example (Phase 8 optimization):**
- Old: `"к силе" !"к силе и" !"к силе,"` (40 chars)
- New: `"к си" "! и"` (9 chars, 80% shorter)

### regexPrefixContext (Phase 9)

When regex + regexExclude cannot eliminate all FP because the suffix appears in both target and conflict families, `regexPrefixContext` provides a short substring that appears ONLY in the target family's rawText.

**How it works:**
- ETL `repairCrossFamilyFP()` Step 3 computes it after excludes are exhausted
- Finds shortest word from the template prefix that appears in ALL target-family tokens but NOT in any conflict
- UI compiles: `AND(LITERAL(context), LITERAL(regex))` → `"context" "suffix"`
- Both must appear on the item (AND across blocks), eliminating FP

**Example:**
- Target: "Приспешники имеют (7—9)% увеличение урона" — has "имеют" AND "увеличение урона"
- Conflict: "(3—7)% увеличение урона от огня" — has "увеличение урона" but NOT "имеют"
- Old: `"увеличение урона" !"увеличение урона от" !"хаосом"` — still has FP from fire/cold/lightning
- New: `"имеют" "увеличение урона"` — no FP, shorter, no excludes needed

**When context is used vs excludes:**
- Excludes preferred when: a short marker can cover all conflicts (e.g., `"! и"` for compound families)
- Context preferred when: suffix appears in both target AND conflicts, no short exclude exists
- Can combine both: `"context" "suffix" "!exclude"` — context narrows scope, excludes handle remaining

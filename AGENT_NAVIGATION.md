# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 55.0 | **Date:** 2026-06-07

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
| `tests/` | Test files. | Mirror `src/` structure. 487 tests. |
| `регис/` | Manual Russian mod lists + analysis reports. | Reference data for cross-validation. |

## 2. Build Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server
pnpm build           # Production build
npx vitest run --root . # Run tests (487 tests, Vitest)
pnpm etl             # Run ETL pipeline (requires network or .etl-cache/)
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
- [ ] `npx vitest run --root .` passes (487 tests)
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

*(none currently)*

### MEDIUM

1. **4 cross-family FP remaining** — tablet.mod_od9m77/mod_ld06px and their multi-line splits (.h4ipty). Accepted limitation — no unique substring, essentially family-tier FP with different familyKeys.
2. **Per-token dual-number RANGE filtering** — Second placeholder overrides not supported.

### LOW

1. **Jewel classification accuracy** — ETL lookup for normal jewels; heuristic fallback (~84%) for desecrated/corrupted.
2. **Number regex length** — `[0-9]` is 5 chars vs `.` (1 char). Some RANGE regexes may exceed 250 limit.
3. **VirtualizedModList jewel type sub-groups** — JewelPage uses VirtualizedModList with origin sub-sections but without jewel type sub-headers (Рубин/Изумруд/Сапфир). Token pre-filtering by jewelType still works; only the visual sub-headers within origin sections are not rendered.

## 7. Multi-Line Mod Splitting (Session 55)

`extractTextAndRanges()` in `scripts/etl/normalize.ts` now splits `<br>` segments into separate tokens. Each sub-line is an independent searchable block (verified in-game Phase 7 Block 3 / Group I).

**How it works:**
- HTML like `"Монстры имеют (80—120)% повышение шанса<br>(30—50)% к бонусу критического урона"` produces 2 tokens
- Token IDs use hash-based suffixes: `waystone.mod_dv8kwa`, `waystone.mod_dv8kwa.h4ipty`
- Hash suffix avoids ID collisions when different tiers of the same modCode have different second segments
- `normalizeTypeA()` and `normalizeTypeB()` now return `NormalizedMod[]` instead of single `NormalizedMod`
- `run-etl.ts` uses `flatMap()` to handle the array results

**Token count changes:**
| Category | Before | After |
|----------|--------|-------|
| waystone | 97 | 311 |
| waystone-desecrated | 17 | 27 |
| tablet | 75 | 82 |
| jewel-desecrated | 32 | 47 |

## 8. Regex Strategy Pipeline (Phase 8)

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

## 9. Optimization Pipeline (Phases A-B-C + A1)

`computeOptimizations()` in `scripts/etl/compute-optimizations.ts`:

| Phase | Name | Description |
|-------|------|-------------|
| **A** | Family-based grouping | Tokens sharing a familyKey get one shared regex |
| **A1** | Word truncation (Session 53) | Try Strategy 1e truncation on Phase A shared regexes — saves ~541 chars across categories |
| **B** | DP factorization | Cross-family groups factorized via `batchDPFactorize()` |
| **C** | Dialect optimization | `[её]`, `[юя]`, `ь?` applied to all regexes |

Phase A1 only truncates entries WITHOUT context/excludes (pure, no FP). Truncated forms are validated: must match all family tokens via PoE2 engine AND be unique within the category.

## 10. Oracle API

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

## 11. regexExclude & regexPrefixContext System

Two mechanisms for cross-family FP prevention:

### regexExclude
Field `regexExclude` on `GameToken` stores negation patterns for cross-family FP prevention.

**Priority order for exclude patterns (verified in-game Phase 8):**
1. **Minion marker:** `"Приспеш"` — covers all minion variants
2. **Compound separator:** `" и"` — covers compound-family overlaps
3. **Short universal markers:** single word in ALL conflicts but NOT in target
4. **Specific full-phrase patterns:** fallback, longest

**In optimizer:** `buildOptimizedNode()` creates `AND(LITERAL(regex), EXCLUDE(OR(...excludes)))`.

### regexPrefixContext

When regex + regexExclude cannot eliminate all FP, `regexPrefixContext` provides a short substring appearing ONLY in the target family's rawText. UI compiles: `AND(LITERAL(context), LITERAL(regex))`.

**When context is used vs excludes:**
- Excludes preferred when: a short marker covers all conflicts
- Context preferred when: suffix appears in both target AND conflicts
- Can combine both: `"context" "suffix" "!exclude"`

## 12. Optimization Table with Context

`OptimizationEntry` includes optional `regexPrefixContext` and `regexExclude` fields. These are populated by `patchOptimizationEntries()` (ETL step 7c), which runs after `repairCrossFamilyFP()`.

**Data flow:**
1. Step 4: `computeOptimizations()` creates entries (Phase A → A1 truncation → B → C)
2. Step 7b: `repairCrossFamilyFP()` adds regexPrefixContext/regexExclude to tokens
3. Step 7c: `patchOptimizationEntries()` copies shared context/excludes from tokens to optimization entries

**Rules for patching:**
- If ALL tokens share the same `regexPrefixContext` → added to entry
- If ALL tokens share the same `regexExclude` patterns → added to entry
- Mixed → entry left without them (not optimizable by runtime)

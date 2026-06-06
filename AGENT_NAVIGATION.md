# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 23.0 | **Date:** 2026-06-06
> **Current Iteration:** Iteration 18 (ETL Refresh + Doc Compression + Scoring Cleanup + Per-Mod Numeric Filter Design) — IN PROGRESS.
> **Sessions 17-25 summary:** Jewel type sub-grouping, weighted scoring cleanup (~15 rules), Tablet Экспедиция tooltip, ARCHITECTURE.md compression (1023→518 lines), docs/AGENT_NAVIGATION.md compressed. All 204 tests pass.

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Business logic. Pure TS, no React. | **Tests mandatory.** No DOM/React/Zustand imports. |
| `src/strategies/` | Locale-specific logic. Currently only RU. | Can import from `src/shared/` and `src/core/`. |
| `src/ui/` | React components. | Each file < 250 lines. Import from `@core`, `@shared`, `@data`, `@store`. |
| `src/store/` | Zustand stores. | One store per domain. Import from `@shared`. |
| `src/data/` | JSON loading. | Proxies `fetch()` -> typed objects. Import from `@shared`. |
| `src/shared/` | Types, constants, i18n. | **No imports from other src/ directories.** This is the lowest layer. |
| `scripts/etl/` | ETL pipeline. | Run via `pnpm etl`. Output to `public/generated/`. |
| `scripts/etl/i18n-overrides.json` | Manual Russian translations for tokens without Russian text on poe2db.tw. | Applied automatically after ETL. Edit when new overrides needed. |
| `public/icons/` | Game inventory icons (PNG). | Served as static assets. `import.meta.env.BASE_URL + 'icons/...'`. |
| `public/generated/` | Read-only artifacts. | **NEVER edit manually.** Created only by ETL. |
| `tests/` | Test files. | Mirror `src/` structure. |
| `docs/` | Documentation. | Read before starting each iteration. |
| `worklog.md` | Agent work log. | Append-only. Never overwrite. |
| `регис/` | Manual Russian mod lists. | Reference data for cross-validation with ETL output. |

## 2. Build Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server
pnpm build           # Production build
pnpm test            # Run tests (Vitest)
pnpm etl             # Run ETL pipeline (requires network)
pnpm lint            # Lint code
```

**Important:** `pnpm etl` requires network access to fetch data from poe2db.tw. If running in CI or a sandboxed environment, skip this step and use the existing JSON files in `public/generated/`.

## 3. Agent Workflow

1. Read `docs/ARCHITECTURE.md` and `docs/DATA_CONTRACTS.md`
2. Read `worklog.md` to understand what's already done
3. Execute the current iteration's tasks
4. Write tests for new code
5. Run `pnpm test` and `pnpm build` — both must pass
6. Update `worklog.md` with what was done
7. **NEVER** touch `public/generated/` manually

## 4. Pre-Commit Checklist

- [ ] `pnpm build` passes without errors
- [ ] `pnpm test` passes
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

## 6. Iteration Status

| Iterations | Status | Summary |
|------------|--------|---------|
| 0-9 (MVP) | ✅ Complete | Core engine, ETL, UI, vendor, CI/CD (see git history for details) |
| 10-12 (Layout v2) | ✅ Complete | Two-column layout, family pooling, semantic grouping, accessibility, mobile CSS |
| 13-14 (Icons + ETL Fix) | ✅ Complete | Game icons, 8 bug fixes, ETL tag cleanup, ARIA fixes |
| 15-16 (i18n + Jewel Filter) | ✅ Complete | Full i18n, JewelPage type filter (Ruby/Emerald/Sapphire) |
| 17 (Jewel Sub-Groups) | ✅ Complete | Jewel-type groupMode + visual sub-grouping, scoring cleanup, TabletPage refactor |
| 18 (Current) | 🔄 In Progress | ETL refresh, doc compression, scoring conflict resolution, per-mod numeric filter design |

## 7. Known Issues & Remaining Work

### 🔴 HIGH — Requires In-Game Verification

1. **VendorPage regex strings** — 50+ strings need in-game testing (page has warning banner)
2. **TabletPage regex strings** — "бездн", "делир", "ритуал", "ваал", "обычн", "волшебн", "редк", "использ" all need verification
3. **RANGE.max in-game** — `generateMaxNumberRegex` is unit-tested but not verified in-game

### 🟡 MEDIUM — Data Quality & Features

4. **Belt/ring/amulet same-text duplicates** — Different origins (normal vs essence) with identical rawText. NOT a bug — optimizer handles correctly.
5. **Full min+max RANGE intersection** — Works but uses more characters. See ARCHITECTURE.md §7.
6. **Per-mod numeric filter** — Current UI applies GLOBAL min/max to ALL ranged tokens. Need per-mod thresholds (e.g., waystone: ≥80% monsters AND ≥96% experience). See §9 below.
7. **SAPPHIRE generic crit rule conflict** — `/повышен.*шанс.*критического удара/` (w=2) conflicts with Emerald attack-crit. Should narrow or remove. See §10 below.

### 🟢 LOW — Polish

8. **Jewel classification accuracy** — ~84% with weighted scoring; 100% with static lookup. Scoring is fallback for new mods.
9. **HomePage hardcoded mod counts** — Category cards show stale counts after data updates.

## 8. Tablet Type Regex Reference

| Tablet Type | Regex | Verified |
|-------------|-------|----------|
| Breach (Бездна) | `бездн` | ❌ |
| Delirium (Делириум) | `делир` | ❌ |
| Ritual (Ритуал) | `ритуал` | ❌ |
| Vaal (Ваал) | `ваал` | ❌ |
| Expedition (Экспедиция) | `экспед` | ⛔ Not in game yet (tooltip shown) |

Rarity: `обычн` | `волшебн` | `редк` — all need verification. Uses: `использ` — needs verification.

## 9. Per-Mod Numeric Filter — Current vs Desired

**Current behavior:** The UI has a single GLOBAL `minValue`/`maxValue` pair. When set, ALL selected ranged tokens get the SAME numeric filter. Example: selecting "Бездны порождают увеличенное на (50—100)% количество монстров" AND "Монстры Бездны даруют увеличенное на (50—100)% количество опыта" applies the same ≥N threshold to both.

**Desired behavior:** Per-mod numeric thresholds. Example: ≥80% monsters AND ≥96% experience on the same item.

**PoE2 regex supports this** via AND: `"([8-9].|\d..).*количество монстр" "([9-9].|\d..).*количество опыт"` — each quoted group has its own number+suffix constraint, AND ensures both match the same item.

**Implementation approach (future):** Add per-token `minValue`/`maxValue` to filter store, modify `buildAstFromSelections` to use per-token thresholds instead of global, update UI with per-chip min/max inputs.

## 10. Scoring Conflict — SAPPHIRE Generic Crit

**Problem:** `SAPPHIRE_SCORES` contains `/повышен.*шанс.*критического удара/` (w=2). This is a generic "increased critical strike chance" pattern that also matches Emerald-specific mods like "(6—16)% повышение шанса критического удара атаками" (attack crit = Emerald). The Emerald rule `/шанс.*крит.*удар.*атак|крит.*удар.*атак/i` (w=2) doesn't outweigh Sapphire's generic crit rule for text like "повышение шанса критического удара" (without "атаками" suffix).

**Resolution:** Narrow the Sapphire rule to exclude attack-specific context: `/повышен.*шанс.*критического удара(?!.*атак)/i` or remove it entirely since Sapphire has specific spell-crit rules already.

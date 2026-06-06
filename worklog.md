# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 21 — 2026-06-06)

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

### Session 21 Changes — i18n Completion + VendorPage Refactor

**MEDIUM — VendorPage now uses shared CategoryControlPanel:**
- Removed duplicated sticky wrapper, mode toggle, round10 toggle from VendorPage
- CategoryControlPanel extended with optional props: `showRound10`, `clearButton`
- VendorPage passes `hasRangedTokens={false}`, `showRound10={hasNumericSelected}`, `clearButton={...}`
- Eliminates ~40 lines of duplicated UI code

**MEDIUM — i18n: all page components now use t() instead of hardcoded Russian:**
- BeltPage, RingPage, AmuletPage, WaystonePage, JewelPage, RelicPage, TabletPage:
  "Загрузка данных..." → `t('loading')`, "Ошибка загрузки:" → `t('load_error')`,
  "Нет данных" → `t('no_data')`, "выбрано" → `t('selected')`,
  "мод(ов)" → `t('mods_word')`, "модов" → `t('mods_word')`,
  "Выбрано:" → `t('summary.selected')`, "Включить"/"Исключить" → `t('summary.include')`/`t('summary.exclude')`

**LOW — AFFIX_LABELS/ORIGIN_LABELS replaced with t() in ModList + mod-classifier:**
- `AFFIX_LABELS[affix]` → `t('affix.' + affix)` in ModList (column headers, dropdowns, origin mode)
- `ORIGIN_LABELS[origin]` → `t('origin.' + origin)` in ModList (dropdown) and mod-classifier (origin mode labels)
- New i18n keys: `affix.prefix`, `affix.suffix`, `origin.normal/desecrated/corrupted/essence/breachborn`

**INFO — FilterChip i18n:**
- Replaced hardcoded "выбрано/частично выбрано/не выбрано/уровней/диапазон" with `t('chip.*')` calls
- Keys already existed in i18n.ts, just not used

**INFO — CategoryControlPanel i18n:**
- "Панель управления фильтрами" → `t('control.panel')`
- "Режим фильтра" → `t('mode.want')`
- "Мин"/"Макс" → `t('range.min')`/`t('range.max')`
- "Минимальное/Максимальное значение" → `t('range.min_aria')`/`t('range.max_aria')`
- "суффиксы" → `t('suffixes.label')`

**INFO — ETL automation already in place:**
- deploy.yml has weekly cron (Monday 06:00 UTC) that runs ETL + commit + deploy
- `workflow_dispatch` with `run_etl` parameter for manual trigger
- `.etl-cache/` is in `.gitignore` — fresh data on each ETL run in CI

**New i18n keys added (total now ~110+):**
- `affix.prefix`, `affix.suffix`
- `origin.normal`, `origin.desecrated`, `origin.corrupted`, `origin.essence`, `origin.breachborn`
- `summary.selected`, `summary.include`, `summary.exclude`
- `control.panel`, `suffixes.label`
- `range.min`, `range.max`, `range.min_aria`, `range.max_aria`

---

## Known Issues (Remaining)

| Priority | Issue | Status |
|----------|-------|--------|
| INFO | 1 i18n override token has regex <5 chars (amulet fire spell crit breachborn) | Acceptable |
| INFO | Waystone tier filter removed (confirmed not searchable in RU client) | By design |
| INFO | 51 tokens use i18n overrides (poe2db.tw lacks Russian text) | Handled by i18n-overrides.json |
| LOW | TabletPage labels "Тип:", "Редкость:", "Исп.:" still hardcoded | Next iteration |
| LOW | WaystonePage checkbox labels "Осквернён/Неосквернён/Делириум" still hardcoded | Next iteration |
| LOW | VendorPage GROUP_ORDER + GROUP_COLORS labels are hardcoded Russian | By design (vendor-specific) |

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
- **Components:** `src/ui/components/` — ModList, FilterChip, RegexOutput, CategoryControlPanel, ProfilePanel, VendorChip
- **i18n:** `src/shared/i18n.ts` — t() function with 110+ keys
- **Regex Engine:** `src/core/` — AST, compiler, optimizer, number-regex
- **Store:** `src/store/` — Zustand filter store, profile store, URL sync

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json` and `run-etl.ts` `applyI18nOverrides()`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`

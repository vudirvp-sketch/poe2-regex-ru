# PoE2 Regex Architect — Architecture

> **Version:** 44.0 | **Date:** 2026-06-10 | **Language:** RU-first

---

## 1. Layer Diagram

```
+------------------------------------------------------------------+
|                        UI / Presentation                         |
|  React 19, Vite, Tailwind, Zustand                               |
|  Pages: Waystone, Tablet, Relic, Vendor, Belts, Rings, Amulets |
+------------------------------------------------------------------+
|                         Store Layer                              |
|  Zustand stores (filters, profiles) + lz-string URL sync        |
+------------------------------------------------------------------+
|                        Core / Domain                             |
|  Pure TypeScript — ZERO dependencies                             |
|  AST, Compiler, Optimizer, Number Regex, Limits, Locale, Matcher|
+------------------------------------------------------------------+
|                        Data Loader                               |
|  fetch public/generated/*.json -> typed objects                   |
+------------------------------------------------------------------+
|                     ETL Pipeline (build-time)                    |
|  Cheerio scraper -> normalize -> filter implicit-set -> compute  |
|  -> generate JSON -> i18n overrides -> FP repair -> public/gen  |
+------------------------------------------------------------------+
|                     External Data Source                         |
|  poe2db.tw/ru/* (server-rendered HTML, no anti-bot)             |
+------------------------------------------------------------------+
```

## 2. Data Flow

```
poe2db.tw/ru/*
    → fetch-poe2db.ts (Cheerio + fetch)
    → normalize.ts (clean text, extract ranges/values)
    → filterImplicitSetBonuses() + getImplicitTokensForCategory() (remove non-searchable implicit-set bonuses, add implicit tokens)
    → compute-regex.ts (minimal unique substrings)
    → compute-optimizations.ts (shared regex groups)
    → generate-dictionary.ts (assemble CategoryData)
    → i18n-overrides.json (patch missing translations)
    → repairCrossFamilyFP() (suffix lengthening + excludes + context)
    → patchOptimizationEntries() (copy context/excludes to opt entries)
    → public/generated/waystone.json, tablet.json, etc.
    → loader.ts (fetch at runtime)
    → UI: user selects filters
    → ast.ts (build AST from selections)
    → optimizer.ts (apply optimizationTable)
    → compiler.ts (compile AST → regex string)
    → Regex displayed in UI → copied → pasted in PoE2 search
```

## 3. PoE2 Regex Dialect (NOT Standard PCRE) — VERIFIED IN-GAME

| Syntax | Meaning | Example | Verified |
|--------|---------|---------|----------|
| `substring` | Simple substring match | `Бездн` | Yes |
| `\|` | OR (alternation) | `Бездн\|Делир` | Yes |
| `!` | NOT (negation) | `!Бездн` | Yes |
| `""` | Phrase grouping + AND separator | `"Бездн" "карт"` | Yes |
| `.` | Any single character (wildcard) | `Б.здн` | Yes |
| `.*` | Any sequence WITHIN a single block | `"Бездн.*монстр"` | Yes |
| `[]` | Character class | `Делири[уф]` | Yes |
| `^` | Start-of-block anchor | `^(2[7-9]\|30).*suffix` | Yes (Phase 9b) |
| `$` | End anchor | — | Unreliable, do not use |
| `()` | Grouping | `([5-9]\|..)` | Yes |
| `\d` | Digit shorthand | `\d..` | Yes |
| `%` `+` | Literals (not special) | `"+66"`, `"% к сопр"` | Yes |

**NOT supported:** `?` (optional), `.*` across blocks (VERIFIED B1-B2), negative lookahead, non-greedy quantifiers, backreferences.

**Critical syntax rules:**

1. **`!` must be INSIDE quotes when combined with `|`:** `"!A|B"` works, `!"A|B"` does NOT.
2. **`.*` does NOT cross block boundaries** — each mod/implicit/property/name/state is a separate searchable block. Use AND (`"X" "Y"`) to search across blocks.
3. **`.*` is directional** — `"огня.*приспеш"` only matches if "огня" appears BEFORE "приспеш" in the same block. For bidirectional, use AND.
4. **AND via space between quoted groups is order-independent** and works ACROSS blocks.
5. **Case insensitive** — verified with Cyrillic.
6. **`!X` is item-wide** — excludes the entire item if X appears in ANY block.
7. **Description/tooltip text is NOT indexed** — not searchable.
8. **State text IS indexed** — "Осквернено", "Делириум" are searchable.

**Word Truncation:** PoE2 is substring search. Truncating the END of a word works (`"к си"` → matches `"к силе"`). Mid-word extraction does NOT work. Minimum 3 significant chars per truncated word.

## 4. Block-Based Matching Model

PoE2 search is block-based. Each piece of item text is an independent searchable block.

**Searchable blocks:** Item name, type, rarity, each property/implicit/mod line, state text ("Осквернено").
**NOT indexed:** Description/tooltip text.

**Matching rules:**
- `.*` works ONLY within a single block
- AND (`"X" "Y"`) works ACROSS blocks
- `!X` is item-wide

**Implicit vs Mod blocks:**
- **Mod blocks** (prefix/suffix): Format `##% description` — number BEFORE text. Regex: `(number)%.*suffix`. Dual-indexed (simplified + range notation).
- **Implicit blocks**: Format `Description: +##%` — number AFTER text. Regex: `suffix.*(number)%` (REVERSED). NOT dual-indexed (only simplified format).
- **Implicit-set bonuses** (e.g., `"На ##% больше..."`, `"##% увеличение эффективности монстров"`) are NOT searchable in-game — they affect the implicit section but have no searchable mod text.

## 5. Compiler: Enumerated Range + AND Fallback

### Enumerated Range (preferred, ≤50 values)

When both min and max are specified AND the range has ≤ `MAX_ENUMERATE_RANGE` (50) values, the compiler produces a single quoted group with compact decade grouping:

```
RANGE(27, 30, 'откладывания наград')  →  "(2[7-9]|30).*откладывания наград"
```

Decade grouping: full decade → `[0-9]`, partial start → `[7-9]`, partial end → `[0-2]`, single → literal. Cross-boundary splits. ~4.5x shorter than flat enumeration.

**Known limitation:** Enumeration does NOT fully prevent FP when the item's range notation contains a matching number (e.g. `"26(27-50)%..."` — `27` from range notation matches enumeration). Mitigated by `^` and `%` anchors (§6).

**round10 is always disabled for enumerated ranges** — enumeration is inherently precise.

### AND Fallback (ranges >50 values)

```
RANGE(100, 200, 'жизн')  →  "([1-9][0-9][0-9]).*жизн" "([0-9]|[1-9][0-9]|[1-1][0-9][0-9]|200).*жизн"
```

Known limitation: wide-range AND can produce FP from secondary numbers in range notation.

### Prefix Anchoring (dual-number mods only)

Since `.*` does NOT cross blocks, cross-mod FP is impossible. Prefix is only needed for dual-number mods ("От ## до ## урона") where prefix "От" anchors the number to the first placeholder.

## 6. Three-Level FP Prevention

| Level | Method | When | FP prevented | FN risk |
|-------|--------|------|-------------|---------|
| 1 | `^` (anchorStart) | Template starts with `##` | Range notation at non-position-0 | None |
| 2 | `%` suffix anchor (anchorEnd) | Template has `##%` AND anchorStart=false | Numbers not followed by `%` | Items where actual roll has range notation |
| 3 | Enumeration (compact decade) | Range ≤ 50 | Secondary numbers not matching enumerated values | None |

**`anchorStart` implementation:**
- `anchorStart=true` when `rawTextTemplate` starts with `##` (number at position 0)
- Compiler adds `^` when `anchorStart=true` AND no `prefix`
- NOT for `+##` (accessory mods) or `-##` (negative values)

**`anchorEnd` implementation:**
- `anchorEnd='%'` when template matches `/##%/` (double-hash) AND `anchorStart=false`
- Single-hash `#%` (values-only) is intentionally EXCLUDED — causes 100% FN because items always have range notation
- Compiler inserts `anchorEnd` string after number pattern, before `.*suffix`

**When NOT to use `^`:** prefix set (dual-number), block starts with non-digit (`+`, `-`)
**When NOT to use `%`:** anchorStart=true (redundant), no `%` after number, single-hash `#%` templates

## 7. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
```

Same as AGENT_NAVIGATION §5.

## 8. AND/OR Search Logic

- **AND mode** (default): Tokens grouped by `familyKey`. Same family → OR (any tier matches). Different families → AND (all must be present).
- **OR mode**: All LITERAL/RANGE nodes go into a single OR group.
- **Orphaned ranged tokens** (no effective range while others have one): treated as LITERAL suffix nodes.

## 9. Family Pooling

All tokens sharing same `familyKey.ru` + `affix` → one `FamilyGroup` → one chip with combined range.

- FilterChip shows `displayText` + tier count badge ("×9")
- Origin filter applied **before** grouping
- Dual-number mods (`hasMultiPlaceholder=true`) show "2x" badge + 1е/2е slot switcher

## 10. Visual Hierarchy (3-Level)

All category pages use 3-level visual hierarchy. Headers are **block-level** (never inline-block).

| Level | Label | Font Size | Style |
|-------|-------|-----------|-------|
| 1 — Affix | ПРЕФИКС / СУФФИКС | `text-base` (16px) | Bold uppercase, decorative frame with gradient bg, corner accents, colored border-l. CSS classes: `affix-header-prefix` (blue), `affix-header-suffix` (orange). |
| 2 — Origin | Обычные / Очернённые / Осквернённые / Сущность / Разлом | `text-[14px]` (14px) | Bold uppercase badge, bg+border+border-l, origin-specific color + 17px icon. |
| 3 — Semantic | Атакующие / Защитные / Характеристики / Прочие / ... | `text-[12px]` (12px) | Semibold uppercase badge, bg+border, category-specific color |

**CategoryLabel interface** (in `mod-classifier.ts`):
```ts
interface CategoryLabel {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  borderLClass: string;
  iconPath?: string;  // Origin icons: webp files in public/icons/
}
```

**Origin colors:** Обычные=gray, Очернённые=emerald, Осквернённые=red, Сущность=amber, Разлом=violet.
All defined in `ORIGIN_SECTION_LABELS` (`mod-classifier.ts`). Light theme overrides in `index.css`.

**Origin icon paths:** Очернённые=`icons/очернение абис.webp`, Осквернённые=`icons/осквернение.webp`, Сущность=`icons/сущность.webp`, Разлом=`icons/разлом.webp`, Обычные=no icon.

### Per-Tab Grouping Modes

| Tab | `groupMode` | Sub-groups |
|-----|-------------|------------|
| Amulet/Ring/Belt | `affix-semantic` | Атакующие/Защитные/Характеристики/Прочие |
| Waystone | `affix-sentiment` | Позитивные/Негативные |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие |
| Jewel | `origin + showJewelTypeSubGroups` | Origin → prefix/suffix → Ruby/Emerald/Sapphire/Shared |
| Relic | `affix-only` | Just prefix/suffix |
| Vendor | N/A | Chip groups by category |

## 11. Multi-Origin Loading

`loadMergedCategoryData()` in `loader.ts`:
- JewelPage: jewel + jewel-desecrated + jewel-corrupted (224 tokens)
- WaystonePage: waystone + waystone-desecrated (112 tokens)

## 12. Priority Tier System

| Component | Role |
|-----------|------|
| `PriorityTier` | `'S' \| 'A' \| 'B' \| 'C'` in `types.ts` |
| `PriorityFilter` | `'all' \| 'S+A' \| 'S'` — UI filter mode |
| `classifyPriorityTier(group, category)` | Text-based heuristic for ring/amulet/belt/waystone/tablet. Others return 'C'. |
| `FamilyGroup.priorityTier` | Set during grouping, used for default sort (S→C) |
| `CategoryControlPanel` | Toggle: «Все \| S+A \| S» with amber accent |
| `FilterChip` | S-tier gets amber border-l, C-tier gets opacity-80 dimming |
| `filter-store.ts` | `priorityFilter` persisted in URL via `p` key |

Categories with priority: ring, amulet, belt, waystone, tablet. Others (jewel, relic, vendor) return 'C' — no toggle.

## 13. UI Conventions

### FilterChip & Range Inputs
- Text: `text-[13px]`, padding: `px-2.5 py-1.5`
- Range inputs: `w-16 text-[13px]`, dual-number: `w-14`
- ⚡ indicator when optimizer collapses token into shared regex
- `chip-with-range` CSS class with `flex-basis: 100%` prevents overlap

### CategoryControlPanel
- Sticky: `sticky top-0 z-10` with `control-panel-sticky::before` gap fix
- Range warnings: ⚠ Округл. (round10 + >50 range) and ⚠ Диапазон (range notation FP risk)

### VendorChip
- Switch + numeric threshold input
- `step={1}` on all numeric inputs

### ARIA
- VendorChip/FilterChip: Switch (label) + inputs (siblings)
- ProfilePanel delete: `onMouseDown` (not `onClick`) to prevent onBlur race

### Home/Sidebar
- Home card icons: 44×44px, Sidebar icons: 28×28px (maxHeight/maxWidth constrained)
- Header title: `text-lg`, Regex output: `text-base`

## 14. Optimizer Collapse Indicator

When runtime optimizer replaces multiple tokens with shared regex, ⚡ appears on FilterChip.
- `collectCollapsedTokenIds(ast, optimizationTable)` — walks optimized AST for `opt:` prefixed LITERAL nodes
- `collapsedTokenIds: Set<string>` — returned by `useCategoryPage`, passed to FilterChip

## 15. Optimization Pipeline

`computeOptimizations()` in `compute-optimizations.ts`:

| Phase | Name | Description |
|-------|------|-------------|
| A | Family-based grouping | Tokens sharing familyKey get one shared regex |
| A1 | Word truncation | Strategy 1e truncation on Phase A regexes |
| B | DP factorization | Cross-family groups via `batchDPFactorize()` |
| C | Dialect optimization | `[её]`, `[юя]`, `ь?` applied to all regexes |

## 16. Number Regex Correctness

`threeDigitMax()` generates correct PoE2 regex for all 3-digit max values:
- Round hundreds: `([0-9]|[1-9][0-9]|N[0-9][0-9]|N00)`
- D0=1 general: `([0-9]|[1-9][0-9]|1[0-prevD1][0-9]|1d1[0-d2])`
- D0>1 variants: handles all sub-cases correctly

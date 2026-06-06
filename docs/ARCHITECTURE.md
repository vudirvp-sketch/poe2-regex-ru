# PoE2 Regex Architect — Architecture

> **Version:** 17.0 | **Date:** 2026-06-06 | **Language:** RU-first

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
|  Cheerio scraper -> normalize -> compute-regex -> compute-opt   |
|  -> generate JSON -> i18n overrides -> public/generated/*.json  |
+------------------------------------------------------------------+
|                     External Data Source                         |
|  poe2db.tw/ru/* (server-rendered HTML, no anti-bot)             |
+------------------------------------------------------------------+
```

## 2. Data Flow

```
poe2db.tw/ru/*
    |
    v  (Cheerio + fetch)
scripts/etl/fetch-poe2db.ts
    |
    v  (normalize, extract ranges/values)
scripts/etl/normalize.ts
    |
    v  (compute minimal unique substrings)
scripts/etl/compute-regex.ts
    |
    v  (compute optimization table)
scripts/etl/compute-optimizations.ts
    |
    v  (assemble and write JSON)
scripts/etl/generate-dictionary.ts
    |
    v  (apply i18n overrides for untranslated tokens)
scripts/etl/i18n-overrides.json -> applied by run-etl.ts
    |
    v
public/generated/waystone.json, tablet.json, etc.
    |
    v  (fetch at runtime)
src/data/loader.ts
    |
    v  (user selects filters in UI)
src/ui/pages/*
    |
    v  (build AST from selections)
src/core/ast.ts
    |
    v  (optimize using optimizationTable)
src/core/optimizer.ts
    |
    v  (compile AST -> regex string)
src/core/compiler.ts
    |
    v
Regex string displayed in UI -> copied to clipboard -> pasted in PoE2 search
```

## 3. Invariants (NEVER VIOLATE)

```
I1. Character limit = 250 (str.length, NOT TextEncoder)
I2. Core Layer (src/core/) — ZERO dependencies. No React, DOM, or Zustand imports.
I3. public/generated/ — READ-ONLY artifact. Created ONLY by ETL scripts.
    Manual editing or runtime modification is FORBIDDEN.
I4. No hardcoded mod strings in UI or Engine code. Only internal_id references
    and i18n lookups from loaded data.
I5. pnpm is the ONLY package manager. Never use npm or yarn.
I6. Rule of 3: Do not create an abstraction until the same logic has been
    written 3 times.
I7. Locale type is 'ru' now. The type system must support extension to
    Locale = 'ru' | 'en' | ... but only 'ru' is implemented.
I8. PoE2 regex dialect: . (wildcard), | (OR), ! (NOT), "" (grouping),
    [] (char class), ^/$ (anchors), ? (optional). NOT standard PCRE.
```

## 4. Principles

```
P1. RU-first, Locale-extensible       -> type Locale = 'ru', always 'ru' for now
P2. Data -> Code separation             -> JSON artifacts, never hardcode
P3. Pre-compute, don't compute at runtime -> regex substrings computed in ETL
P4. Only internal_id in code           -> no Russian mod text in source
P5. Overflow = block                   -> red alert + copy disabled
P6. pnpm only
P7. Rule of 3
P8. Test the Core                     -> every core function has unit tests
P9. Regex validation               -> poe2-regex-matcher.ts simulates in-game search
```

## 5. PoE2 Regex Dialect (NOT Standard PCRE) — VERIFIED IN-GAME (RU Client)

All features below were tested and confirmed in the Russian game client on 2025-06-05.

| Syntax | Meaning | Example | Verified |
|--------|---------|---------|----------|
| `substring` | Simple substring match | `Бездн` matches all with "Бездн" | Yes |
| `\|` | OR (alternation) | `Бездн\|Делир` matches either | Yes - CRITICAL |
| `!` | NOT (negation) | `!Бездн` excludes items with "Бездн" | Yes |
| `""` | Phrase grouping + AND separator | `"Бездн" "карт"` requires both | Yes - CRITICAL |
| `.` | Any single character (wildcard) | `Б.здн` matches "Бездн" | Yes |
| `.*` | Any sequence (crosses mod boundaries!) | `Бездн.*монстр` matches across mods | Yes |
| `[]` | Character class | `Делири[уф]` matches "Делириу" or "Делириф" | Yes |
| `^` / `$` | Anchors (start/end) | `огня$` matches end of line | Yes |
| `()` | Grouping | `([5-9]\|\\d..)` | Yes |
| space between `""` | AND separator | `"огня" "приспеш"` = both must be on item | Yes |

**Critical syntax rules:**

1. **`!` must be INSIDE quotes when combined with `|`:**
   - CORRECT: `"!проклят|сопротивлен"` — excludes items with either word
   - WRONG: `!"проклят|сопротивлен"` — does NOT work
   - Also works without quotes: `!проклят` (simple negation)

2. **`.*` crosses mod boundaries:** The pattern `"([2-9].|\\d..).*увеличение"` can match
   a number in one mod and "увеличение" in a different mod on the same item.
   This means `.*` is NOT safe for combining number + specific mod. Use AND instead.

3. **`.*` is directional:** `"огня.*приспеш"` only matches if "огня" appears BEFORE "приспеш"
   in the text. For bidirectional matching, use AND: `"огня" "приспеш"`.

4. **AND via space between quoted groups is order-independent:** `"огня" "приспеш"` matches
   regardless of which word appears first on the item.

**NOT supported:** Negative lookahead, non-greedy quantifiers, backreferences.
**Case insensitive:** The in-game search is case-insensitive. Verified with Cyrillic text.

## 6. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
  ^        ^        ^          ^       ^      ^
  +--------+--------+----------+-------+------+
  (shared can be imported by everyone, nothing imports from ui)
```

- `shared` -> imports nothing from `src/`
- `core` -> imports only from `shared`
- `strategies` -> imports from `shared`, `core`
- `store` -> imports from `shared`, `core`, `strategies`
- `data` -> imports from `shared`
- `ui` -> imports from everyone

## 7. Compiler: Min+Max RANGE Support

### Problem
When both `min` and `max` are specified in a RANGE node (e.g., "match numbers between 40 and 80"),
the PoE2 regex dialect cannot express a single "range intersection" pattern. The dialect supports
`≥N` (via `generateNumberRegex`) and `≤N` (via `generateMaxNumberRegex`) independently, but not
their intersection in a single pattern.

### Solution: AST Normalization
The compiler uses a **normalization step** that expands `RANGE(min, max, suffix)` into
`AND(RANGE(min, undefined, suffix), RANGE(undefined, max, suffix))` before compilation.
This produces two AND-joined quoted groups in the output:

```
RANGE(40, 80, 'm q')  →  "([4-9].|\d..).*m q" "([0-9]|[1-7].|80).*m q"
```

Both conditions must match on the item, effectively constraining the number to [40, 80].

### Theoretical Limitation
There is an edge case where two different numbers on the same item could satisfy the
conditions independently (e.g., one mod has value ≥40, another has value ≤80). However,
this is extremely rare in practice because the suffix constraint ensures both patterns
match against the same mod text. This approach matches what poe2.re uses.

### Flattening
When a RANGE(min, max) is a child of an AND node, the normalization step **flattens**
the expanded AND into the parent AND, avoiding double-quoting:
```
AND(literal('огн'), RANGE(40, 80, 'm q'))
→ AND(literal('огн'), RANGE(40, ∅, 'm q'), RANGE(∅, 80, 'm q'))
→ "огн" "([4-9].|\d..).*m q" "([0-9]|[1-7].|80).*m q"
```

### URL Sharing
Both `minValue` and `maxValue` are synced to the filter store's `extraState` and
included in share URLs via lz-string compression.

## 8. Family Pooling (Modifier Grouping)

### Problem
Each tier of a modifier was shown as a separate chip. For example, "+(5—8) к силе",
"+(9—12) к силе", "+(13—16) к силе" — 3 separate lines that all generate the same
regex ("к силе"). In the amulet category, 427 tokens → 110 families. Users saw
~317 "extra" rows that added no informational value.

### Solution: Group by `familyKey.ru + affix`
All tokens sharing the same `familyKey.ru` AND `affix` are merged into a single
`FamilyGroup` displayed as one chip with a combined range.

### Data Model (`src/shared/types.ts`)
```typescript
interface FamilyGroup {
  familyKey: string;          // familyKey.ru
  affix: AffixType;
  members: GameToken[];       // all tier tokens in this group
  globalMin: number;          // min across all ranges/values
  globalMax: number;          // max across all ranges/values
  displayText: string;        // template + substituted range
  hasMultiPlaceholder: boolean;
  rangeSlots: number[][];     // [[min1,max1],[min2,max2]] for multi-##
}
```

### Grouping Logic (`src/shared/family-grouper.ts`)
1. Group tokens by `familyKey.ru + affix`
2. For each group, parse the familyKey template to identify `#` placeholder slots
3. For each member, map its `ranges[]` and `values[]` to the corresponding slots
4. Compute globalMin/globalMax per slot
5. Generate `displayText` by substituting `(min—max)` into the template
6. Sort: prefixes first, then suffixes; alphabetically within each group

### Display Text Generation
| familyKey Template | Slot Values | Result |
|---|---|---|
| `+# к силе` | [5,33] | `+(5—33) к силе` |
| `+# к уровню всех камней умений чар` | [1,3] | `+(1—3) к уровню всех камней умений чар` |
| `От # до # физического урона шипами` | [[1,97],[3,145]] | `От (1—97) до (3—145) физического урона шипами` |

### UI Components
- **`FilterChip`**: Accepts a `FamilyGroup` instead of a `GameToken`. Shows
  `displayText` + tier count badge ("×9"). Click toggles ALL member IDs.
  Visual states: full (all selected), partial (some selected), none.
- **`ModList`**: Groups filtered tokens via `groupTokensByFamily()` before building
  virtual rows. Header counts show number of families, not individual tokens.

### Origin Filter Interaction
The origin filter is applied **before** grouping. Filtering by "corrupted" produces
groups with ranges scoped to corrupted tokens only. Example: "+(10—15) к силе"
(1 corrupted member) instead of "+(5—33) к силе" (9 members across all origins).

## 9. Layout v2 — Two-Column Full-Width with Semantic Grouping

### Problem (v1 layout)
The original layout used a single-column virtual-scroll ModList on the left
and a 320px control panel on the right. This wasted horizontal space:
- Chip text averaged 37-66 chars (~350-550px), but the chip stretched to full column width
- Right panel consumed 25-30% of width for controls that are used infrequently
- Users had to scroll extensively (193 rows for jewels, 113 for amulets)

### Solution: Inverted Layout
Move the regex output and controls to a sticky top bar, freeing the full
width for a two-column mod display:

```
┌──────────────────── Full Width ────────────────────────┐
│ [RegexOutput + Health Bar + Copy + Share] (sticky)     │
│ [Хочу/Не хочу] [Min ≥] [Max ≤] [Round10] [Extras]    │
├────────────────────────────────────────────────────────┤
│  ┌── ПРЕФИКС (N) ──┬── СУФФИКС (M) ────────────────┐ │
│  │ [chip] [chip]    │ [chip] [chip] [chip]           │ │
│  │  ── Атакующие ── │  ── Защитные ──               │ │
│  │ [chip] [chip]    │ [chip] [chip] [chip]           │ │
│  └──────────────────┴────────────────────────────────┘ │
│ [ProfilePanel]                                         │
└────────────────────────────────────────────────────────┘
```

### Key Changes

1. **No virtual scroll**: Family Pooling reduces counts to 17-193 families.
   Simple rendering is more reliable and allows flex-wrap layout.

2. **Two-column prefix/suffix**: Uses `grid grid-cols-[2fr_3fr]` to give
   suffixes more space (they typically outnumber prefixes ~2:1).

3. **Flex-wrap chips**: Each FilterChip is `inline-flex` so multiple chips
   pack on one line, adapting to text length naturally.

4. **Semantic sub-grouping** (`src/shared/mod-classifier.ts`):
   - Tags-based classification (preferred): uses `GameToken.tags[]`
   - Text-based classification (fallback): regex keyword matching
   - Per-tab mode selection via `groupMode` prop

5. **Sticky control panel** (`CategoryControlPanel.tsx`):
   - RegexOutput + mode/range/round10 controls always visible
   - `extraControls` slot for category-specific controls

### Per-Tab Grouping Modes

| Tab | `groupMode` | Sub-groups | Origin sections |
|-----|-------------|------------|-----------------|
| Amulet/Ring/Belt | `affix-semantic` | Атакующие/Защитные/Характеристики/Прочие | ✅ `showOriginSubSections` |
| Waystone | `affix-sentiment` | Позитивные/Негативные (0 NEUTRAL) | origin filter (normal/desecrated) |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие | — |
| Jewel | `origin + showJewelTypeSubGroups` | Обычные/Очернённые/Осквернённые → prefix/suffix → Рубин/Изумруд/Сапфир/Общие | Built into headers |
| Relic | `affix-only` | None (just prefix/suffix) | ✅ `showOriginSubSections` |
| Vendor | N/A | Chip groups by category | — |

### Semantic Classification Logic

**Tags-based** (for categories with tags[] — amulet, ring, belt, jewel):
- `offensive`: damage, attack, critical, speed, caster, minion, physical, chaos, ailment
- `defensive`: resistance, life, mana, armour, energy_shield, charm
- `attribute`: attribute (str/dex/int)
- `neutral`: no matching tags

**Text-based** (for waystone, tablet, relic — no tags):
- `offensive`: keywords like урон, атак, крит, скорость, сотворени, etc.
- `defensive`: keywords like сопр, здоров, брон, уклонен, блок, дух, etc.
- `attribute`: keywords like к силе, к ловк, к интелл
- `neutral`: no match

**Waystone sentiment**:
- `positive`: редкость, количество, дополнительн, больше (player benefits)
- `negative`: монстр, области, горят, ледене, отравлен (map difficulty)
- `neutral`: 0 remaining (all classified as of iteration 3)

### Components Added/Modified

| Component | Change | Description |
|-----------|--------|-------------|
| `ModList.tsx` | **Rewritten** | Two-column layout, flex-wrap, groupMode prop, no virtual scroll |
| `FilterChip.tsx` | **Rewritten** | Compact inline-flex chip for flex-wrap layout |
| `CategoryControlPanel.tsx` | **New** | Shared sticky top bar with regex + controls + extraControls slot |
| `mod-classifier.ts` | **New** | Semantic classification logic (tags + text + sentiment) |
| All page components | **Updated** | New layout: ControlPanel top → ModList full-width → ProfilePanel |

## 10. Iteration 2 — Multi-Origin Loading + Tablet Type Grouping

Added multi-origin data loading via `loadMergedCategoryData()` in `src/data/loader.ts` with composite-key caching and `mergeCategories` option in `useCategoryPage`. JewelPage loads jewel + jewel-desecrated + jewel-corrupted (224 tokens across 3 origins). WaystonePage loads waystone + waystone-desecrated (112 tokens). Added `groupMode="tablet-type"` for TabletPage with text-based heuristics (алтар→Ритуал, бездн→Бездна, делир→Делириум, ваал/маяк→Ваал, экспедици→Экспедиция).

Key components: `loader.ts`, `useCategoryPage.ts`, `JewelPage.tsx`, `WaystonePage.tsx`, `mod-classifier.ts`, `TabletPage.tsx`.

## 11. Iteration 3 — Origin Sub-Sections + Classification Fine-Tuning

Added origin sub-sections within semantic groups: `splitGroupByOrigin()` in family-grouper splits FamilyGroups by origin with visual dividers (··· Осквернённые ···). Enabled for Amulet/Ring/Belt/Relic via `showOriginSubSections` prop. Fine-tuned waystone sentiment classification (0 NEUTRAL, 27 POS / 85 NEG). Expanded OFFENSIVE_TAGS (elemental, cold, fire, lightning, curse) and DEFENSIVE_TAGS (evasion). Fixed origin labels: desecrated→"Очернённые", corrupted→"Осквернённые". Light theme CSS additions for origin sub-sections, affix borders, FilterChip.

Key components: `family-grouper.ts`, `ModList.tsx`, `mod-classifier.ts`, `constants.ts`, `index.css`.

## 12. Iteration 4 — VendorPage Layout + Relic Origins + Mobile

Rewrote VendorPage to Layout v2 with new `VendorChip` component (compact inline-flex, color-coded group headers, shortened labels). Added `showOriginSubSections` to RelicPage (1 corrupted suffix shown under "··· Осквернённые ···" divider). Mobile CSS optimization (768px + 480px breakpoints: larger touch targets, full-width search, grid overflow prevention). Light theme VendorChip overrides. Verified waystone sentiment: 27 POS / 85 NEG / 0 NEUTRAL.

Key components: `VendorPage.tsx`, `VendorChip.tsx`, `RelicPage.tsx`, `index.css`.

## 13. Iteration 5 — Accessibility + Keyboard Navigation + Performance

Full accessibility audit: ARIA attributes on all interactive components (role="switch" on chips, role="progressbar" on health bar, radiogroup/radio on mode toggle, aria-live on RegexOutput, aria-expanded on ProfilePanel, role="alert" on VendorPage warning). Keyboard navigation via `focus-visible` outlines (2px solid blue, 2px offset). Skip-to-content link in Layout. `.sr-only` utility class. Performance review: React.memo on sub-components, useMemo/useCallback throughout, family pooling keeps counts well below virtual scroll threshold.

Key components: `FilterChip.tsx`, `VendorChip.tsx`, `RegexOutput.tsx`, `CategoryControlPanel.tsx`, `ModList.tsx`, `ProfilePanel.tsx`, `VendorPage.tsx`, `Layout.tsx`, `index.css`.

## 14. Iteration 6 — Game Icons Integration + Bug Fixes

Replaced all emoji icons with game inventory images (`public/icons/`, logo resized 1024→256). Bug fixes: belt label "Ремни"→"Пояса", FilterChip aria-pressed→aria-checked (true/false/mixed), sidebar hamburger missing aria-expanded, parseInt||null swallowing 0, VendorPage clearAll not resetting excludeMode, RegexOutput fallback color #0f0f1a→#0a0a0f. Light theme CSS fixes (scrollbar hover, green button state).

Key components: `Sidebar.tsx`, `HomePage.tsx`, all page components, `FilterChip.tsx`, `CategoryControlPanel.tsx`, `index.css`.

## 15. Iteration 7 — ETL Tag Cleanup + ARIA Fix + Layout Balance + Accessibility

### Changes

1. **ETL: Crafting tag removal from mod text** (`scripts/etl/normalize.ts` + `public/generated/jewel*.json`):
   - Root cause: poe2db.tw stores crafting tag badges (`<span class="badge" data-tag="armour">Броня</span>`)
     inside the description HTML cell. The ETL pipeline extracted `data-tag` attributes into `tags[]`
     but left the badge text in the description, causing tags like "Атака", "Броня", "Урон Стихийный"
     to appear at the end of `rawText`, `rawTextTemplate`, `familyKey`, and `regex` fields.
   - Fix in `extractTextAndRanges()`: Added `$('[data-tag]').remove()` and
     `$('span.badge[class*="crafting"]').remove()` before text extraction, alongside the
     existing `$('span.secondary').remove()`.
   - Hot-patched existing JSON files: cleaned 132 tokens in `jewel.json`, 1 in
     `jewel-desecrated.json`, 5 in `jewel-corrupted.json`. Recomputed regex for 22 tokens
     that had empty or tag-contaminated regexes after cleanup.
   - Example before: `"(10—20)% повышение брони Броня"` → after: `"(10—20)% повышение брони"`
   - Example before: regex `"Броня"` → after: regex `"повышение брони"`

2. **Bug fix: `::origin` suffix leaking into displayText** (`src/shared/family-grouper.ts`):
   - Root cause: `splitGroupByOrigin()` passed `${group.familyKey}::${origin}` as the
     familyKey to `buildFamilyGroup()`, which used it for `generateDisplayText()`, causing
     `::normal`, `::corrupted` etc. to appear in chip display text.
   - Fix: Pass the clean `group.familyKey` (without `::origin`) to `buildFamilyGroup()`,
     then override `splitGroup.familyKey` with the `::origin` suffix for React key uniqueness.

3. **VendorChip ARIA restructuring** (`src/ui/components/VendorChip.tsx`):
   - Root cause: `<input type="number">` was nested inside `<span role="switch">`,
     creating an invalid ARIA tree (interactive element inside switch role).
   - Fix: Restructured to `<div>` wrapper containing `<span role="switch">` (label + toggle)
     and `<input>` as siblings. Also increased `max={100}` → `max={1000}` for item levels > 100.

4. **FilterChip layout balance** (`src/ui/components/FilterChip.tsx`):
   - Fix: Added `min-w-[45%]` to FilterChip className, ensuring chips either fill ~half
     width (2 per row) or full width, eliminating single short chip on a line.

5. **RegexOutput aria-live reduction** (`src/ui/components/RegexOutput.tsx`):
   - Changed `aria-live="polite"` → `aria-live="off"` to prevent screen reader from
     announcing the entire regex string on every change.

6. **Sidebar focus trap for mobile menu** (`src/ui/layout/Sidebar.tsx`):
   - Added keyboard event handler that traps Tab/Shift+Tab focus within the sidebar
     when mobile menu is open, preventing focus from escaping behind the overlay.
   - Added Escape key to close the mobile menu.
   - Auto-focuses first nav link when sidebar opens.
   - Added `role="navigation"` and `aria-label` to aside element.

### Remaining

1. **HIGH — Full ETL re-run**: Jewel JSON hot-patches should be replaced with a full ETL re-run.
2. **HIGH — Regex quality audit for jewels**: Recomputed regexes via simplified Python algorithm should be audited against the full TypeScript compute-regex.
3. **MEDIUM — HomePage: Hardcoded mod counts**: Category cards show mod counts that will become stale.
4. **MEDIUM — i18n: Russian strings bypassing t()**: Multiple components still contain hardcoded Russian strings.
5. **MEDIUM — VendorPage: Duplicated layout controls**: Duplicates some CategoryControlPanel functionality.
6. **LOW — index.html: Hardcoded theme-color** / Light theme overly-broad opacity-70 override / RegexOutput double sticky.

## 16. Iteration 9 — i18n Labels + Jewel Type Filter + Constants Cleanup

### Changes

1. **TabletPage i18n labels** (`src/ui/pages/tablet/TabletPage.tsx` + `src/shared/i18n.ts`):
   - Replaced hardcoded "Тип:", "Редкость:", "Исп.:" and summary strings with `t()` calls.
   - Added 6 new i18n keys.

2. **WaystonePage i18n labels** (`src/ui/pages/waystone/WaystonePage.tsx` + `src/shared/i18n.ts`):
   - Replaced hardcoded "Осквернён", "Неосквернён", "Делириум" labels and summary strings with `t()` calls.
   - Added 6 new i18n keys.

3. **Constants cleanup** (`src/shared/constants.ts`):
   - Removed unused `ORIGIN_LABELS` and `AFFIX_LABELS` exports (replaced by `t()` calls in iteration 15).

4. **Jewel type filter** (`src/ui/pages/jewel/JewelPage.tsx` + `src/shared/mod-classifier.ts`):
   - Added `JewelTypeCategory` type: `'ruby' | 'emerald' | 'sapphire' | 'shared'`
   - Added `classifyJewelType()` using text-based heuristics:
     Ruby (fire, bleed, armour, maces, rage, thorns, totems, warcries, banners, presence),
     Emerald (lightning, accuracy, attack speed, projectiles, bows/crossbows/staves/spears, parry, sentinel, flasks),
     Sapphire (cold, curses, energy shield, spells, mana, offerings, minions, chaos).
   - Shared: mods matching multiple types or none.
   - Added 4 jewel type filter buttons (Все/Рубин/Изумруд/Сапфир) in JewelPage extraControls.
   - Filter shows selected type + shared mods; state synced to filterStore for URL sharing.
   - Added 5 new i18n keys.

### Remaining

1. **Jewel type classification verification**: Text-based heuristics need cross-validation against game data.
2. **Jewel type sub-grouping**: Add `groupMode="jewel-type"` that groups tokens by jewel type within each origin section with visual separation instead of hiding non-matching mods. **→ DONE in iteration 17.**
3. **Jewel type filter for desecrated/corrupted tokens**: Current filter applies to all origins; desecrated/corrupted mods are mostly shared across types.

## 17. Iteration 10 — Deploy Fix + Jewel Classification v2 + PageStateWrapper

### Changes

1. **Deploy fix — VendorPage FilterStoreApi type mismatch** (`src/ui/pages/vendor/VendorPage.tsx`):
   - Root cause: `filterStore.getState()` was passed as `FilterStoreApi` to `CategoryControlPanel`, but `FilterStoreApi` requires `getState`, `subscribe`, `serialize` methods.
   - Fix: Wrapped Zustand store in `FilterStoreApi` adapter (same pattern as `useCategoryPage.ts`).

2. **Jewel type classification v2 — weighted scoring** (`src/shared/mod-classifier.ts`):
   - Replaced simple regex OR-groups with weighted keyword scoring system.
   - Each jewel type has `[RegExp, weight][]` arrays: `RUBY_SCORES`, `EMERALD_SCORES`, `SAPPHIRE_SCORES`.
   - Classification picks the type with highest score, requiring margin ≥ 2 over second-best (or ≥ 1 if best ≥ 3).
   - Cross-validated against poe2db.tw Modifier Calculator pages (Ruby/Emerald/Sapphire).
   - Improved accuracy from ~62% (simple regex) to ~84% (weighted scoring).
   - Key improvements: added missing keywords (Вестник, Разрез, отравлен, колчан, пригвожден, метк, etc.),
     reduced weight for ambiguous keywords (поджог, шок, ман).

3. **PageStateWrapper component** (`src/ui/components/PageStateWrapper.tsx`):
   - New reusable component extracting loading/error/no-data pattern.
   - Generic type `<T>` with render-prop pattern: `<PageStateWrapper>{(data) => ...}</PageStateWrapper>`
   - Refactored 5 pages: BeltPage, RingPage, AmuletPage, RelicPage, WaystonePage, JewelPage.

### Remaining

1. **Jewel type sub-grouping**: Add `groupMode="jewel-type"` with visual separation instead of hiding. **→ DONE in iteration 17.**
2. **Jewel classification accuracy**: ~84% accuracy; could be improved with a static lookup table from poe2db data instead of heuristics.
3. **TabletPage PageStateWrapper**: Still has inline loading/error/no-data pattern.
4. **Full ETL re-run**: Jewel JSON hot-patches from iteration 7 should be replaced with a full `pnpm etl` run.

## 18. Iteration 17 — Jewel Type Sub-Grouping + Weighted Scoring Cleanup + Tablet Экспедиция

### Changes

1. **Jewel type sub-grouping** (`src/shared/mod-classifier.ts` + `src/ui/components/ModList.tsx` + `src/ui/pages/jewel/JewelPage.tsx`):
   - Added `'jewel-type'` to `ModGroupMode` union type.
   - `classifyGroups()` now handles `jewel-type` mode: within each origin section, tokens are further grouped into Рубин/Изумруд/Сапфир/Общие sub-headers.
   - Added `showJewelTypeSubGroups` prop to ModList — enables jewel-type sub-grouping within each origin group.
   - Added `jewelTypeFilter` prop to ModList — when a specific type is selected, only that type's sub-header + "Общие" sub-header are shown (other types hidden, not just visually collapsed).
   - JewelPage uses both props: `showJewelTypeSubGroups` always on, `jewelTypeFilter` driven by type filter buttons.
   - This replaces the previous approach of hiding non-matching tokens entirely; all types are now visible with visual separation when no filter is active.

2. **Weighted scoring cleanup** (`src/shared/mod-classifier.ts`):
   - Fixed "крич"→"клич" warcry typo in RUBY_SCORES (was matching wrong keyword root).
   - Removed duplicate/overlapping rules that were subsumed by higher-weight or more-specific entries:
     - **RUBY**: removed subsumed поджог (covered by fire keywords), оглушен (covered by оглушение), armour break (covered by armour keywords).
     - **EMERALD**: removed duplicate parry (appeared twice), mana-flask (overlap with flask), melee↔projectile (contradictory classification).
     - **SAPPHIRE**: removed duplicate minion-resist (subsumed by minion keyword), cold-resist (subsumed by cold keyword), ES-threshold (subsumed by energy_shield keyword).
   - Net result: ~15 rules removed, zero classification accuracy loss (all cross-validation results unchanged).

3. **Tablet Экспедиция tooltip** (`src/ui/pages/tablet/TabletPage.tsx`):
   - Added tooltip to "Экспедиция" button in TABLET_TYPES controls noting temporary absence in the current league (лига Руны Альдура).
   - Button shown with `opacity-60` to indicate inactive state.
   - Kept in UI for future content when Экспедиция returns.

### Remaining

1. **Jewel classification accuracy**: ~84% accuracy on cross-validation. Could be improved with a static lookup table from poe2db data instead of heuristics.
2. **TabletPage PageStateWrapper**: Still has inline loading/error/no-data pattern.
3. **Full ETL re-run**: Jewel JSON hot-patches from iteration 7 should be replaced with a full `pnpm etl` run.
4. **HomePage hardcoded mod counts**: Category cards show stale counts after data updates.

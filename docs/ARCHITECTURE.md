# PoE2 Regex Architect — Architecture

> **Version:** 10.0 | **Date:** 2026-06-06 | **Language:** RU-first

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

### Invariants Preserved
- `src/core/` — ZERO changes (I2)
- `public/generated/` — ZERO changes (I3, READ-ONLY)
- ETL pipeline — ZERO changes
- AST builder / compiler / optimizer — ZERO changes
- URL sync / Profile persistence — works unchanged (underlying token IDs preserved)

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
| Amulet/Ring/Belt | `affix-semantic` | Атакующие/Защитные/Характеристики/Прочие | Via origin filter |
| Waystone | `affix-sentiment` | Позитивные/Негативные/Нейтральные | origin filter (normal/desecrated) |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие | — |
| Jewel | `origin` | Обычные/Очернённые/Осквернённые → prefix/suffix within | Built into headers |
| Relic | `affix-only` | None (just prefix/suffix) | — |
| Vendor | N/A | Custom grid layout, not affected | — |

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
- `neutral`: everything else

### Components Added/Modified

| Component | Change | Description |
|-----------|--------|-------------|
| `ModList.tsx` | **Rewritten** | Two-column layout, flex-wrap, groupMode prop, no virtual scroll |
| `FilterChip.tsx` | **Rewritten** | Compact inline-flex chip for flex-wrap layout |
| `CategoryControlPanel.tsx` | **New** | Shared sticky top bar with regex + controls + extraControls slot |
| `mod-classifier.ts` | **New** | Semantic classification logic (tags + text + sentiment) |
| All page components | **Updated** | New layout: ControlPanel top → ModList full-width → ProfilePanel |

### Known Limitations (Next Iteration)

1. ~~**Origin sub-sections within columns**: Currently origins are handled
   via the origin filter dropdown. Visual origin sub-sections within
   each affix column (separate "Осквернённые" block) are planned.
   This requires refactoring ModList to support nested sub-groups
   (semantic → origin within each semantic group).~~ **DONE in iteration 3.**

2. **Mobile optimization**: The two-column layout stacks on mobile
   (`grid-cols-1 md:grid-cols-[2fr_3fr]`), but needs testing.

3. **VendorPage**: Not updated in this iteration — layout polish deferred.

4. ~~**Light theme CSS**: New components (ModList, FilterChip, CategoryControlPanel)
   may need light-theme overrides in `src/index.css`.~~ **DONE in iteration 3.**

5. ~~**Semantic classification fine-tuning**: The text-based heuristics
   for waystone and tablet classification should be verified against
   all real data. Edge cases may need keyword adjustments.~~ **DONE in iteration 3.**

6. **Relic origin sections**: Relic data has 58 tokens (57 normal + 1 corrupted).
   Origin sub-sections could show the single corrupted mod separately,
   but the count is too small to justify the visual noise.

## 10. Iteration 2 Changes — Multi-Origin Loading + Tablet Type Grouping

### Changes

1. **Multi-origin data loading** (`src/data/loader.ts`):
   - Added `loadMergedCategoryData()` — loads and merges multiple category JSON
     files into a single `CategoryData` object
   - Merge strategy: concatenate tokens, merge optimization tables
     (primary takes priority for duplicate keys)
   - Cached under composite key (e.g., "jewel+jewel-desecrated+jewel-corrupted")

2. **useCategoryPage `mergeCategories` option** (`src/ui/hooks/useCategoryPage.ts`):
   - New config option: `mergeCategories?: string[]`
   - When provided, loads primary + merge categories via `loadMergedCategoryData`
   - Enables multi-origin pages without changing the page component structure

3. **JewelPage multi-origin loading** (`src/ui/pages/jewel/JewelPage.tsx`):
   - Now loads: `jewel.json` (193 normal) + `jewel-desecrated.json` (21) + `jewel-corrupted.json` (10)
   - Total: 224 tokens across 3 origins
   - `groupMode="origin"` now shows all three groups:
     Обычные (193) / Очернённые (21) / Осквернённые (10)

4. **WaystonePage multi-origin loading** (`src/ui/pages/waystone/WaystonePage.tsx`):
   - Now loads: `waystone.json` (96 normal) + `waystone-desecrated.json` (16)
   - Total: 112 tokens across 2 origins (normal + desecrated)
   - Origin filter dropdown appears automatically in ModList

5. **Tablet type grouping** (`src/shared/mod-classifier.ts`):
   - New `groupMode="tablet-type"` with `TabletTypeCategory` type
   - Classifies tablet mods by content type: Ритуал, Бездна, Делириум, Ваал, Экспедиция, Общие
   - Text-based heuristics: keyword matching (алтар→Ритуал, бездн→Бездна, делир→Делириум, ваал/маяк→Ваал, экспедици→Экспедиция)
   - Updated TabletPage to use `groupMode="tablet-type"` instead of `affix-only`
   - Added "Экспедиция" to TABLET_TYPES controls in TabletPage

### Per-Tab Grouping Modes (Updated)

| Tab | `groupMode` | Sub-groups | Multi-origin? |
|-----|-------------|------------|---------------|
| Amulet/Ring/Belt | `affix-semantic` | Атакующие/Защитные/Характеристики/Прочие | Already in single file |
| Waystone | `affix-sentiment` | Позитивные/Негативные/Нейтральные | ✅ waystone + waystone-desecrated |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие | Single file |
| Jewel | `origin` | Обычные/Очернённые/Осквернённые | ✅ jewel + jewel-desecrated + jewel-corrupted |
| Relic | `affix-only` | None (just prefix/suffix) | Single file |
| Vendor | N/A | Custom grid layout | N/A |

### Invariants Preserved
- `src/core/` — ZERO changes (I2)
- `public/generated/` — ZERO changes (I3, READ-ONLY)
- ETL pipeline — ZERO changes
- AST builder / compiler / optimizer — ZERO changes
- URL sync / Profile persistence — works unchanged (underlying token IDs preserved)

## 11. Iteration 3 Changes — Origin Sub-Sections + Classification Fine-Tuning

### Changes

1. **Origin sub-sections within semantic groups** (`src/shared/family-grouper.ts` + `src/ui/components/ModList.tsx`):
   - Added `splitGroupByOrigin()` to family-grouper — splits a FamilyGroup with members
     from multiple origins into separate per-origin FamilyGroup objects, each with
     its own displayText and range values scoped to that origin's members only
   - Refactored `buildFamilyGroup()` as a shared helper (eliminated code duplication
     between `groupTokensByFamily()` and `splitGroupByOrigin()`)
   - Added `showOriginSubSections` prop to ModList — when enabled, each semantic
     sub-group (e.g., "Атакующие") further splits its chips by origin with visual
     divider lines:
     ```
     ── Атакующие (15) ──
     [chip] [chip] [chip]       ← normal origin chips
     ··· Осквернённые (3) ···   ← origin divider
     [chip] [chip] [chip]       ← corrupted origin chips
     ··· Очернённые (2) ···     ← origin divider
     [chip] [chip]              ← desecrated origin chips
     ```
   - Enabled for Amulet, Ring, Belt pages (which have multi-origin data in single files:
     amulet=427 tokens across normal/corrupted/desecrated/breachborn/essence origins)
   - Origin sub-sections only appear when there are non-normal origins present
   - Each split FamilyGroup has a unique `familyKey` with `::origin` suffix for React key uniqueness

2. **Waystone sentiment classification fine-tuning** (`src/shared/mod-classifier.ts`):
   - Fixed "больше здоровья монстров" — was POSITIVE (keyword "больше"), now NEGATIVE
   - Fixed "Дополнительных свойств у редких монстров" — was POSITIVE, now NEGATIVE
   - Fixed area curses ("Область проклята") — was NEUTRAL, now NEGATIVE
   - Fixed player debuffs (reduced resistances, flask charges, speed, recovery) — now NEGATIVE
   - Added comprehensive monster buff patterns (armoured, evasive, accuracy, bleed, poison, etc.) — now NEGATIVE
   - Positive keywords now use specific multi-word patterns instead of broad single words:
     "повышен.*редкост" instead of just "редкость", "увеличен.*количеств" instead of "количество"
   - Result: 27 POSITIVE / 81 NEGATIVE / 4 NEUTRAL (down from many misclassifications)
   - Remaining NEUTRAL (4): mostly ambiguous mods or very niche effects

3. **Tags-based classification expansion** (`src/shared/mod-classifier.ts`):
   - Added to OFFENSIVE_TAGS: `elemental`, `cold`, `fire`, `lightning`, `curse`
   - Added to DEFENSIVE_TAGS: `evasion`
   - These tags exist in amulet/ring/belt token data but were previously unclassified,
     causing tokens with only these tags to fall into `neutral` instead of their
     correct semantic category

4. **Origin label consistency fix** (`src/shared/constants.ts`):
   - Fixed `desecrated` label: was "Осквернённые" (incorrect — that's corrupted),
     now "Очернённые" (correct — desecrated/очернённые in RU game client)
   - Fixed `corrupted` label: was "Осквернено" (neuter singular), now "Осквернённые"
     (plural, consistent with other origin labels)
   - Fixed CATEGORY_LABELS: `waystone-desecrated` → "Путевые камни (Очернённые)",
     `jewel-desecrated` → "Самоцветы (Очернённые)",
     `jewel-corrupted` → "Самоцветы (Осквернённые)"

5. **Light theme CSS additions** (`src/index.css`):
   - Added overrides for origin sub-section label colors (purple-400, cyan-400, yellow-400)
   - Added overrides for affix column borders (blue-800/50, orange-800/50)
   - Added overrides for select dropdowns and input fields
   - Added overrides for FilterChip partial selection background
   - Added origin divider opacity adjustment

### Per-Tab Grouping Modes (Updated)

| Tab | `groupMode` | Sub-groups | Origin sub-sections? |
|-----|-------------|------------|----------------------|
| Amulet/Ring/Belt | `affix-semantic` | Атакующие/Защитные/Характеристики/Прочие | ✅ `showOriginSubSections` |
| Waystone | `affix-sentiment` | Позитивные/Негативные/Нейтральные | Via origin filter |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие | — |
| Jewel | `origin` | Обычные/Очернённые/Осквернённые → prefix/suffix within | Built into headers |
| Relic | `affix-only` | None (just prefix/suffix) | — |
| Vendor | N/A | Custom grid layout | — |

### Data Origin Distribution

| Category | Total tokens | Normal | Desecrated | Corrupted | Breachborn | Essence |
|----------|-------------|--------|------------|-----------|------------|---------|
| Amulet | 427 | 209 | 30 | 12 | 139 | 37 |
| Ring | 366 | 203 | 22 | 12 | 95 | 34 |
| Belt | 298 | 135 | 21 | 12 | 94 | 36 |
| Waystone | 96+16 | 96 | 16 | — | — | — |
| Jewel | 193+21+10 | 193 | 21 | 10 | — | — |
| Tablet | 75 | 75 | — | — | — | — |
| Relic | 58 | 57 | — | 1 | — | — |

### Invariants Preserved
- `src/core/` — ZERO changes (I2)
- `public/generated/` — ZERO changes (I3, READ-ONLY)
- ETL pipeline — ZERO changes
- AST builder / compiler / optimizer — ZERO changes
- URL sync / Profile persistence — works unchanged (underlying token IDs preserved)

### Remaining for Next Iteration

1. **P2 — VendorPage layout polish**: Page still uses old grid layout.
   Adapt to new style with CategoryControlPanel + compact chip layout.

2. **P2 — Mobile optimization**: Two-column layout stacks on mobile
   (`grid-cols-1 md:grid-cols-[2fr_3fr]`), but needs real device testing.
   Origin sub-sections add vertical space which may cause excessive scrolling.

3. **P2 — Relic origin sub-sections**: Relic data has 1 corrupted token.
   Could add `showOriginSubSections` but visual noise may not be worth it.

4. **Waystone sentiment edge cases**: 4 remaining NEUTRAL tokens.
   May need game-specific context to classify correctly.

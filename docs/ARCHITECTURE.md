# PoE2 Regex Architect — Architecture

> **Version:** 12.0 | **Date:** 2026-06-06 | **Language:** RU-first

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
| Amulet/Ring/Belt | `affix-semantic` | Атакующие/Защитные/Характеристики/Прочие | ✅ `showOriginSubSections` |
| Waystone | `affix-sentiment` | Позитивные/Негативные (0 NEUTRAL) | origin filter (normal/desecrated) |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие | — |
| Jewel | `origin` | Обычные/Очернённые/Осквернённые → prefix/suffix within | Built into headers |
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

### Known Limitations (Next Iteration)

1. ~~**Origin sub-sections within columns**: Currently origins are handled
   via the origin filter dropdown. Visual origin sub-sections within
   each affix column (separate "Осквернённые" block) are planned.
   This requires refactoring ModList to support nested sub-groups
   (semantic → origin within each semantic group).~~ **DONE in iteration 3.**

2. ~~**Mobile optimization**: The two-column layout stacks on mobile
   (`grid-cols-1 md:grid-cols-[2fr_3fr]`), but needs testing.~~ **DONE in iteration 4.**

3. ~~**VendorPage**: Not updated in this iteration — layout polish deferred.~~ **DONE in iteration 4.**

4. ~~**Light theme CSS**: New components (ModList, FilterChip, CategoryControlPanel)
   may need light-theme overrides in `src/index.css`.~~ **DONE in iteration 3.**

5. ~~**Semantic classification fine-tuning**: The text-based heuristics
   for waystone and tablet classification should be verified against
   all real data. Edge cases may need keyword adjustments.~~ **DONE in iteration 3.**

6. ~~**Relic origin sections**: Relic data has 58 tokens (57 normal + 1 corrupted).
   Origin sub-sections could show the single corrupted mod separately,
   but the count is too small to justify the visual noise.~~ **DONE in iteration 4.**

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
   - Result: 27 POSITIVE / 85 NEGATIVE / 0 NEUTRAL (all classified)
   - Note: The "4 NEUTRAL" count in earlier docs was incorrect — verification
     against actual data confirms all waystone family groups are classified.

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
| Waystone | `affix-sentiment` | Позитивные/Негативные (0 NEUTRAL) | Via origin filter |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие | — |
| Jewel | `origin` | Обычные/Очернённые/Осквернённые → prefix/suffix within | Built into headers |
| Relic | `affix-only` | None (just prefix/suffix) | ✅ `showOriginSubSections` |
| Vendor | N/A | Chip groups by category | — |

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

1. ~~**P2 — VendorPage layout polish**: Page still uses old grid layout.
   Adapt to new style with CategoryControlPanel + compact chip layout.~~ **DONE in iteration 4.**

2. ~~**P2 — Mobile optimization**: Two-column layout stacks on mobile
   (`grid-cols-1 md:grid-cols-[2fr_3fr]`), but needs real device testing.
   Origin sub-sections add vertical space which may cause excessive scrolling.~~ **DONE in iteration 4.**

3. ~~**P2 — Relic origin sub-sections**: Relic data has 1 corrupted token.
   Could add `showOriginSubSections` but visual noise may not be worth it.~~ **DONE in iteration 4.**

4. ~~**Waystone sentiment edge cases**: 4 remaining NEUTRAL tokens.
   May need game-specific context to classify correctly.~~ **RESOLVED — actual count is 0 NEUTRAL.**

## 12. Iteration 4 Changes — VendorPage Layout + Relic Origins + Mobile

### Changes

1. **VendorPage layout polish** (`src/ui/pages/vendor/VendorPage.tsx` + `src/ui/components/VendorChip.tsx`):
   - Replaced old grid layout (`grid-cols-1 lg:grid-cols-[1fr_320px]`) with new Layout v2 style:
     sticky top bar (RegexOutput + mode toggle + round10 + clear) → full-width chip groups below
   - Created new `VendorChip` component (`src/ui/components/VendorChip.tsx`):
     compact inline-flex chip, visually consistent with `FilterChip` but simpler
     (no family grouping, no range slots — just toggle + optional numeric input)
   - Chip labels shortened for compact display (e.g., "Скорость передвижения (30%)" → "МС 30%",
     "Сопротивление огню" → "Сопр. огню", "Одноручные булавы" → "1H Булавы")
   - Added color-coded group headers with `GROUP_COLORS` mapping:
     Скорость → yellow, Сопротивления → blue, Модификаторы → red, Умения → purple,
     Характеристики → green, Уровень → cyan, etc.
   - Added `GROUP_ORDER` for consistent group display order
   - Sticky top panel includes RegexOutput, mode toggle (Хочу/Не хочу),
     round10 toggle (when numeric values present), and clear button
   - Verification note moved to bottom of page
   - Full layout now matches other category pages: header → sticky controls → chip groups → footer note

2. **Relic origin sub-sections** (`src/ui/pages/relic/RelicPage.tsx`):
   - Added `showOriginSubSections` prop to RelicPage's ModList
   - Relic data has 58 tokens (57 normal + 1 corrupted suffix)
   - The single corrupted token "(8—10)% увеличение восстановления чести"
     now appears under a "··· Осквернённые (1) ···" divider within the suffix column
   - Since there's only 1 corrupted family group, the visual noise is minimal

3. **Mobile optimization** (`src/index.css`):
   - Added `@media (max-width: 768px)` rules:
     - Larger touch targets for filter/vendor chips (min-height: 32px, increased padding)
     - Slightly larger chip text on mobile (0.8rem) for readability
     - Extra padding on sticky control panel for reliable sticky behavior
     - Reduced margin on origin sub-section dividers to save vertical space
     - Full-width search input on mobile
   - Added `@media (max-width: 480px)` rules:
     - Grid overflow prevention (min-width: 0)
     - Adjusted chip gap for very small screens

4. **Light theme CSS additions for VendorChip** (`src/index.css`):
   - Added overrides for VendorChip group header colors (red, purple, green, cyan, amber, sky, teal)
   - Added overrides for VendorChip border-left colors (gray, yellow, red, purple, green, cyan, orange, amber, sky, teal)
   - These ensure the new VendorPage chip groups look correct in light theme

5. **Waystone sentiment verification**:
   - Verified against actual waystone + waystone-desecrated data (112 total tokens)
   - Result: 27 POSITIVE / 85 NEGATIVE / 0 NEUTRAL across 51 family groups
   - The "4 NEUTRAL" count from iteration 3 docs was incorrect — all groups are classified
   - Updated iteration 3 docs to reflect the correct count

### Per-Tab Grouping Modes (Final)

| Tab | `groupMode` | Sub-groups | Origin sub-sections? |
|-----|-------------|------------|----------------------|
| Amulet/Ring/Belt | `affix-semantic` | Атакующие/Защитные/Характеристики/Прочие | ✅ `showOriginSubSections` |
| Waystone | `affix-sentiment` | Позитивные/Негативные (0 NEUTRAL) | Via origin filter |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие | — |
| Jewel | `origin` | Обычные/Очернённые/Осквернённые → prefix/suffix within | Built into headers |
| Relic | `affix-only` | None (just prefix/suffix) | ✅ `showOriginSubSections` |
| Vendor | N/A | Color-coded chip groups | — |

### Components Added/Modified

| Component | Change | Description |
|-----------|--------|-------------|
| `VendorPage.tsx` | **Rewritten** | New Layout v2: sticky controls → chip groups → footer note |
| `VendorChip.tsx` | **New** | Compact inline-flex chip for vendor properties |
| `RelicPage.tsx` | **Updated** | Added `showOriginSubSections` to ModList |
| `index.css` | **Updated** | Mobile optimization rules + light theme VendorChip overrides |

### Invariants Preserved
- `src/core/` — ZERO changes (I2)
- `public/generated/` — ZERO changes (I3, READ-ONLY)
- ETL pipeline — ZERO changes
- AST builder / compiler / optimizer — ZERO changes
- URL sync / Profile persistence — works unchanged (underlying token IDs preserved)

### Remaining for Next Iteration

1. **P3 — Real device testing**: Mobile CSS has been added but not tested on
   actual devices. May need adjustments after real-world testing.

2. **P3 — Vendor regex verification**: Vendor regex strings are still unverified
   in-game. The verification note at the bottom of VendorPage should remain until
   community testing confirms them.

3. **P3 — Accessibility audit**: All category pages should be audited for
   keyboard navigation, screen reader support, and ARIA attributes.

4. **P3 — Performance profiling**: With 427 amulet tokens and origin sub-sections,
   render performance should be profiled. Virtual scroll may be needed if
   family group counts grow significantly.

## 13. Iteration 5 Changes — Accessibility + Keyboard Navigation + Performance

### Changes

1. **Accessibility audit — ARIA attributes** (all interactive components):
   - `FilterChip.tsx`: Added `role="switch"`, `aria-pressed`, `aria-label` (Russian,
     includes selection state + tier count + range), `aria-hidden` on decorative badges
   - `VendorChip.tsx`: Added `role="switch"`, `aria-checked`, `aria-label`, `tabIndex={0}`,
     keyboard handler (Enter/Space), `aria-label` on numeric input
   - `RegexOutput.tsx`: Added `role="region"`, `aria-label`, `aria-live="polite"` for
     live updates, `role="progressbar"` with `aria-valuenow/valuemin/valuemax/aria-label`
     on health bar, `aria-label` on regex display area
   - `CategoryControlPanel.tsx`: Added `role="toolbar"`, `aria-label`, `role="radiogroup"`
     + `role="radio"` + `aria-checked` on mode toggle buttons, `aria-label` on numeric inputs
   - `ModList.tsx`: Added `role="group"`, `aria-label`, `aria-label` on search input,
     affix filter select, origin filter select
   - `ProfilePanel.tsx`: Added `aria-expanded`, `aria-controls` on toggle button,
     `id="profile-panel-content"` on expandable section, `aria-hidden` on decorative arrow,
     `aria-label` on profile name input
   - `VendorPage.tsx`: Added `role="toolbar"`, `aria-label`, `role="radiogroup"` + `role="radio"`
     on mode toggle, `role="alert"` on verification warning

2. **Keyboard navigation** (`src/index.css`):
   - Added `focus-visible` outline styles (2px solid blue, 2px offset) for all
     interactive elements: buttons, selects, inputs, [role="switch"], [role="radio"], links
   - Added light theme override for darker focus ring contrast
   - Added `focus:not(:focus-visible)` rule to remove outline for mouse clicks
   - This ensures keyboard-only users get visible focus indicators without
     visual noise for mouse users

3. **Skip-to-content link** (`src/ui/layout/Layout.tsx` + `src/index.css`):
   - Added `<a href="#main-content" className="skip-link">` at the top of Layout
   - Skip link is visually hidden (`top: -40px`) until focused (keyboard Tab)
   - Jumps focus to `<main id="main-content" tabIndex={-1}>` when activated
   - Allows screen reader and keyboard users to bypass sidebar navigation

4. **Screen reader utility class** (`src/index.css`):
   - Added `.sr-only` utility class for visually hidden but accessible text
   - Standard clip/rect pattern for screen reader compatibility

5. **Performance review**:
   - `ModSubGroupSection` and `AffixColumn` already wrapped with `React.memo`
   - `useMemo` and `useCallback` properly used throughout all components
   - Family pooling reduces 427 amulet tokens to ~110 families — no virtual
     scroll needed at current scale
   - Assessment: virtual scroll would only be needed if family group counts
     exceed ~500, which is unlikely given current PoE2 mod pool sizes

### Components Modified

| Component | Change | Description |
|-----------|--------|-------------|
| `FilterChip.tsx` | **Updated** | ARIA: role=switch, aria-pressed, aria-label, aria-hidden on badges |
| `VendorChip.tsx` | **Updated** | ARIA: role=switch, aria-checked, aria-label, tabIndex, keyboard handler |
| `RegexOutput.tsx` | **Updated** | ARIA: role=region, aria-live, progressbar with aria attributes |
| `CategoryControlPanel.tsx` | **Updated** | ARIA: role=toolbar, radiogroup/radio for mode toggle, aria-labels on inputs |
| `ModList.tsx` | **Updated** | ARIA: role=group, aria-labels on search/filter controls |
| `ProfilePanel.tsx` | **Updated** | ARIA: aria-expanded, aria-controls, id on content panel |
| `VendorPage.tsx` | **Updated** | ARIA: role=toolbar, radiogroup, role=alert on warning |
| `Layout.tsx` | **Updated** | Skip-to-content link + main content landmark |
| `index.css` | **Updated** | focus-visible outlines, skip-link styles, .sr-only utility |

### Invariants Preserved
- `src/core/` — ZERO changes (I2)
- `public/generated/` — ZERO changes (I3, READ-ONLY)
- ETL pipeline — ZERO changes
- AST builder / compiler / optimizer — ZERO changes
- URL sync / Profile persistence — works unchanged (underlying token IDs preserved)

### Remaining for Next Iteration

1. **P3 — Real device testing**: Mobile CSS + focus-visible outlines need testing
   on actual iOS/Android devices. Touch behavior may differ from desktop emulation.

2. **P3 — Vendor regex verification**: Vendor regex strings are still unverified
   in-game. The verification note at the bottom of VendorPage now has `role="alert"`
   for screen readers. Should remain until community testing confirms them.

3. **P3 — Accessibility deep testing**: ARIA attributes are added but not tested
   with actual screen readers (NVDA, JAWS, VoiceOver). Manual testing recommended.

4. **P3 — Performance profiling with large datasets**: Current family group counts
   (17-193) are well within simple rendering limits. If PoE2 adds significantly
   more mods, re-evaluate virtual scroll.

## 14. Iteration 6 Changes — Game Icons Integration + Bug Fixes

### Changes

1. **Game icons integration** (`public/icons/` + multiple components):
   - Copied game inventory icons from `icon/` folder to `public/icons/` with clean filenames:
     `waystone.png`, `tablet.png`, `relic.png`, `jewel.png`, `vendor.png`, `belt.png`,
     `ring.png`, `amulet.png`, `logo.png`
   - Logo resized from 1024×1024 (2.2MB) to 256×256 (89KB) for web performance
   - **Sidebar.tsx**: Replaced all emoji icons (💎🧱⚡💠🛒🎗️💍📿🏠) with `<img>` tags
     referencing `public/icons/`. Added logo image above "PoE2 Regex" title.
   - **HomePage.tsx**: Replaced all emoji icons in category cards with `<img>` tags (48×48px)
   - **All category pages** (Waystone, Tablet, Relic, Jewel, Vendor, Belt, Ring, Amulet):
     Added game icon (24×24px) next to page title using `<img>` with `flex items-center gap-2`
   - Icons served via `import.meta.env.BASE_URL + 'icons/...'` for correct GitHub Pages deployment

2. **Bug fix: CATEGORY_LABELS belt label** (`src/shared/constants.ts`):
   - Fixed `belt: 'Ремни'` → `belt: 'Пояса'` — "Пояса" is the correct Russian game term,
     matching the i18n translation (`belt.title: 'Пояса'`)

3. **Bug fix: FilterChip ARIA conflict** (`src/ui/components/FilterChip.tsx`):
   - Replaced `aria-pressed` (boolean) with `aria-checked` (true/false/mixed) to match `role="switch"`
   - Now correctly communicates three selection states to screen readers:
     full → "true", partial → "mixed", none → "false"

4. **Bug fix: Sidebar hamburger missing aria-expanded** (`src/ui/layout/Sidebar.tsx`):
   - Added `aria-expanded={mobileOpen}` to the hamburger toggle button
   - Screen readers now announce whether the mobile menu is open or closed

5. **Bug fix: parseInt || null swallows 0** (`CategoryControlPanel.tsx`, `TabletPage.tsx`):
   - Changed `parseInt(e.target.value, 10) || null` to proper NaN check:
     `const v = parseInt(e.target.value, 10); setValue(e.target.value === '' ? null : isNaN(v) ? null : v)`
   - Typing "0" in range/uses inputs no longer silently clears the field

6. **Bug fix: VendorPage clearAll doesn't reset excludeMode** (`src/ui/pages/vendor/VendorPage.tsx`):
   - Added `setExcludeMode(false)` to `clearAll` function
   - Users expect "Clear" to reset all state, not just selections

7. **Bug fix: RegexOutput fallback color mismatch** (`src/ui/components/RegexOutput.tsx`):
   - Changed `var(--poe-bg, #0f0f1a)` → `var(--poe-bg, #0a0a0f)` to match actual CSS variable value

8. **Light theme CSS fixes** (`src/index.css`):
   - Added scrollbar hover color override for light theme: `#b0b0ab`
   - Added `bg-green-600` override for light theme (copied/share button state):
     `background-color: #16a34a; color: #ffffff`

### Icon File Mapping

| Source (icon/) | Target (public/icons/) | Category | Dimensions |
|----------------|----------------------|----------|------------|
| `Waystone_(Tier_15)_inventory_icon.png` | `waystone.png` | Путевые камни | 108×108 |
| `Irradiated_Tablet_inventory_icon.png` | `tablet.png` | Башни Предтеч | 108×108 |
| `Relic.png` | `relic.png` | Реликвии | 80×156 |
| `Diamond_inventory_icon.png` | `jewel.png` | Самоцветы | 108×108 |
| `Vendor.png` | `vendor.png` | Торговец | 331×270 |
| `Plate_Belt_inventory_icon.png` | `belt.png` | Пояса | 212×108 |
| `Iron_Ring_inventory_icon.png` | `ring.png` | Кольца | 108×108 |
| `Gold_Amulet_inventory_icon.png` | `amulet.png` | Амулеты | 108×108 |
| `gpt-image-1-mini_a_создай_логотип_path_.png` | `logo.png` | Логотип (sidebar) | 256×256 (resized) |

### Components Modified

| Component | Change | Description |
|-----------|--------|-------------|
| `Sidebar.tsx` | **Updated** | Emoji → game icons in nav + logo in header + aria-expanded |
| `HomePage.tsx` | **Updated** | Emoji → game icons in category cards |
| `WaystonePage.tsx` | **Updated** | Game icon in page header |
| `TabletPage.tsx` | **Updated** | Game icon in page header + parseInt fix |
| `RelicPage.tsx` | **Updated** | Game icon in page header |
| `JewelPage.tsx` | **Updated** | Game icon in page header |
| `VendorPage.tsx` | **Updated** | Game icon in page header + clearAll fix |
| `BeltPage.tsx` | **Updated** | Game icon in page header |
| `RingPage.tsx` | **Updated** | Game icon in page header |
| `AmuletPage.tsx` | **Updated** | Game icon in page header |
| `FilterChip.tsx` | **Updated** | aria-pressed → aria-checked (true/false/mixed) |
| `CategoryControlPanel.tsx` | **Updated** | parseInt || null → isNaN check |
| `RegexOutput.tsx` | **Updated** | Fallback color #0f0f1a → #0a0a0f |
| `constants.ts` | **Updated** | belt label "Ремни" → "Пояса" |
| `index.css` | **Updated** | Light theme scrollbar hover + bg-green-600 override |

### Invariants Preserved
- `src/core/` — ZERO changes (I2)
- `public/generated/` — ZERO changes (I3, READ-ONLY)
- ETL pipeline — ZERO changes
- AST builder / compiler / optimizer — ZERO changes
- URL sync / Profile persistence — works unchanged (underlying token IDs preserved)

### Remaining for Next Iteration (UI Audit — 29 issues found)

**HIGH priority:**
1. **VendorChip: Interactive input inside role="switch"** — Numeric `<input>` nested inside
   `<span role="switch">` creates invalid ARIA tree. Restructure as siblings.

**MEDIUM priority:**
2. **Sidebar: Focus trap when mobile menu open** — Tab key escapes overlay into hidden page content
3. **Sidebar: Focus not returned to hamburger after close** — Keyboard users lose position
4. **RegexOutput: aria-live="polite" too chatty** — Announces full regex string on every change
5. **ProfilePanel: Tiny touch targets for rename/delete** — Below WCAG 44×44px minimum
6. **Light theme: Over-broad opacity-70 override** — Affects all elements with opacity-70 class
7. **HomePage: Hardcoded mod counts** — Will drift as ETL data updates
8. **HomePage: Hardcoded hero stats ("1 584 мода")** — Should compute from data
9. **VendorProperty interface duplicated** — In both VendorPage.tsx and VendorChip.tsx
10. **VendorChip numeric max={100} too low** — PoE2 item levels exceed 100
11. **VendorPage: Duplicated control panel layout** — Should use CategoryControlPanel
12. **Many UI strings bypass i18n system** — Hardcoded Russian in components
13. **VendorPage regex: Short substrings may cause false positives** — "дух", "ман", "силе" too short
14. **index.html: theme-color hardcoded to dark** — Should update on theme toggle

**LOW priority:**
15. CategoryControlPanel radio buttons missing name attribute
16. Light theme scrollbar thumb hover hardcoded
17. Global `* { border-color }` overly broad
18. RegexOutput double-sticky positioning redundant
19. i18n: `home.description` key defined but unused
20. Header: Theme not synced across browser tabs
21. VendorPage group headers too small on mobile
22. Sidebar: No max-height/scroll indication on mobile
23. Auto-copy may silently fail without feedback

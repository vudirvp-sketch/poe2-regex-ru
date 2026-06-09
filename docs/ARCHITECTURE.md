# PoE2 Regex Architect — Architecture

> **Version:** 36.0 | **Date:** 2026-06-09 | **Language:** RU-first

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
    v  (compute minimal unique substrings + prefix + suffix lengthening)
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
I4. No hardcoded mod strings in UI or Engine code. Only internal_id references
    and i18n lookups from loaded data.
I5. pnpm is the ONLY package manager. Never use npm or yarn.
I6. Rule of 3: Do not create an abstraction until the same logic has been
    written 3 times.
I7. Locale type is 'ru' now. The type system must support extension to
    Locale = 'ru' | 'en' | ... but only 'ru' is implemented.
I8. PoE2 regex dialect: . (wildcard), | (OR), ! (NOT), "" (grouping),
    [] (char class), ^/$ (anchors), () (grouping). NOT standard PCRE.
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

## 5. PoE2 Regex Dialect (NOT Standard PCRE) — VERIFIED IN-GAME (RU Client, Phase 7)

| Syntax | Meaning | Example | Verified |
|--------|---------|---------|----------|
| `substring` | Simple substring match | `Бездн` matches all with "Бездн" | Yes |
| `\|` | OR (alternation) | `Бездн\|Делир` matches either | Yes |
| `!` | NOT (negation) | `!Бездн` excludes items with "Бездн" | Yes |
| `""` | Phrase grouping + AND separator | `"Бездн" "карт"` requires both | Yes |
| `.` | Any single character (wildcard) | `Б.здн` matches "Бездн" | Yes |
| `.*` | Any sequence WITHIN a single block | `"Бездн.*монстр"` within one mod | Yes |
| `[]` | Character class | `Делири[уф]` matches either | Yes |
| `^` / `$` | Anchors (start/end) | `огня$` matches end of line | Yes |
| `()` | Grouping | `([5-9]\|\d..)` | Yes (verified M-02, M-04) |
| `\d` | Digit shorthand | `\d..` matches digit + 2 chars | Yes (verified M-08) |
| `%` / `+` | Literals (not special) | `"+66"`, `"% к сопротивлению"` | Yes |
| `(` unmatched | Literal (when not paired) | `"(60"` matches literal "(60" | Yes |

**NOT supported (verified in-game, Phase 7):**

| Syntax | Status | Note |
|--------|--------|------|
| `?` (optional) | ❌ Does NOT work | No PoE2 regex support |
| `.*` across blocks | ❌ Does NOT cross | Mods/implicits/properties are separate searchable blocks |
| Description text | ❌ NOT indexed | "Можно использовать в Машине картоходца..." not searchable |

**Critical syntax rules:**

1. **`!` must be INSIDE quotes when combined with `|`:**
   - CORRECT: `"!проклят|сопротивлен"` — WRONG: `!"проклят|сопротивлен"`
   - VERIFIED in-game (Phase 8): `"!X"` works 10/10, `!"X"` works 0/10
2. **`.*` does NOT cross block boundaries** — each mod, implicit, property, name, type, and state text ("Осквернено") is a separate searchable block. Use AND (`"X" "Y"`) to search across blocks.
3. **`.*` is directional** — `"огня.*приспеш"` only matches if "огня" appears BEFORE "приспеш" WITHIN the same block. For bidirectional, use AND: `"огня" "приспеш"`.
4. **AND via space between quoted groups is order-independent** and works ACROSS blocks.
5. **Case insensitive** — verified with Cyrillic text.
6. **NOT supported:** Negative lookahead, non-greedy quantifiers, backreferences, `?` optional.
7. **Negation `!X` is item-wide** — excludes the entire item if X appears in ANY block, not just one block.
8. **Description/tooltip text is NOT indexed** — "Можно использовать в Машине картоходца...", "Путевые камни одноразовые" etc. are not searchable.
9. **State text IS indexed** — "Осквернено", "Делириум" are searchable.

**Word Truncation rules (verified in-game Phase 8):**

PoE2 is a substring search engine. Truncating the END of a word creates a valid leading substring:
- **Trailing substring works:** `"к си"` → matches `"к силе"` (because "си" is the start of "силе")
- **Leading word removal works:** `"силе"` → matches `"к силе"` (substring of full phrase)
- **Mid-word extraction does NOT work:** `"еличен"` does NOT uniquely target "увеличение"
- **Non-contiguous does NOT work:** `"к с ле"` does NOT match "к силе"
- **Minimum 3 significant chars per truncated word** — shorter truncation generates FP

**Negate optimization rules (verified in-game Phase 8):**

Priority order for exclude patterns (mixed-conflict support added Session 47):
1. **Minion marker:** `"!Приспеш"` — covers ALL minion-variant FP with one short pattern (partial coverage OK)
2. **Compound separator:** `"! и"` — catches "к силе и ловкости", "к силе, ловкости" etc. (partial coverage OK)
3. **Short universal markers** — single word appearing in ALL remaining conflicts but NOT in target family
4. **Short first-word excludes** — first word after suffix in conflict (e.g., `"для"` instead of `"повышение шанса критического удара для"`)
5. **Specific full-phrase patterns** — fallback, least preferred

**Combined exclude format `"!(A|B)"` (Session 47):**

When a token has multiple exclude patterns, they are combined into a single `EXCLUDE(OR([...]))` node:
- Old: `"suffix" "!A" "!B"` — separate AND-joined exclude groups
- New: `"suffix" "!A|B"` — single combined OR-negate group
- Semantically equivalent (both exclude items containing A OR B in any block)
- Saves ~3 chars per additional exclude pattern

**Known exclude markers (extended in Session 47):**

| Marker | Covers | Example conflict |
|--------|--------|------------------|
| `Приспеш` | All minion variants | "Приспешники имеют X% повышение шанса критического удара" |
| ` и` | Compound-family | "к силе и интеллекту" |
| `состояния` | DOT/ailment | "Наносящие урон состояния наносят урон на X% быстрее" |
| `заканчив` | Debuff duration | "Отрицательные эффекты на вас заканчиваются на X% быстрее" |
| `воскреш` | Resurrect speed | "Приспешники воскрешаются на X% быстрее" |
| `во время` | Flask-effect | "во время действия любого флакона" |
| `флакона` | Flask variants | "действия любого флакона" |
| `умения` | Skill variants | "эффекта умения" vs "эффекта умений" |

**NOT supported (verified in-game, Phase 8):**
- `^` / `$` anchors — unreliable for practical use
- Character class for word alternatives: `[сило]` ≠ «сило»

**Verified in-game (Group M, Phase 8):**
- `|` inside `()` for number ranges — WORKS. `([3-9][0-9]|[0-9][0-9][0-9])` confirmed in M-04.
- `\d` digit shorthand — WORKS. Confirmed in M-08.
- `!` + `|` inside quotes = `!(A|B)` — WORKS. Confirmed in M-07.
- `()` + `|` + `.*` scoped OR within one block — WORKS. Confirmed in M-06.

## 5.1 Block-Based Matching Model (Phase 7 — verified in-game)

PoE2 search is **block-based**: each piece of item text is an independent searchable block.

**Searchable blocks:**
- Item name
- Item type
- Item rarity
- Each property line ("Требуется: Уровень 60", "Уровень предмета: 82")
- Each implicit line
- Each mod line (for multi-line mods like Разрушительный, each sub-line is a separate block)
- Each additional state entry ("Осквернено")

**NOT indexed (not searchable):**
- Description/tooltip text ("Можно использовать в Машине картоходца...")

**Matching rules:**
- `.*` works ONLY within a single block
- AND (`"X" "Y"`) works ACROSS blocks — each group independently matches at least one block
- `!X` is item-wide — if X appears in ANY block, the item is excluded
- Positive group `X` — must find at least one block where X matches

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

## 7. Compiler: Enumerated Range (Phase 9) + AND Fallback

### Enumerated Range (preferred, Phase 9)
When both `min` and `max` are specified AND the range has ≤ `MAX_ENUMERATE_RANGE` (50) values, the compiler produces a **single quoted group** with all valid values enumerated:
```
RANGE(27, 30, 'откладывания наград')  →  "(27|28|29|30).*откладывания наград"
```
This approach is **immune to false positives from secondary numbers** in PoE2's range notation (e.g., `"26(26-50)% шанс откладывания наград"` where `50` would satisfy `≥27` and `26` would satisfy `≤30` in the AND approach).

**Why enumeration is needed (verified in-game, Phase 9):**
- PoE2 item text contains range notation like `"26(26-50)% шанс откладывания наград"`
- The AND approach produces two quoted groups that each match independently
- `"50"` in the range notation satisfies the `≥27` condition
- `"26"` (the actual roll) satisfies the `≤30` condition
- Both groups match → false positive for value 26 which is NOT in [27,30]
- Enumeration avoids this by listing exact values that must match

**round10 is always disabled for enumerated ranges** — enumeration is inherently precise. Using round10 with RANGE(27,30) would produce [20,30] instead of [27,30], defeating the purpose of precise filtering.

### AND Fallback (wide ranges)
For ranges with > `MAX_ENUMERATE_RANGE` (50) values, the compiler falls back to AND expansion:
```
RANGE(100, 200, 'жизн')  →  AND(RANGE(100, ∅, 'жизн'), RANGE(∅, 200, 'жизн'))
                          →  "([1-9][0-9][0-9]).*жизн" "([0-9]|[1-9][0-9]|[1-1][0-9][0-9]|200).*жизн"
```
**Known limitation:** Wide-range AND can produce false positives from secondary numbers in range notation. This is acceptable for broad filters where precision is less critical.

### Prefix anchoring (dual-number disambiguation only)
Since `.*` does NOT cross block boundaries (verified in-game Phase 7), cross-mod FP is impossible. Prefix anchoring is only needed for **dual-number mods** where the template has "до" between ## placeholders (e.g., "От ## до ## урона"). The prefix "От" ensures the number regex targets the first placeholder, not the second.

For single-number mods, prefix is always empty — `.*` within a single block cannot accidentally match a number from a different mod.
```
Dual-number: "От (numRegex).*до.*урона"  ← prefix "От" anchors to first number
Single-number: "(numRegex).*к сопротивлению огню"  ← no prefix needed, .* stays within block
```

### OR-suffix RANGE (Session 60: ranged tokens with different suffixes)
When multiple ranged tokens share the same numeric range (min, max) but have different suffixes, they are merged into a single RANGE node with OR-joined suffixes. The compiler wraps OR-suffixes in `()` to scope the `|` correctly within the quoted group:
```
RANGE(10, undefined, "огню|холоду|молнии")  →  "([1-9][0-9]|[0-9][0-9][0-9]).*(огню|холоду|молнии)"
```
Without wrapping: `"([1-9][0-9]).*огню|холоду|молнии"` would parse as `"([1-9][0-9]).*огню"` OR `"холоду"` OR `"молнии"` — WRONG.

- **When prefix is needed:** Dual-number mods ("От ## до ## ...", "Добавляет от ## до ## ...")
- **When prefix is NOT needed:** All single-number mods (.* can't cross blocks)
- Implementation: `regexPrefix` field on GameToken, `prefix` param on RANGE AST node

### Per-token exact regex (no round10)
Per-token numeric overrides set `exact=true` on the RANGE node, producing precise regex without rounding. Global ranges use the `round10` option.

### AND/OR Search Logic
- **AND mode** (default): Tokens are grouped by `familyKey`. Within the same family (different tiers of the same mod), tokens are OR'd — any tier matches. Across different families, tokens are AND'd — all selected mod families must be present. Example: selecting "fire res T1" + "fire res T2" + "cold res T1" in AND mode → `"fireRes1|fireRes2" "coldRes"` (fire res at any tier AND cold res).
- **OR mode**: All LITERAL and RANGE nodes go into a single OR group. Item needs ANY selected mod.

### Orphaned Ranged Tokens
When some ranged tokens have effective min/max (per-token or global) and others don't, the ones without effective range are not silently dropped. They are treated as LITERAL suffix nodes and added using the same family-based AND/OR logic.

## 8. Family Pooling (Modifier Grouping)

All tokens sharing the same `familyKey.ru` AND `affix` are merged into a single `FamilyGroup` displayed as one chip with a combined range. See `DATA_CONTRACTS.md` for the `FamilyGroup` interface.

- FilterChip shows `displayText` + tier count badge ("×9")
- Origin filter is applied **before** grouping — filtering by "corrupted" produces groups with ranges scoped to corrupted tokens only
- Dual-number mods (`hasMultiPlaceholder=true`) show "2x" badge and 1е/2е slot switcher

## 9. Layout v3 — 3-Level Visual Hierarchy

```
+--------------------------------------------------------------+
| [RegexOutput + Health Bar + Copy + Share] (sticky)          |
| [Хочу/Не хочу] [AND/OR] [Min ≥] [Max ≤] [Round10] [Extras] |
+--------------------------------------------------------------+
|  ┃ ПРЕФИКС (40)                         ┃ СУФФИКС (55)      |
|  │                                       │                    |
|  │  █ Очернённые (11)                    │  █ Осквернённые(8) |
|  │    ▪ Атакующие (3)                    │    ▪ Защитные (5)  |
|  │      [chip] [chip] [chip]             │      [chip] [chip] |
|  │    ▪ Защитные (5)                     │    ▪ Прочие (3)    |
|  │      [chip] [chip]                    │      [chip] [chip] |
|  │  █ Осквернённые (6)                   │                    |
|  │    ▪ Атакующие (2)                    │                    |
|  │      [chip] [chip]                    │                    |
|  +---------------------------------------+--------------------+
| [ProfilePanel]                                               |
+--------------------------------------------------------------+
```

### 3-Level Hierarchy

Each level is visually subordinate to the previous: smaller text, more indentation, muted background.

| | Level 1: АФФИКС | Level 2: ORIGIN | Level 3: СЕМАНТИКА |
|---|---|---|---|
| Font size | 14px (`text-sm`) | 12px (`text-xs`) | 10px (`text-[10px]`) |
| Font weight | bold | bold | semibold |
| Transform | uppercase | uppercase | uppercase |
| Display | block | block | block |
| Background | none | `bg-{color}-900/30` (notable) | `bg-{color}-900/15` (muted) |
| Border | `border-l-2` (full-width) | `border + border-l-2` (badge) | `border` (thin, badge) |

### Level 1 — АФФИКС (Prefix / Suffix)

No changes from v2. Full-width column header with `border-l-2` and left padding.
- Prefix: `text-blue-400`, `border-blue-800/50`
- Suffix: `text-orange-400`, `border-orange-800/50`

### Level 2 — ORIGIN (Обычные / Очернённые / Осквернённые / Сущность / Разлом)

Badge-style header with background, clearly subordinate to Level 1:
- `text-xs font-bold uppercase tracking-wider` (12px)
- `bg-{color}-900/30 border border-{color}-500/25 rounded-sm px-2.5 py-1 border-l-2 border-l-{color}-400`
- `block ml-2 mt-4 mb-2`

**Origin colors (v4 palette):**

| Origin | Text | Background | Border | border-l | In-game association |
|--------|------|-----------|--------|----------|-------------------|
| Обычные | `gray-300` | `gray-900/30` | `gray-500/25` | `gray-400` | Default |
| Очернённые | `emerald-400` | `emerald-900/30` | `emerald-500/25` | `emerald-400` | Desecrated |
| Осквернённые | `red-400` | `red-900/30` | `red-500/25` | `red-400` | Corrupted/Vaal |
| Сущность | `amber-400` | `amber-900/30` | `amber-500/25` | `amber-400` | Essence |
| Разлом | `violet-400` | `violet-900/30` | `violet-500/25` | `violet-400` | Breachborn |

### Level 3 — СЕМАНТИКА (Атакующие / Защитные / Характеристики / Прочие)

Compact block label, even smaller and more muted. Subordinate to Origin:

- `text-[10px] font-semibold uppercase tracking-wider`
- `bg-{color}-900/15 border border-{color}-500/15 rounded px-2 py-0.5`
- `block ml-4 mb-1`
- No `border-l-2` (to avoid competing with Levels 1 and 2)

**Semantic colors:**

| Category | Text | Background | Border |
|----------|------|-----------|--------|
| Атакующие | `red-400` | `red-900/15` | `red-500/15` |
| Защитные | `blue-400` | `blue-900/15` | `blue-500/15` |
| Характеристики | `green-400` | `green-900/15` | `green-500/15` |
| Прочие | `gray-400` | `gray-900/15` | `gray-500/15` |

Same pattern applies for:
- Waystone sentiments: Позитивные=green, Негативные=red, Нейтральные=gray
- Tablet types: Ритуал=red, Бездна=purple, Делириум=blue, Ваал=orange, Экспедиция=green, Общие=gray
- Jewel types: Рубин=red, Изумруд=green, Сапфир=blue, Общие=gray

### CategoryLabel interface

All visual configuration is centralized in `CategoryLabel` (in `mod-classifier.ts`):

```ts
interface CategoryLabel {
  label: string;        // Display text
  colorClass: string;   // Text color (e.g. 'text-red-400')
  bgClass: string;      // Background for badge (e.g. 'bg-red-900/30')
  borderClass: string;  // Border for badge (e.g. 'border-red-500/25')
  borderLClass: string; // Left accent for Level 2 only (e.g. 'border-l-red-400')
}
```

### What was removed from v2

- `··· Очернённые (11) ···` → badge Level 2
- `── Атакующие (3) ──` → badge Level 3
- `opacity-80` on origin sections → replaced with background+border styling

### Per-Tab Grouping Modes

| Tab | `groupMode` | Sub-groups | Origin sections |
|-----|-------------|------------|-----------------|
| Amulet/Ring/Belt | `affix-semantic` | Атакующие/Защитные/Характеристики/Прочие | ✅ `showOriginSubSections` |
| Waystone | `affix-sentiment` | Позитивные/Негативные (0 NEUTRAL) | origin filter (normal/desecrated) |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие | — |
| Jewel | `origin + showJewelTypeSubGroups` | Обычные/Очернённые/Осквернённые → prefix/suffix → Рубин/Изумруд/Сапфир/Общие | Built into headers |
| Relic | `affix-only` | None (just prefix/suffix) | ✅ `showOriginSubSections` |
| Vendor | N/A | Chip groups by category | — |

### Semantic Classification

**Tags-based** (amulet, ring, belt, jewel — have `tags[]`):
- `offensive`: damage, attack, critical, speed, caster, minion, physical, chaos, ailment, elemental, cold, fire, lightning, curse
- `defensive`: resistance, life, mana, armour, energy_shield, charm, evasion
- `attribute`: attribute
- `neutral`: no matching tags

**Text-based** (waystone, tablet, relic — no tags):
- Keywords: урон/атак/крит → offensive; сопр/здоров/брон → defensive; к силе/к ловк → attribute

**Waystone sentiment**: positive (редкость, количество, опыт), negative (монстр, проклят, уменьшен), 0 neutral

**Jewel type**: ETL lookup (100% when available) → weighted keyword scoring fallback (~84%). Currently all "shared" because Type A parser doesn't extract modCode.

## 10. Multi-Origin Loading

`loadMergedCategoryData()` in `src/data/loader.ts` loads multiple JSONs per page:
- JewelPage: jewel + jewel-desecrated + jewel-corrupted (224 tokens)
- WaystonePage: waystone + waystone-desecrated (112 tokens)

Origin sub-sections (`splitGroupByOrigin()` in family-grouper) split FamilyGroups by origin with Level 2 badge headers. Enabled for Amulet/Ring/Belt/Relic via `showOriginSubSections` prop.

## 11. Oracle API — Regex Validation (Phase 8)

The Oracle (`src/core/regex-oracle.ts`) validates regex patterns against sets of mod texts.

### Two validation modes

| Function | Matching | Use case |
|----------|----------|----------|
| `validateRegex()` | Flat-text (`matchQuotedGroup`) | ETL single-mod validation |
| `validateRegexItem()` | Block-based (`matchPoE2RegexItem`) | In-game behavior simulation |
| `batchValidate()` | Flat-text, batch | ETL `--validate` |
| `batchValidateItem()` | Block-based, batch | Accurate FP analysis |

### FP Categorization (Phase 8)

Oracle results distinguish two types of false positives:

- **Family-tier FP** (`OracleResult.familyTierFP`): Regex for token A matches token B's text, and A and B share the same `familyKey`. This is "by design" — when a user clicks "fire resistance", they want ALL tiers, so a regex like "к сопротивлению огню" matching both tier1 and tier2 is intentional.

- **Cross-family FP** (`OracleResult.crossFamilyFP`): Regex for token A matches token B's text, and A and B have DIFFERENT `familyKey`. This is a real bug — the regex is too broad and matches unintended mod families.

**`valid = true`** when there are NO cross-family FP and no false negatives. Family-tier FP are acceptable and don't invalidate the regex.

### Waystone implicits note

Waystone base properties (Уровень путевого камня, размер групп, количество предметов, редкость, возрождения, шанс выпадения, золото, опыт, волшебные монстры, редкие монстры) are NOT affixes — they are implicit properties of the base item type. They are NOT scraped by the ETL pipeline and NOT present in `waystone.json`. The UI handles them separately via the WaystonePage component.

## 12. Bug Fix Log

### v36.0 (2026-06-09)

| Bug | Severity | Fix |
|-----|----------|-----|
| AND of two quoted groups for numeric range produces false positives | **Critical** | RANGE(min, max) with ≤50 values now uses enumeration: `"(27\|28\|29\|30).*suffix"` instead of AND. Verified in-game (Phase 9): AND approach fails because secondary numbers in range notation (e.g., "26(26-50)%") satisfy each group independently. Enumeration lists exact values, immune to secondary numbers. |
| round10 + narrow range [27,30] widens to [20,30] | **High** | Enumerated ranges always disable round10 — enumeration is inherently precise. RANGE(27,30) with round10=true now produces `"(27\|28\|29\|30).*suffix"` (precise), not the rounded AND equivalent. |

### v35.0 (2026-06-09)

| Bug | Severity | Fix |
|-----|----------|-----|
| AND mode: different-family tokens OR'd instead of AND'd | **Critical** | In AND mode, tokens from different `familyKey` groups were all put into one OR group, producing `"suffix1\|suffix2"` (matches ANY mod). Fixed: group by `familyKey`, OR within same family, AND across families → `"suffix1" "suffix2"` (matches ALL mods). |
| AND/OR toggle had no effect on output | **Critical** | Both AND and OR modes produced identical regex. Root cause: same as above — `or(...literals)` was always used regardless of `searchLogic`. Fixed with family-based grouping. |
| Ranged tokens without effective range silently dropped | **High** | When `anyHasRange=true` but some ranged tokens had no effective min/max, those tokens were skipped entirely. Fixed: collect orphaned tokens and add as LITERAL nodes with family-based AND/OR logic. |

### v33.0 (2026-06-08)

| Bug | Severity | Fix |
|-----|----------|-----|
| `threeDigitMax()` missing range for D0>1 non-round-hundred values | **Critical** | e.g., max=250 previously produced `([0-9]\|[1-9][0-9]\|[1-1][0-9][0-9]\|250)`, missing 200-249. Fixed: now produces `([0-9]\|[1-9][0-9]\|1[0-9][0-9]\|2[0-4][0-9]\|250)` |
| `generateMaxNumberRegex` returned `''` for max=0 | Medium | Now returns `'(0)'` — matches only zero instead of silently dropping the constraint |
| Duplicate `MAX_CHARS` constant in `shared/constants.ts` and `core/limits.ts` | Low | Consolidated: `MAX_CHARS` only in `core/limits.ts`, UI imports from there. `shared/constants.ts` now only contains CATEGORY_IDS/ROUTES/LABELS |

### Number Regex correctness note

The `threeDigitMax()` function generates correct PoE2 regex for all 3-digit max values:
- Round hundreds (100, 200, 300): `([0-9]|[1-9][0-9]|[1-N][0-9][0-9]|N00)`
- D0=1 general (125, 150, 175): `([0-9]|[1-9][0-9]|1[0-prevD1][0-9]|1d1[0-d2])`
- D0>1 with d1=0 (205, 305): `([0-9]|[1-9][0-9]|[1-D0-1][0-9][0-9]|D00[0-d2])`
- D0>1 with d2=0 (250, 350): `([0-9]|[1-9][0-9]|[1-D0-1][0-9][0-9]|D0[0-prevD1][0-9]|ND0)`
- D0>1 general (275, 385): `([0-9]|[1-9][0-9]|[1-D0-1][0-9][0-9]|D0[0-prevD1][0-9]|D0d1[0-d2])`

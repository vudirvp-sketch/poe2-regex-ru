# PoE2 Regex Architect — Architecture

> **Version:** 33.0 | **Date:** 2026-06-08 | **Language:** RU-first

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

## 7. Compiler: Min+Max RANGE + Prefix Anchoring

### RANGE normalization
When both `min` and `max` are specified, the compiler expands `RANGE(min, max, suffix)` into `AND(RANGE(min, ∅, suffix), RANGE(∅, max, suffix))`, producing two AND-joined quoted groups:
```
RANGE(40, 80, 'm q')  →  "([4-9].|\d..).*m q" "([0-9]|[1-7].|80).*m q"
```
When a RANGE(min,max) is a child of AND, the expansion flattens into the parent AND to avoid double-quoting.

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
- **AND mode** (default): Each OR-group gets its own quoted group. Space between quotes = AND. Item must have ALL selected mods.
- **OR mode**: All LITERAL and RANGE nodes go into a single OR group. Item needs ANY selected mod.

## 8. Family Pooling (Modifier Grouping)

All tokens sharing the same `familyKey.ru` AND `affix` are merged into a single `FamilyGroup` displayed as one chip with a combined range. See `DATA_CONTRACTS.md` for the `FamilyGroup` interface.

- FilterChip shows `displayText` + tier count badge ("×9")
- Origin filter is applied **before** grouping — filtering by "corrupted" produces groups with ranges scoped to corrupted tokens only
- Dual-number mods (`hasMultiPlaceholder=true`) show "2x" badge and 1е/2е slot switcher

## 9. Layout v2 — Two-Column Full-Width with Semantic Grouping

```
+--------------------------------------------------------------+
| [RegexOutput + Health Bar + Copy + Share] (sticky)          |
| [Хочу/Не хочу] [AND/OR] [Min ≥] [Max ≤] [Round10] [Extras] |
+--------------------------------------------------------------+
|  +-- ПРЕФИКС (N) --+-- СУФФИКС (M) --------------------+   |
|  | [chip] [chip]    | [chip] [chip] [chip]              |   |
|  |  -- Атакующие -- |  -- Защитные --                   |   |
|  | [chip] [chip]    | [chip] [chip] [chip]              |   |
|  +------------------+------------------------------------+   |
| [ProfilePanel]                                               |
+--------------------------------------------------------------+
```

**Key:** No virtual scroll (family pooling keeps counts manageable). Two-column prefix/suffix grid `grid-cols-[2fr_3fr]`. Flex-wrap inline-flex chips. Sticky CategoryControlPanel with `extraControls` slot.

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

Origin sub-sections (`splitGroupByOrigin()` in family-grouper) split FamilyGroups by origin with visual dividers (··· Осквернённые ···). Enabled for Amulet/Ring/Belt/Relic via `showOriginSubSections` prop.

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

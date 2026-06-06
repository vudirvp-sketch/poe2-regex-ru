# PoE2 Regex Architect — Architecture

> **Version:** 29.0 | **Date:** 2026-06-07 | **Language:** RU-first

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
| `()` | Grouping | `([5-9]\|\d..)` | Yes |
| `\d` | Digit shorthand | `\d..` matches digit + 2 chars | Yes |
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
2. **`.*` does NOT cross block boundaries** — each mod, implicit, property, name, type, and state text ("Осквернено") is a separate searchable block. Use AND (`"X" "Y"`) to search across blocks.
3. **`.*` is directional** — `"огня.*приспеш"` only matches if "огня" appears BEFORE "приспеш" WITHIN the same block. For bidirectional, use AND: `"огня" "приспеш"`.
4. **AND via space between quoted groups is order-independent** and works ACROSS blocks.
5. **Case insensitive** — verified with Cyrillic text.
6. **NOT supported:** Negative lookahead, non-greedy quantifiers, backreferences, `?` optional.
7. **Negation `!X` is item-wide** — excludes the entire item if X appears in ANY block, not just one block.
8. **Description/tooltip text is NOT indexed** — "Можно использовать в Машине картоходца...", "Путевые камни одноразовые" etc. are not searchable.
9. **State text IS indexed** — "Осквернено", "Делириум" are searchable.

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

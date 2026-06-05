# PoE2 Regex Architect — ETL Guide

> **Version:** 5.1 | **Date:** 2026-06-06

---

## 1. Pipeline Overview

```
poe2db.tw/ru/*
    |
    v Step 1: Fetch HTML
scripts/etl/fetch-poe2db.ts + parse-tables.ts / parse-modifiers-calc.ts
    |
    v Step 2: Normalize
scripts/etl/normalize.ts
    |  - Clean text: trim, normalize Unicode, fix whitespace
    |  - Extract ranges and values from mod-value spans
    |  - Generate internal_id from English mod name
    |  - Extract gender inflection forms
    |  - Mark E positions for yofication
    |
    v Step 3: Compute Regex
scripts/etl/compute-regex.ts
    |  - For each token, find minimal unique substring
    |  - Consider all gender forms for uniqueness
    |  - Prefer end-of-word substrings (append $ anchor)
    |  - Check [ee] variant uniqueness
    |
    v Step 4: Compute Optimizations
scripts/etl/compute-optimizations.ts
    |  - For each combination of 2-5 tokens in category
    |  - Find shared substring matching ALL tokens
    |  - Compute savings vs individual regexes
    |  - Keep only if savings > 0
    |
    v Step 5: Generate JSON
scripts/etl/generate-dictionary.ts
    |  - Assemble CategoryData objects
    |  - Write to public/generated/*.json
    |  - Validate output against TypeScript types
    |
    v Step 6: Apply i18n overrides
scripts/etl/i18n-overrides.json (applied by run-etl.ts)
    |  - Patch tokens where poe2db.tw has no Russian translation
    |  - Override rawText.ru with manual translations
    |  - Recompute regex.ru using minimal unique substring algorithm
    |
    v
public/generated/waystone.json, tablet.json, etc.
```

## 2. Source URLs

| Category | URL | Type |
|----------|-----|------|
| Waystones (normal) | `https://poe2db.tw/ru/Waystones#ПутевыекамниMods` | A |
| Waystones (desecrated) | `https://poe2db.tw/ru/Waystones#DesecratedWaystoneMods` | A |
| Tablets | `https://poe2db.tw/ru/Tablet#БашниПредтечMods` | A |
| Urn Relic | `https://poe2db.tw/ru/Urn_Relic#RelicMods` | B |
| Seal Relic | `https://poe2db.tw/ru/Seal_Relic#RelicMods` | B |
| Jewels (normal) | `https://poe2db.tw/ru/Jewels#JewelMods` | A |
| Jewels (desecrated) | `https://poe2db.tw/ru/Jewels#JewelsDesecratedMods` | A |
| Jewels (corrupt) | `https://poe2db.tw/ru/Jewels#JewelCorruptMods` | A |
| Belts | `https://poe2db.tw/ru/Belts#ModifiersCalc` | B |
| Rings | `https://poe2db.tw/ru/Rings#ModifiersCalc` | B |
| Amulets | `https://poe2db.tw/ru/Amulets#ModifiersCalc` | B |

## 3. Type A Page Parser (Waystones, Tablets, Jewels)

### HTML Structure
Mod data is in `<table class="table table-hover table-striped mb-0 filters">` tables.
All tab content is in HTML (no lazy loading). **NOT `tablesorter`** as originally assumed.
Rows do NOT have `role="row"` attribute. Affix text is in Russian: `Префикс`/`Суффикс`/`Осквернено`.

**Column layouts vary by page:**
- Waystones normal: [Level, Pre/Suf, Description] (3 cols)
- Waystones desecrated: [Name, Pre/Suf, Description] (3 cols)
- Tablets: [Level, Pre/Suf, Description] (3 cols)
- Jewels normal/desecrated: [Name, Level, Pre/Suf, Description] (4 cols)
- Jewels corrupted: [Level, Pre/Suf (Осквернено), Description] (3 cols)
- Relics #RelicMods: [Name, Level, Pre/Suf, Description, Weight] (5 cols)

Tags are in `<span class="badge" data-tag="...">` inside description cells.
Mod codes can be extracted from `<i class="fas fa-info-circle" data-hover="...">` URLs or `data-keyword` attributes.

### Raw Data Interface
```typescript
interface RawModData {
  level: number;            // from column
  nameHtml: string;         // raw HTML with gender templates
  affix: 'prefix' | 'suffix';  // from Pre/Suf column
  descriptionHtml: string;  // raw HTML with mod-value spans
  secondaryText?: string;   // from <span class="secondary">
}
```

### Parsing Approach
1. Load HTML with Cheerio
2. Find `#${tabId} table.tablesorter tbody tr[role="row"]`
3. Extract cells: level, name (with gender HTML), affix, description HTML
4. Column layout varies by page type

## 4. Type B Page Parser (Belts, Rings, Amulets, Relics)

### HTML Structure
Mod data in `ModifiersCalc` section is **NOT in static HTML**. The actual mod data exists as a JSON object embedded in a `<script>` tag, passed to `new ModsView({...})`. The Mustache templates only render client-side.

**Real data source:** Extract JSON from `new ModsView({...})` using regex on the raw HTML string.

### JSON Structure
The JSON object contains these category arrays:
- `normal[]` — 135+ mods per belt/ring/amulet
- `corrupted[]` — 12 mods
- `desecrated[]` — 21+ mods
- `breach_tree[]`, `breach_minion[]`, `breach_caster[]` — 16-40 mods each
- `essence[]` — 35+ mods
- `perfect_essence[]` — 1 mod

Each mod object has:
```typescript
{
  Name: string;           // Gender template or plain text
  Level: string;          // Required item level
  ModGenerationTypeID: string;  // "1"=Prefix, "2"=Suffix, "5"=Corrupted
  ModFamilyList: string[];      // Grouping key
  DropChance: number | string;  // Weight
  str: string;            // HTML description with mod-value spans
  fossil_no: string[];    // Fossil tags
  mod_no: string[];       // HTML badges with data-tag attributes
  hover: string;          // URL containing mod code
  Code?: string;          // Only for essence mods
}
```

### Raw Data Interface
```typescript
interface RawModGroupData {
  genGroup: string;         // data-gengroup attribute
  origin: ModOrigin;        // normal / desecrated / corrupted / essence / breachborn
  tags: string[];           // from data-tag attributes
  maxLevel: number;         // from bg-secondary badge
  tiers: RawModTier[];      // from detail modal tables
}

interface RawModTier {
  tier: string;             // "T10"
  nameHtml: string;         // with gender templates
  level: number;            // required level
  descriptionHtml: string;  // with mod-value spans
  weight: string;           // from bg-danger badge
  modCode: string;          // from data-code or data-hover
}
```

### Parsing Approach
1. Find the ModifiersCalc tab pane: `div.tab-pane[id*="ModifiersCalc"]`
2. Extract summary cards -> groups (each card = one mod group)
3. Extract detail modals -> tiers per group

## 5. Normalize Step

### Multi-line Description Splitting (Mod Gluing Fix)

**CRITICAL:** poe2db.tw stores multiple properties in a single description cell,
separated by `<br>` tags. Only the **first line** is the actual affix mod.
Subsequent lines are implicit bonuses that the item gains from having that affix.

Example HTML from poe2db.tw waystone page:
```html
<td>Дополнительных свойств у редких монстров: <span class="mod-value">1</span>
<br><span class="mod-value">25</span>% увеличение количества редких монстров
<br><span class="mod-value">10</span>% увеличение количества путевых камней, находимых в области</td>
```

- Line 1: "Дополнительных свойств у редких монстров: 1" — **actual affix**
- Lines 2-3: "25% увеличение количества редких монстров" etc. — **implicit bonuses** (NOT separate affixes)

The `extractTextAndRanges()` function splits by `<br>` and takes ONLY the first segment.
This prevents "mod gluing" where all text gets concatenated into one garbage string.

Without this fix, rawText would become:
`"Дополнительных свойств у редких монстров: 125% увеличение количества редких монстров10% увеличение количества путевых камней, находимых в области"`

### Gender Inflection Template
Russian mod names on poe2db.tw use a custom template syntax with **UPPERCASE** keys:
```html
<if:MS>{Глубинный}<elif:FS>{Глубинная}<elif:NS>{Глубинное}
<elif:MP>{Глубинные}<elif:FP>{Глубинные}<elif:NP>{Глубинные}
</if:NP></elif:FP></elif:MP></elif:NS></elif:FS></if:MS>
```

Keys: `MS`=masculine singular, `FS`=feminine singular, `NS`=neuter singular, `MP/FP/NP`=plural forms.
Note: The original docs specified lowercase (`ms`, `fs`) but actual poe2db.tw uses UPPERCASE.

### Numeric Range Encoding
```html
<span class="mod-value">(5<span class="ndash">—</span>9)</span>% от их урона
```
Parse with: `/\((\d+)<span class="ndash">—<\/span>(\d+)\)/`

### Yofication Detection
Mark characters where E (Cyrillic) could be replaced with [её] (Cyrillic).
Only applies when the root morpheme contains Ё in standard Russian.

## 6. Compute Regex Algorithm (Minimal Unique Substring)

This is the **most critical algorithm** in the entire project.

### Algorithm
1. Get candidate texts for uniqueness checking:
   - targetToken.rawText[locale] (lowercase)
   - targetToken.genderForms[locale] all forms (lowercase)
   - All other tokens' rawText + gender forms (lowercase)
2. Build a set of ALL substrings of all exclusion texts (up to max needed length)
   - Pre-compute for O(1) lookup
3. For the target text, try all substrings starting from shortest:
   - for length n = 1, 2, 3, ...:
     - for position i = 0, 1, ..., targetText.length - n:
       - candidate = targetText.substring(i, i + n)
       - if candidate NOT in exclusion substring set: found unique substring
4. Among all unique substrings of minimum length, prefer:
   - Substrings at end of word (can append $ anchor for precision)
   - Substrings without spaces
   - Substrings that don't contain common words
5. Check [её] variant:
   - If candidate contains 'е' at a yoficationPosition:
     - Test '[её]' variant — if also unique, mark hasYofication=true
6. If no unique substring found (rare), use full text

### Performance
Pre-compute a set of all substrings (up to length 20) of all exclusion texts.
Complexity: For K tokens, each with average text length L:
- Pre-compute: O(K * L^2) — build substring sets
- Per token: O(L^2) — scan all substrings of target
- Total: O(K * L^2) — acceptable for K <= 200, L <= 100

## 7. Compute Optimizations Algorithm

### Algorithm
1. For all combinations of 2-5 tokens (limit to avoid combinatorial explosion):
2. Find longest common substring among all combo members' rawText
3. Compute savings = sum(individual_regex.length) - shared_regex.length
4. If savings > 0, add to result

### Combinatorial Limit
Max group size = 5. For K=100 tokens, C(100,5) ~ 75M — too many.
**Optimization:** Only compute for tokens that share at least 3 characters at the start of their rawText.

### Longest Common Substring
Dynamic programming, O(n*m) for two strings. For K strings, iterate pairwise.

## 8. Fallback Procedures

If poe2db.tw adds anti-bot protection:
1. Manual HTML save -> local file -> parse from file
2. Manual JSON creation with in-game verified data
3. Add Playwright in future iteration if needed

If some mods aren't translated on poe2db.tw:
1. Fall back to in-game observation
2. Add manual translations to `scripts/etl/i18n-overrides.json`
3. Overrides are applied automatically at the end of ETL pipeline

## 9. i18n Override System

### Purpose
Some tokens on poe2db.tw have English-only rawText because the site lacks Russian translations.
The override system patches these tokens with manually verified Russian translations after the
standard ETL pipeline completes.

### Override File: `scripts/etl/i18n-overrides.json`

```json
{
  "overrides": {
    "token.internal_id": {
      "rawText": "Russian translation from in-game or регис folder",
      "rawTextTemplate": "Template with # for numeric values (optional)",
      "source": "where this translation came from"
    }
  }
}
```

### How It Works
1. After all JSON files are generated (Step 5), the `applyI18nOverrides()` function runs
2. It reads `i18n-overrides.json` and looks for matching token IDs in the generated files
3. For each match, it:
   - Overwrites `rawText.ru` with the manual translation
   - Overwrites `rawTextTemplate.ru` if provided
   - Recomputes `regex.ru` using the minimal unique substring algorithm (minimum length 5)
   - Resets yofication for the token (would need manual re-check)
4. Re-writes the patched JSON files

### Adding New Overrides
1. Identify tokens with English-only rawText (check ETL output or run cross-validation tests)
2. Find the correct Russian translation from in-game text or the `регис/` folder
3. Add an entry to `scripts/etl/i18n-overrides.json`
4. Re-run `pnpm etl` to apply

### Current Overrides (51 tokens)

3 original overrides + 48 new overrides added 2026-06-06 covering all English-only breachborn and tablet tokens.

**Amulet breachborn (17 tokens):**

| Token ID | Russian Override | Regex |
|----------|------------------|-------|
| `amulet.genesistreefirespellbasecriticalchance_breachborn` | +(4—5)% к шансу критического удара чар огня | огня |
| `amulet.minionimmobilisationbuildup1_breachborn` | Приспешники имеют (20—25)% увеличение накопления обездвиживания | обездвиживания |
| `amulet.minionimmobilisationbuildup2_breachborn` | Приспешники имеют (26—31)% ... | обездвиживания |
| `amulet.minionimmobilisationbuildup3-6_breachborn` | (same pattern, different ranges) | обездвиживания |
| `amulet.spelldamageduringmanaflaskeffect1-6_breachborn` | (XX—YY)% увеличение урона чар во время действия любого флакона | урона чар во время действия любого флакона |
| `amulet.castspeedduringmanaflaskeffect1-4_breachborn` | (XX—YY)% увеличение скорости сотворения чар во время действия любого флакона | сотворения чар во время действия любого флакона |

**Belt breachborn (23 tokens):**

| Token ID | Russian Override | Regex |
|----------|------------------|-------|
| `belt.genesistreebeltsealgainfrequency_breachborn` | Запечатанные умения имеют (21—35)% увеличение частоты получения зарядов печати | печати |
| `belt.breach_tree_2_breachborn` | (41—59)% увеличение урона от огня, если вы подобрали Огненное насыщение... | Огненное насыщение за последние 8 секунд |
| `belt.genesistreebeltlightningdamageiflightninginfusioncollectedlast8seconds_breachborn` | ...Молниевое насыщение... | Молниевое насыщение за последние 8 секунд |
| `belt.genesistreebeltcolddamageifcoldinfusioncollectedlast8seconds_breachborn` | ...Холодное насыщение... | Холодное насыщение за последние 8 секунд |
| `belt.genesistreebeltspellelementalailmentmagnitude_breachborn` | (30—40)% увеличение величины элементальных недугов... | чарами |
| `belt.genesistreebeltarchonundeathonofferinguse_breachborn` | (35—50)% шанс получить Архонта Нежити при создании подношения | подношения |
| `belt.genesistreebeltminiondamageperdifferentcommandskillusedlast15seconds_breachborn` | (7—12)% увеличение урона приспешников за каждое... | 15 секунд |
| `belt.minionimmobilisationbuildup1-6_breachborn` | (same as amulet) | обездвиживания |
| `belt.spelldamageduringmanaflaskeffect1-6_breachborn` | (same as amulet) | урона чар во время действия любого флакона |
| `belt.castspeedduringmanaflaskeffect1-4_breachborn` | (same as amulet) | сотворения чар во время действия любого флакона |

**Ring breachborn (1 token):**

| Token ID | Russian Override | Regex |
|----------|------------------|-------|
| `ring.genesistreeringminionpuppetmaster_breachborn` | (40—50)% превосходящий шанс получить заряд Кукловода при использовании умения-приказа | умения-приказа |

**Tablet (7 tokens):**

| Token ID | Russian Override | Regex |
|----------|------------------|-------|
| `tablet.mod_2pzo3q` | Туман Делириума на карте порождает на (12—26)% больше осколков зеркал | осколков зеркал |
| `tablet.mod_jkqo0p` | (30—60)% увеличение шанса, что сундуки Маяков Ваал на карте окажутся редкими | окажутся редкими |
| `tablet.mod_df7zhf` | (10—25)% шанс добавить на карту уникального монстра Маяка Ваал | Маяка Ваал |
| `tablet.mod_v2ddkt` | (5—10)% шанс получить дополнительный кристалл с Маяков Ваал на карте | с Маяков Ваал на карте |
| `tablet.mod_h8udqa` | (25—50)% увеличение шанса, что Маяки Ваал призовут дополнительных монстров на карте | дополнительных монстров на карте |
| `tablet.mod_i7llgb` | (30—60)% шанс появления дополнительных групп монстров вокруг Маяков Ваал на карте | дополнительных групп монстров вокруг Маяков Ваал на карте |
| `tablet.mod_q7wgu2` | (10—30)% увеличение размера групп монстров вокруг Маяков Ваал на карте | размера групп монстров вокруг Маяков Ваал на карте |

**Original 3 overrides:**

| Token ID | Russian Override | Source |
|----------|------------------|--------|
| `amulet.genesistreeadditionalmaximumseals_breachborn` | Запечатанные умения имеют +1 к максимуму зарядов печати | регис/Амулеты моды.md |
| `tablet.mod_lqwqxg` | 1 дополнительная группа монстров вокруг Маяков Ваал на карте | регис/Плитки предтеч моды.md |
| `tablet.mod_al1nsy` | Нестабильные Бездны на карте порождают дополнительного редкого монстра при стабилизации | estimated — needs verification |

# PoE2 Regex Architect — ETL Guide

> **Version:** 3.0 | **Date:** 2025-06-05

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
Mod data is in `<table class="tablesorter">` tables. All tab content is in HTML (no lazy loading).

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
Mod data in `ModifiersCalc` section with summary cards + detail modals. Both are server-rendered.

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

### Gender Inflection Template
Russian mod names on poe2db.tw use a custom template syntax:
```html
<if:ms>{Глубинный}<elif:fs>{Глубинная}<elif:ns>{Глубинное}
<elif:mp>{Глубинные}<elif:fp>{Глубинные}<elif:np>{Глубинные}
</if:np></elif:fp></elif:mp></elif:ns></elif:fs></if:ms>
```

Keys: `ms`=masculine singular, `fs`=feminine singular, `ns`=neuter singular, `mp/fp/np`=plural forms.

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
2. Manual entry in a separate manual-overrides.json

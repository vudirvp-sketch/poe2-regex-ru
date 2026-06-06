# PoE2 Regex Architect — ETL Guide

> **Version:** 6.0 | **Date:** 2026-06-06

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
    |  - Clean text, normalize Unicode, fix whitespace
    |  - Extract ranges and values from mod-value spans (including fractional: 2.1—3)
    |  - Generate internal_id from English mod name
    |  - Extract gender inflection forms
    |  - Mark E positions for yofication
    |
    v Step 3: Compute Regex
scripts/etl/compute-regex.ts
    |  - For each token, find minimal unique substring
    |  - Extract prefix before first ## (regexPrefix field)
    |  - Suffix lengthening when suffix not unique across category
    |  - Consider all gender forms for uniqueness
    |  - Check [её] variant uniqueness
    |
    v Step 4: Compute Optimizations
scripts/etl/compute-optimizations.ts
    |  - For each combination of 2-5 tokens, find shared substring
    |  - Keep only if savings > 0
    |
    v Step 5: Generate JSON
scripts/etl/generate-dictionary.ts
    |  - Assemble CategoryData objects → public/generated/*.json
    |
    v Step 6: Apply i18n overrides
scripts/etl/i18n-overrides.json (applied by run-etl.ts)
    |  - Patch tokens with missing Russian translations
    |  - Recompute regex.ru, familyKey.ru, hasMultiPlaceholder, regexPrefix.ru
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
| Urn/Seal Relic | `https://poe2db.tw/ru/Urn_Relic#RelicMods` / `Seal_Relic` | B |
| Jewels (normal/desecrated/corrupt) | `https://poe2db.tw/ru/Jewels#JewelMods` etc. | A |
| Belts/Rings/Amulets | `https://poe2db.tw/ru/Belts#ModifiersCalc` etc. | B |

## 3. Type A Page Parser (Waystones, Tablets, Jewels)

HTML structure: `<table class="table table-hover table-striped mb-0 filters">` tables. All tab content in HTML (no lazy loading).

**Column layouts vary by page:**
- Waystones normal: [Level, Pre/Suf, Description] (3 cols)
- Waystones desecrated: [Name, Pre/Suf, Description] (3 cols)
- Tablets: [Level, Pre/Suf, Description] (3 cols)
- Jewels normal/desecrated: [Name, Level, Pre/Suf, Description] (4 cols)
- Jewels corrupted: [Level, Pre/Suf (Осквернено), Description] (3 cols)

Tags: `<span class="badge" data-tag="...">` inside description cells. Mod codes from `<i class="fas fa-info-circle" data-hover="...">` URLs.

**Known issue:** Type A parser doesn't extract modCode for jewels → `jewelType` field always "shared".

## 4. Type B Page Parser (Belts, Rings, Amulets, Relics)

Mod data is NOT in static HTML. Extract JSON from `new ModsView({...})` in a `<script>` tag.

Category arrays: `normal[]`, `corrupted[]`, `desecrated[]`, `breach_tree[]`, `breach_minion[]`, `breach_caster[]`, `essence[]`, `perfect_essence[]`

Each mod object: `{ Name, Level, ModGenerationTypeID, ModFamilyList, DropChance, str, fossil_no, mod_no, hover, Code? }`

## 5. Normalize Step — Key Details

### Multi-line Description Splitting
poe2db.tw stores multiple properties in one cell, separated by `<br>`. Only the **first line** is the actual affix. `extractTextAndRanges()` splits by `<br>` and takes only the first segment. This prevents "mod gluing".

### Gender Inflection Template
Russian mod names use UPPERCASE keys: `<if:MS>{...}<elif:FS>{...}...`. Keys: MS/FS/NS/MP/FP/NP.

### Numeric Range Encoding
Parse with: `/\((\d+)<span class="ndash">—<\/span>(\d+)\)/`. Fractional ranges supported via `parseFloat`.

## 6. Compute Regex Algorithm (Minimal Unique Substring)

1. Get candidate texts for uniqueness: target rawText + genderForms, all other tokens' rawText + genderForms
2. Build set of ALL substrings of exclusion texts (up to length 20) for O(1) lookup
3. For target, try all substrings from shortest → longest
4. Among unique substrings of minimum length, prefer: end-of-word, no spaces, no common words
5. Check [её] variant at yoficationPositions
6. Fallback: use full text if no unique substring found

### Prefix Extraction (`extractTemplatePrefix`)
Extracts text before first `##/#`, trimmed to last 2-3 words (minimum 5 chars). Returns empty if number at start or prefix too short. For dual-number templates, minimum prefix = 2 chars ("до" pattern).

### Suffix Lengthening
When a suffix is not unique within a category (e.g., "урона к атакам" appears for physical/lightning/cold damage), `extractExtendedSuffix()` adds inter-placeholder text to make it unique.

## 7. i18n Override System

Some tokens have English-only rawText on poe2db.tw. The override system patches them with manually verified Russian translations after ETL.

**File:** `scripts/etl/i18n-overrides.json` — currently 57 overrides covering:
- 17 amulet breachborn tokens
- 23 belt breachborn tokens
- 1 ring breachborn token
- 7 tablet tokens (typo fixes + content corrections)
- 9 original overrides (typo fixes, missing translations)

Override format:
```json
{
  "overrides": {
    "token.internal_id": {
      "rawText": "Russian translation",
      "rawTextTemplate": "Template with # (optional)",
      "source": "where this came from"
    }
  }
}
```

After applying overrides, `run-etl.ts` recomputes: `regex.ru`, `familyKey.ru`, `hasMultiPlaceholder`, `regexPrefix.ru`.

**To add new overrides:** Identify English-only tokens → find Russian translation from in-game text or `регис/` folder → add to `i18n-overrides.json` → re-run `pnpm etl`.

## 8. Fallback Procedures

If poe2db.tw adds anti-bot: manual HTML save → local file → parse from file.
If some mods not translated: add manual translations to `i18n-overrides.json`.

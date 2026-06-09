# PoE2 Regex Architect — ETL Guide

> **Version:** 10.0 | **Date:** 2026-06-09

---

## 1. Pipeline Overview

```
poe2db.tw/ru/*
    → Step 1: Fetch HTML (fetch-poe2db.ts + parse-tables.ts / parse-modifiers-calc.ts)
    → Step 2: Normalize (normalize.ts) — clean text, extract ranges/values, generate internal_id, gender forms, yofication
    → Step 3: Compute Regex (compute-regex.ts) — minimal unique substrings per token
    → Step 4: Compute Optimizations (compute-optimizations.ts) — shared regex groups for multi-token combos
    → Step 5: Generate JSON (generate-dictionary.ts) — assemble CategoryData → public/generated/*.json
    → Step 6: i18n overrides (i18n-overrides.json, applied by run-etl.ts) — patch missing translations, recompute fields
    → Step 7: FP repair (repairCrossFamilyFP in run-etl.ts) — suffix lengthening + excludes + prefix context
    → Step 8: Patch optimization entries (patchOptimizationEntries) — copy context/excludes to optimization entries
    → public/generated/waystone.json, tablet.json, etc.
```

## 2. Source URLs

| Category | URL | Parser Type |
|----------|-----|-------------|
| Waystones (normal) | `poe2db.tw/ru/Waystones#ПутевыекамниMods` | A |
| Waystones (desecrated) | `poe2db.tw/ru/Waystones#DesecratedWaystoneMods` | A |
| Tablets | `poe2db.tw/ru/Tablet#БашниПредтечMods` | A |
| Urn/Seal Relic | `poe2db.tw/ru/Urn_Relic#RelicMods` / `Seal_Relic` | B |
| Jewels (normal/desecrated/corrupt) | `poe2db.tw/ru/Jewels#JewelMods` etc. | A |
| Belts/Rings/Amulets | `poe2db.tw/ru/Belts#ModifiersCalc` etc. | B |

## 3. Type A Parser (Waystones, Tablets, Jewels)

HTML structure: `<table class="table table-hover table-striped mb-0 filters">` tables. All tab content in HTML (no lazy loading).

Column layouts vary by page:
- Waystones normal: [Level, Pre/Suf, Description] (3 cols)
- Waystones desecrated: [Name, Pre/Suf, Description] (3 cols)
- Tablets: [Level, Pre/Suf, Description] (3 cols)
- Jewels normal/desecrated: [Name, Level, Pre/Suf, Description] (4 cols)
- Jewels corrupted: [Level, Pre/Suf (Осквернено), Description] (3 cols)

Tags from `<span class="badge" data-tag="...">`. Mod codes from `<i class="fas fa-info-circle" data-hover="...">`.

**Known issue:** Type A parser doesn't extract modCode for jewels → `jewelType` always "shared".

## 4. Type B Parser (Belts, Rings, Amulets, Relics)

Mod data NOT in static HTML. Extract JSON from `new ModsView({...})` in a `<script>` tag.

Category arrays: `normal[]`, `corrupted[]`, `desecrated[]`, `breach_tree[]`, `breach_minion[]`, `breach_caster[]`, `essence[]`, `perfect_essence[]`

Each mod object: `{ Name, Level, ModGenerationTypeID, ModFamilyList, DropChance, str, fossil_no, mod_no, hover, Code? }`

## 5. Normalize Step — Key Details

**Multi-line description splitting:** poe2db.tw stores multiple properties in one cell separated by `<br>`. Only the first line is the actual affix. `extractTextAndRanges()` splits by `<br>` and takes first segment only.

**Gender inflection template:** Russian mod names use UPPERCASE keys: `<if:MS>{...}<elif:FS>{...}...`. Keys: MS/FS/NS/MP/FP/NP.

**Numeric range encoding:** Parse with `/\((\d+)<span class="ndash">—<\/span>(\d+)\)/`. Fractional ranges via `parseFloat`.

## 6. Compute Regex Algorithm

1. Get candidate texts: target rawText + genderForms, all other tokens' rawText + genderForms
2. Build set of ALL substrings of exclusion texts (up to length 20) for O(1) lookup
3. Try all substrings shortest → longest for target
4. Among unique substrings of minimum length, prefer: end-of-word, no spaces, no common words
5. Check [её] variant at yoficationPositions
6. Fallback: full text

**Prefix extraction** (`extractTemplatePrefix`): Text before first `##/#`, trimmed to last 2-3 words (min 5 chars). Empty if number at start. For dual-number: min prefix = 2 chars ("до" pattern).

**Suffix lengthening:** When suffix not unique within category, `extractExtendedSuffix()` adds inter-placeholder text.

## 7. i18n Override System

Some tokens have English-only rawText on poe2db.tw. Override system patches with manually verified Russian translations.

**File:** `scripts/etl/i18n-overrides.json` — ~56 overrides covering:
- 17 amulet breachborn, 23 belt breachborn, 1 ring breachborn
- 8 tablet tokens (typo fixes + content corrections + 2 explicit regex overrides)
- 7 original overrides (typo fixes, missing translations)

Override format:
```json
{
  "overrides": {
    "token.internal_id": {
      "rawText": "Russian translation",
      "rawTextTemplate": "Template with # (optional)",
      "regex": "explicit regex (optional — skip recomputation)",
      "source": "where this came from"
    }
  }
}
```

If `regex` is specified, applied directly without recomputation. After overrides, `run-etl.ts` recomputes: `regex.ru`, `familyKey.ru`, `hasMultiPlaceholder`, `regexPrefix.ru` (unless `regex` explicitly provided).

## 8. Cross-Family FP Repair (Post-Override)

`repairCrossFamilyFP()` in `run-etl.ts` — 3 steps per token, iterating until convergence:

1. **Suffix lengthening** — upgrade to full template suffix (fewer conflicts)
2. **Exclude patterns** — add short negation markers from CONFLICT_MARKERS + first-word-after-suffix heuristic
3. **regexPrefixContext** — find short substring from template prefix appearing in ALL target tokens but NOT in conflicts → stored as `regexPrefixContext` → compiled as AND(context, regex)

**CONFLICT_MARKERS:** Приспеш, во время, флакона, снарядов, всем стихиям, умений, самострелами, кинжалами, посохами, копьями, мечами, луками, топорами, без, для.

**Exclude limit:** 8 patterns per token.

**Expected impact:** −23 cross-family FP.

## 9. Optimization Entry Patching (Post-Repair)

After FP repair, `patchOptimizationEntries()` enriches optimization entries with `regexPrefixContext` and `regexExclude` from their covered tokens.

**Rules:**
- ALL tokens share same `regexPrefixContext` → added to entry
- ALL tokens share same `regexExclude` → added to entry
- Mixed → entry left without them

**Runtime consumption:** When `applyOptimizationTable()` replaces a group with shared regex:
- With `regexPrefixContext`: `AND(LITERAL(context), LITERAL(regex))`
- With `regexExclude`: `AND(LITERAL(regex), EXCLUDE(OR(...excludes)))`
- With both: combined
- Without either: plain `LITERAL(regex)`

## 10. Fallback Procedures

If poe2db.tw adds anti-bot: manual HTML save → local file → parse from file.
If some mods not translated: add manual translations to `i18n-overrides.json`.

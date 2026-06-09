# PoE2 Regex Architect — Data Contracts

> **Version:** 7.0 | **Date:** 2026-06-09

---

## 1. GameToken

```typescript
// src/shared/types.ts

export type Locale = 'ru';  // Future: | 'en'
export type AffixType = 'prefix' | 'suffix';
export type ModOrigin = 'normal' | 'desecrated' | 'corrupted' | 'essence' | 'breachborn';
export type SearchLogic = 'and' | 'or';
export type JewelType = 'ruby' | 'emerald' | 'sapphire' | 'shared';

export interface GenderForms {
  ms?: string;  // masculine singular
  fs?: string;  // feminine singular
  ns?: string;  // neuter singular
  mp?: string;  // masculine plural
  fp?: string;  // feminine plural
  np?: string;  // neuter plural
}

export interface GameToken {
  id: string;                              // "waystone.temporal_chains"
  category: string;                        // "waystone" | "tablet" | "relic" | ...
  origin: ModOrigin;                       // "normal" | "desecrated" | "corrupted" | "essence" | "breachborn"
  rawText: Record<Locale, string>;         // RU text as it appears in game
  rawTextTemplate: Record<Locale, string>; // with ## for ranges, # for values
  regex: Record<Locale, string>;           // pre-computed minimal unique substring
  familyKey: Record<Locale, string>;       // normalized rawTextTemplate for grouping mods of the same family
  regexPrefix: Record<Locale, string>;     // text before number placeholder, dual-number mods only
  hasMultiPlaceholder: boolean;            // template has multiple ##/# (dual-number or dual-stat)
  /** Exclusion patterns for cross-family FP prevention */
  regexExclude?: Record<Locale, string[]>;
  /** AND-composed prefix context for cross-family FP prevention.
   *  Short substring appearing in ALL target-family tokens but NOT in conflicts.
   *  UI compiles: AND(LITERAL(context), LITERAL(regex)) → "context" "suffix" */
  regexPrefixContext?: Record<Locale, string>;
  jewelType?: JewelType;                   // only for jewel category; populated by ETL from ModCalc pages
  genderForms: Record<Locale, GenderForms>;
  affix: AffixType;
  tags: string[];                          // ["curse", "slow", "life"]
  ranges: number[][];                      // [[5, 20]] — numeric ranges; [[2.1, 3]] for fractional
  values: number[];                        // fixed values
  hasYofication: boolean;                  // contains E in root morpheme
  yoficationPositions: number[];           // character positions where e->[её] applies
  level: number;                           // required item level (0 if N/A)
  tradeStatId?: string;                    // "explicit.stat_XXXX" for trade link
}
```

## 2. FamilyGroup

```typescript
export interface FamilyGroup {
  familyKey: string;          // familyKey.ru — normalized key for grouping
  affix: AffixType;
  members: GameToken[];       // all tier tokens in this group
  globalMin: number;          // min across all ranges/values
  globalMax: number;          // max across all ranges/values
  displayText: string;        // template with substituted range
  hasMultiPlaceholder: boolean;
  rangeSlots: number[][];     // [[min1,max1],[min2,max2]] for multi-##
  filterSlotIndex: number;    // which slot is used for numeric filtering (0=first placeholder)
}
```

## 3. OptimizationEntry

```typescript
export interface OptimizationEntry {
  ids: string[];                           // Token IDs in this group
  regex: Record<Locale, string>;           // shared substring for the group
  weight: number;                          // length of regex string
  count: number;                           // number of tokens covered
}
```

## 4. CategoryData

```typescript
export interface CategoryData {
  version: string;                         // ETL run timestamp
  category: string;                        // "waystone" | "tablet" | ...
  source: string;                          // "poe2db.tw" | "manual"
  tokens: GameToken[];
  optimizationTable: Record<string, OptimizationEntry>;
}
```

## 5. ASTNode

```typescript
export type ASTNode =
  | { type: 'AND'; children: ASTNode[] }
  | { type: 'OR'; children: ASTNode[] }
  | { type: 'EXCLUDE'; child: ASTNode }
  | { type: 'LITERAL'; value: string; tokenId?: string }
  | { type: 'RANGE'; min?: number; max?: number; suffix?: string; prefix?: string; exact?: boolean };
```

- `prefix`: text before number, only for dual-number mods ("От ## до ## ..."). Empty for single-number mods since .* can't cross blocks.
- `exact`: when true, skip round10 for precise per-token numeric filter

## 6. Internal ID Schema

```
{category}.{short_english_description}
```

Examples: `waystone.temporal_chains`, `tablet.breach_pack_size`, `relic.urn.increased_defences`, `belt.increased_life`

**Rule:** Use English description from poe2db.tw (`data-code` or canonical English name) in snake_case. Stable across ETL re-runs.

## 7. AST → Regex Compilation Rules — VERIFIED IN-GAME

| AST Node | Compilation Output | Example | Verified |
|----------|-------------------|---------|----------|
| `AND([A, B, C])` | `"A" "B" "C"` | `"огня" "приспеш" "!проклят"` | Yes |
| `OR([A, B])` | `"A\|B"` | `"огн\|хол"` | Yes |
| `EXCLUDE(LITERAL(A))` | `"!A"` | `"!проклят"` | Yes |
| `EXCLUDE(OR([A,B]))` | `"!A\|B"` | `"!проклят\|сопротивлен"` | Yes |
| `LITERAL("цепя")` | `"цепя"` | (from pre-computed regex) | Yes |
| `RANGE(min=40, suffix="m q")` | `"([4-9][0-9]\|[0-9][0-9][0-9]).*m q"` | (with round10) | Yes |
| `RANGE(min=40, suffix="m q", prefix="От")` | `"От ([4-9][0-9]\|[0-9][0-9][0-9]).*m q"` | (dual-number prefix) | Yes |
| `RANGE(min=27, max=30, suffix="суфф")` | `"(27\|28\|29\|30).*суфф"` | (enumeration, Phase 9) | Yes |
| `AND([RANGE(...), LITERAL(...)])` | `"rangeRegex" "literal"` | | Yes |
| AND-composed `regexPrefixContext` | `"context" "suffix"` | `"имеют" "увеличение урона"` | Yes |

**Key rules:**
- Each AND child gets its own quoted group. Space between groups = AND (order-independent)
- OR children share a single quoted group, separated by `|`
- `.*` does NOT cross block boundaries — safe for number + suffix within the SAME mod block
- `.*` is ONLY safe for number + suffix within the SAME block
- `!` must be INSIDE quotes: `"!A|B"` not `!"A|B"`
- RANGE(min, max) with ≤50 values uses enumeration: `"(27|28|29|30).*suffix"` (Phase 9)
- RANGE(min, max) with >50 values falls back to AND: `"≥min.*suffix" "≤max.*suffix"`
- Enumerated ranges always disable round10 — enumeration is inherently precise

## 8. JSON File Format (public/generated/*.json)

```json
{
  "version": "2025-06-05T12:00:00Z",
  "category": "waystone",
  "source": "poe2db.tw",
  "tokens": [ { ... GameToken ... } ],
  "optimizationTable": {
    "waystone.temporal_chains:waystone.enfeeble": {
      "ids": ["waystone.temporal_chains", "waystone.enfeeble"],
      "regex": { "ru": "проклят" },
      "weight": 7,
      "count": 2
    }
  }
}
```

Optimization table key: colon-joined sorted token IDs → O(1) lookup for combination checks.

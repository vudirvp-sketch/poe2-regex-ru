# PoE2 Regex Architect — Data Contracts

> **Version:** 11.0 | **Date:** 2026-06-12

---

## 1. GameToken

```typescript
// src/shared/types.ts

export type Locale = 'ru';  // Future: | 'en'
export type AffixType = 'prefix' | 'suffix' | 'implicit';
// 'implicit' = item implicit properties (waystone implicits, tablet charges, etc.)
export type ModOrigin = 'normal' | 'desecrated' | 'corrupted' | 'essence' | 'breachborn';
export type SearchLogic = 'and' | 'or';
export type JewelType = 'ruby' | 'emerald' | 'sapphire' | 'shared';
export type PriorityTier = 'S' | 'A' | 'B' | 'C';
export type PriorityFilter = 'all' | 'S+A' | 'S';

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
  origin: ModOrigin;                       // Item origin classification
  rawText: Record<Locale, string>;         // RU text as it appears in game
  rawTextTemplate: Record<Locale, string>; // with ## for ranges, # for values
  regex: Record<Locale, string>;           // pre-computed minimal unique substring
  familyKey: Record<Locale, string>;       // normalized rawTextTemplate for grouping
  regexPrefix: Record<Locale, string>;     // text before number placeholder, dual-number mods only
  hasMultiPlaceholder: boolean;            // template has multiple ##/# (dual-number or dual-stat)
  regexExclude?: Record<Locale, string[]>; // exclusion patterns for cross-family FP prevention
  regexPrefixContext?: Record<Locale, string>; // AND-composed context for FP prevention
  jewelType?: JewelType;                   // only for jewel category
  genderForms: Record<Locale, GenderForms>;
  affix: AffixType;
  tags: string[];                          // ["curse", "slow", "life"]
  ranges: number[][];                      // [[5, 20]] — numeric ranges; [[2.1, 3]] for fractional
  values: number[];                        // fixed values
  hasYofication: boolean;                  // contains Е in root morpheme
  yoficationPositions: number[];           // character positions where e->[её] applies
  level: number;                           // required item level (0 if N/A)
  tradeStatId?: string;                    // "explicit.stat_XXXX" for trade link
}
```

## 2. FamilyGroup

```typescript
// src/shared/types.ts

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
  priorityTier: PriorityTier; // S/A/B/C based on popularity, 'C' if unclassified
}
```

## 3. OptimizationEntry

```typescript
// src/shared/types.ts

export interface OptimizationEntry {
  ids: string[];                           // Token IDs in this group
  regex: Record<Locale, string>;           // shared substring for the group
  regexPrefixContext?: Record<Locale, string>; // AND-composed context (if all tokens share same)
  regexExclude?: Record<Locale, string[]>;     // exclusion patterns (if all tokens share same)
  weight: number;                          // length of regex string
  count: number;                           // number of tokens covered
}
```

## 4. CategoryData

```typescript
// src/shared/types.ts

export interface CategoryData {
  version: string;                         // ETL run timestamp
  category: string;                        // "waystone" | "tablet" | ...
  source: string;                          // "poe2db.tw" | "manual"
  /** SHA-256 hash (16-char prefix) of all poe2db.tw source HTML files.
   *  Used by --check-stale to detect if source data has changed since last ETL run.
   *  When sourceHash in generated JSON differs from current cache hash, re-run ETL. */
  sourceHash?: string;
  tokens: GameToken[];
  optimizationTable: Record<string, OptimizationEntry>;
}
```

## 5. ASTNode

```typescript
// src/shared/types.ts

export type ASTNode =
  | { type: 'AND'; children: ASTNode[] }
  | { type: 'OR'; children: ASTNode[] }
  | { type: 'EXCLUDE'; child: ASTNode }
  | { type: 'LITERAL'; value: string; tokenId?: string }
  | { type: 'RANGE'; min?: number; max?: number; suffix?: string; prefix?: string;
      exact?: boolean; anchorStart?: boolean; anchorEnd?: string; reversed?: boolean };
```

- `prefix`: text before number, only for dual-number mods ("От ## до ## ...")
- `exact`: when true, skip round10 for precise per-token numeric filter
- `anchorStart`: when true, adds `^` before number pattern (template starts with `##`)
- `anchorEnd`: when set, inserts this string after number pattern (typically `'%'` for `##%` mods)
- `reversed`: when true, produces `"suffix.*(number)%"` instead of `"(number)%.*suffix"` — used for implicit tokens where text comes BEFORE number

## 6. SlotRangeOverride & TokenRangeOverride

```typescript
// src/store/filter-store.ts

export interface SlotRangeOverride {
  min?: number;
  max?: number;
}

export interface TokenRangeOverride {
  min?: number;
  max?: number;
  filterSlotIndex?: number;          // 0=first placeholder, 1=second (single-slot mode)
  slotOverrides?: Record<number, SlotRangeOverride>; // dual-slot mode (both placeholders simultaneously)
}
```

- When `slotOverrides` is set, `filterSlotIndex`/`min`/`max` are ignored
- AST builder generates separate RANGE nodes for each active slot, ANDed together
- FilterChip shows two rows of inputs (1е/2е) for multi-placeholder mods
- Serialization: `[tokenId, min, max, filterSlotIndex, slotIdx, sMin, sMax, ...]`

## 7. VendorProperty

```typescript
// src/data/vendor-properties.ts — CANONICAL SOURCE, do not duplicate

export interface VendorProperty {
  id: string;
  label: string;
  regex: string;
  group: string;
  hasNumericInput?: boolean;
  numericSuffix?: string;
}
```

## 8. CategoryLabel

```typescript
// src/shared/mod-classifier.ts

interface CategoryLabel {
  label: string;          // Display text
  colorClass: string;     // Text color (e.g. 'text-red-400')
  bgClass: string;        // Background for badge (e.g. 'bg-red-900/30')
  borderClass: string;    // Border for badge (e.g. 'border-red-500/25')
  borderLClass: string;   // Left accent for Level 2 only (e.g. 'border-l-red-400')
  iconPath?: string;      // Origin icon path (e.g. 'icons/осквернение.webp')
}
```

Used by `ORIGIN_SECTION_LABELS` (Record<ModOrigin, CategoryLabel>) and semantic classifiers.

## 9. Internal ID Schema

```
{category}.{short_english_description}
```

Examples: `waystone.temporal_chains`, `tablet.breach_pack_size`, `relic.urn.increased_defences`, `belt.increased_life`

**Rule:** Use English description from poe2db.tw (`data-code` or canonical English name) in snake_case. Stable across ETL re-runs.

## 10. AST → Regex Compilation Rules — VERIFIED IN-GAME

| AST Node | Compilation Output | Example |
|----------|-------------------|---------|
| `AND([A, B, C])` | `"A" "B" "C"` | `"огня" "приспеш" "!проклят"` |
| `OR([A, B])` | `"A\|B"` | `"огн\|хол"` |
| `EXCLUDE(LITERAL(A))` | `"!A"` | `"!проклят"` |
| `EXCLUDE(OR([A,B]))` | `"!A\|B"` | `"!проклят\|сопротивлен"` |
| `LITERAL("цепя")` | `"цепя"` | from pre-computed regex |
| `RANGE(min=40, suffix="m q")` | `"([4-9][0-9]\|[0-9][0-9][0-9]).*m q"` | with round10 |
| `RANGE(min=40, suffix="m q", prefix="От")` | `"От ([4-9][0-9]\|...).*m q"` | dual-number prefix |
| `RANGE(min=27, max=30, suffix="суфф")` | `"(2[7-9]\|30).*суфф"` | enumeration (Phase 9) |
| `RANGE(min=27, max=30, suffix="суфф", anchorStart=true)` | `"^(2[7-9]\|30).*суфф"` | ^ anchor (Phase 9b) |
| `RANGE(min=27, max=30, suffix="суфф", anchorEnd='%')` | `"(2[7-9]\|30)%.*суфф"` | % anchor (Phase 9c) |
| `RANGE(min=80, max=99, suffix="Шанс выпадения", reversed=true)` | `"Шанс выпадения.*(8[0-9]\|9[0-9])%"` | reversed (implicit) |
| AND-composed `regexPrefixContext` | `"context" "suffix"` | `"имеют" "увеличение урона"` |

**Key rules:**
- Each AND child gets its own quoted group. Space between = AND (order-independent)
- OR children share a single quoted group, separated by `|`
- `.*` does NOT cross block boundaries — safe for number + suffix within SAME block
- `!` must be INSIDE quotes: `"!A|B"` not `!"A|B"`
- RANGE with ≤50 values: enumeration. >50 values: AND fallback
- Enumerated ranges always disable round10

## 11. JSON File Format (public/generated/*.json)

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

Optimization table key: colon-joined sorted token IDs → O(1) lookup.

## 12. Zod Schemas (Runtime Validation)

All data contracts are also defined as Zod schemas in `src/shared/schemas.ts`. These schemas validate JSON at the ETL→runtime boundary (`loader.ts`).

**Key schemas:**

| Schema | Validates |
|--------|-----------|
| `CategoryDataSchema` | Top-level JSON: version, category, source, tokens, optimizationTable |
| `GameTokenSchema` | All token fields including optional (regexExclude, regexPrefixContext, jewelType, tradeStatId) |
| `OptimizationEntrySchema` | ids, regex, weight, count + optional context/exclude |
| `GenderFormsSchema` | 6 gender form fields, all optional |
| Enum schemas | Locale, AffixType, ModOrigin, JewelType, PriorityTier, PriorityFilter |

**Usage in loader.ts:**

```typescript
import { CategoryDataSchema } from '@shared/schemas';

const raw = await response.json();
const data = CategoryDataSchema.parse(raw) as CategoryData;  // throws ZodError on invalid
```

**Inferred types:** `ValidatedCategoryData`, `ValidatedGameToken`, `ValidatedOptimizationEntry` — use for runtime-validated data where Zod parsing has confirmed the shape.

# PoE2 Regex Architect — Data Contracts

> **Version:** 3.0 | **Date:** 2025-06-05

---

## 1. GameToken

```typescript
// src/shared/types.ts

export type Locale = 'ru';  // Future: | 'en'
export type AffixType = 'prefix' | 'suffix';
export type ModOrigin = 'normal' | 'desecrated' | 'corrupted' | 'essence' | 'breachborn';

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
  origin: ModOrigin;                       // "normal" | "desecrated" | "corrupted"
  rawText: Record<Locale, string>;         // RU text as it appears in game
  rawTextTemplate: Record<Locale, string>; // with ## for ranges, # for values
  regex: Record<Locale, string>;           // pre-computed minimal unique substring
  genderForms: Record<Locale, GenderForms>; // gender inflection variants (for RU mods)
  affix: AffixType;
  tags: string[];                          // ["curse", "slow", "life"]
  ranges: number[][];                      // [[5, 20]] — numeric ranges
  values: number[];                        // fixed values
  hasYofication: boolean;                  // contains E in root morpheme
  yoficationPositions: number[];           // character positions where e->[ee] applies
  level: number;                           // required item level (0 if N/A)
  tradeStatId?: string;                    // "explicit.stat_XXXX" for trade link
}
```

## 2. OptimizationEntry

```typescript
export interface OptimizationEntry {
  ids: string[];                           // Token IDs in this group
  regex: Record<Locale, string>;           // shared substring for the group
  weight: number;                          // length of regex string
  count: number;                           // number of tokens covered
}
```

## 3. CategoryData

```typescript
export interface CategoryData {
  version: string;                         // ETL run timestamp
  category: string;                        // "waystone" | "tablet" | ...
  source: string;                          // "poe2db.tw" | "manual"
  tokens: GameToken[];
  optimizationTable: Record<string, OptimizationEntry>;
}
```

## 4. ASTNode

```typescript
export type ASTNode =
  | { type: 'AND'; children: ASTNode[] }
  | { type: 'OR'; children: ASTNode[] }
  | { type: 'EXCLUDE'; child: ASTNode }
  | { type: 'LITERAL'; value: string; tokenId?: string }  // pre-computed regex from token
  | { type: 'RANGE'; min?: number; max?: number; suffix?: string };
```

## 5. Internal ID Schema

```
{category}.{short_english_description}
```

Examples:
- `waystone.temporal_chains`
- `waystone.monsters_extra_chaos`
- `tablet.breach_pack_size`
- `relic.urn.increased_defences`
- `vendor.fire_resistance`
- `belt.increased_life`

**ID generation rule:** Use the English description from poe2db.tw (the `data-code` attribute or the mod's canonical English name), converted to snake_case. This ensures IDs are stable across ETL re-runs and language-independent.

## 6. AST -> Regex Compilation Rules — VERIFIED IN-GAME

| AST Node | Compilation Output | Example | Verified |
|----------|-------------------|---------|----------|
| `AND([A, B, C])` | `"A" "B" "C"` | `"огня" "приспеш" "!проклят"` | Yes |
| `OR([A, B])` | `"A\|B"` | `"огн\|хол"` | Yes |
| `EXCLUDE(LITERAL(A))` | `"!A"` | `"!проклят"` | Yes |
| `EXCLUDE(OR([A,B]))` | `"!A\|B"` | `"!проклят\|сопротивлен"` | Yes |
| `LITERAL("цепя")` | `"цепя"` | (from pre-computed regex) | Yes |
| `RANGE(min=40, suffix="m q")` | `"([4-9].\|\\d..).*m q"` | (with round10) | Yes |
| `AND([RANGE(40, "m q"), LITERAL("corr")])` | `"([4-9].\|\\d..).*m q" "corr"` | | Yes |

**Key rules (verified by in-game testing):**
- Each AND child gets its own quoted group. Space between groups = AND.
- OR children share a single quoted group, separated by `|`.
- RANGE + suffix combines with `.*` inside a single quoted group.
- EXCLUDE prefix `!` must be INSIDE the quoted group: `"!A"` not `!"A"`.
- `EXCLUDE(OR([...]))` compiles to `"!A|B|C"` — negation of any of the alternatives.
- AND between quoted groups is order-independent (unlike `.*` which is directional).
- `.*` crosses mod boundaries — do NOT use `.*` to combine number + specific mod text
  across different mods. Use AND (separate quoted groups) instead.
- `.*` is ONLY safe for number + suffix within the SAME mod (e.g., `"([4-9].|\\d..).*путев"`)

## 7. JSON File Format (public/generated/*.json)

```json
{
  "version": "2025-06-05T12:00:00Z",
  "category": "waystone",
  "source": "poe2db.tw",
  "tokens": [
    {
      "id": "waystone.temporal_chains",
      "category": "waystone",
      "origin": "normal",
      "rawText": {
        "ru": "Игроки периодически прокляты Замедляющими цепями"
      },
      "rawTextTemplate": {
        "ru": "Игроки периодически прокляты Замедляющими цепями"
      },
      "regex": {
        "ru": "цепя"
      },
      "genderForms": {
        "ru": {}
      },
      "affix": "suffix",
      "tags": ["curse", "slow"],
      "ranges": [],
      "values": [],
      "hasYofication": false,
      "yoficationPositions": [],
      "level": 1,
      "tradeStatId": "explicit.stat_map_players_cursed_with_temporal_chains"
    }
  ],
  "optimizationTable": {
    "waystone.temporal_chains:waystone.enfeeble:waystone.elemental_weakness": {
      "ids": ["waystone.temporal_chains", "waystone.enfeeble", "waystone.elemental_weakness"],
      "regex": { "ru": "проклят" },
      "weight": 7,
      "count": 3
    }
  }
}
```

## 8. Optimization Table Key Format

The key is colon-joined sorted token IDs:
```
"waystone.temporal_chains:waystone.enfeeble:waystone.elemental_weakness"
```

This allows O(1) lookup when checking if a combination of selected tokens has an optimization entry.

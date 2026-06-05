# PoE2 Regex Architect — Architecture

> **Version:** 5.0 | **Date:** 2026-06-06 | **Language:** RU-first

---

## 1. Layer Diagram

```
+------------------------------------------------------------------+
|                        UI / Presentation                         |
|  React 19, Vite, Tailwind, shadcn/ui, Zustand, react-router    |
|  Pages: Waystone, Tablet, Relic, Vendor, Belts, Rings, Amulets |
+------------------------------------------------------------------+
|                         Store Layer                              |
|  Zustand stores (filters, profiles) + lz-string URL sync        |
+------------------------------------------------------------------+
|                        Core / Domain                             |
|  Pure TypeScript — ZERO dependencies                             |
|  AST, Compiler, Optimizer, Number Regex, Limits, Locale         |
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
    v  (compute minimal unique substrings)
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
    Manual editing or runtime modification is FORBIDDEN.
I4. No hardcoded mod strings in UI or Engine code. Only internal_id references
    and i18n lookups from loaded data.
I5. pnpm is the ONLY package manager. Never use npm or yarn.
I6. Rule of 3: Do not create an abstraction until the same logic has been
    written 3 times.
I7. Locale type is 'ru' now. The type system must support extension to
    Locale = 'ru' | 'en' | ... but only 'ru' is implemented.
I8. PoE2 regex dialect: . (wildcard), | (OR), ! (NOT), "" (grouping),
    [] (char class), ^/$ (anchors). NOT standard PCRE.
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
```

## 5. PoE2 Regex Dialect (NOT Standard PCRE) — VERIFIED IN-GAME (RU Client)

All features below were tested and confirmed in the Russian game client on 2025-06-05.

| Syntax | Meaning | Example | Verified |
|--------|---------|---------|----------|
| `substring` | Simple substring match | `Бездн` matches all with "Бездн" | Yes |
| `\|` | OR (alternation) | `Бездн\|Делир` matches either | Yes - CRITICAL |
| `!` | NOT (negation) | `!Бездн` excludes items with "Бездн" | Yes |
| `""` | Phrase grouping + AND separator | `"Бездн" "карт"` requires both | Yes - CRITICAL |
| `.` | Any single character (wildcard) | `Б.здн` matches "Бездн" | Yes |
| `.*` | Any sequence (crosses mod boundaries!) | `Бездн.*монстр` matches across mods | Yes |
| `[]` | Character class | `Делири[уф]` matches "Делириу" or "Делириф" | Yes |
| `^` / `$` | Anchors (start/end) | `огня$` matches end of line | Yes |
| `()` | Grouping | `([5-9]\|\\d..)` | Yes |
| space between `""` | AND separator | `"огня" "приспеш"` = both must be on item | Yes |

**Critical syntax rules:**

1. **`!` must be INSIDE quotes when combined with `|`:**
   - CORRECT: `"!проклят|сопротивлен"` — excludes items with either word
   - WRONG: `!"проклят|сопротивлен"` — does NOT work
   - Also works without quotes: `!проклят` (simple negation)

2. **`.*` crosses mod boundaries:** The pattern `"([2-9].|\\d..).*увеличение"` can match
   a number in one mod and "увеличение" in a different mod on the same item.
   This means `.*` is NOT safe for combining number + specific mod. Use AND instead.

3. **`.*` is directional:** `"огня.*приспеш"` only matches if "огня" appears BEFORE "приспеш"
   in the text. For bidirectional matching, use AND: `"огня" "приспеш"`.

4. **AND via space between quoted groups is order-independent:** `"огня" "приспеш"` matches
   regardless of which word appears first on the item.

**NOT supported:** Negative lookahead, non-greedy quantifiers, backreferences.
**Case insensitive:** The in-game search is case-insensitive. Verified with Cyrillic text.

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

## 7. Compiler: Min+Max RANGE Support

### Problem
When both `min` and `max` are specified in a RANGE node (e.g., "match numbers between 40 and 80"),
the PoE2 regex dialect cannot express a single "range intersection" pattern. The dialect supports
`≥N` (via `generateNumberRegex`) and `≤N` (via `generateMaxNumberRegex`) independently, but not
their intersection in a single pattern.

### Solution: AST Normalization
The compiler uses a **normalization step** that expands `RANGE(min, max, suffix)` into
`AND(RANGE(min, undefined, suffix), RANGE(undefined, max, suffix))` before compilation.
This produces two AND-joined quoted groups in the output:

```
RANGE(40, 80, 'm q')  →  "([4-9].|\d..).*m q" "([0-9]|[1-7].|80).*m q"
```

Both conditions must match on the item, effectively constraining the number to [40, 80].

### Theoretical Limitation
There is an edge case where two different numbers on the same item could satisfy the
conditions independently (e.g., one mod has value ≥40, another has value ≤80). However,
this is extremely rare in practice because the suffix constraint ensures both patterns
match against the same mod text. This approach matches what poe2.re uses.

### Flattening
When a RANGE(min, max) is a child of an AND node, the normalization step **flattens**
the expanded AND into the parent AND, avoiding double-quoting:
```
AND(literal('огн'), RANGE(40, 80, 'm q'))
→ AND(literal('огн'), RANGE(40, ∅, 'm q'), RANGE(∅, 80, 'm q'))
→ "огн" "([4-9].|\d..).*m q" "([0-9]|[1-7].|80).*m q"
```

### URL Sharing
Both `minValue` and `maxValue` are synced to the filter store's `extraState` and
included in share URLs via lz-string compression.

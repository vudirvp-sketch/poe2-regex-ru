# PoE2 Regex Architect — Architecture

> **Version:** 60.0 | **Date:** 2026-06-16 | **Language:** RU-first

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
|  AST, Compiler, Optimizer (3 modules), Number Regex, Limits, Locale, Matcher|
+------------------------------------------------------------------+
|                        Data Loader                               |
|  fetch public/generated/*.json -> Zod validate -> typed objects   |
+------------------------------------------------------------------+
|                     ETL Pipeline (build-time)                    |
|  Cheerio scraper -> normalize -> filter implicit-set -> compute  |
|  -> generate JSON -> i18n overrides -> FP repair -> optimize    |
|  -> Oracle validation -> public/gen                              |
+------------------------------------------------------------------+
|                     External Data Source                         |
|  poe2db.tw/ru/* (server-rendered HTML, no anti-bot)             |
+------------------------------------------------------------------+
```

## 2. Data Flow

```
poe2db.tw/ru/*
    → fetch-poe2db.ts (Cheerio + fetch)
    → normalize.ts (clean text, extract ranges/values)
    → filterImplicitSetBonuses() + getImplicitTokensForCategory() (remove non-searchable implicit-set bonuses, add implicit tokens)
    → compute-regex.ts → compute-regex-core.ts + compute-regex-strategies.ts (minimal unique substrings)
    → compute-optimizations.ts (shared regex groups)
    → generate-dictionary.ts (assemble CategoryData)
    → i18n-overrides.json (patch missing translations)
    → repairCrossFamilyFP() (suffix lengthening + excludes + context)
    → patchOptimizationEntries() (copy context/excludes to opt entries)
    → iterative-optimizer.ts (Step 10: dialect opt, suffix shorten, FN fix, short-regex context + Oracle validation)
    → public/generated/waystone.json, tablet.json, etc.
    → loader.ts (fetch at runtime)
    → UI: user selects filters (want + don't-want via exclude mode)
    → ast.ts (build AST from selections — AND/OR + EXCLUDE)
    → optimizer.ts → core-optimizations.ts + optimization-strategies.ts (apply optimizationTable)
    → compiler.ts (compile AST → regex string)
    → Regex displayed in UI → copied → pasted in PoE2 search
```

## 3. PoE2 Regex Dialect (NOT Standard PCRE) — VERIFIED IN-GAME

| Syntax | Meaning | Example | Verified |
|--------|---------|---------|----------|
| `substring` | Simple substring match | `Бездн` | Yes |
| `\|` (top-level in ONE quoted group) | OR — single-word OR multi-word with `.*` bridges | `"увеличение урона.*луками\|увеличение урона.*посохами"` | ✅ iter 38 (Path D) |
| `\|` (BETWEEN two quoted groups) | OR — BROKEN | `"X"\|"Y"` | ❌ B0 confirmed iter 38 |
| `!` | NOT (negation) | `!Бездн` | Yes |
| `""` | Phrase grouping + AND separator | `"Бездн" "карт"` | Yes |
| `.` | Any single character (wildcard) | `Б.здн` | Yes |
| `.*` | Any sequence WITHIN a single block | `"Бездн.*монстр"` | Yes |
| `[]` | Character class | `Делири[уф]` | Yes |
| `^` | Start-of-block anchor | `^(2[7-9]\|30).*suffix` | Yes |
| `$` | End anchor | — | Unreliable, do not use |
| `()` with single-word `\|` inside | Grouping — works alone | `([5-9]\|..)` | ✅ |
| `()` with multi-word `\|` inside | Grouping — BROKEN | `(A B\|C D)` | ❌ Test 15 |
| `"prefix (A\|B)"` (non-`.*` prefix + `()` + `\|`) | BROKEN — matches only prefix broadly | `"повышение (брони\|скорости)"` | ❌ Test 16 |
| `\d` | Digit shorthand | `\d..` | Yes |
| `%` `+` | Literals (not special) | `"+66"`, `"% к сопр"` | Yes |
| `(?!…)` | Negative lookahead — **bidirectional via `^(?!…).*Z` (iter 46)** | `^(?!.*луками).*скорости` | Yes |

**NOT supported:** `?` (optional), `.*` across blocks, non-greedy quantifiers, backreferences.

**Critical syntax rules:**

1. **`!` must be INSIDE quotes when combined with `|`:** `"!A|B"` works, `!"A|B"` does NOT.
2. **`|` works at the TOP LEVEL of a single quoted group** (with or without `.*` in alternatives). It does NOT work in three contexts (iter 38):
   - Between two quoted groups: `"X"|"Y"` → ZERO matches in-game (B0 confirmed)
   - Inside `()` with multi-word alternatives: `"(A B|C D)"` → nothing (Test 15)
   - After non-`.*` prefix inside quotes: `"prefix (A|B)"` → matches only prefix broadly (Test 16)
3. **`.*` does NOT cross block boundaries** — each mod/implicit/property/name/state is a separate searchable block. Use AND (`"X" "Y"`) to search across blocks.
4. **`.*` is directional** — `"огня.*приспеш"` only matches if "огня" appears BEFORE "приспеш" in the same block. For bidirectional, use AND.
5. **AND via space between quoted groups is order-independent** and works ACROSS blocks.
6. **Case insensitive** — verified with Cyrillic.
7. **`!X` is item-wide** — excludes the entire item if X appears in ANY block.
8. **`(?!X)` is per-block, bidirectional via `^(?!…).*Z` (iter 46)** — `Z(?!.*X)` is forward-only (FP if X precedes Z). Anchor with `^` + `.*` bridge to make `.*` inside lookahead cover the WHOLE block: `^(?!.*X).*Z`. Lookbehind `(?<!…)` NOT supported.
9. **Description/tooltip text is NOT indexed** — not searchable.
10. **State text IS indexed** — "Осквернено", "Делириум" are searchable.

**Path D — same-family OR strategy (iter 38-41, COMPLETE):**

For multi-word alternatives that share a prefix (e.g., weapon damage with луками/посохами/копьями), use ONE quoted group with top-level `|` and `.*` bridges:

```
"увеличение урона.*луками|увеличение урона.*посохами|увеличение урона.*копьями"
```

This is the WORKING replacement for the broken opt-table pattern `"prefix (A|B|C)"` (Tests 16-17). Verified in-game:
- iter 38: 2 alternatives (D7-3)
- iter 39: 3+4 alternatives + AND-combination (D1)
- iter 40: **IMPLEMENTED in ETL** (`scripts/etl/path-d-transform.ts` + Phase D in `compute-optimizations.ts` + `reoptimizeTable` in `iterative-optimizer.ts`) and runtime (`applyOptimizationTable` applies Path D entries even with negative savings). 327/529 opt-table entries converted to Path D format, 0 broken `()` entries remain.
- iter 41: **D5 PRODUCTION-VERIFIED** — 5/5 in-game tests PASS on production ETL output (6-9 alts, same-block AND, cross-cat FP). Path D is COMPLETE.
- iter 42: **Char-limit diagnostic** — `findOverLimitEntries()` in `path-d-transform.ts` + Phase D1 in `compute-optimizations.ts` + final summary in `iterative-optimizer.ts` log warnings for opt-table entries >250 chars. Policy: diagnostic-only (entries kept, not modified).
- iter 44: **3 FP-fixes in shared `src/core/`** (user-reported jewel FP):
  1. `removeConflictingExcludes` (core-optimizations.ts) — surgical: removes only conflicting literals from EXCLUDE's OR, not entire EXCLUDE
  2. `applyOptimizationTable` (optimization-strategies.ts) — skips opt-entries with top-level `|` when user's selection is a STRICT SUBSET (`matchedIds.size < entry.ids.length`) — prevents FP from unselected alternatives
  3. `normalizeAst` in `compiler.ts` — transforms AND(LITERAL, EXCLUDE(LITERAL|OR(LITERAL,...))) inside OR into a single LITERAL with lookahead (avoids nested quotes that broke PoE2 parsing). Format refined in iter 46 from `X(?!.*A)(?!.*B)` (forward-only) to `^(?!.*A)(?!.*B).*X` (bidirectional — see iter 46 below).
- iter 46: **Forward-only `(?!…)` FP — RESOLVED + in-game verified.** iter 44's `X(?!.*A)(?!.*B)` was forward-only — failed when exclude `A` PRECEDED `X` in same block (FP with minion affix «Приспешники имеют … повышение скорости атаки»). **iter 46 FIX:** compiler now produces `^(?!.*A)(?!.*B).*X` — `^`-anchor + `.*` bridge = bidirectional exclude. In-game verified (Tests A+B PASS, Test C confirms old FP). Works in OR-context (`^` applies only to first alt, no leak — Test B verified). One-line change in `compiler.ts` normalizeAst. 4 iter 44 tests updated to new format, 2 NEW backward-exclude regression tests added (minion-блок data). 1108 tests pass.

**Other alternative strategies for multi-word OR:**

- **`.*` bridging within single block:** `"скорости.*копьями"` matches «скорости атаки копьями» — `.*` bridges the gap between "скорости" and "копьями" within one block
- **`(?!…)` bidirectional exclusions (iter 46):** `"^(?!.*луками).*скорости"` matches «скорости» in blocks without «луками» anywhere (forward-only `скорости(?!.*луками)` would miss «луками … скорости»). Anchor with `^` + `.*` bridge to make `.*` inside lookahead cover the WHOLE block.
- **AND decomposition:** Instead of one shared regex with `|`, use separate quoted groups per alternative combined via AND

## 3.1. Deterministic Regex Strategy (8 Principles) — UNIFIED for ALL categories

> Added in iteration 37, updated iter 38-42 (Path D production-verified, char-limit diagnostic). Verified on 4 real gems (60 tests in `tests/core/in-game-iteration-36-gems.test.ts`) + 5 in-game functional tests on 16 production items (iter 41 D5).
> This strategy replaces the broken opt-table approach (`"prefix (A|B|C)"`) with patterns that use ONLY verified-working PoE2 syntax.

### Principle 1: ONE MOD = ONE QUOTED GROUP

Each selected mod produces exactly ONE quoted group. The quoted group contains:
- Optional number pattern (enumeration / threshold / `^`/`+`/`%` anchors)
- The mod's distinctive suffix (unique substring)
- `.*` for bridging number → suffix within the same block

**Form:** `"[number_pattern.*]suffix"` (one quoted group per mod)

**Examples:**
- `"длительности эффекта оберега"` (no number, suffix only)
- `"15%.*увеличение урона.*посохами"` (number + `.*` bridge + suffix with mid-`.*`)
- `"(1[0-5])%.*порога стихийных состояний"` (enumeration + `.*` + suffix)

### Principle 2: MULTI-MOD = AND ACROSS BLOCKS (or WITHIN single block — iter 41 confirmed)

When user selects N mods, the regex is N quoted groups separated by spaces:

```
"mod1_regex" "mod2_regex" "mod3_regex"
```

Each group must match SOME block — possibly the same block (same-block AND, iter 41 confirmed in D5-2) OR different blocks (cross-block AND). This is the ONLY way to combine multiple mods.

### Principle 3: `|` SCOPE — only at TOP LEVEL of one quoted group (iter 38)

`|` works at the TOP LEVEL of a single quoted group — with or without `.*` bridges in each alternative. It does NOT work in three contexts:

| Pattern | Works? | Why |
|---------|--------|-----|
| `"A\|B"` (top-level `|`, single words) | ✅ | Tokenized correctly |
| `"(A\|B)"` (top-level `|` inside `()`, single words) | ✅ | Parens are grouping |
| `"prefix.*A\|prefix.*B"` (top-level `|`, multi-word with `.*`) | ✅ | **Path D, iter 38** — game patched |
| `"prefix (A\|B)"` (alternation after non-`.*` prefix inside quotes) | ❌ | `()` + `\|` ignored inside `"..."` (Test 16) |
| `"(A B\|C D)"` (multi-word alternation in parens) | ❌ | `\|` + multi-word broken (Test 15) |
| `"X"\|"Y"` (OR between quoted groups) | ❌ | **B0 confirmed broken iter 38** — zero matches |

### Principle 4: `.*` BRIDGING WITHIN SINGLE BLOCK

When mod has structure `prefix N suffix` (e.g., `15% увеличение урона боевыми посохами`), use:

```
"prefix.*suffix"
```

`.*` bridges the number and any middle words within ONE block. This is the deterministic replacement for broken `"prefix (A|B|C)"` opt-table patterns.

**Examples:**
- `"увеличение урона.*луками"` matches "15% увеличение урона луками" (one block)
- `"скорости атаки.*посохами"` matches "2% повышение скорости атаки боевыми посохами" (`.*` bridges "боевыми")
- `"Снаряды.*дополнительный снаряд"` matches long single-block mod

### Principle 5: SUFFIX UNIQUENESS

For each mod, find the SHORTEST suffix that:
- Matches the mod's rawText (via PoE2 substring matching)
- Does NOT match any OTHER mod's rawText in the same category (no FP)
- Has ≥3 significant chars per truncated word
- Truncation only at END of suffix (contiguous substring property)

**Verified unique suffixes (iter 37, gems):**
- `"длительности эффекта оберега"` — unique to "оберег duration" mod
- `"максимума здоровья компаньонов"` — unique to "компаньон HP" mod
- `"глобальной меткости"` — unique to "глобальная меткость" mod
- `"шанса наложения состояний"` — unique to "наложения состояний" mod

### Principle 6: SHARED SUFFIX → DIFFERENTIATE BY NUMBER OR CONTEXT

If two mods share the same suffix (e.g., `"порога стихийных состояний"` appears in 2+ mods with different number ranges), differentiate by:

1. **Number range (preferred):** `"(1[0-5])%.*порога стихийных состояний"` — family regex matches any tier
2. **Exact number:** `"10%.*порога стихийных состояний"` — matches only that specific roll
3. **Accept shared match:** `"порога стихийных состояний"` — matches ANY mod with this suffix (use when user wants ANY tier)

### Principle 7: CROSS-BLOCK FP RISK

`"X" "Y"` (AND across blocks) can match items where X and Y appear in DIFFERENT blocks (different mod lines). This causes false positives when:
- X matches mod A's block
- Y matches mod B's block
- But no single block contains both X and Y

**FP EXAMPLE (verified iter 37):**
- Item: Племенной узор with mods "10% увеличение урона снарядов" + "6% повышение глобальной меткости"
- Regex: `"увеличение" "меткости"` → MATCHES (FP!)
- Reason: "увеличение" matches first mod, "меткости" matches second mod — different blocks

**FP PREVENTION:**
- Use `.*` bridge in ONE quoted group: `"X.*Y"` (forces same-block match)
- `"увеличение.*меткости"` → does NOT match (no single block has both)
- `"повышение.*меткости"` → MATCHES (single block "повышение глобальной меткости")
- OR: make each quoted group as specific as possible (full suffix, not truncated)

### Principle 8: SAME-FAMILY OR — Path D (iter 38-42, COMPLETE + char-limit diagnostic)

When user wants ANY of N mods from the same family (e.g., damage with different weapons: луками/посохами/копьями), use ONE quoted group with top-level `|` and `.*` bridge per alternative:

```
"prefix.*A|prefix.*B|prefix.*C"
```

This is the WORKING replacement for the broken opt-table approach `"prefix (A|B|C)"` (Tests 16-17).

**Status:**
- ✅ 2 alternatives verified in-game (D7-3, iter 38)
- ✅ 3+4 alternatives + AND-combination verified in-game (D1, iter 39)
- ✅ ETL implemented (D2, iter 40): `path-d-transform.ts` + Phase D in `compute-optimizations.ts` + `reoptimizeTable` in `iterative-optimizer.ts`
- ✅ Runtime implemented (D4, iter 40): `applyOptimizationTable` applies Path D entries even with negative savings
- ✅ 327/529 opt-table entries converted to Path D format, 0 broken `()` entries remain
- ✅ **D5 PRODUCTION-VERIFIED (iter 41)**: 5/5 in-game tests PASS on production ETL output covering 5 categories (jewel, amulet, ring, waystone, tablet). 6-9 alts verified. Same-block AND confirmed. Cross-category FP acceptable (category-agnostic by design).
- ✅ **Char-limit diagnostic (iter 42, D7)**: `findOverLimitEntries()` in `path-d-transform.ts` (canonical `POE2_REGEX_CHAR_LIMIT = 250` constant) is called from Phase D1 in `compute-optimizations.ts` (logs WARNING per category) and from final summary in `iterative-optimizer.ts` (logs over-limit entries per category + global warning). Policy: **diagnostic-only** — entries are kept in the table (useful for subset selection; compiler picks the matching subset when fewer ids are selected), but the full entry cannot be used as a single in-game regex when ALL its ids are selected. Currently 2 entries >250 chars in jewel (317, 260 chars).

**Path D is COMPLETE. No fallback needed.**

**NEW constraint (iter 41 discovered, iter 42 diagnostic):** PoE2 regex char limit ≈ 250 chars. Path D entries >250 chars cannot be tested in isolation in-game. ETL logs warnings via `findOverLimitEntries()` — no entries dropped or modified (keeps subset-selection value).

**Word Truncation:** PoE2 is substring search. Truncating the END of a word works (`"к си"` → matches `"к силе"`). Mid-word extraction does NOT work. Minimum 3 significant chars per truncated word. **CRITICAL:** Truncation is only safe at the END of the suffix string — truncating a word followed by more text breaks the contiguous substring property (e.g., `"монстр на карте"` does NOT match `"монстров на карте"`). This applies to BOTH runtime Phase 3 (`truncateSuffix`) and ETL (`generateTruncatedSuffixes`) — both enforce last-word-only truncation.

**Truncation principle:** Basic morpheme truncations (приспешник, оглушен, флакон, хаос, монстр) work 100% when at the END of the suffix — they are substring matches and will highlight all occurrences. Mid-phrase truncation is FORBIDDEN — it creates a gap between the truncated word and subsequent text. Separate in-game verification is only needed when the truncated form could match a different meaningful word in the item context (e.g., «редкост» → FP on «редкий» rarity label).

## 4. Block-Based Matching Model

PoE2 search is block-based. Each piece of item text is an independent searchable block.

**Searchable blocks:** Item name, type, rarity, each property/implicit/mod line, state text ("Осквернено").
**NOT indexed:** Description/tooltip text.

**Matching rules:**
- `.*` works ONLY within a single block
- AND (`"X" "Y"`) works ACROSS blocks
- `!X` is item-wide

**Implicit vs Mod blocks:**
- **Mod blocks** (prefix/suffix): Format `##% description` — number BEFORE text. Regex: `(number)%.*suffix`. Dual-indexed (simplified + range notation).
- **Implicit blocks**: Format `Description: +##%` — number AFTER text. Regex: `suffix.*(number)%` (REVERSED). NOT dual-indexed (only simplified format).
- **Implicit-set bonuses** (e.g., `"На ##% больше..."`, `"##% увеличение эффективности монстров"`) are NOT searchable in-game — they affect the implicit section but have no searchable mod text.

## 5. Compiler: Enumerated Range + AND Fallback

### Enumerated Range (preferred, ≤50 values)

When both min and max are specified AND the range has ≤ `MAX_ENUMERATE_RANGE` (50) values, the compiler produces a single quoted group with compact decade grouping:

```
RANGE(27, 30, 'откладывания наград')  →  "(2[7-9]|30).*откладывания наград"
```

Decade grouping: full decade → `[0-9]`, partial start → `[7-9]`, partial end → `[0-2]`, single → literal. Cross-boundary splits. ~4.5x shorter than flat enumeration.

**Known limitation:** Enumeration does NOT fully prevent FP when the item's range notation contains a matching number (e.g. `"26(27-50)%..."` — `27` from range notation matches enumeration). Mitigated by `^` and `%` anchors (§6).

**round10 is always disabled for enumerated ranges** — enumeration is inherently precise.

### AND Fallback (ranges >50 values)

```
RANGE(100, 200, 'жизн')  →  "([1-9][0-9][0-9]).*жизн" "([0-9]|[1-9][0-9]|[1-1][0-9][0-9]|200).*жизн"
```

Known limitation: wide-range AND can produce FP from secondary numbers in range notation.

### Prefix Anchoring (dual-number mods only)

Since `.*` does NOT cross blocks, cross-mod FP is impossible. Prefix is only needed for dual-number mods ("От ## до ## урона") where prefix "От" anchors the number to the first placeholder.

### MULTI_RANGE: Single-Group Dual-Number Regex

For dual-number mods where BOTH slots have a numeric filter, the system generates a single `MULTI_RANGE` AST node that compiles to a SINGLE quoted group containing both number patterns:

```
MULTI_RANGE(
  [{min:6, prefix:"Добавляет от"}, {min:12, prefix:"до"}],
  suffix: "урона к атакам"
)
→  "Добавляет от ([6-9]|\d{2,}).*до (1[2-9]|[2-9][0-9]|\d{3,}).*урона к атакам"
```

vs. old AND-of-two-RANGE approach:
```
"Добавляет от ([6-9]|\d{2,}).*урона к атакам" "до (1[2-9]|[2-9][0-9]|\d{3,}).*урона к атакам"
```

**Why single group is better:**
1. Both numbers MUST match in the SAME block (AND-of-two can match different blocks)
2. Shorter regex (one group vs two, no duplicate suffix)
3. No risk of each quoted group matching a different mod line

**When MULTI_RANGE is used:**
- Dual-number mod (`hasMultiPlaceholder=true`) AND both slots have filters → MULTI_RANGE
- Only one slot has a filter → falls back to single RANGE node (existing approach)
- Single-placeholder mod → existing RANGE approach

**Broken suffix repair:** Some ETL-generated suffixes for multi-placeholder tokens incorrectly include range notation characters (e.g., `"4—20) физического урона к атакам"`). At runtime, MULTI_RANGE detects `)` or `—` in the suffix and extracts a clean suffix from `rawTextTemplate` instead.

## 6. Four-Level FP Prevention

| Level | Method | When | FP prevented | FN risk |
|-------|--------|------|-------------|---------|
| 1 | `^` (anchorStart) | Template starts with `##` or `[+-]##` | Range notation at non-position-0 | None |
| 2 | `\+` / `-` (signPrefix) | Template has `+##` or `-##` before number | Range notation numbers never have +/- sign | None |
| 3 | `%` suffix anchor (anchorEnd) | Template has `##%` AND anchorStart=false AND no signPrefix | Numbers not followed by `%` | Items where actual roll has range notation |
| 4 | Enumeration (compact decade) | Range ≤ 50 | Secondary numbers not matching enumerated values | None |

**`anchorStart` implementation:**
- `anchorStart=true` when `rawTextTemplate` starts with `##` or `[+-]##` (number at position 0)
- Compiler adds `^` when `anchorStart=true` AND no `prefix`
- For `+##` and `-##` mods: `^\+` or `^-` anchors to sign+number at block start

**`signPrefix` implementation:**
- `signPrefix='+'` when template has `+##` → compiler emits `\+` before number pattern
- `signPrefix='-'` when template has `-##` → compiler emits `-` before number pattern
- Provides implicit anchoring: range notation numbers never have +/- before them
- For `+##%` mods: `^\+N` replaces `%` anchorEnd — more precise (sign + number)
- Detection: `getSignPrefix()` scans `rawTextTemplate` for `[+-]` immediately before `##`
- Included in RANGE grouping key → tokens with different signs don't merge

**`anchorEnd` implementation:**
- `anchorEnd='%'` when template matches `/##%/` (double-hash) AND `anchorStart=false` AND no signPrefix
- Single-hash `#%` (values-only) is intentionally EXCLUDED — causes 100% FN
- Compiler inserts `anchorEnd` string after number pattern, before `.*suffix`

**When NOT to use `^`:** prefix set (dual-number)
**When NOT to use `%`:** anchorStart=true or signPrefix set (redundant), no `%` after number, single-hash `#%` templates

## 7. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
```

Same as AGENT_NAVIGATION §5.

## 8. AND/OR Search Logic

- **AND mode** (default): Tokens grouped by `familyKey`. Same family → OR (any tier matches). Different families → AND (all must be present).
- **OR mode**: All LITERAL/RANGE nodes go into a single OR group.
- **Orphaned ranged tokens** (no effective range while others have one): treated as LITERAL suffix nodes.

## 9. Family Pooling

All tokens sharing same `familyKey.ru` + `affix` → one `FamilyGroup` → one chip with combined range.

- FilterChip shows `displayText` + tier count badge ("×9")
- Origin filter applied **before** grouping
- Dual-number mods (`hasMultiPlaceholder=true`) show "2x" badge + 1е/2е slot switcher

## 10. Visual Hierarchy (3-Level)

All category pages use 3-level visual hierarchy. Headers are **block-level** (never inline-block).

| Level | Label | Font Size | Style |
|-------|-------|-----------|-------|
| 1 — Affix | ПРЕФИКС / СУФФИКС | `text-base` (16px) | Bold uppercase, decorative frame with gradient bg, corner accents, colored border-l. CSS classes: `affix-header-prefix` (blue), `affix-header-suffix` (orange). |
| 2 — Origin | Обычные / Очернённые / Осквернённые / Сущность / Разлом | `text-[14px]` (14px) | Bold uppercase badge, bg+border+border-l, origin-specific color + 17px icon. |
| 3 — Semantic | Атакующие / Защитные / Характеристики / Прочие / ... | `text-[12px]` (12px) | Semibold uppercase badge, bg+border, category-specific color |

**CategoryLabel interface** (in `mod-classifier.ts`):
```ts
interface CategoryLabel {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  borderLClass: string;
  iconPath?: string;  // Origin icons: webp files in public/icons/
}
```

**Origin colors:** Обычные=gray, Очернённые=emerald, Осквернённые=red, Сущность=amber, Разлом=violet.
All defined in `ORIGIN_SECTION_LABELS` (`mod-classifier.ts`). Theme switching via CSS custom properties — no `!important` overrides.

**Origin icon paths:** Очернённые=`icons/очернение абис.webp`, Осквернённые=`icons/осквернение.webp`, Сущность=`icons/сущность.webp`, Разлом=`icons/разлом.webp`, Обычные=no icon.

### Per-Tab Grouping Modes

| Tab | `groupMode` | Sub-groups |
|-----|-------------|------------|
| Amulet/Ring/Belt | `affix-semantic` | Атакующие/Защитные/Характеристики/Прочие |
| Waystone | `affix-sentiment` | Позитивные/Негативные |
| Tablet | `tablet-type` | Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие |
| Jewel | `origin + showJewelTypeSubGroups` | Origin → prefix/suffix → Ruby/Emerald/Sapphire/Shared |
| Relic | `affix-only` | Just prefix/suffix |
| Vendor | N/A | Chip groups by category |

## 11. Multi-Origin Loading

`loadMergedCategoryData()` in `loader.ts`:
- JewelPage: jewel + jewel-desecrated + jewel-corrupted (224 tokens)
- WaystonePage: waystone + waystone-desecrated (112 tokens)

## 12. Priority Tier System

| Component | Role |
|-----------|------|
| `PriorityTier` | `'S' \| 'A' \| 'B' \| 'C'` in `types.ts` |
| `PriorityFilter` | `'all' \| 'S+A' \| 'S'` — UI filter mode |
| `classifyPriorityTier(group, category)` | Text-based heuristic for ring/amulet/belt/waystone/tablet. Others return 'C'. |
| `FamilyGroup.priorityTier` | Set during grouping, used for default sort (S→C) |
| `CategoryControlPanel` | Toggle: «Все \| S+A \| S» with amber accent |
| `FilterChip` | S-tier gets amber border-l, C-tier gets opacity-80 dimming |
| `filter-store.ts` | `priorityFilter` persisted in URL via `p` key |

Categories with priority: ring, amulet, belt, waystone, tablet. Others (jewel, relic, vendor) return 'C' — no toggle.

## 13. UI Conventions

### FilterChip & Range Inputs
- Text: `text-[13px]`, padding: `px-2.5 py-1.5`
- Range inputs: `w-16 text-[13px]`, dual-number: `w-14`
- ⚡ indicator when optimizer collapses token into shared regex
- `chip-with-range` CSS class with `flex-basis: 100%` prevents overlap

### CategoryControlPanel
- Sticky: `sticky top-0 z-10` with `control-panel-sticky::before` gap fix
- Range warnings: ⚠ Округл. (round10 + >50 range) and ⚠ Диапазон (range notation FP risk)

### VendorChip
- Switch + numeric threshold input
- `step={1}` on all numeric inputs

### ARIA
- VendorChip/FilterChip: Switch (label) + inputs (siblings)
- ProfilePanel delete: `onMouseDown` (not `onClick`) to prevent onBlur race

### Home/Sidebar
- Home card icons: 44×44px, Sidebar icons: 28×28px (maxHeight/maxWidth constrained)
- Header title: `text-lg`, Regex output: `text-base`

## 14. Optimizer Collapse Indicator

When runtime optimizer replaces multiple tokens with shared regex, ⚡ appears on FilterChip.
- `collectCollapsedTokenIds(ast, optimizationTable)` — in `optimizer.ts`, walks optimized AST for `opt:` prefixed LITERAL nodes
- `collapsedTokenIds: Set<string>` — returned by `useCategoryPage`, passed to FilterChip

## 15. Optimization Pipeline

`computeOptimizations()` in `compute-optimizations.ts`:

| Phase | Name | Description |
|-------|------|-------------|
| A | Family-based grouping | Tokens sharing familyKey get one shared regex |
| A1 | Word truncation | Strategy 1e truncation on Phase A regexes |
| B | DP factorization | Cross-family groups via `batchDPFactorize()` |
| C | Dialect optimization | `[её]`, `[юя]`, `ь?` applied to all regexes |

## 16. Iterative Optimizer (Step 10)

`runIterativeOptimization()` in `iterative-optimizer.ts`:

Runs after all ETL steps as Step 10. Iteratively optimizes regexes using multiple
strategies, with Oracle validation after each iteration.

| Strategy | Priority | Description |
|----------|----------|-------------|
| fn-repair | 1 (highest) | Fix FN by broadening regex (find alternative substring) |
| dialect | 2 | Apply `[её]`, `[юя]`, `ь?` optimizations |
| fp-reduce | 3 | Reduce FP >2 by extending regex with adjacent words |
| suffix-shorten | 4 | Trim words from left while keeping regex unique (min 5 chars, 7 for waystone, 10 for tablet) |
| short-regex-context | 5 | Add `regexPrefixContext` for regexes < MIN_REGEX_LEN |

**Oracle validation** (enabled by default):
- After each iteration, ALL changed regexes are validated using block-based Oracle (`matchPoE2RegexItem`)
- Changes that introduce cross-family FP or FN are automatically reverted
- Ensures iterative improvements never degrade regex quality

**Short-regex context:**
- Regexes shorter than MIN_REGEX_LEN_DEFAULT (5) like "огня" (4 chars) can match too broadly
- The optimizer finds a distinctive word from the rawText prefix that is unique to the target family
- Adds it as `regexPrefixContext`, so the compiled regex becomes: `"огня" "distinctive_word"`
- This AND across blocks eliminates cross-family FP while keeping the short suffix

## 17. Positive + Negative Mods (Want + Don't-Want)

PoE2's `!` negation supports combining "want" and "don't want" mods in a single regex.

**Pattern:** `"want1|want2" !"dontwant1|dontwant2"`

**Example:** Tablet with ≥8 charges + waystone find bonus, but NO gold bonus:
```
"зарядов.*([89]|[1-9][0-9])" "путевых камн" !"золот"
```

**Architecture:**
- `excludeMode=false`: Selected tokens → AND/OR groups (positive matches)
- `excludeMode=true`: Selected tokens → EXCLUDE(OR(...)) (negative matches)
- Combined in `buildAstFromSelections()`: `AND(OR(want1, want2), EXCLUDE(OR(dontwant1, dontwant2)))`
- Compiler output: `"want1|want2" "!dontwant1|dontwant2"`

**Key rules (verified in-game):**
- `!` must be INSIDE quotes when combined with `|`: `"!A|B"` works, `!"A|B"` does NOT
- `!X` is item-wide: excludes entire item if X appears in ANY block
- AND works across blocks: `"want" "want2"` finds items where BOTH quoted groups match (possibly different blocks)

**UI implementation:** Per-mod want/exclude toggle — each FilterChip has a ✗/✓ button
that switches between "want" (selectedIds) and "don't want" (excludedIds). Both states
can coexist across different mods in a single search.

## 18. 250-Char Budget for 6+ Mods

When 6+ mods are selected, the combined regex can exceed PoE2's 250-char limit.

**Budget estimation functions** (in `limits.ts`):
- `estimateMultiModLength(regexes, hasRange, contexts, excludes)` — estimated total compiled length
- `wouldExceedBudget(currentLen, newModRegex, ...)` — check before adding a mod

**Optimization layers that help stay under budget:**

| Layer | Mechanism | Savings |
|-------|-----------|---------|
| ETL Step 4 | Family-based grouping | 10-50 chars/family |
| ETL Step 4 | DP factorization | 5-30 chars/cross-family group |
| ETL Step 10 | Suffix shortening | 2-10 chars/token |
| Runtime | Family deduplication (Phase 1) | 10-50 chars/family |
| Runtime | Yofication [её] | 2-5 chars/position |
| Runtime | Optimization table (Phase 2) | 5-30 chars/entry |

**Practical guidance for 6+ mods:**
- Each mod averages ~15-20 chars in compiled regex (including quotes + separator)
- 6 mods ≈ 90-120 chars (safe), 10 mods ≈ 150-200 chars (yellow), 12+ mods → likely overflow
- Mods with `regexPrefixContext` or `regexExclude` add extra chars per mod

## 19. Number Regex Correctness

`threeDigitMax()` generates correct PoE2 regex for all 3-digit max values:
- Round hundreds: `([0-9]|[1-9][0-9]|N[0-9][0-9]|N00)`
- D0=1 general: `([0-9]|[1-9][0-9]|1[0-prevD1][0-9]|1d1[0-d2])`
- D0>1 variants: handles all sub-cases correctly

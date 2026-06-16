# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Верификация v8:** 2026-06-16 — итерация 38: B0 RESOLVED (broken), D7-3 CONFIRMED WORKING (game patched), Path D — новая стратегия.

---

## PoE2 Regex Dialect — VERIFIED (iter 38)

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR (single-word, whole quoted group) | ✅ | `"огня\|холоду"`, `"луками\|посохами"` |
| `\|` OR (multi-word with `.*` inside ONE quoted group) | ✅ | `"увеличение урона.*луками\|увеличение урона.*посохами"` (D7-3, iter 38) |
| `()` grouping (single-word OR, alone) | ✅ | `"(огня\|холоду)"` |
| `\d` digit shorthand | ✅ | `"\d.*к максимуму здоровья"` |
| `{N,}` quantifier | ✅ | `"\d{2,}%.*золота"` |
| `!` + `\|` = `!(A\|B)` | ✅ | `"к сопротивлению" "!молнии\|хаосу"` |
| `?` optional | ❌ | NOT supported |
| `.*` within single block | ✅ | Does NOT cross block boundaries |
| `.*` bridging (prefix→suffix) | ✅ | `"увеличение урона.*луками"` (verified iter 37) |
| `-` literal | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `\+` matches literal + |
| `^` start-of-block anchor | ✅ | `"^28%"` anchors to block start |
| Case insensitive | ✅ | Cyrillic verified |
| `!X` item-wide | ✅ | Excludes item if X in ANY block |
| AND across blocks | ✅ | `"максимуму здоровья" "к силе"` |
| Threshold ≥N% | ✅ | `"Монстры с (3[4-9]\|[4-9][0-9]\|\d{3,})%.*отравление"` |
| Substring search (truncated words) | ✅ | `"оберег"` matches `"оберега"`, `"посох"` matches `"посохами"` |
| `"prefix (A\|B)"` (`\|` after non-`.*` prefix inside quotes) | ❌ | Test 16 — matches only the prefix broadly |
| `"(A B\|C D)"` (multi-word `\|` inside `()`) | ❌ | Test 15 — nothing matches |
| `"X"\|"Y"` (`\|` BETWEEN two quoted groups) | ❌ | **B0 CONFIRMED BROKEN iter 38** — zero matches |

**Critical syntax rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries
3. `.*` is directional — forward only
4. AND via space between quoted groups works ACROSS blocks
5. `!X` is item-wide — excludes ENTIRE item if X found in ANY block
6. Description/tooltip text is NOT indexed
7. Item rarity label IS indexed — «редк» matches all rare items
8. **`|` works at the TOP LEVEL of a single quoted group** (with or without `.*` in alternatives). It does NOT work between two quoted groups (`"X"|"Y"`), and it does NOT work inside `()` with multi-word alternatives (`"(A B|C D)"`).

---

## Iteration 38 — B0 RESOLVED + Path D confirmed

### Two critical findings from iter 37 in-game run

**1. B0 — `"X"|"Y"` (OR between TWO quoted groups) is BROKEN.**

All 3 B0 tests gave ZERO matches in-game. The PoE2 parser breaks completely when it sees `|` between two quoted groups.

Simulator behavior (kept for reference): `parseQuotedGroups` splits on SPACES outside quotes, NOT on `|`. So `"A"|"B"` becomes groups [`A`, `|B`]. Group 2 `|B` parses as alternation: empty | `b` → always matches. Result: `"A"|"B"` = `A` AND `(|B)` = `A` only.

Game behavior: ZERO matches. The simulator is "less broken" than the game (simulator matches `"A"`, game matches nothing). Neither gives the desired OR semantics.

| # | Regex | Simulator | Game (iter 37) | Conclusion |
|---|-------|-----------|----------------|------------|
| B0-1 | `"увеличение урона.*луками"\|"увеличение урона.*посохами"` | Only gem 2 | ZERO | BROKEN |
| B0-2 | `"оберег"\|"компаньон"` | Only gem 1 | ZERO | BROKEN |
| B0-3 | `"глобальной меткости"\|"максимума здоровья компаньонов"` | Only gem 3 | ZERO | BROKEN |

**Conclusion:** Path A (decompose opt-table to `"X"|"Y"`) is IMPOSSIBLE. Use Path D instead.

**2. D7-3 — top-level `|` inside ONE quoted group with `.*` bridges WORKS in-game.**

The PoE2 regex engine was PATCHED since iterations 15-17. The simulator already modeled this correctly.

| Test | Regex | Result (game) | Simulator | Match? |
|------|-------|---------------|-----------|--------|
| D7-1 | `"увеличение урона (луками\|посохами)"` | Only gem 2 | gem 1 ❌, gem 2 ✅ | ✅ simulator matches broken game (Test 16) |
| D7-2 | `"(увеличение урона луками\|увеличение урона посохами)"` | Only gem 2 | gem 1 ❌, gem 2 ✅ | ✅ simulator matches broken game (Test 15) |
| **D7-3** | `"увеличение урона.*луками\|увеличение урона.*посохами"` | **Gems 1+2** | gem 1 ✅, gem 2 ✅ | ✅ **simulator matches patched game** |

### Path D — NEW strategy for same-family OR

When the user wants ANY of N mods from the same family (e.g., damage with different weapons: луками/посохами/копьями), use ONE quoted group with top-level `|` and `.*` bridge per alternative:

```
"prefix.*A|prefix.*B|prefix.*C"
```

This is the WORKING replacement for the broken opt-table pattern `"prefix (A|B|C)"` (Tests 16-17).

**Status:**
- ✅ 2 alternatives verified in-game (D7-3, iter 37)
- ⚠️ 3+ alternatives: PENDING in-game verification (next iteration)

**Fallback options if Path D fails on 3+ alternatives:**
- (b) UI redesign: each same-family mod becomes a SEPARATE AND filter (mutually exclusive choice in UI)
- (c) Fall back to AND (user must accept that selecting multiple same-family mods requires ALL to be present, not ANY)

---

## Iteration 37 — Deterministic Strategy (8 principles, all categories)

### Test Items (4 Изумрудных самоцвета)

| Gem | Name | ilvl | Key mods |
|-----|------|------|----------|
| 1 | Племенная лучина | 82 | оберег duration, посохи damage, DoT duration, отравл |
| 2 | Гипнотическая сущность | 65 | crit атаками, луками damage, снаряд split, компаньон HP |
| 3 | Племенной узор | 28 | глобальная меткость, снарядов damage, наложения состояний, порог стихийных |
| 4 | Почётная мечта | 81 | посохи attack speed, порог стихийных, снарядами conditional |

### D1. Single-mod suffix matching — ✅ PASSED

Unique suffix per mod, no FP across 4 gems:
- `"длительности эффекта оберега"` → only gem 1
- `"максимума здоровья компаньонов"` → only gem 2
- `"глобальной меткости"` → only gem 3
- `"шанса наложения состояний"` → only gem 3

### D2. `.*` bridging within single block — ✅ PASSED

- `"увеличение урона.*посохами"` → gem 1 (боевыми посохами)
- `"увеличение урона.*луками"` → gem 2 (луками)
- `"скорости атаки.*посохами"` → gem 4 (боевыми посохами)
- Cross-weapon FP check: `"увеличение урона.*луками"` does NOT match gem 1 (посохами)

### D3. AND across blocks — ✅ PASSED

- Two mods on same gem: `"длительности эффекта оберега" "увеличение урона.*посохами"` → gem 1 MATCH
- AND is order-independent
- AND rejects items missing any mod

### D4. Cross-block FP risk — ✅ DEMONSTRATED

- FP RISK: `"увеличение" "меткости"` matches gem 3 via DIFFERENT blocks (mods: "увеличение урона снарядов" + "повышение глобальной меткости")
- FP PREVENTION via `.*` bridge: `"увеличение.*меткости"` does NOT match gem 3 (no single block has both)
- FP PREVENTION via `.*` bridge: `"повышение.*меткости"` matches gem 3 (same block: "повышение глобальной меткости")

### D5. Shared suffix differentiation — ✅ PASSED

- Shared suffix `"порога стихийных состояний"` matches BOTH gem 3 (10%) and gem 4 (12%)
- Differentiate by exact number: `"10%.*порога стихийных состояний"` → gem 3 only
- Differentiate by exact number: `"12%.*порога стихийных состояний"` → gem 4 only
- Family regex (any tier): `"(1[0-5])%.*порога стихийных состояний"` → BOTH gems

### D6. Single-word `|` as whole quoted group — ✅ PASSED

- `"луками|посохами"` → matches gems 1, 2, 4 (each has one of these words)
- Does NOT match gem 3 (no weapon damage mod)
- `"оберег|компаньон"` → matches gems 1, 2

### D9. Number patterns — ✅ PASSED

- Enumeration: `"(1[0-5])%.*suffix"` works
- Threshold: `"([2-9][0-9])%.*suffix"` works
- `^` anchor: `"^2%.*скорости атаки"` works
- Exact number: `"2%.*скорости атаки.*посохами"` → gem 4 only

### D10. Truncated stems — ✅ PASSED

- `"оберег"` matches `"оберега"` (genitive) — gem 1
- `"компаньон"` matches `"компаньонов"` (plural) — gem 2
- `"снаряд"` matches both `"снарядов"` (gem 3) and `"снарядами"` (gem 4)
- `"посох"` matches `"посохами"` (instrumental) — gems 1, 4

### D11. Combined mod regex — ✅ PASSED

Full deterministic pattern per mod: `"<number_pattern>.*<suffix>"`. All 5 tests pass.

---

## Iteration 15 — Legacy in-game tests

### T2. Threshold «отравление» ≥34% — ✅ PASSED

**Regex:** `"Монстры с (3[4-9]|[4-9][0-9]|\d{3,})%.*отравление"`

Тестовые предметы:
- Призрачный камень: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅
- Разрушенный коридор: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅

### T3. .* cross-block bridge — ✅ CONFIRMED: .* does NOT cross block boundaries

| Regex | Результат | Вывод |
|-------|-----------|-------|
| `"уклонению.*огня"` | Не подсветило | .* не мостит через границы модов |
| `"огня.*атакам"` | ПОДСВЕТИЛО | Один блок, `.*` работает ✅ |
| `"огня" "силе"` | ПОДСВЕТИЛО | AND crosses blocks ✅ |

---

## Iteration 36 — Legacy OR multi-word tests (Tests 15-17)

**Status:** These tests documented BROKEN behavior in iter 36. Iter 38 re-tested and confirmed:
- Tests 15, 16 are STILL BROKEN (multi-word `|` inside `()` and after non-`.*` prefix inside `"..."`)
- Test D7-3 (top-level `|` with `.*` inside ONE quoted group) is NOW WORKING (game patched)

| Test | Regex | Result |
|------|-------|--------|
| T15 | `(скорости атаки\|передвижения)` | Ничего не подсвечено (STILL BROKEN) |
| T16 | `"повышение (брони\|скорости)"` | Подсветило ВСЁ с «повышение» (STILL BROKEN) |
| T17 | `"повышение (брони\|скорости атаки\|шанса критического удара)"` | Много мусора (STILL BROKEN) |

**Resolution:** Use Path D (`"prefix.*A|prefix.*B|prefix.*C"`) instead of the broken `"prefix (A|B|C)"` opt-table patterns.

---

## FP Prevention Anchors — ALL VERIFIED ✅

| Anchor | Method | In-game test |
|--------|--------|-------------|
| `^` (anchorStart) | Template starts with `##` or `[+-]##` | ✅ A2, A5, A6 |
| `\+` (signPrefix '+') | Template has `+##` before number | ✅ A2, A4, A6, C1 |
| `-` (signPrefix '-') | Template has `-##` before number | ✅ A5, C2 |
| `%` suffix (anchorEnd) | Template has `##%` | ✅ A1, A4, A6 |
| `: ` colon | Reversed non-% mods with `: ##` | ✅ A7 |
| Prefix (middle-number) | Text before ## in types 3/9 | ✅ T2 |
| Threshold ≥N% | `([X-Y]\d|\d{3,})%.*suffix` | ✅ T2 |
| Enumeration | `(2[7-9]|30)%.*suffix` | ✅ C5 |

---

## 9 Pattern Types — ALL VERIFIED ✅

| # | Pattern | Regex form | Key feature |
|---|---------|-----------|-------------|
| 1 | `хх% бла бла` | `N%.*suffix` | anchorEnd=`%` |
| 2 | `+хх бла бла` | `^\+N.*suffix` | `^\+` anchoring |
| 3 | `бла бла хх бла бла` | `prefix N.*suffix` | prefix+`.*` |
| 4 | `бла бла +хх%` | `suffix.*\+N%` | reversed + `\+` + `%` |
| 5 | `-хх% бла бла` | `^-N%.*suffix` | `^-` signPrefix |
| 6 | `+хх% бла бла` | `^\+N%.*suffix` | double anchor |
| 7 | `бла бла х` | `suffix.*: N` | colonAnchor `: ` |
| 8 | `бла бла хх` | `suffix.*N` | reversed, no `%` |
| 9 | `бла бла хх% бла бла` | `prefix N%.*suffix` | prefix + `%` + suffix |

---

## Truncated Word Tails

**Принцип:** PoE2 = substring search. Truncation работает всегда, если укороченная форма не совпадает с другим значимым словом в контексте игровых предметов.

### Безопасные (применяются оптимизатором)

| Truncation | Морфема | Почему безопасно |
|------------|---------|------------------|
| `эффективн` | эффективность | Уникальная морфема |
| `бездн` | бездна/бездны | Уникальная морфема |
| `путев` | путевой/путевого | Уникальная морфема |
| `глубин` | глубина/глубины | Уникальная морфема |
| `приспешник` | приспешники/приспешника | Уникальная морфема |
| `оглушен` | оглушение/оглушения | Уникальная морфема |
| `флакон` | флакона/флаконы | Уникальная морфема |
| `хаос` | хаосу/хаосом | Уникальная морфема |
| `монстр` | монстры/монстров | Уникальная морфема |
| `оберег` | оберега/оберегом | iter 37: gem 1 verified |
| `компаньон` | компаньонов/компаньона | iter 37: gem 2 verified |
| `посох` | посохами/посоха | iter 37: gems 1, 4 verified |
| `снаряд` | снарядов/снарядами | iter 37: gems 3, 4 verified |

### Blacklisted (никогда не применяются)

| Truncation | Почему опасно |
|------------|---------------|
| `редкост` | FP на rarity label «редкий» |
| `редк` | FP на rarity label «редкий» |
| `провал` | Нетестировано + низкая ценность |

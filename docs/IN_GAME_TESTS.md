# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Верификация v7:** 2026-06-16 — итерация 37: тесты 4 самоцветов + детерминированная стратегия + B0 hypothesis pending.

---

## PoE2 Regex Dialect — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR (single-word, whole quoted group) | ✅ | `"огня\|холоду"`, `"луками\|посохами"` |
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
| `\|` multi-word (top level) | ❌ | Tests 9-11 |
| `\|` multi-word inside `()` | ❌ | Test 15 |
| `\|` inside `"..."` + `()` | ❌ | Tests 16-17 |
| `"X"\|"Y"` (OR between quoted groups) | ❓ | **B0 PENDING** — iter 37 |

**Critical syntax rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries
3. `.*` is directional — forward only
4. AND via space between quoted groups works ACROSS blocks
5. `!X` is item-wide — excludes ENTIRE item if X found in ANY block
6. Description/tooltip text is NOT indexed
7. Item rarity label IS indexed — «редк» matches all rare items
8. **`|` ONLY works for single-word alternation as the WHOLE quoted group** — `"A|B"` works, but `"prefix (A|B)"`, `"(A B|C D)"`, and `"A B|C D"` are all BROKEN

---

## Iteration 37 — 4 Gems Tests + Deterministic Strategy

### Test Items (4 Изумрудных самоцвета)

| Gem | Name | ilvl | Key mods |
|-----|------|------|----------|
| 1 | Племенная лучина | 82 | оберег duration, посохи damage, DoT duration, отравл |
| 2 | Гипнотическая сущность | 65 | crit атаками, луками damage, снаряд split, компаньон HP |
| 3 | Племенной узор | 28 | глобальная меткость, снарядов damage, наложения состояний, порог стихийных |
| 4 | Почётная мечта | 81 | посохи attack speed, порог стихийных, снарядами conditional |

### D1. Single-mod suffix matching — ✅ PASSED (simulator)

Unique suffix per mod, no FP across 4 gems:
- `"длительности эффекта оберега"` → only gem 1
- `"максимума здоровья компаньонов"` → only gem 2
- `"глобальной меткости"` → only gem 3
- `"шанса наложения состояний"` → only gem 3

### D2. `.*` bridging within single block — ✅ PASSED (simulator)

- `"увеличение урона.*посохами"` → gem 1 (боевыми посохами)
- `"увеличение урона.*луками"` → gem 2 (луками)
- `"скорости атаки.*посохами"` → gem 4 (боевыми посохами)
- Cross-weapon FP check: `"увеличение урона.*луками"` does NOT match gem 1 (посохами)

### D3. AND across blocks — ✅ PASSED (simulator)

- Two mods on same gem: `"длительности эффекта оберега" "увеличение урона.*посохами"` → gem 1 MATCH
- AND is order-independent
- AND rejects items missing any mod

### D4. Cross-block FP risk — ✅ DEMONSTRATED (simulator)

- FP RISK: `"увеличение" "меткости"` matches gem 3 via DIFFERENT blocks (mods: "увеличение урона снарядов" + "повышение глобальной меткости")
- FP PREVENTION via `.*` bridge: `"увеличение.*меткости"` does NOT match gem 3 (no single block has both)
- FP PREVENTION via `.*` bridge: `"повышение.*меткости"` matches gem 3 (same block: "повышение глобальной меткости")

### D5. Shared suffix differentiation — ✅ PASSED (simulator)

- Shared suffix `"порога стихийных состояний"` matches BOTH gem 3 (10%) and gem 4 (12%)
- Differentiate by exact number: `"10%.*порога стихийных состояний"` → gem 3 only
- Differentiate by exact number: `"12%.*порога стихийных состояний"` → gem 4 only
- Family regex (any tier): `"(1[0-5])%.*порога стихийных состояний"` → BOTH gems

### D6. Single-word `|` as whole quoted group — ✅ PASSED (simulator)

- `"луками|посохами"` → matches gems 1, 2, 4 (each has one of these words)
- Does NOT match gem 3 (no weapon damage mod)
- `"оберег|компаньон"` → matches gems 1, 2

### D7. Broken patterns (multi-word `|`) — ✅ DOCUMENTED (simulator diverges from game)

| Pattern | Simulator | Game (Tests 15-17) |
|---------|-----------|-------------------|
| `"увеличение урона (луками\|посохами)"` | gem 1 NO, gem 2 YES (exact adjacency) | matches ANY "увеличение" (`()` + `\|` ignored) |
| `"(увеличение урона луками\|увеличение урона посохами)"` | gem 1 NO, gem 2 YES (exact substring) | NOTHING matches (`()` + multi-word `\|` broken) |
| `"увеличение урона.*луками\|увеличение урона.*посохами"` | BOTH match (alternation) | BROKEN (Tests 9-11) |

**Conclusion:** All multi-word `|` patterns are UNUSABLE in production. Simulator and game diverge — neither produces the desired OR semantics.

### D8. B0 HYPOTHESIS — OR between quoted groups (PENDING in-game) ❓

**Critical unverified test:** does `"X"|"Y"` work as OR between two quoted groups?

In our simulator: `parseQuotedGroups` splits on SPACES outside quotes, NOT on `|`. So `"A"|"B"` becomes groups [`A`, `|B`]. Group 2 `|B` parses as alternation: empty | `b` → always matches. Result: `"A"|"B"` = `A` AND `(|B)` = `A` only.

In the game: UNKNOWN — needs Test B0.

**Test protocol (run in-game with the 4 gems):**

| # | Regex | Simulator result | If OR works in game | If OR broken in game |
|---|-------|------------------|---------------------|----------------------|
| B0-1 | `"увеличение урона.*луками"\|"увеличение урона.*посохами"` | Only gem 2 | gems 1+2 | Only gem 2 |
| B0-2 | `"оберег"\|"компаньон"` | Only gem 1 | gems 1+2 | Only gem 1 |
| B0-3 | `"глобальной меткости"\|"максимума здоровья компаньонов"` | Only gem 3 | gems 2+3 | Only gem 3 |

**After running:**
- If OR works → Path B strategy: decompose opt-table to quoted groups in OR
- If OR broken → UI redesign: each OR-child = separate AND-фильтр (mutually exclusive choice)

### D9-D12. Number patterns, truncated stems, combined regex, sanity — ✅ PASSED (simulator)

- Enumeration: `"(1[0-5])%.*suffix"` works
- Threshold: `"([2-9][0-9])%.*suffix"` works
- `^` anchor: `"^2%.*скорости атаки"` works
- Truncated stems: `"оберег"` matches `"оберега"`, `"посох"` matches `"посохами"`, `"снаряд"` matches both `"снарядов"` and `"снарядами"`

---

## Iteration 15 In-Game Test Results (legacy)

### T2. Threshold «отравление» ≥34% — ✅ PASSED

**Regex:** `"Монстры с (3[4-9]|[4-9][0-9]|\d{3,})%.*отравление"`

**Тестовые предметы:**
- Призрачный камень: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅
- Разрушенный коридор: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅

### T3. .* cross-block bridge — ✅ CONFIRMED: .* does NOT cross block boundaries

| Regex | Результат | Вывод |
|-------|-----------|-------|
| `"уклонению.*огня"` | Не подсветило | .* не мостит через границы модов |
| `"огня.*атакам"` | ПОДСВЕТИЛО | Один блок, `.*` работает ✅ |
| `"огня" "силе"` | ПОДСВЕТИЛО | AND crosses blocks ✅ |

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

---

## Iteration 36 — OR с многословными паттернами (legacy)

### T15-T17: `|` внутри `()` и `"..."` — ❌ НЕ РАБОТАЕТ

| Test | Regex | Result |
|------|-------|--------|
| T15 | `(скорости атаки\|передвижения)` | Ничего не подсвечено |
| T16 | `"повышение (брони\|скорости)"` | Подсветило ВСЁ с «повышение» |
| T17 | `"повышение (брони\|скорости атаки\|шанса критического удара)"` | Много мусора |

**Итог:** `|` между многословными альтернативами сломан на всех уровнях. Путь B подтверждён.

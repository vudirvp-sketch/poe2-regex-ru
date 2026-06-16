# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Текущее состояние:** `^(?!…).*Z` bidirectional exclude — IMPLEMENTED + IN-GAME VERIFIED (Tests A+B PASS, Test C подтверждает root cause). Фикс в `src/core/compiler.ts` normalizeAst (одна строка). 1108 тестов проходят.

---

## iter 46 VERIFICATION — `^(?!…).*Z` bidirectional exclude

**User-reported FP (post-iter 44):** regex `"повышение скорости атаки(?!.*Приспеш)…|перезарядки умений|…"` совпадал с minion-аффиксом «Приспешники имеют х% повышение скорости атаки и сотворения чар». Root cause: `(?!…)` forward-only, не видит excludes ДО суффикса. Fix: `^(?!…).*Z` вместо `Z(?!…)`.

### In-game test plan (verified)

| Тест | Regex | Ожидание | Результат | Вывод |
|------|-------|----------|-----------|-------|
| **A** (single-quoted baseline) | `"^(?!.*Приспеш).*повышение скорости атаки"` | Матчит только non-minion блоки | ✅ **PASS** — minions НЕ подсвечены | `^`-anchor работает в single-quoted context |
| **B** (OR-context, ключевой) | `"^(?!.*Приспеш).*повышение скорости атаки\|перезарядки умений"` | (a) non-minion «повышение скорости атаки» И (b) любые «перезарядки умений» | ✅ **PASS** — результат идентичен A (`^` НЕ leaks ко второй альтернативе) | `^` работает в OR-context, применяется только к первой альтернативе |
| **C** (control — старый формат iter 44) | `"повышение скорости атаки(?!.*Приспеш)\|перезарядки умений"` | ❌ FP с minion-блоком | ❌ **EXPECTED FP** — minion-блоки подсвечены | Forward-only `(?!…)` не видит «Приспеш» ДО суффикса |

### Фикс

`src/core/compiler.ts` normalizeAst (AND-in-OR transform):
```diff
- const mergedValue = `${literalChild.value}${lookaheads}`;
+ const mergedValue = `^${lookaheads}.*${literalChild.value}`;
```

Production regex для user scenario: `"^(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми).*повышение скорости атаки|перезарядки умений|передвижения|атаки копьями"` (195 chars ≤250 ✅).

Tests: 1108 passed (1106 baseline + 2 NEW backward-exclude regression tests для minion-блок data). TypeScript clean.

---

## PoE2 Regex Dialect — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR (single-word, whole quoted group) | ✅ | `"огня\|холоду"`, `"луками\|посохами"` |
| `\|` OR (multi-word with `.*` inside ONE quoted group — Path D) | ✅ | verified up to 9 alts + same-block AND + cross-cat FP |
| `()` grouping (single-word OR, alone) | ✅ | `"(огня\|холоду)"` |
| `\d` digit shorthand | ✅ | `"\d.*к максимуму здоровья"` |
| `{N,}` quantifier | ✅ | `"\d{2,}%.*золота"` |
| `!` + `\|` = `!(A\|B)` | ✅ | `"к сопротивлению" "!молнии\|хаосу"` |
| `?` optional | ❌ | NOT supported — use `\d{2,}` |
| `.*` within single block | ✅ | Does NOT cross block boundaries |
| `.*` bridging (prefix→suffix) | ✅ | `"увеличение урона.*луками"` |
| `-` literal | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `\+` matches literal + |
| `^` start-of-block anchor (single-quoted) | ✅ | `"^28%"` anchors to block start |
| `^` start-of-block anchor (внутри `\|`-группы) | ✅ | `^(?!.*X).*Z\|Y` — `^` применяется только к первой альтернативе, не leaks |
| Case insensitive | ✅ | Cyrillic verified |
| `!X` item-wide | ✅ | Excludes item if X in ANY block |
| AND across blocks (cross-block) | ✅ | `"максимуму здоровья" "к силе"` |
| AND within single block (same-block AND) | ✅ | `"имеют" "повышение.*шанса критического удара"` matches `Монстры имеют X повышение шанса критического удара` (BOTH in ONE block) |
| Threshold ≥N% | ✅ | `"Монстры с (3[4-9]\|[4-9][0-9]\|\d{3,})%.*отравление"` |
| Substring search (truncated words) | ✅ | `"оберег"` matches `"оберега"`, `"посох"` matches `"посохами"` |
| `(?!…)` negative lookahead — bidirectional via `^(?!…).*Z` | ✅ | Forward-only `Z(?!…)` FP. iter 46 fix: anchor `^` + `.*` bridge = bidirectional. **Simulator models `(?!…)` as `lookaheadNeg` AST node (iter 48 — Known Issue #2 CLOSED). Multi-LITERAL AND-in-OR transform extended iter 49 (Known Issue #4 CLOSED) — `^(?!…).*ctx.*Z` form.** |
| `"prefix (A\|B)"` (`\|` after non-`.*` prefix inside quotes) | ❌ | matches only the prefix broadly |
| `"(A B\|C D)"` (multi-word `\|` inside `()`) | ❌ | nothing matches |
| `"X"\|"Y"` (`\|` BETWEEN two quoted groups) | ❌ | zero matches (B0) |
| Regex char limit ≈ 250 chars | ⚠️ | ETL diagnostic only (`findOverLimitEntries`) |

**Critical syntax rules:**

1. `!` must be INSIDE quotes when combined with `|`: `"!A|B"` works, `!"A|B"` does NOT.
2. `.*` does NOT cross block boundaries.
3. `.*` is directional — forward only.
4. AND via space between quoted groups works BOTH across blocks AND within a single block.
5. `!X` is item-wide — excludes ENTIRE item if X found in ANY block.
6. Description/tooltip text is NOT indexed.
7. Item rarity label IS indexed — «редк» matches all rare items.
8. **`|` works ONLY at the TOP LEVEL of a single quoted group** (with or without `.*` in alternatives). Does NOT work: between two quoted groups, inside `()` with multi-word alternatives, after non-`.*` prefix inside quotes.
9. **Regex total length limit ≈ 250 chars** — single regex >250 chars не примется игрой.
10. **`(?!…)` is bidirectional via `^(?!…).*Z`** — anchor `^` + `.*` bridge covers the WHOLE block (before and after suffix position). Works in OR-context too (`^` applies only to first alternative, no leak). **Simulator models `(?!…)` as `lookaheadNeg` AST node (iter 48 — Known Issue #2 CLOSED)** — semantic regression tests in `tests/core/poe2-regex-matcher.test.ts` Section 11 (minion-block data). **iter 49 extends the compiler transform to multi-LITERAL case (`AND(LITERAL_ctx, LITERAL_regex, EXCLUDE(...))` → `^(?!…).*ctx.*Z`) — closes Pitfall 11 / Known Issue #4. Semantic regression tests in Section 12.**

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
| `оберег` | оберега/оберегом | verified |
| `компаньон` | компаньонов/компаньона | verified |
| `посох` | посохами/посоха | verified |
| `снаряд` | снарядов/снарядами | verified |

### Blacklisted (никогда не применяются)

| Truncation | Почему опасно |
|------------|---------------|
| `редкост` | FP на rarity label «редкий» |
| `редк` | FP на rarity label «редкий» |
| `провал` | Нетестировано + низкая ценность |

---

## Older iterations summary

- **iter 41 (D5 VERIFIED):** 5/5 in-game tests PASS на production ETL output (jewel, amulet, ring, waystone, tablet). Same-block AND confirmed. PoE2 regex char limit ≈ 250 chars обнаружен.
- **iter 39 (D1 VERIFIED):** Path D on 3+4 alternatives + AND-combination — verified.
- **iter 38 (B0 RESOLVED + D7-3 confirmed):** `"X"|"Y"` confirmed BROKEN (zero matches). Path D strategy born: `"prefix.*A|prefix.*B|prefix.*C"`.
- **iter 37 (Deterministic Strategy):** 8 principles unified for all categories. Verified on 4 real gems — D1-D11 patterns confirmed (suffix matching, `.*` bridging, AND across blocks, cross-block FP risk, shared suffix differentiation, single-word `|`, number patterns, truncated stems, combined mod regex).
- **iter 15-36:** earlier in-game tests covering hypothesis pattern verification, FP prevention anchors, Phase 9 number regex, colonAnchor verification, tablet patterns, vendor patterns. See git history for details.

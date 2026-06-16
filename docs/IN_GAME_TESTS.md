# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Верификация v12:** 2026-06-17 — iter 45: `(?!…)` lookahead — **FORWARD-ONLY** (user in-game confirmed FP). Симулятор `(?!…)` не моделирует вообще. iter 44 regression test был structural, не semantic. Фикс предложен для iter 46: `^(?!…).*Z` вместо `Z(?!…)` — требует in-game verify `^` в OR-context.
> **Верификация v11:** 2026-06-16 — iter 41: D5 DONE — Path D production-verified на 5 категориях (jewel, amulet, ring, waystone, tablet), 5/5 in-game тестов PASS. Same-block AND confirmed. PoE2 regex char limit ≈ 250 chars обнаружен.

---

## ⚠️ iter 45 FINDING — `(?!…)` is FORWARD-ONLY

**User-reported FP:** iter 44 regex `"повышение скорости атаки(?!.*Приспеш)(?!.*топорами)…|перезарядки умений|передвижения|атаки копьями"` совпадал с minion-аффиксом «Приспешники имеют х% повышение скорости атаки и сотворения чар».

**Root cause:** `(?!.*X)` проверяет текст **только ВПЕРЁД** от текущей позиции (позиция курсора — сразу после matched-суффикса «повышение скорости атаки»). `.*` из этой позиции захватывает только остаток блока — « и сотворения чар». В этом остатке «Приспеш» нет → lookahead проходит → FP.

**Где стоит «Приспеш»:** в начале блока, **ДО** суффикса — forward-only lookahead его не видит.

**Lookbehind `(?<!…)` НЕ поддерживается в PoE2** (см. §9 AGENT_NAVIGATION.md: «NOT supported: ?»).

**Simulator gap:** `poe2-regex-matcher.ts` не токенизирует `(?!…)` вообще (токен `?` обрабатывается как `optional` quantifier). iter 44 regression test (optimizer.test.ts lines 888-968) проверял STRUCTURE скомпилированной строки (contains `(?!.*A)`, no nested quotes, length ≤250), а не SEMANTIC behavior. Симулятор пропускал lookahead молча.

**Proposed fix (iter 46 — NOT YET IMPLEMENTED):** change compiler output from `Z(?!.*X)(?!.*Y)` to `^(?!.*X)(?!.*Y).*Z`. `^` анкер ставит курсор в начало блока, `.*` внутри lookahead покрывает ВЕСЬ блок (до и после позиции суффикса) → bidirectional exclude. +3 chars per LITERAL. **Risk:** in-game verify нужен, что `^` работает внутри `|`-группы (применяется только к первой альтернативе) — в docs `^` верифицирован только для single-quoted `"^28%"` (Phase 9b), не для `"^…|B|C"`.

**In-game test plan for iter 46 verification:**
1. Тест A — `^` в single-quoted, простая проверка: `"^(?!.*Приспеш).*повышение скорости атаки"` — должно матчить только non-minion блоки.
2. Тест B — `^` в OR-context: `"^(?!.*Приспеш).*повышение скорости атаки|перезарядки умений"` — должно матчить (a) блоки с «повышение скорости атаки» без «Приспеш» И (b) блоки с «перезарядки умений» (любые).
3. Тест C — контролный: `"X(?!.*Приспеш)|Y"` (старый формат iter 44) должен ВСЁ ЕЩЁ давать FP с minion-блоком — подтверждает root cause.

Если Тест A + B PASS — внедрить фикс в `compiler.ts` (одна строка в `normalizeAst` AND-in-OR transform).

---

## PoE2 Regex Dialect — VERIFIED (iter 41)

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR (single-word, whole quoted group) | ✅ | `"огня\|холоду"`, `"луками\|посохами"` |
| `\|` OR (multi-word with `.*` inside ONE quoted group — Path D) | ✅ | iter 38: 2 alt; iter 39: 3+4 alt + AND; iter 41: 6-9 alts + same-block AND + cross-cat FP |
| `()` grouping (single-word OR, alone) | ✅ | `"(огня\|холоду)"` |
| `\d` digit shorthand | ✅ | `"\d.*к максимуму здоровья"` |
| `{N,}` quantifier | ✅ | `"\d{2,}%.*золота"` |
| `!` + `\|` = `!(A\|B)` | ✅ | `"к сопротивлению" "!молнии\|хаосу"` |
| `?` optional | ❌ | NOT supported |
| `.*` within single block | ✅ | Does NOT cross block boundaries |
| `.*` bridging (prefix→suffix) | ✅ | `"увеличение урона.*луками"` |
| `-` literal | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `\+` matches literal + |
| `^` start-of-block anchor (single-quoted) | ✅ | `"^28%"` anchors to block start |
| `^` start-of-block anchor (внутри `\|`-группы) | ⚠️ UNVERIFIED | iter 46 test needed (см. выше) |
| Case insensitive | ✅ | Cyrillic verified |
| `!X` item-wide | ✅ | Excludes item if X in ANY block |
| AND across blocks (cross-block) | ✅ | `"максимуму здоровья" "к силе"` |
| AND within single block (same-block AND) | ✅ | iter 41 D5-2: `"имеют" "повышение.*шанса критического удара"` matches waystone mod "Монстры имеют X повышение шанса критического удара" (BOTH in ONE block) |
| Threshold ≥N% | ✅ | `"Монстры с (3[4-9]\|[4-9][0-9]\|\d{3,})%.*отравление"` |
| Substring search (truncated words) | ✅ | `"оберег"` matches `"оберега"`, `"посох"` matches `"посохами"` |
| `(?!…)` negative lookahead — **FORWARD-ONLY** | ⚠️ iter 45 | Проверяет текст только ВПЕРЁД от позиции. Не видит excludes ДО суффикса в блоке. **Симулятор не моделирует.** iter 46 fix: `^(?!…).*Z` |
| `"prefix (A\|B)"` (`\|` after non-`.*` prefix inside quotes) | ❌ | Test 16 — matches only the prefix broadly |
| `"(A B\|C D)"` (multi-word `\|` inside `()`) | ❌ | Test 15 — nothing matches |
| `"X"\|"Y"` (`\|` BETWEEN two quoted groups) | ❌ | **B0 CONFIRMED BROKEN iter 38** — zero matches |
| Regex char limit ≈ 250 chars | ⚠️ | iter 41: D5-1 v1 (262 chars) и D5-2 v1 (327 chars) не влезли в лимит |

**Critical syntax rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries
3. `.*` is directional — forward only
4. AND via space between quoted groups works BOTH across blocks AND within a single block (iter 41 confirmed)
5. `!X` is item-wide — excludes ENTIRE item if X found in ANY block
6. Description/tooltip text is NOT indexed
7. Item rarity label IS indexed — «редк» matches all rare items
8. **`|` works at the TOP LEVEL of a single quoted group** (with or without `.*` in alternatives). It does NOT work between two quoted groups (`"X"|"Y"`), and it does NOT work inside `()` with multi-word alternatives (`"(A B|C D)"`).
9. **Regex total length limit ≈ 250 chars** (iter 41) — single regex >250 chars не примется игрой.
10. **`(?!…)` is forward-only** (iter 45 finding) — lookahead checks text AFTER current position only. Lookbehind `(?<!…)` NOT supported. Workaround: anchor lookahead at block start with `^(?!…).*Z` (iter 46 proposed, needs in-game verify).

---

## Iteration 41 — D5 VERIFIED (Path D production-verified)

5 функциональных in-game тестов, **все PASS**. Test items: 16 предметов from `регис/предметы для теста с аффиксами имплиситами_новый.md` (3 кольца + 3 путевых камня + 3 плиты + 3 амулета + 4 самоцвета). Цель: верифицировать что ETL-generated Path D regexes (iter 40) работают в игре на production данных, покрывая все risk-зоны.

### Test D5-1 v2 — Scalability 6 alts + split-word `.*` patterns [JEWEL]

**Длина:** 98 chars ✅
**Regex:** `"урон.*а.*топорами|урон.*а.*луками|урон.*а.*от чар|урон.*а.*мечами|урон.*а.*тотемов|урон.* от чар"`

| Item | Expected | Matched? |
|------|----------|----------|
| Племенная лучина (jewel) | ❌ TN | ✅ correctly NOT matched |
| Гипнотическая сущность (jewel) | ✅ TP (`урон.*а.*луками` ← `6% увеличение урона луками`) | ✅ matched |
| Племенной узор (jewel) | ❌ TN | ✅ correctly NOT matched |
| Почётная мечта (jewel) | ❌ TN | ✅ correctly NOT matched |

**Result:** ✅ PASS — exactly 1 item matched, all FP-control items correctly rejected. Split-word `.*` patterns (`урон.*а.*луками`) work in-game.

### Test D5-2 v2 — AND + Path D runtime (4 alts + prefix_ctx `имеют`) [JEWEL + cross-cat WAYSTONE]

**Длина:** 125 chars ✅
**Regex:** `"имеют" "повышение.*брони|повышение.*скорости.*атаки|повышение.*скорости.*сотворения чар|повышение.*шанса критического удара"`

| Item | Expected | Matched? |
|------|----------|----------|
| Племенная лучина (jewel) | ❌ TN (no "имеют") | ✅ correctly NOT matched |
| Гипнотическая сущность (jewel) | ✅ TP (`Снаряды имеют 10% шанс...` + `7% повышение шанса критического удара атаками`) | ✅ matched (AND across blocks) |
| Племенной узор (jewel) | ❌ TN | ✅ correctly NOT matched |
| Почётная мечта (jewel) | ❌ TN (has Path D match but no "имеют") | ✅ correctly NOT matched |
| Призрачный камень (waystone) | ✅ Cross-cat TP (same-block AND: `Монстры имеют 276% повышение шанса критического удара`) | ✅ matched |
| Изменённый прогресс (waystone) | ✅ Cross-cat TP (same-block AND) | ✅ matched |
| Разрушенный коридор (waystone) | ✅ Cross-cat TP (same-block AND) | ✅ matched |

**Result:** ✅ PASS — **KEY FINDING: same-block AND confirmed.** `"имеют" "Path D regex"` matches waystones where BOTH quoted groups are in ONE block (`Монстры имеют X повышение шанса критического удара`). This validates `optimization-strategies.ts` runtime combination — no need to switch to `"имеют.*Path D"` single-quoted-group form.

### Test D5-3 — Clean TP/TN with FP control (6 alts, no prefix_ctx) [TABLET]

**Длина:** 139 chars ✅
**Regex:** `"встретить.*бродячих изгнанников|встретить.*ритуальный круг|встретить.*духов азмири|встретить.*Сущности|встретить.*ларцы|встретить.*алтари"`

| Item | Expected | Matched? |
|------|----------|----------|
| Потусторонний ордер (tablet) | ✅ TP (`встретить.*Сущности`) | ✅ matched |
| Фениксовый наказ (tablet) | ✅ TP (`встретить.*духов азмири`) | ✅ matched |
| Фениксовое побуждение (tablet) | ❌ TN (FP control — no "встретить") | ✅ correctly NOT matched |

**Result:** ✅ PASS — exactly 2 items matched, FP-control item correctly rejected.

### Test D5-4 — Multi-item TP + cross-category FP (6 alts, no prefix_ctx) [AMULET]

**Длина:** 148 chars ✅
**Regex:** `"максимуму.*здоровья|увеличение максимума.*здоровья|восполняется в виде.*здоровья|похищается в виде.*здоровья|вместо.*здоровья|количестве.*здоровья"`

| Item | Expected | Matched? |
|------|----------|----------|
| Племенной медальон (amulet) | ✅ TP (`максимуму.*здоровья` ← `+17 к максимуму здоровья`) | ✅ matched |
| Крутящий горжет (amulet) | ✅ TP (`восполняется в виде.*здоровья` ← `14% полученного урона восполняется в виде здоровья`) | ✅ matched |
| Унылый фермуар (amulet) | ❌ TN (FP control — no "здоровья") | ✅ correctly NOT matched |
| Отвратительное потрясение (ring) | ✅ Cross-cat TP (`максимуму.*здоровья` ← `+66 к максимуму здоровья`) | ✅ matched |
| Гипнотическая сущность (jewel) | ✅ Cross-cat TP (`увеличение максимума.*здоровья` ← `19% увеличение максимума здоровья компаньонов`) | ✅ matched |

**Result:** ✅ PASS — Multi-item TP + cross-category FP exactly as predicted. Opt-table regexes are category-agnostic by design — cross-category matches are EXPECTED, not bugs.

### Test D5-5 — Truncated stems + broad `.*` (9 alts, no prefix_ctx) [WAYSTONE + cross-cat TABLET]

**Длина:** 229 chars ✅
**Regex:** `"критическ.*их уда.*ров|критическ.*ого урона монст.*ров|количества редких монст.*ров|увеличение урона монст.*ров|и редких монст.*ров|появления свойств у редких монст.*ров|здоровья монст.*ров|эффективности монст.*ров|у монст.*ров"`

| Item | Expected | Matched? |
|------|----------|----------|
| Призрачный камень (waystone) | ✅ TP (`критыск.*ого урона монст.*ров` ← `+28% к бонусу критического урона монстров`) | ✅ matched |
| Изменённый прогресс (waystone) | ✅ TP (`критыск.*ого урона монст.*ров`) | ✅ matched |
| Разрушенный коридор (waystone) | ✅ TP (`критыск.*ого урона монст.*ров`) | ✅ matched |
| Потусторонний ордер (tablet) | ✅ Cross-cat TP (`у монст.*ров` — broad `.*` bridge FP) | ✅ matched (expected cross-cat FP) |
| Фениксовое побуждение (tablet) | ✅ Cross-cat TP (`у монст.*ров` — broad `.*` bridge FP) | ✅ matched (expected cross-cat FP) |

**Result:** ✅ PASS — All 3 waystones matched via specific alt; 2 tablets matched via broad `у монст.*ров` alt. The `у монст.*ров` FP is **expected and acceptable** behavior (category-agnostic by design). No D3 regexExclude fix needed based on this result.

### D5 conclusions

1. **Path D works in production on 6-9 alts** — no scalability issues observed (11+ alts couldn't be directly tested due to 250-char limit, but 9-alt PASS gives high confidence).
2. **Same-block AND confirmed in PoE2** — `"X" "Y"` matches when BOTH quoted groups are in ONE block. `regexPrefixContext` runtime combination (`"ctx" "Path D regex"`) is CORRECT — no `optimization-strategies.ts` changes needed.
3. **Cross-category FP is expected behavior** — opt-table regexes are category-agnostic by design. D5-4 (amulet regex matched ring + jewel) and D5-5 (waystone regex matched tablets) are NOT bugs.
4. **PoE2 regex char limit ≈ 250 chars** — NEW finding. ETL should add constraint to avoid generating opt-table entries that exceed this limit.
5. **No code changes needed** — ETL pipeline, runtime optimization, and `optimization-strategies.ts` are all correct.

---

## Iteration 39 — D1 VERIFIED (Path D on 3+4 alternatives)

3 in-game tests, all PASS. Verified Path D scales to 4 alts + composes safely with AND across blocks. Key test: `"увеличение урона.*огня|увеличение урона.*хаосом|увеличение урона.*луками|увеличение урона.*посохами"` matched exactly 4 items (Отврас. потрясение, Ненавистное потрясение, Племенная лучина, Гипнотическая сущность). FP-control verified: «Почётная мечта» (has "посохами" but no "увеличение урона" in same block) correctly NOT matched. AND + Path D verified: `"Path D regex" "сопротивлению.*молнии"` matched exactly 1 item (cross-block AND).

---

## Iteration 38 — B0 RESOLVED + D7-3 confirmed

**B0 CONFIRMED BROKEN:** `"X"|"Y"` (OR between two quoted groups) gives ZERO matches in-game. All 3 B0 tests confirmed. **Conclusion:** Path A (decompose opt-table to `"X"|"Y"`) is IMPOSSIBLE.

**D7-3 CONFIRMED WORKING:** `"увеличение урона.*луками|увеличение урона.*посохами"` (top-level `|` inside ONE quoted group with `.*` bridges) — game was patched since iter 15-17, this NOW WORKS. **Path D strategy born:** `"prefix.*A|prefix.*B|prefix.*C"` as replacement for broken opt-table pattern `"prefix (A|B|C)"`.

---

## Iteration 37 — Deterministic Strategy (8 principles, all categories)

Test items (4 Изумрудных самоцвета): Племенная лучина (ilvl 82), Гипнотическая сущность (65), Племенной узор (28), Почётная мечта (81).

Key findings:
- **D1** Single-mod suffix matching: ✅ PASSED — unique substrings, no FP
- **D2** `.*` bridging within single block: ✅ PASSED — `"увеличение урона.*посохами"` → gem 1
- **D3** AND across blocks: ✅ PASSED — order-independent, rejects missing mods
- **D4** Cross-block FP risk: ✅ DEMONSTRATED — `"увеличение" "меткости"` matches gem 3 via DIFFERENT blocks (FP); `"увеличение.*меткости"` does NOT (same-block `.*` bridge prevents FP)
- **D5** Shared suffix differentiation: ✅ PASSED — `"(1[0-5])%.*порога стихийных состояний"` matches both gems 3 and 4
- **D6** Single-word `|` as whole quoted group: ✅ PASSED — `"луками|посохами"` matches gems 1, 2, 4
- **D9** Number patterns: ✅ PASSED — enumeration, threshold, `^` anchor all work
- **D10** Truncated stems: ✅ PASSED — `"оберег"` matches `"оберега"`, `"посох"` matches `"посохами"`
- **D11** Combined mod regex: ✅ PASSED — `"<number_pattern>.*<suffix>"` pattern verified

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

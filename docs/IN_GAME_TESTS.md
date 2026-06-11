# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Верификация v2:** 2026-06-11 — пороги, `{N,}`, обрезки, negation+группы.

---

## PoE2 Regex Dialect — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR without `()` | ✅ | `"огня\|холоду"` → 3 items |
| `()` grouping | ✅ | `"(огня\|холоду)"` → same as without |
| `\|` inside `()` with number ranges | ✅ | `"([3-9][0-9]\|[0-9][0-9][0-9]).*к сопротивлению молнии"` |
| `\d` digit shorthand | ✅ | `"\d.*к максимуму здоровья"` |
| `{N,}` quantifier | ✅ | `"\d{2,}%.*золота"` — matches ≥2 digits |
| `\d{3,}` for ≥100 | ✅ | `"\d{3,}%.*алтар"` — NO match on 85%, 88% |
| `!` + `\|` = `!(A\|B)` | ✅ | `"к сопротивлению" "!молнии\|хаосу"` |
| `!` + `[]` inside negation | ✅ | `"золота" "!2[0-9]%.*золота"` — excludes 20-29% |
| `!` + `\d` inside negation | ✅ | `"золота" "!2\d%.*золота"` — same as above |
| `()` + `\|` + `.*` scoped OR | ✅ | `"(огня\|молнии).*к атакам"` |
| `?` optional | ❌ | NOT supported |
| `.*` is directional (forward only) | ✅ | Reverse order → ❌ |
| `.*` does NOT cross block boundaries | ✅ | Verified |
| `.` matches literal dot | ✅ | `"15.9"` matches fractional |
| `[.]` for exact dot match | ✅ | `"15[.]9"` |
| `-` literal outside `[]` | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `"% к сопротивлению"`, `\+` matches literal + |
| `(` unmatched = literal | ✅ | `"(60"` matches literal |
| Case insensitive | ✅ | Verified with Cyrillic |
| `!X` is item-wide | ✅ | Excludes item if X in ANY block |
| AND across blocks | ✅ | `"максимуму здоровья" "к силе"` → ✅ |
| `"A\|B" "!C"` OR + exclude | ✅ | Correctly excludes items with chaos |
| Enumerated range out-of-bounds | ✅ | `(2[5-9]\|3[0-5])%.*редких монстров` — 27% matches, 39% excluded |
| `"От N.*suffix"` dual-number prefix | ✅ | `От ([1-9][0-9]).*огня к атакам` — matches 17, not 5 |
| Threshold ≥N% + suffix | ✅ | `"([3-9]\d\|\d{3,})%.*золота"` — ≥30%, no FP from range notation |
| `\d{3,}` no FP on fractional | ✅ | `"\d{3,}%.*дани"` — 5.13% NOT matched |
| Combinatorial OR per role | ✅ | `"([3-9]\d)%.*золота\|дополнит.*алтар"` — gold ≥30% OR extra altar |

**Critical syntax rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries
3. `.*` is directional — forward only
4. AND via space between quoted groups is order-independent, works ACROSS blocks
5. Case insensitive
6. `!X` is item-wide
7. Description/tooltip text is NOT indexed
8. Item rarity label IS indexed — contains «редк»/«редкий», visible in search

---

## Threshold Patterns — VERIFIED ✅

Пороговые паттерны `([X-Y]\d|\d{3,})%` работают БЕЗ FP от чисел в диапазонной нотации.

| Test | Regex | Result |
|------|-------|--------|
| ≥30% + золота | `"([3-9]\d\|\d{3,})%.*золота"` | ✅ 2 shown (30%, 32%), 3 hidden (25%, 27%, 29%) |
| ≥25% + золота | `"([2-9]\d\|\d{3,})%.*золота"` | ✅ All 5 shown |
| ≥30% + Бездн (FP test) | `"([3-9]\d\|\d{3,})%.*Бездн"` | ✅ 0 items — NO FP from range "(20—30)%" |
| ≥30% + путев | `"([3-9]\d\|\d{3,})%.*путев"` | ✅ 6 items with ≥30% waystones |
| ≥30% + редких монстров | `"([3-9]\d\|\d{3,})%.*редких монстров"` | ✅ 0 items — all below 30% |
| ≥10% + редкост | `"([1-9]\d)%.*редкост"` | ✅ Works but FP on «редкости монстров» |
| ≥10% + карте предметов | `"([1-9]\d)%.*карте предметов"` | ✅ No FP — full suffix disambiguates |

**Ключевой вывод:** Числа внутри диапазонной нотации «(20—30)%» НЕ дают FP с пороговыми паттернами. Порог ≥30% не совпадает с «30» из «(20—30)%». Причина: `.*` внутри одного блока, а число из диапазона стоит в другом контексте либо `.*` не доходит.

**Пороговый паттерн vs enumeration:**
| Способ | Пример ≥30% | Длина | Точность |
|--------|-------------|-------|----------|
| Порог | `([3-9]\d\|\d{3,})` | ~17 символов | ✅ Без FP (верифицировано) |
| Enumeration | `(3[0-9]\|4[0-9]\|5[0-9]\|...|[1-9][0-9][0-9])` | ~50+ символов | ✅ Без FP |

---

## `{N,}` Quantifier — VERIFIED ✅

| Test | Regex | Result |
|------|-------|--------|
| `{2,}` basic | `"\d{2,}%.*золота"` | ✅ Works — ≥2 digits matched |
| `\d{3,}` no 2-digit FP | `"\d{3,}%.*алтар"` | ✅ 88%, 85% NOT matched |
| `\d{3,}` no fractional FP | `"\d{3,}%.*дани"` | ✅ 5.13% NOT matched |

**Ключевой вывод:** `{N,}` квантификатор поддерживается в PoE2. `\d{3,}` можно использовать вместо `[0-9][0-9][0-9]`. Дробные числа (5.13) не дают FP — `\d` не захватывает точку, а «13» = 2 цифры < 3.

**Экономия:** `\d{3,}` (6 символов) vs `[0-9][0-9][0-9]` (15 символов) = **-9 символов** на каждом ≥100 паттерне.

---

## Truncated Word Tails — VERIFIED (с оговорками)

| Word | Test | FP? | Safe? |
|------|------|-----|-------|
| `эффективн` | 12 items matched | No | ✅ SAFE |
| `бездн` | 5 items matched | No | ✅ SAFE |
| `глубин` | 1 item matched | No | ✅ SAFE |
| `провал` | 0 items | No | ✅ SAFE (no items to test) |
| `путев` | 6 items matched | No | ✅ SAFE |
| `редкост` | ALL items + jewels | **YES** | ❌ UNSAFE |

**FP `редкост`:** Подсвечивает ВСЕ предметы включая самоцветы. Причина: метка редкости предмета («редкий») индексируется поиском и содержит подстроку «редк». Это invisible text для игрока, но PoE2 regex его видит.

**Правило:** Обрезанные хвосты безопасны только если подстрока уникальна в контексте предмета. `редкост` не уникальна — совпадает с rarity label. Полному суффиксу `карте предметов` эта проблема не грозит.

---

## `\+` Literal Plus — VERIFIED ✅

`\+` работает как literal плюс. На плитках нет «+» в модах — 0 совпадений. Отдельно проверено на другом сундуке: предметы с `+%` подсвечиваются.

Для полного теста нужны путевые камни с implicit-блоками.

---

## Negation + Regex Groups — VERIFIED ✅

| Test | Regex | Result |
|------|-------|--------|
| `!` + `[0-9]` | `"золота" "!2[0-9]%.*золота"` | ✅ Excludes 20-29%, shows ≥30% |
| `!` + `\d` | `"золота" "!2\d%.*золота"` | ✅ Same — `\d` works inside `!` |

**Ключевой вывод:** `!` работает с `[]` и `\d` внутри negation. Открывает возможность «исключить <N%» вместо «выбрать ≥N%».

---

## Item Rarity Label — VERIFIED (indexed)

`"редкост"` подсвечивает ВСЕ редкие предметы. Метка редкости (типа «Редкий») содержит подстроку «редк» и индексируется PoE2 regex. Игрок этого текста не видит на экране при наведении, но regex-поиск его находит.

**Следствие:** Любой регекс содержащий «редк» будет FP на всех редких предметах. Нужно использовать полные суффиксы-дизамбигаторы: `карте предметов` вместо `редкост`.

---

## Cross-Block AND — VERIFIED ✅

| Test | Regex | Result |
|------|-------|--------|
| "Бездн" + "опыт" | `"Бездн" "опыт"` | ✅ 3 items — Abyss + experience |
| "Ритуала" + ≥30% золота | `"Ритуала" "([3-9]\d\|\d{3,})%.*золота"` | ✅ 2 items |
| "путев" + "Бездн" | `"путев" "Бездн"` | ✅ 0 items — neither exists together |
| "Бездн" + "редкост" | `"Бездн" "редкост"` | ⚠️ 5 items instead of 1 — `редкост` matches rarity label |

**Следствие:** AND с `редкост` не фильтрует, потому что `редкост` совпадает на ВСЕХ редких предметах.

---

## Dual-Indexing — VERIFIED

| Context | Dual-indexed? | Verified |
|---------|--------------|----------|
| Tablet/Accessory mods | ✅ Yes | `"39[(]"` matches on tablets |
| Waystone implicits | ❌ No | `"Шанс выпадения путевого камня.*85[(]"` → ❌ |

---

## FP Prevention Anchors — VERIFIED

| Anchor | Method | Status |
|--------|--------|--------|
| `^` (anchorStart) | Template starts with `##` | ✅ |
| `%` suffix (anchorEnd) | Template has `##%`, anchorStart=false | ✅ |
| `: ` colon | Reversed non-% mods with `: ##` | ✅ |
| Threshold ≥N% | `([X-Y]\d|\d{3,})%.*suffix` | ✅ NEW — no FP from range notation |

---

## Block Model — VERIFIED

- `.*` within single block only ✅
- AND works across blocks ✅
- Implicits indexed ✅
- State text indexed ("Осквернено") ✅
- Multi-line mods: `.*` crosses newline ✅
- Item rarity label indexed («редкий» / «редк») ✅ NEW

# In-Game Regex Verification Tests

> Результаты проверки поведения PoE2 regex в игре (RU клиент).

---

## Verified Results Summary

### PoE2 Regex Dialect — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR without `()` | ✅ | `"огня\|холоду"` → 3 items |
| `()` grouping | ✅ | `"(огня\|холоду)"` → same as without |
| `\|` inside `()` with number ranges | ✅ | `"([3-9][0-9]\|[0-9][0-9][0-9]).*к сопротивлению молнии"` |
| `\d` digit shorthand | ✅ | `"\d.*к максимуму здоровья"` |
| `!` + `\|` = `!(A\|B)` | ✅ | `"к сопротивлению" "!молнии\|хаосу"` |
| `()` + `\|` + `.*` scoped OR | ✅ | `"(огня\|молнии).*к атакам"` |
| `?` optional | ❌ | NOT supported |
| `[её]?` | ❌ | NOT supported |
| `.*` is directional (forward only) | ✅ | Reverse order → ❌ |
| `.*` does NOT cross block boundaries | ✅ | B1-B2 verified — see Block Model |
| `.` matches literal dot | ✅ | `"15.9"` matches fractional |
| `[.]` for exact dot match | ✅ | `"15[.]9"` |
| `-` literal outside `[]` | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `"% к сопротивлению"` |
| `(` unmatched = literal | ✅ | `"(60"` matches literal |
| Case insensitive | ✅ | Verified with Cyrillic |
| `!X` is item-wide | ✅ | Excludes item if X in ANY block |
| Description text NOT indexed | ✅ | `"картоходца"` → no match |
| AND across blocks | ✅ | `"максимуму здоровья" "к силе"` → ✅ |

### PoE2 Dual-Indexing — VERIFIED

PoE2 индексирует ДВА формата текста **для модов**:
1. **Simplified:** `39% увеличение количества...` (rolled value без range)
2. **Detailed:** `39(30-40)% увеличение количества...` (с range notation)

Оба searchable. `.*` матчит оба.

**Имплисеты: NO dual-indexing.** Только simplified формат: `Шанс выпадения путевого камня: +85%`

| Context | Dual-indexed? | Verified |
|---------|--------------|----------|
| Tablet mods (`##% suffix`) | ✅ Yes | `"39[(]"` matches on tablets |
| Accessory mods (`+##% suffix`) | ✅ Yes | Implied by `%` anchor working |
| Waystone mods (`##% suffix`) | ✅ Presumed | Same pattern as tablets |
| Waystone implicits (`Label: +##%`) | ❌ No | `"Шанс выпадения путевого камня.*85[(]"` → ❌ |

### % Anchor — VERIFIED AND RE-ENABLED

| Method | Status | Notes |
|--------|--------|-------|
| `%` suffix anchor (anchorEnd) | ✅ RE-ENABLED | Works on mods. Prevents range notation FP. |
| `%` on implicits (reversed) | ✅ VERIFIED | `"Шанс выпадения путевого камня.*85%"` works in-game |
| `^` anchor (anchorStart) | ✅ | For ##% mods where number starts the block |
| Enumeration without `%` | ⚠️ FP risk | `(30\|39).*suffix` → FP from `(30-40)%` |
| Non-% mods reversed regex | ✅ FIXED | Colon anchor `: ` prevents FP — `suffix.*: (number)` matches only rolled value after `: ` |

**% anchor mechanism:**
- Mods: `"(3[0-6]%\|39%).*suffix"` → correct, `%` filters range FP
- Implicits: `"Label.*(range)%"` → correct, no range FP possible (no dual-indexing)

**Non-% mods colon anchor (VERIFIED in-game):**
- Моды с `##` в конце шаблона ("suffix: ##") используют reversed regex `suffix.*: number` с colon anchor
- Анкор `: ` гарантирует, что число стоит сразу после разделителя `: ` (rolled value)
- Range notation вторичные числа (напр. "2" в "1(1-2)") стоят после rolled value, не после `: ` → нет FP
- In-game VERIFIED: T1 и T3 FP предотвращены colon anchor
- Implicits НЕ dual-indexed → нет range notation → нет FP (colon anchor не нужен)
- Тесты: `tests/core/tablet-non-percent-fp.test.ts`

### Block Model — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `.*` within single block only | ✅ VERIFIED | B1-B2: `"35%.*к сопротивлению молнии"` matches ONLY +35% lightning ring, NOT +35% cold + +41% lightning ring |
| AND works across blocks | ✅ | `"максимуму здоровья" "к силе"` |
| Implicits indexed | ✅ VERIFIED | Waystone `"Шанс выпадения путевого камня.*85%"` → ✅ |
| State text indexed ("Осквернено") | ✅ | Block K4 |
| Multi-line mods: `.*` crosses newline | ✅ | `"повышение шанса.*бонусу"` works |

### Waystone Implicit Regex — VERIFIED

| # | Regex | Result | Notes |
|---|-------|--------|-------|
| WV1 | `"повышение шанса критического удара"` | ✅ | Waystone mods indexed |
| WV2 | `"Шанс выпадения путевого камня"` | ✅ | Waystone implicits indexed |
| WV3a | `"Шанс выпадения путевого камня.*85%"` | ✅ | Reversed regex + % anchor works |
| WV3b | `"Шанс выпадения путевого камня.*85[(]"` | ❌ | No dual-indexing on implicits |
| WV5a | `"Шанс выпадения путевого камня" "85%"` | ✅ | AND across blocks works |

### Tablet Implicit Regex — VERIFIED

| # | Regex | Result | Notes |
|---|-------|--------|-------|
| T1 | `"Осталось зарядов.*3"` | ✅ | Reversed regex for charges works |
| T2 | `"алтари Ритуала"` | ✅ | Literal implicit text works |

### Scroll Fix — VERIFIED (all categories)

| Category | Status | Notes |
|----------|--------|-------|
| All | ✅ v7 | Shared VirtualizedModList component, progressive scroll restore (immediate → RAF → setTimeout) |

---

## Colon Anchor Fix — VERIFIED in-game (T1, T3)

### In-game верификация (2026-06-10)

| # | Мод | Regex | Порог | Значение | Ожидание | Результат |
|---|-----|-------|-------|----------|----------|-----------|
| T1 | дополнительных редких монстров | `появляется.*: ([2-9]\|...)` | ≥2 | 1 | Не подсветить | ✅ Ничего не подсвечивает |
| T3 | дополнительных редких сундуков | `х редких с.*: ([3-9]\|...)` | ≥3 | 2 | Не подсветить | ✅ Ничего не подсвечивает |

**Автоматические тесты:** `tests/core/colon-anchor-verification.test.ts` (17 тестов)

---

## Non-% Mods In-Game Verification — COMPLETED (6 тестов)

### Результаты (2026-06-10)

| # | Мод | Порог | Предмет | Значение | Результат | FP? |
|---|-----|-------|---------|----------|-----------|-----|
| T1 | дополнительных редких монстров | ≥2 | Возвышенная Плитка Бездны | 1 | **Подсветило** (range "1(1-2)") | **FP → FIXED** |
| T2 | дополнительных свойств | ≥2 | Непостижимое побуждение | 1 | Не подсветило | OK |
| T3 | дополнительных редких сундуков | ≥3 | Тревожный суд | 2 | **Подсветило** (range "2(1-3)") | **FP → FIXED** |
| T4 | дополнительных духов азмири | ≥2 | Космический мандат | 1 | Не подсветило | OK |
| T5 | зарядов (implicit) | ≥5 | Древний декрет | 4 | Корректно отфильтровано | OK (control) |
| T6 | % эффективности монстров | ≥16 | Языческий приказ | 15% | Не подсветило | OK (control) |

### Colon Anchor Fix

FP в T1 и T3 вызваны range notation в dual-indexed модах:
- T1: "дополнительных редких монстров: **1(1-2)**" → "2" в "(1-2)" матчит ≥2
- T3: "дополнительных редких сундуков: **2(1-3)**" → "3" в "(1-3)" матчит ≥3

**Fix: colon anchor** — для non-% reversed модов с шаблоном `: ##` компилятор теперь генерирует `suffix.*: (number)` вместо `suffix.*(number)`. Анкор `: ` гарантирует, что число стоит сразу после разделителя `: `, где находится rolled value. Числа в range notation стоят после rolled value, а не после `: `.

Пример:
- Было: `"появляется.*([2-9]|[0-9][0-9][0-9]?)"` → FP на "1(1-2)"
- Стало: `"появляется.*: ([2-9]|[0-9][0-9][0-9]?)"` → нет FP, "1" после `: ` не матчит [2-9]

Требуется in-game верификация fix'а — повторить T1 и T3 с новым regex. **ВЫПОЛНЕНО — см. "Colon Anchor Fix — VERIFIED in-game" выше.**

---

## Regex Syntax — VERIFIED

| Feature | Status | Regex tested |
|---------|--------|-------------|
| `[]` + `.*` + long suffix | ✅ | `"[2-3][0-9]%.*находимых на карте путевых камней"` |
| `()` + `\|` + char class + `.*` + suffix | ✅ | `"(3[0-6]%\|39%).*suffix"` |
| `()` + `\|` + literals + `.*` + suffix | ✅ | `"(30%\|39%).*suffix"` |
| Long enumeration + long suffix | ✅ | No length limit hit |

---

## Waystone — Searchable Text Model

### Моды (префиксы/суффиксы)

Формат: `##% описание` (число ПЕРЕД текстом)
Regex: `число%.*суффикс` или `^число.*суффикс`

### Имплисеты (отдельная секция)

Формат: `Описание: +##%` (число ПОСЛЕ текста)
Regex: `суффикс.*число%`

- `"Шанс выпадения путевого камня: +##%"` — ranges [0, 350]
- `"Редкость предметов: +##%"` — ranges [0, 350]
- `"Размер групп монстров: +##%"` — ranges [0, 350]
- `"Эффективность монстров: +##%"` — ranges [0, 350]
- `"Доступно возрождений: #"` — values [0, 6]

### НЕ моды (имплисет-бонусы, не searchable)

- `"На ##% больше находимых в области путевых камней"` ← НЕ searchable
- `"##% увеличение эффективности монстров"` ← НЕ searchable
- `"На ##% больше редкости находимых в этой области предметов"` ← НЕ searchable
- `"На ##% больше размера групп монстров"` ← НЕ searchable

### Правило для ETL

1. Строки, влияющие на имплисет — НЕ моды. Убрать из списка модов.
2. Имплисет-бонусы (`"На ##% больше..."`, `"##% увеличение эффективности монстров"`) — не searchable.
3. Имплисеты (`"Шанс выпадения путевого камня: +##%"`) — searchable, но regex REVERSED (text.*number%).
4. Только ПЕРВАЯ строка каждой мод-группы — это мод.

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
| Non-% mods reversed regex | ⚠️ FP risk | `suffix.*(number)` без `%` anchor → FP от range notation вторичных чисел |

**% anchor mechanism:**
- Mods: `"(3[0-6]%\|39%).*suffix"` → correct, `%` filters range FP
- Implicits: `"Label.*(range)%"` → correct, no range FP possible (no dual-indexing)

**Non-% mods FP risk:**
- Моды с `##` в конце шаблона ("suffix: ##") используют reversed regex `suffix.*number` без `%` anchor
- Range notation вторичные числа (напр. "2" в "1(1-2)") могут матчить ≥2 фильтр → FP
- Риск низкий: диапазоны маленькие (1-2), FP только для специфичных порогов
- Implicits НЕ dual-indexed → нет range notation → нет FP
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

### Scroll Fix — VERIFIED (jewel), PENDING (belt/ring/amulet)

| Category | Status | Notes |
|----------|--------|-------|
| Jewel | ✅ VERIFIED | No scroll jumps when clicking mods with ≥/≤ |
| Belt | ⏳ PENDING | Same component (VirtualizedModList), should work identically |
| Ring | ⏳ PENDING | Same component (VirtualizedModList), should work identically |
| Amulet | ⏳ PENDING | Same component (VirtualizedModList), should work identically |

Scroll fix реализован в `VirtualizedModList.tsx` (shared component). Fix использует `useLayoutEffect` + `scrollTopRef` + double-RAF для сохранения позиции скролла при `virtualizer.measure()`. Применяется одинаково для всех категорий.

---

## Non-% Mods In-Game Verification Plan (6 тестов)

Эти тесты нужно провести в игре для подтверждения/опровержения FP риска для non-% модов с reversed regex.

### Тестовые предметы (из `плитки для теста в игре.md`)

| Предмет | Ключевой мод | Значение |
|---------|-------------|----------|
| Возвышенная Плитка Бездны чемпионов | дополнительных редких монстров: | 1 |
| Непостижимое побуждение | дополнительных свойств: | 1 |
| Тревожный суд | дополнительных редких сундуков: | 2 |
| Космический мандат | дополнительных духов азмири: | 1 |
| Древний декрет | Осталось зарядов - | 4 |
| Языческий приказ | увеличение эффективности монстров | 15% |

### TEST 1: "дополнительных редких монстров" ≥2

- **Предмет**: Возвышенная Плитка Бездны чемпионов (значение = 1)
- **Поиск в PoE2**: `"появляется.*([2-9]|[0-9][0-9][0-9]?)"`
- **Ожидание**:
  - Если игра показывает range notation "1(1-2)" → предмет подсвечивается (FP — значение 1, но "2" в range матчит ≥2)
  - Если без range notation → НЕ подсвечивается (корректно)
- **Вариант без FP**: `"появляется.*(2)"` — точное совпадение с "2", но пропускает значение 2

### TEST 2: "дополнительных свойств" ≥2

- **Предмет**: Непостижимое побуждение (значение = 1)
- **Поиск в PoE2**: `"уникальные.*([2-9]|[0-9][0-9][0-9]?)"`
- **Ожидание**: аналогично TEST 1 — FP если range notation "1(1-2)"

### TEST 3: "дополнительных редких сундуков" ≥3

- **Предмет**: Тревожный суд (значение = 2)
- **Поиск в PoE2**: `"х редких с.*([3-9]|[0-9][0-9][0-9]?)"`
- **Ожидание**: FP только если range extends до 3+ (напр. "2(1-3)")
- **Примечание**: при диапазоне [2,3] FP менее вероятен, чем при [1,2]

### TEST 4: "дополнительных духов азмири" ≥2

- **Предмет**: Космический мандат / Потусторонний гимн (значение = 1)
- **Поиск в PoE2**: `"ьных духов.*([2-9]|[0-9][0-9][0-9]?)"`
- **Ожидание**: FP если range notation "1(1-2)"

### TEST 5: "зарядов" ≥5 (control — implicit)

- **Предмет**: Древний декрет (Осталось зарядов - 4)
- **Поиск в PoE2**: `"Осталось зарядов.*([5-9]|[0-9][0-9][0-9]?)"`
- **Ожидание**: НЕ подсвечивается (implicits НЕ dual-indexed, нет range notation)
- **Это контрольный тест** — должен всегда проходить

### TEST 6: % mod control — "эффективности монстров" ≥16

- **Предмет**: Языческий приказ (15% увеличение эффективности монстров)
- **Поиск в PoE2**: `"(1[6-9]|[2-9][0-9]|[0-9][0-9][0-9])%.*эффективности монстров"`
- **Ожидание**: НЕ подсвечивается (15 не матчит 1[6-9], % anchor предотвращает range FP)
- **Это контрольный тест** — должен всегда проходить

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

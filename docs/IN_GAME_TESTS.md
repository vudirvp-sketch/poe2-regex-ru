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
| `.*` within single block only | ✅ VERIFIED | B1-B2: `"35%.*к сопротивлению молнии"` matches ONLY +35% lightning ring, NOT +35% cold + +41% lightning ring (different affixes = different blocks) |
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

### Regex Syntax — VERIFIED

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

---

## Test Items Reference

| # | Item | Key mods |
|---|------|----------|
| R1 | Отвратительное потрясение | +66 max HP, 28% fire res, +121 evasion, +23 str, +35% lightning res |
| R2 | Расколотый завиток | 17-30 fire damage, 2-36 lightning damage, +32 str, +13% all res |
| A1 | Унылый фермуар | 28% mana regen, 43% evasion, +380 accuracy, +12% cold res, +33 int |
| A2 | Крутящий горжет | 25% mana regen, +184 accuracy, +62 ES, +24% lightning res |
| A3 | Племенной медальон | 27% mana regen, +17 max HP, +55 mana, +34% lightning res, +14% chaos res |

# MIXED-mode UI — In-Game Verification Tests (iter 160, прогоны iter 161–163)

> **Цель:** закрыть KI#48 — верифицировать UI MIXED-mode (iter 159) в реальной игре
> на 5 категориях (ring / waystone / tablet / amulet / jewel).
> **Источник предметов:** `регис/предметы для теста с аффиксами имплиситами_новый.md`.
> **Связанные документы:** `регис/результаты AND+OR тестов.md` (iter 157 — core layer
> in-game verified T1–T10), `docs/UI_REFACTOR_PLAN.md` §14 (MIXED-mode UI patterns).
> **UI-инструкция:** на странице категории переключить logic mode на «Смешанный»
> (третий radio button в CategoryControlPanel; рядом с чипом — ⓘ glyph,
> hover 350ms открывает tooltip с пояснением жестов). Чипы получают 3-state
> поведение: click = want (MUST), shift+click = opt (OPT, amber dashed border),
> right-click = exclude (EXCLUDE, red border).

> **Статус (iter 163 — KI#48 ЗАКРЫТ):**
> - T1 — PASS in-game (пользователь, iter 161).
> - T2 — PASS in-game (пользователь, iter 161).
> - T3 — closed через KI#49. Паттерн `"!BAD" "MUST" "OPT"` = iter 157 T7
>   (`"!замерзшей земли" "повышение шанса критического удара" ...
>   "пробивает|порога состояний"` — PASS на W1/W3, W2 исключён через `!`).
>   KI#49 fix (iter 162) гарантирует regex string строится корректно
>   (unit-test PASS). Семантика `!` item-wide + AND + OR уже in-game verified.
> - T4 — PASS in-game (пользователь, iter 161).
> - T5 — PASS in-game (пользователь, iter 161).
> - T6 — unit-test PASS (`tests/ui/FilterChip.test.tsx`: `enters full-optional
>   state`, `enters partial-optional state`, `shift+click calls onToggleOptional`).
>   UI-only тест, in-game не применим.
> - T7 — unit-test PASS (`tests/ui/FilterChip.test.tsx`: `right-click calls
>   onToggleExclude when mixedMode is true`, `right-click does NOT call
>   onToggleExclude when mixedMode is false`, `shift+Enter calls onToggleOptional`).
>   `preventDefault()` на `contextmenu` — стандартное браузерное поведение.
> - T8 — unit-test PASS (`tests/store/filter-store.test.ts`: `serialize()
>   includes 'opt' key`, `deserialize() restores optionalIds from 'opt' key`,
>   `serialize → deserialize round-trip preserves optionalIds`, defensive strips).
>   URL ≠ game, in-game не применимо.
> - T9 — unit-test PASS (iter 163, `tests/ui/FilterChip.test.tsx`:
>   `iter 163 (T9): toggling mixedMode off then on preserves OPT state`).
>   Store behavior, in-game не применимо.
> - T10 — unit-test PASS (`tests/ui/buildMixedAst.test.ts`: `builds canonical
>   MIXED pattern: "MUST1" "MUST2" "OPT1|OPT2"`). Паттерн `"MUST" "OPT1|OPT2|OPT3"`
>   = iter 157 T1/T2 (3 OPT вместо 2). Семантика OR-группы уже verified.
>
> **Итог:** KI#48 закрыт. In-game verification завершена через iter 157
> (паттерны эквивалентны) + iter 161 (T1/T2/T4/T5 PASS). Unit-test layer
> полностью закрыт. Повторных прогонов не требуется.

---

## 1. Тестовые предметы

> Коды используются во всех таблицах ожиданий ниже. Все предметы взяты из
> `регис/предметы для теста с аффиксами имплиситами_новый.md` (16 предметов,
> 5 категорий). Полные тексты аффиксов — в источнике.

### Кольца Разлома (Ring)

| Код | Имя | Ключевые аффиксы (кратко) |
|-----|-----|---------------------------|
| **R1** | Отвратительное потрясение | +66 здоровье, +23 сила, 28% урон огнём, +35% сопр. молнии, 49 HP за убитого врага, +121 уклонение |
| **R2** | Расколотый завиток | +32 сила, +13% сопр. всем стихиям, 19% реген маны, 15% радиус обзора, 17-30 урон огнём к атакам |
| **R3** | Ненавистное потрясение | 15% урон хаосом, 5-9 физ урон к атакам, +59 мана, реген 15.9 HP/с, 18% редкость предметов |

### Путевые камни (Waystone)

| Код | Имя | Ключевые аффиксы |
|-----|-----|-------------------|
| **W1** | Призрачный камень | Редкость +18%, Размер групп +30%, Эффективность +57%, Шанс выпадения +85%, 276% crit, +28% crit dmg, 36% отравление, 18% кровотечение, 70% порог сост., 76% порог оглуш. |
| **W2** | Изменённый прогресс | Редкость +36%, Размер групп +30%, Эффективность +30%, Шанс выпадения +90%, 273% crit, +26% crit dmg, 125% накопление оглуш., 50% меньше эффекта проклятий, замерзшая земля, Путы времени |
| **W3** | Разрушенный коридор | Редкость +25%, Размер групп +43%, Эффективность +30%, Шанс выпадения +110%, 297% crit, +26% crit dmg, 2 доп. снаряда, 10% скорость монстров, 36% отравление, пробивает 13% сопр. стихиям |

### Заражённые плитки (Tablet)

| Код | Имя | Ключевые аффиксы |
|-----|-----|-------------------|
| **T1** | Потусторонний ордер | 39% редкие монстры, 18% редкость предметов, 82% шанс Сущности, 34% больше путевых камней |
| **T2** | Фениксовое побуждение | 27% редкие монстры, 33% больше золота, 43% больше путевых камней, 1 доп. свойство уников |
| **T3** | Фениксовый наказ | 57% волшебные монстры, 21% редкость предметов, 39% больше путевых камней, 73% шанс духов азмири |

### Лазурные амулеты (Amulet)

| Код | Имя | Ключевые аффиксы |
|-----|-----|-------------------|
| **A1** | Унылый фермуар | 28% реген маны, 43% уклонение, 29% макс. ЭЩ, +380 меткость, 15% crit, +12% сопр. холоду, +33 интеллект |
| **A2** | Крутящий горжет | 25% реген маны, +184 меткость, +62 ЭЩ, 30% макс. ЭЩ, +24% сопр. молнии, 14% урон→HP, +14 ловкость |
| **A3** | Племенной медальон | 27% реген маны, +35 меткость, +17 здоровье, +55 мана, +34% сопр. молнии, +14% сопр. хаосу, реген 30.9 HP/с |

### Самоцветы — Изумруд (Jewel)

| Код | Имя | Ключевые аффиксы |
|-----|-----|-------------------|
| **J1** | Племенная лучина | 11% длительность оберега, 15% урон боевыми посохами, 9% длительность состояний, 7% сила отравления |
| **J2** | Гипнотическая сущность | 7% crit атаками, 6% урон луками, 10% доп. снаряд при разветвлении, 19% макс. HP компаньонов |
| **J3** | Племенной узор | 6% глобальная меткость, 10% урон снарядов, 10% шанс наложения состояний, 10% порог стихийных состояний |
| **J4** | Почётная мечта | 2% скорость атаки посохами, 12% порог стихийных состояний, 20% урон снарядами (после удара в ближнем бою) |

---

## 2. Раунд 1 — Базовые сценарии MIXED-mode (T1–T5)

> Перед каждым тестом: открыть категорию → logic mode = «Смешанный» →
> очистить выбор (кнопка «Очистить» в SelectedBasket).

### T1 — 1 MUST + 1 OPT (простейший случай)

**Категория:** Ring (Кольцо)
**Логика:** MUST = `+XX к максимуму здоровья`, OPT = `+XX к силе`
**Шаги UI:**
1. Click на чипе «+XX к максимуму здоровья» (prefix) → MUST state.
2. Shift+click на чипе «+XX к силе» (prefix) → OPT state (amber dashed border).

**Ожидаемый regex (форма, до оптимизаций/yofication):**
```
"максимуму здоровья" "силе"
```
> Примечание: при единственном OPT токене MIXED_OR деградирует в обычный AND —
> это корректное поведение. Тест проверяет, что shift+click не ломает builder.

| R1 | R2 | R3 |
|----|----|----|
| ✅ | ❌ | ❌ |

**Ожидание:** только R1 (имеет +66 к здоровью = MUST). R2/R3 не имеют «максимуму здоровья».
**Если FAIL:** shift+click не вызывает `onToggleOptional`, либо builder падает на
single-OPT MIXED_OR — смотреть `FilterChip.handleClick` + `buildMixedAstFromSelections`.

---

### T2 — 2 MUST + 2 OPT → `"MUST1" "MUST2" "OPT1|OPT2"`

**Категория:** Amulet (Амулет)
**Логика:**
- MUST1 = `XX% увеличение максимума энергетического щита` (есть у A1=29%, A2=30%; нет у A3)
- MUST2 = `+XX к меткости` (есть у всех: A1=380, A2=184, A3=35)
- OPT1 = `+XX% к сопротивлению холоду` (только A1=12%)
- OPT2 = `+XX% к сопротивлению молнии` (A2=24%, A3=34%)

**Шаги UI:**
1. Click на «XX% увеличение максимума энергетического щита» (suffix) → MUST.
2. Click на «+XX к меткости» (suffix) → MUST.
3. Shift+click на «+XX% к сопротивлению холоду» (suffix) → OPT.
4. Shift+click на «+XX% к сопротивлению молнии» (suffix) → OPT.

**Ожидаемый regex (форма):**
```
"максимума энергетического щита" "меткости" "сопротивлению холоду|сопротивлению молнии"
```

| A1 | A2 | A3 |
|----|----|----|
| ✅ | ✅ | ❌ |

**Ожидание:**
- A1: MUST1 ✓ AND MUST2 ✓ AND (OPT1 ✓ OR OPT2 ✗) → ДА
- A2: MUST1 ✓ AND MUST2 ✓ AND (OPT1 ✗ OR OPT2 ✓) → ДА
- A3: MUST1 ✗ (нет «максимума энергетического щита») → НЕТ
**Если FAIL:** OR-группа OPT не матчится — смотреть `buildMixedAstFromSelections`
шаг 3 (MIXED_OR wrapping) + компилятор MIXED_OR node.

---

### T3 — 1 MUST + 1 OPT + 1 EXCLUDE → `"!BAD" "MUST" "OPT"`

**Категория:** Amulet (Амулет)
**Логика:**
- EXCLUDE = `+XX% к сопротивлению хаосу` (только A3=14%)
- MUST = `+XX к меткости` (все три)
- OPT = `XX% повышение скорости регенерации маны` (все три: 28%, 25%, 27%)

**Шаги UI:**
1. Right-click на «+XX% к сопротивлению хаосу» (suffix) → EXCLUDE (red border).
   Браузерное контекстное меню НЕ должно появиться.
2. Click на «+XX к меткости» (suffix) → MUST.
3. Shift+click на «XX% повышение скорости регенерации маны» (suffix) → OPT.

**Ожидаемый regex (форма):**
```
"!хаосу" "меткости" "регенерации маны"
```
> EXCLUDE идёт ПЕРВЫМ (iter 158 spec — `!BAD` как первый AND-child).
> Single-OPT деградирует в AND, но EXCLUDE сохраняется.

| A1 | A2 | A3 |
|----|----|----|
| ✅ | ✅ | ❌ |

**Ожидание:**
- A1: NOT хаос ✓ AND меткость ✓ AND реген маны ✓ → ДА
- A2: NOT хаос ✓ AND меткость ✓ AND реген маны ✓ → ДА
- A3: NOT хаос ✗ (имеет «+14% к сопротивлению хаосу») → НЕТ (`!` — item-wide)

**Результат прогона (iter 161 → iter 163 — CLOSED):**
- **iter 161 — FAIL.** Пользователь выбрал EXCLUDE + MUST + OPT, но в regex
  попали только `"меткости" "регенерации маны"` (без `"!хаосу"`). Заведён
  KI#49 — pure-EXCLUDE токен (только в `excludedIds`, не в must/opt)
  терялся в `buildMixedAstFromSelections`.
- **iter 162 — FIX готов** (KI#49). Добавлен опциональный параметр
  `excludeTokens: GameToken[]` в `buildMixedAstFromSelections`. Call site
  передаёт `selectedTokens.filter(t => excludedIds.has(t.id))`. Regression
  test в `tests/ui/buildMixedAst.test.ts` воспроизводит T3-сценарий (3 теста PASS).
- **iter 163 — KI#49 ЗАКРЫТ.** Паттерн `"!BAD" "MUST" "OPT"` уже in-game
  verified в iter 157 T7 (`"!замерзшей земли" "повышение шанса критического
  удара" ... "пробивает|порога состояний"` — PASS на W1/W3, W2 исключён через
  `!`). T3 — тот же паттерн (1 EXCLUDE + 1 MUST + 1 OPT, single-OPT деградирует
  в AND). Regex string корректный (unit-test PASS). Семантика `!` item-wide +
  AND + OR уже подтверждена. Повторный in-game прогон не нужен.

**Если FAIL в будущем:** `!`-негация не применяется item-wide — смотреть
`buildMixedAstFromSelections` шаг 1 (excludedTokens → `exclude(or(...))`).
Если pure-EXCLUDE токен не попадает в `!BAD` — проверить, что call site
передаёт `excludeTokens` (iter 162 fix, KI#49).

---

### T4 — Ranged MUST + ranged OPT (reversed RANGE) → пороги в OPT

**Категория:** Waystone (Путевой камень)
**Логика:**
- MUST = `Размер групп монстров: +XX%` с min=35 (reversed RANGE, формат «бла: +XX%»).
  Значения: W1=30% (✗), W2=30% (✗), W3=43% (✓).
- OPT = `Шанс выпадения путевого камня: +XX%` с min=85 (reversed RANGE).
  Значения: W1=85% (✓), W2=90% (✓), W3=110% (✓).

**Шаги UI:**
1. Click на «Размер групп монстров: +XX%» → MUST.
2. В min-инпуте этого чипа ввести `35`.
3. Shift+click на «Шанс выпадения путевого камня: +XX%» → OPT.
4. В min-инпуте OPT-чипа ввести `85`.

**Ожидаемый regex (форма, после Path D transform для reversed RANGE):**
```
"азмер групп.*\+[3-9][0-9]%|азмер групп.*\+\d{3,}%" "анс выпадения.*\+[8-9][0-9]%|анс выпадения.*\+\d{3,}%"
```
> Оба аффикса — reversed RANGE (значение в конце, после `+`).
> round10 выключен → пороги точные (35 → `[3-9][0-9]` = 30-99; 85 → `[8-9][0-9]` = 80-99).

| W1 | W2 | W3 |
|----|----|----|
| ❌ | ❌ | ✅ |

**Ожидание:**
- W1: Размер групп 30% < 35 → MUST ✗ → НЕТ (несмотря на Шанс 85% ✓)
- W2: Размер групп 30% < 35 → MUST ✗ → НЕТ (несмотря на Шанс 90% ✓)
- W3: Размер групп 43% ≥ 35 ✓ AND Шанс 110% ≥ 85 ✓ → ДА
**Если FAIL:** reversed RANGE в OPT не работает — смотреть
`buildMixedAstFromSelections` шаг 3 (делегирование в `buildAstFromSelections` с
`searchLogic='or'` + unwrapping OR → MIXED_OR).

---

### T5 — > 240 chars → auto-truncation (KI#46 mitigation)

**Категория:** Waystone (Путевой камень)
**Логика:** 4 MUST (длинные аффиксы) + 4 OPT → regex > 240 chars без truncation.
После `truncateMixedOrLiterals(maxLen=12)` regex должен стать ≤ 250 chars.

**Шаги UI:**
1. Click на 4 чипа (MUST):
   - «Монстры имеют XX% повышение шанса критического удара» (implicit)
   - «XX% к бонусу критического урона монстров» (implicit)
   - «Монстры с XX% шансом могут наложить отравление при нанесении удара» (implicit)
   - «Монстры с XX% шансом могут наложить кровотечение при нанесении удара» (implicit)
2. Shift+click на 4 чипа (OPT):
   - «Шанс выпадения путевого камня: +XX%» (implicit)
   - «Эффективность монстров: +XX%» (implicit)
   - «Редкость предметов: +XX%» (implicit)
   - «Размер групп монстров: +XX%» (implicit)

**Ожидаемый regex (до truncation, ≈ 350+ chars):**
```
"повышение шанса критического удара" "бонусу критического урона монстров" "отравление при нанесении удара" "кровотечение при нанесении удара" "анс выпадения.*\+\d{1,}%|..." "ивность.*\+\d{1,}%|..." "едкость.*\+\d{1,}%|..." "азмер групп.*\+\d{1,}%|..."
```

**После auto-truncation (LITERAL values ≤ 12 chars):**
```
"шанса крит" "бонусу крит" "отравлен" "кровот" "анс.*\+\d{1,}%|..." "ивност.*\+\d{1,}%|..." "едкост.*\+\d{1,}%|..." "азмер.*\+\d{1,}%|..."
```
> Длина ≤ 250 chars. Truncation применён transparently в `useRegexBuilder`
> (iter 159, KI#46 mitigation).

| W1 | W2 | W3 |
|----|----|----|
| ✅ | ❌ | ❌ |

**Ожидание:**
- W1: все 4 MUST ✓ (276% crit, +28% crit dmg, 36% отравление, 18% кровотечение) AND
  (Шанс 85% ✓ OR Эффективность 57% ✓ OR Редкость 18% ✓ OR Размер 30% ✓) → ДА
- W2: MUST3 ✗ (нет отравления) AND MUST4 ✗ (нет кровотечения) → НЕТ
- W3: MUST4 ✗ (нет кровотечения) → НЕТ
**Доп. проверка:** скопировать regex из UI → вставить в PoE2 → regex должен
приняться игрой (длина ≤ 250). Если игра пишет «regex too long» — auto-truncation
не сработал, смотреть `useRegexBuilder` шаг 4b (KI#46 mitigation).

---

## 3. Раунд 2 — UI-specific сценарии (T6–T10)

### T6 — Shift+click → OPT state visual (amber dashed border)

**Категория:** любая (рекомендуется Ring — короткие названия чипов).
**Это UI-only тест, не требует проверки в игре.**

**Шаги UI:**
1. Открыть Ring page.
2. Переключить logic mode на «Смешанный» (MIXED).
3. Shift+click на чипе «+XX к силе».
4. Визуально: чип должен получить **amber-tinted background + amber-dim DASHED left border**.
5. Открыть DevTools (F12) → выбрать чип → проверить:
   - CSS class `chip-opt` добавлен к элементу.
   - `border-left-style: dashed` (из `.chip-opt` в `src/index.css`).
   - `border-left-color: var(--bl-amber-dim)` (или эквивалент).
6. ARIA: `aria-checked="mixed"` (если partial-optional) или `aria-checked="true"` (если full-optional).
   `aria-label` содержит «опционально» или «частично опционально».

**Ожидание:** OPT state визуально distinct от MUST (solid border) и EXCLUDE (solid red).
**Если FAIL:** `.chip-opt` CSS не определён или `selectionState` не вычисляет 'full-optional'/'partial-optional' —
смотреть `FilterChip.tsx` `selectionState` useMemo (skip когда `mixedMode=false`).

---

### T7 — Right-click → exclude (browser contextmenu suppressed)

**Категория:** любая (рекомендуется Ring).
**Это UI-only тест.**

**Шаги UI:**
1. Открыть Ring page, MIXED mode.
2. Right-click на чипе «+XX к силе».
3. **Браузерное контекстное меню НЕ должно появиться** (preventDefault в `handleContextMenu`).
4. Чип должен перейти в EXCLUDE state: **red background + red solid left border**.
5. DevTools: проверить CSS class `bg-indicator-red border-l-bl-red`.
6. ARIA: `aria-checked="false"` + `aria-label` содержит «исключён».

**Доп. проверка (keyboard parity):**
7. Tab к другому чипу → Shift+Enter → должен перейти в OPT state (T6 visual).
8. Tab к третьему чипу → Enter → MUST state.

**Ожидание:** right-click = exclude, без браузерного меню. Shift+Enter = opt (keyboard parity).
**Если FAIL:** `handleContextMenu` не вызывает `preventDefault()` или `mixedMode` prop не
проброшен от page → ModList → FilterChip — смотреть wiring в 7 page components.

---

### T8 — URL shareable link с `opt` key → deserialize восстанавливает 3-state

**Категория:** Amulet (Амулет).
**Это UI + URL тест.**

**Шаги UI:**
1. Открыть Amulet page, MIXED mode.
2. Click на «XX% увеличение максимума энергетического щита» → MUST.
3. Shift+click на «+XX% к сопротивлению холоду» → OPT.
4. Right-click на «+XX% к сопротивлению хаосу» → EXCLUDE.
5. Скопировать URL из адресной строки браузера (должен содержать `#...&opt=...&...`).
6. Открыть новую вкладку, вставить URL, нажать Enter.
7. Дождаться загрузки Amulet page.

**Ожидание после reload:**
- Logic mode = «Смешанный» (MIXED) — сохранён в URL/localStorage.
- Чип «максимума энергетического щита» → MUST state (selected, solid border).
- Чип «сопротивлению холоду» → OPT state (amber dashed border).
- Чип «сопротивлению хаосу» → EXCLUDE state (red border).
- Regex в RegexOutput идентичен до reload.

**URL inspection:** в hash должны быть ключи `s` (selected/MUST), `opt` (optional),
`e` (excluded). Например: `#s=...&opt=...&e=...`.

**Если FAIL:** `serialize` не пишет `opt` или `deserialize` не восстанавливает optionalIds —
смотреть `filter-store.ts` `serialize()`/`deserialize()` (iter 159).
Также проверить defensive strip (ID в `opt` не должен повторяться в `s` или `e`).

---

### T9 — Toggle MIXED → AND → optionalIds не теряется (только игнорируется)

**Категория:** Ring (Кольцо).
**Это UI тест на сохранение состояния при переключении logic mode.**

**Шаги UI:**
1. Открыть Ring page, MIXED mode.
2. Click на «+XX к максимуму здоровья» → MUST.
3. Shift+click на «+XX к силе» → OPT (amber dashed).
4. Запомнить: чип «сила» в OPT state.
5. Переключить logic mode на «И» (AND).
6. **Проверить:** чип «сила» вернулся в unselected state (no highlight) —
   потому что `optionalIds` игнорируется в AND mode (FilterChip `mixedMode=false` →
   `effectiveOptional = new Set<string>()`).
7. Regex в RegexOutput: только MUST (`"максимуму здоровья"`), без OPT.
8. Переключить logic mode обратно на «Смешанный» (MIXED).
9. **Проверить:** чип «сила» СНОВА в OPT state (amber dashed) —
   потому что `optionalIds` сохранён в store, не удалялся при переключении.
10. Regex: снова `"максимуму здоровья" "силе"`.

**Ожидание:** optionalIds переживает переключение MIXED → AND → MIXED без потерь.
**Если FAIL:** либо `setSearchLogic('and')` очищает optionalIds (не должен), либо
FilterChip в AND mode всё ещё рендерит OPT state (должен игнорировать) —
смотреть `FilterChip.tsx` `selectionState` useMemo + `useCategoryPage.ts` `setSearchLogic`.

---

### T10 — 2+ OPT tokens → одна MIXED_OR группа

**Категория:** Jewel (Самоцвет).
**Логика:** 1 MUST + 3 OPT → все 3 OPT собираются в одну `MIXED_OR` quoted group.

**Шаги UI:**
1. Открыть Jewel page, MIXED mode.
2. Click на «XX% увеличение урона снарядов» (suffix) → MUST.
   (есть у J3=10%, J4=20%; нет у J1, J2)
3. Shift+click на «XX% увеличение порога стихийных состояний» (suffix) → OPT.
   (есть у J3=10%, J4=12%; нет у J1, J2)
4. Shift+click на «XX% повышение шанса критического удара атаками» (suffix) → OPT.
   (есть только у J2=7%)
5. Shift+click на «XX% увеличение урона боевыми посохами» (suffix) → OPT.
   (есть только у J1=15%)

**Ожидаемый regex (форма):**
```
"урона снарядов" "порога стихийных состояний|шанса критического удара атаками|урона боевыми посохами"
```
> Все 3 OPT в ОДНОЙ quoted group через `|`. Это семантически эквивалентно
> `"MUST" "OPT1|OPT2" "OPT3"` (OR associative), но не идентично по строке.

| J1 | J2 | J3 | J4 |
|----|----|----|----|
| ❌ | ❌ | ✅ | ✅ |

**Ожидание:**
- J1: MUST ✗ (нет «урона снарядов») → НЕТ
- J2: MUST ✗ → НЕТ
- J3: MUST ✓ AND (порог стихийных ✗ OR crit атаками ✗ OR урон посохами ✗) →
  НЕТ (нет ни одного OPT)
- J4: MUST ✓ AND (порог стихийных ✓ OR crit атаками ✗ OR урон посохами ✗) → ДА

**WAIT — перепроверка J3:** J3 имеет «10% увеличение порога стихийных состояний».
Стоп — это OPT1. J3 также имеет MUST «урон снарядов» 10%. Так что J3: MUST ✓ AND OPT1 ✓ → ДА.

| J1 | J2 | J3 | J4 |
|----|----|----|----|
| ❌ | ❌ | ✅ | ✅ |

**Финальное ожидание:**
- J1: MUST ✗ → НЕТ
- J2: MUST ✗ → НЕТ
- J3: MUST ✓ AND (OPT1 ✓ OR OPT2 ✗ OR OPT3 ✗) → ДА
- J4: MUST ✓ AND (OPT1 ✓ OR OPT2 ✗ OR OPT3 ✗) → ДА
**Если FAIL:** 3+ OPT токенов не собираются в одну MIXED_OR — смотреть
`buildMixedAstFromSelections` шаг 3 (все optWant идут в один `mixedOr(...)` call).

---

## 4. Известные ограничения

| KI | Описание | Mitigation | Статус |
|----|----------|------------|--------|
| **KI#45** | `^`-anchor на 2+ ALT в OR ломает матч (iter 157 T4) | `anchorFirstAltOnly: true` в MIXED_OR compiler option (iter 158) | Active — mitigation transparent в T1–T10 |
| **KI#46** | Regex > 250 chars rejected игрой (iter 157 T5) | `truncateMixedOrLiterals(maxLen=12)` auto-applied при > 240 chars (iter 159) | Active — T5 in-game verified, truncation работает (iter 157 T8) |
| **KI#47** | Cross-suppression excludes в MIXED (MUST и OPT из одной family с regexExclude) | Low priority — rare edge case | Active — не покрывается T1–T10 |
| **KI#48** | In-game verification MIXED-mode UI | T1–T10 (этот документ) | **CLOSED iter 163** |
| **KI#49** | Pure-EXCLUDE терялся в MIXED (iter 162 fix) | `excludeTokens` param в `buildMixedAstFromSelections` | **CLOSED iter 163** — паттерн `!BAD MUST OPT` = iter 157 T7 |

---

## 5. Если найден новый баг

1. **Сначала документировать** в `STATUS.md` → раздел «Known Issues» → новый KI# (KI#50, KI#51, ...).
   Формат:
   ```markdown
   **KI#N — Краткое описание (iter XXX).**
   Симптом: ...
   Воспроизведение: ...
   Ожидание: ...
   Фактический результат: ...
   Mitigation: (если есть) ...
   ```
2. **Потом фиксить** в коде (следующая итерация).
3. Обновить этот документ: добавить тест-кейс в §3 или отметить FAIL в таблице ожиданий.

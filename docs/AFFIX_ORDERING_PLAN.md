# План систематической сортировки аффиксов внутри блоков

> **iter 112** — внедрена инфраструктура + правила для 4 блоков.
> **iter 113** — добавлены правила для `damage-type` (47 family-keys).
> **iter 114** — добавлены правила для `defence-stats` (28 family-keys).
> **iter 115** — добавлены правила для `resources` (29 family-keys).
> **iter 116** — добавлены правила для `weapon-specific` (24 family-keys) + `flasks` (16 family-keys).
> **Следующие итерации** — расширение на остальные functional blocks.

---

## 1. Контекст и проблема

iter 99 ввёл алфавитную within-block сортировку (`sortGroupsAlphabetically`) — familyKey в Russian locale с tier как tiebreaker. Это улучшило readability, но создало проблему:

**Алфавитный порядок НЕ совпадает с ментальной моделью игрока.**

Примеры из user-feedback iter 112:

| Блок | Алфавитный порядок | Желаемый порядок |
|------|--------------------|------------------|
| `resistances` | молния → огонь → хаос → холод | хаос → молния → холод → огонь |
| `minions` | max-health-comp → Companion-damage → Minion-health → Minion-damage | Companion: health → damage; Minion: health → damage |
| `ailments` | «увеличение силы» и «увеличение шанса» чередуются | «увеличение силы» блоком, затем «увеличение шанса» блоком |

**Причина:** алфавит в русском locale сортирует по первой букве слова. Но игроки мыслят категориями: «сначала хаос-резист (самый редкий), потом стихии в порядке убывания важности». Или «сначала здоровье (defensive), потом урон (offensive)».

---

## 2. Архитектура решения (iter 112)

### 2.1. Новое поле `FamilyGroup.sortKey`

```typescript
// src/shared/types.ts
export interface FamilyGroup {
  // ... existing fields ...
  /** iter 112: canonical within-block sort key.
   *  Format: "<3-digit order>::<familyKey>".
   *  Computed by computeSortKey() in src/shared/block-sort-rules.ts. */
  sortKey?: string;
}
```

### 2.2. Per-block ordering rules

```typescript
// src/shared/block-sort-rules.ts
export interface SortRule {
  pattern: RegExp;   // case-insensitive, matched against familyKey
  order: number;     // primary sort position (0-first, 999-fallback)
  comment?: string;  // human-readable explanation
}

export const BLOCK_SORT_RULES: Partial<Record<FunctionalBlock, SortRule[]>> = {
  resistances: [...],
  attributes:  [...],
  minions:     [...],
  ailments:    [...],
  // Other blocks: empty array → fallback to alphabetical
};
```

### 2.3. `computeSortKey()` algorithm

```typescript
export function computeSortKey(block, familyKey): string {
  const rules = BLOCK_SORT_RULES[block];
  if (!rules || rules.length === 0) return `999::${familyKey}`;  // no rules → alpha
  for (const rule of rules) {
    if (rule.pattern.test(familyKey)) {
      return String(rule.order).padStart(3, '0') + '::' + familyKey;
    }
  }
  return `900::${familyKey}`;  // rules exist but no match — for future iteration
}
```

### 2.4. Sort integration

`sortGroupsAlphabetically()` в `src/shared/mod-classifier.ts`:

1. Если у обоих групп есть `sortKey` → PRIMARY sort по `sortKey.localeCompare('ru')`.
2. Если `sortKey` отсутствует (legacy/test) → fallback к familyKey alphabetical (pre-iter-112 behaviour).
3. Tiebreaker: priorityTier (S→A→B→C).

`sortGroupsByTierFirst()` НЕ использует sortKey — это сознательный выбор пользователя (tier-first mode).

### 2.5. Production path

`groupTokensByFamily()` → `buildFamilyGroup()` → `computeSortKey(members[0].functionalCategory, familyKey)` → `group.sortKey` установлено.

`splitGroupByOrigin()` → `buildFamilyGroup()` вызывается с CLEAN familyKey (без `::origin`) → sortKey корректный для всех origin-вариантов.

---

## 3. Принципы дизайна правил

1. **First-match-wins** — правила упорядочены от MOST-SPECIFIC к LEAST-SPECIFIC.
   - Пример: в `resistances` passive-tree rules (с «значимые пассивные умения») идут ПЕРЕД single-element rules, потому что passive-tree family-keys заканчиваются тем же «к сопротивлению X».

2. **Case-insensitive** — все regex имеют флаг `i`.

3. **Morphology-aware** — Russian имеет 6 падежей. Использовать stems:
   - `скорост` (вместо `скорость` / `скорости`)
   - `накладыва` (вместо `накладываемого` / `накладывать` / `накладывает`)
   - `сопротивлен` (вместо `сопротивлению` / `сопротивления` / `сопротивлением`)

4. **Word-order-agnostic** — family-keys имеют разный порядок слов:
   - «Приспешники имеют #% увеличение урона»
   - «#% увеличение бонуса к критическому урону приспешников»
   - Использовать alternation: `(приспешников.*критическому урону|критическому урону приспешников)`.

5. **Anchor at end (`$`)** для single-element правил — иначе «+#% к сопротивлению огню» matches и для dual-element «+#% к сопротивлениям огню и хаосу».

6. **Numeric order = bucket position**:
   - 0-99: основной bucket (e.g., single-element regular resists)
   - 100-199: sub-bucket (e.g., dual-element)
   - 200-299: sub-bucket (e.g., all-elements)
   - …
   - 900: «rules exist but no match» — для будущего расширения
   - 999: «no rules for this block» — fallback к алфавиту

---

## 4. Текущее покрытие (iter 116)

### 4.1. Блоки с правилами (9 из 20 functional blocks)

| Блок | # family-keys | # rules | Покрытие |
|------|---------------|---------|----------|
| `resistances` | 18 | 18 | 100% |
| `attributes` | 13 | 13 | 100% |
| `minions` | 34 | 34 | 100% |
| `ailments` | 40 | 40 | 100% |
| `damage-type` | 47 | 47 | 100% |
| `defence-stats` | 28 | 28 | 100% |
| `resources` | 29 | 29 | 100% |
| `weapon-specific` | 24 | 24 | 100% |
| `flasks` | 16 | 16 | 100% |
| **Итого** | **249** | **249** | **100%** |

Скрипт аудита: `python3 scripts/audit_block_sort_coverage.py`

### 4.2. Блоки БЕЗ правил (11 из 20)

Возвращают `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).

| Блок | # family-keys | Приоритет iter 117+ |
|------|---------------|---------------------|
| `other` | 27 | LOW (heterogeneous — сложно систематизировать) |
| `offence-speed` | 12 | HIGH (видимый блок) |
| `skill-levels` | 10 | MEDIUM |
| `crit` | 9 | HIGH (видимый блок, §5.4) |
| `area-duration` | 8 | LOW |
| `buff-skills` | 7 | MEDIUM (§5.6) |
| `meta-skills` | 6 | LOW |
| `runes-barrier` | 4 | LOW |
| `rage-charges` | 4 | LOW |
| `penetration` | 3 | LOW |
| `magic-find` | 1 | LOW |
| `breach` | 1 | LOW (только 1 token: Знак повелителя Бездны) |
| `spirit` | 1 | LOW (только 1 token) |
| `wisps` | 0 | N/A |
| `conversion` | 0 | N/A |

**Примечание:** counts приведены для jewellery-only scope (6 файлов: amulet/ring/belt/jewel/jewel-desecrated/jewel-corrupted) — это scope скрипта `audit_block_sort_coverage.py`. Для full-scope (10 файлов, с relic/tablet/waystone) блок `other` содержит 201 family-key, остальные блоки не меняются.

---

## 5. Канонические порядки (реализованные и для будущих итераций)

Ниже — canonical orderings для functional blocks. §5.1, §5.2, §5.5, §5.7, §5.8 — РЕАЛИЗОВАНЫ (iter 113–116). §5.3, §5.4, §5.6 — предложения для iter 117+, не реализованы, задокументированы для планирования.

### 5.1. `damage-type` — РЕАЛИЗОВАН в iter 113 (47 family-keys)

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['damage-type']`:

```
0-9:    Физический (global %, added to attacks, thorns flat)
10-19:  Огонь (увеличение, added to attacks, насыщение, конверсия, thorns-per-100-HP)
20-29:  Холод (увеличение, added to attacks, насыщение, phys→cold conversion, conversion)
30-39:  Молния (увеличение, added to attacks, насыщение, конверсия)
40-49:  Хаос (увеличение, конверсия в хаос)
50-59:  Стихийный / насыщения (увеличение, max-насыщений, saturation preservation mechanic)
60-79:  Generic + by-source damage types (bare, атаки, чары, снаряды, melee,
        тотемы, кличи, растения, ловушки, помехи, шипы, улучшенные атаки,
        срабатывающие чары, вестники)
80-89:  Условный (low-HP, full-ES, transformed, corpse, melee-if-proj, proj-if-melee)
90-99:  По мишени (редкие/уникальные враги)
100-109: Special (Проколы, элементальные недуги, Анемия, оскверненная кровь)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'damage-type':`).

### 5.2. `defence-stats` — РЕАЛИЗОВАН в iter 114 (28 family-keys)

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['defence-stats']`:

```
0-9:    Броня (flat 0, % 1, from-body 2, shield-triple 3, global-triple 4)
10-19:  Уклонение (flat 10, % 11, from-body 12)
20-29:  Энергетический щит (from-body 20, from-focus 21, recharge-speed 22, recharge-start 23)
30-39:  Блок (% шанс 30)
40-49:  Порог оглушения (flat 40, % 41, conditional-recent 42, conditional-parry 43)
50-59:  Отклонение (% 50)
60-69:  Обереги (duration 60, charges-gained 61, charges-used-reduction 62,
        conditional-slow 63, free-use 64, regen 65, ward-active-damage 66)
70-79:  Разрушение брони (duration 70, quantity 71, damage-vs-broken 72)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'defence-stats':`).

### 5.3. `offence-speed` (12 family-keys)
```
0:  Скорость атаки
10: Скорость сотворения чар
20: Скорость передвижения
30: Скорость снарядов
40: Скорость перезарядки самострела
50: Скорость применения боевых кличей
60: Скорость броска ловушки
70: Скорость установки тотемов
80: Скорость смены оружия
90: Скорость умений (generic / transformed)
```

### 5.4. `crit` (9 family-keys)
```
0-9:   Шанс критического удара (generic)
10-19: Шанс критического удара атаками
20-29: Шанс критического удара для чар
30-39: Шанс критического удара шипами
40-49: Бонус к критическому урону (generic, от чар, для атак)
50-59: +%(flat) к бонусу критического урона (атаками, шипами)
60-69: +(#)% к шансу критического удара чар огня
70-79: Силы состояний от критических ударов
```

### 5.5. `resources` — РЕАЛИЗОВАН в iter 115 (29 family-keys)

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['resources']`:

```
0-9:    Здоровье (10 keys: flat max 0, % max 1, flat regen 2, % regen 3,
        leech generic 4, leech phys 5, recovery generic 6, recovery fire 7,
        on-kill % 8, per-kill flat 9)
10-19:  Мана (9 keys: flat max 10, % max 11, % regen 12, leech generic 13,
        recovery 14, leech phys 15, on-kill % 16, per-kill flat 17,
        cost efficiency 18)
20-29:  Энергетический щит (4 keys: flat max 20, % max 21,
        ES→stun threshold 22, ES→ailment threshold 23)
30-39:  Конверсия урона (3 keys: MoM 30, mana-cost→health 31, mana→armour 32)
40-49:  Тотем (1 key: здоровье тотема 40)
50-59:  Прочее (2 keys: радиус обзора 50, Hexblast skill effect 51)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'resources':`).

**Важные корректировки плана** (vs первичной оценки в iter 112):
- Фактически 29 family-keys, а не 33 как планировалось — план завышал.
- ES bucket объединён с ES→threshold conversions (4 keys вместо отдельных bucketов).
- Добавлен Other bucket для не-ресурсных mods (радиус обзора, Hexblast effect).
- Health и Mana buckets параллельны по 8 stat-типов, Мана имеет дополнительный cost-efficiency.

### 5.6. `buff-skills` (7 family-keys)
```
0:  Ауры (сила умений аур)
10: Вестники (эффективность удержания)
20: Проклятия (сила, скорость активации)
30: Знамёна (длительность)
40: Кличи (усиление положительного эффекта, скорость применения)
50: Метки (усиление эффекта, скорость сотворения)
```

### 5.7. `weapon-specific` — РЕАЛИЗОВАН в iter 116 (24 family-keys)

Все family-keys — jewel-only. Группировка по типу оружия × stat (damage/speed/crit/gauge/accuracy).

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['weapon-specific']`:

```
0-9:    Мечи (Swords)             — damage 0, attack-speed 1
10-19:  Топоры (Axes)             — damage 10, attack-speed 11
20-29:  Булавы (Maces)            — damage 20, stun-gauge 21
30-39:  Боевые посохи (Warstaves) — damage 30, attack-speed 31, freeze-gauge 32
40-49:  Кинжалы (Daggers)         — damage 40, attack-speed 41, crit-chance 42
50-59:  Копья (Spears)            — damage 50, attack-speed 51, crit-damage 52
60-69:  Кистени (Flails)          — damage 60, crit-chance 61
70-79:  Луки (Bows)               — damage 70, attack-speed 71, accuracy 72
80-89:  Самострелы (Crossbows)    — damage 80, attack-speed 81
90-99:  Без оружия (Unarmed)      — damage 90, attack-speed 91
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'weapon-specific':`).

**Корректировки плана** (vs первичной оценки в §5.7 plan):
- Фактически 24 family-keys (совпадает с планом).
- Swords не имеют crit в данных (план предполагал crit-chance).
- Maces имеют stun-gauge (план предполагал freeze-gauge — неверно).
- Кистени не имеют attack-speed в данных (план предполагал attack-speed).
- Самострелы не имеют reload в данных (план предполагал reload).
- Дополнительно: «Без оружия» имеет damage wording «атаками без оружия» (с «атаками»), отличающийся от других weapons.

### 5.8. `flasks` — РЕАЛИЗОВАН в iter 116 (16 family-keys)

Группировка: RESOURCE TYPE (Health/Mana/Any) × MECHANIC (recovery-speed, recovery-amount, charges-gained, regen, duration, keep-charges, buffs).

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['flasks']`:

```
0-9:    Health flask (5 keys: recovery-speed 0, recovery-amount 1,
        charges-gained 2, regen-during-effect 3, regen-per-sec 4)
10-19:  Mana flask (4 keys: recovery-speed 10, recovery-amount 11,
        charges-gained 12, regen-per-sec 13)
20-29:  Any flask (5 keys: duration 20, charges-gained 21,
        charges-used-reduction 22, keep-charges 23, regen-per-sec 24)
30-39:  Flask buffs (2 keys: cast-speed 30, spell-damage 31)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'flasks':`).

**Корректировки плана** (vs первичной оценки в §5.8 plan):
- **Resource-first bucketing** (vs plan's mechanic-first bucketing) — каждый resource (Health/Mana/Any) имеет parallel stat-типы. План «Passive regen» bucket разрезал бы parallel структуру.
- Health flask имеет 5 keys (план говорил 4) — добавлен regen-during-effect (`#% увеличение регенерации здоровья во время действия эффекта любого флакона здоровья`).
- Mana flask имеет 4 keys (план говорил 4) — нет regen-during-effect для mana в данных.
- Any flask имеет 5 keys (план говорил 4) — добавлен regen-per-sec (`Флаконы получают зарядов в секунду: #`).
- Flask buffs — 2 keys (план говорил 2) ✓.

---

## 6. Тестирование

### 6.1. Unit tests (`tests/shared/block-sort-rules.test.ts`)

- `computeSortKey()` для каждого canonical family-key (249 cases — 24 weapon-specific + 16 flasks + 29 resources + 28 defence-stats + 47 damage-type + 105 iter 112).
- `sortGroupsAlphabetically()` использует sortKey когда set.
- `sortGroupsAlphabetically()` fallback к familyKey когда sortKey отсутствует (backward compat).
- End-to-end: `groupTokensByFamily()` → `classifyGroups()` → `sortGroupsAlphabetically()` — проверяет канонический порядок.
- Structural integrity: все regex case-insensitive, все orders в диапазоне 0-999, iter 116 scope = 9 блоков.

### 6.2. Audit script (`scripts/audit_block_sort_coverage.py`)

Запускать после каждого изменения `BLOCK_SORT_RULES`:

```bash
python3 scripts/audit_block_sort_coverage.py
```

Выводит список family-keys, которые попадают в `900::` bucket (rules exist but no match). Цель — 0 uncovered family-keys в каждом блоке с правилами.

### 6.3. Regression tests (`tests/etl/cross-validation.test.ts`)

iter 112 добавил 2 теста для regex-бага:
- `no token has range-like regexPrefixContext` — сканирует все 10 JSON на наличие range-like context.
- `jewel-desecrated.mod_3yl2ru has no range context` — точечная проверка исправленного бага.

---

## 7. Ключевые файлы

| Файл | Назначение |
|------|------------|
| `src/shared/block-sort-rules.ts` | Per-block ordering rules + `computeSortKey()` (9 блоков) |
| `src/shared/types.ts` | `FamilyGroup.sortKey?: string` |
| `src/shared/family-grouper.ts` | `buildFamilyGroup()` вычисляет sortKey |
| `src/shared/mod-classifier.ts` | `sortGroupsAlphabetically()` использует sortKey |
| `tests/shared/block-sort-rules.test.ts` | unit + e2e тесты (249 case-tests + relationship + E2E) |
| `scripts/audit_block_sort_coverage.py` | Audit script для coverage (9 блоков) |
| `scripts/etl/iterative-optimizer.ts` | iter 112 fix: `tryAddContextForShortRegex` filter (≥3 letters) |
| `public/generated/jewel-desecrated.json` | iter 112 fix: `mod_3yl2ru` regexPrefixContext удалён |
| `tests/etl/cross-validation.test.ts` | iter 112 regression tests (2 новых) |

---

## 8. Точка остановки iter 116 → iter 117

**Сделано в iter 116:**
1. ✅ `weapon-specific` block — 24 family-keys, 100% coverage. Canonical order: Мечи → Топоры → Булавы → Боевые посохи → Кинжалы → Копья → Кистени → Луки → Самострелы → Без оружия (10 weapon buckets).
2. ✅ `flasks` block — 16 family-keys, 100% coverage. Canonical order: Health flask → Mana flask → Any flask → Flask buffs (4 resource buckets).
3. ✅ Audit script обновлён — проверяет 9 блоков (resistances/attributes/minions/ailments/damage-type/defence-stats/resources/weapon-specific/flasks, 249 family-keys total).
4. ✅ 53 новых unit/relationship/E2E теста — все green (1774/1774 total).
5. ✅ Документация — STATUS.md, AFFIX_ORDERING_PLAN.md (этот файл), worklog.md, AGENT_NAVIGATION.md.

**Корректировки плана в iter 116:**
- `weapon-specific`: 24 family-keys (совпадает с планом §5.7).
- `weapon-specific` sword has no crit (план предполагал) — нет в данных.
- `weapon-specific` maces имеют stun-gauge, не freeze-gauge (план был неточен).
- `weapon-specific` кистени не имеют attack-speed (план был неточен).
- `weapon-specific` самострелы не имеют reload (план был неточен).
- `flasks`: 16 family-keys ✓ (совпадает с iter 115 корректировкой).
- `flasks`: **resource-first bucketing** вместо mechanic-first (план §5.8 был неточен) — Health/Mana/Any параллельны по stat-типам, что делает resource-first более чистым.
- `flasks`: Health flask имеет 5 keys (план говорил 4) — добавлен regen-during-effect.
- `flasks`: Any flask имеет 5 keys (план говорил 4) — добавлен regen-per-sec.

**НЕ сделано (переносится в iter 117+):**

1. **Добавить правила для 11 functional blocks без правил** (см. §4.2).
   - Приоритет: `offence-speed` (12, §5.3), `crit` (9, §5.4), `buff-skills` (7, §5.6).
   - Канонические порядки предложены в §5.3, §5.4, §5.6.

2. **Визуальная верификация пользователем** (из iter 111 — НЕ СДЕЛАНО, переносится дальше):
   - UI в браузере: контрасты, читаемость 12px, рендеринг Noto Sans (Linux).
   - Особое внимание: affix ordering в resistances/attributes/minions/ailments + damage-type + defence-stats + resources + **NEW iter 116: weapon-specific + flasks** — проверить, что канонический порядок выглядит правильно визуально.

3. **Опционально (iter 111 leftover):** удалить `--text-faint-val` alias и `--color-faint` из `@theme` после одного release cycle без использования `text-faint` (cleanup).

4. **При недовольстве dim-textом** (iter 111 leftover): опции (a) lift `--text-dim-val` до #8A92A2; (b) расширить `font-medium` на 8 page mod-counters; (c) принять текущее состояние.

**Подсказка следующему агенту:** iter 116 = weapon-specific (24) + flasks (16) block rules, 100% coverage each. Перед стартом iter 117 прочитай STATUS.md (актуальный статус + Known Issues #4 — 11 блоков без правил), docs/AFFIX_ORDERING_PLAN.md (полный план + канонические порядки §5.3 offence-speed + §5.4 crit + §5.6 buff-skills), worklog.md (этот раздел iter 116). Audit script: `python3 scripts/audit_block_sort_coverage.py` — показывает coverage правил для 9 активных блоков. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

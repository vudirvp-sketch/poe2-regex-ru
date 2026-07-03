# План систематической сортировки аффиксов внутри блоков

> **iter 112** — внедрена инфраструктура + правила для 4 блоков.
> **iter 113** — добавлены правила для `damage-type` (47 family-keys).
> **iter 114** — добавлены правила для `defence-stats` (28 family-keys).
> **iter 115** — добавлены правила для `resources` (29 family-keys).
> **iter 116** — добавлены правила для `weapon-specific` (24 family-keys) + `flasks` (16 family-keys).
> **iter 117** — добавлены правила для `offence-speed` (12 family-keys) + `crit` (9 family-keys) + `buff-skills` (7 family-keys).
> **iter 118** — добавлены правила для `skill-levels` (10 family-keys) + `area-duration` (8 family-keys) + `meta-skills` (6 family-keys).
> **iter 119** — добавлены правила для `rage-charges` (4 family-keys) + `runes-barrier` (4 family-keys) + `penetration` (3 family-keys). **Priority-блоки закрыты.**

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

## 4. Текущее покрытие (iter 119)

### 4.1. Блоки с правилами (18 из 24 functional blocks)

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
| `offence-speed` | 12 | 12 | 100% |
| `crit` | 9 | 9 | 100% |
| `buff-skills` | 7 | 7 | 100% |
| `skill-levels` | 10 | 10 | 100% |
| `area-duration` | 8 | 8 | 100% |
| `meta-skills` | 6 | 6 | 100% |
| `rage-charges` | 4 | 4 | 100% |
| `runes-barrier` | 4 | 4 | 100% |
| `penetration` | 3 | 3 | 100% |
| **Итого** | **312** | **312** | **100%** |

Скрипт аудита: iter 154 — `scripts/audit_block_sort_coverage.py` удалён (OP-1 закрыт iter 119, coverage 100%). Logic inlined в `tests/shared/block-sort-rules.test.ts` (312 case-tests + E2E) для regression protection.

### 4.2. Блоки БЕЗ правил (6 из 24 functional blocks)

Возвращают `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).

| Блок | # family-keys | Статус |
|------|---------------|--------|
| `other` | 27 | LOW (heterogeneous — сложно систематизировать, отложено) |
| `magic-find` | 1 | N/A (1 family-key — правила избыточны) |
| `breach` | 1 | N/A (1 family-key — Знак повелителя Бездны) |
| `spirit` | 1 | N/A (1 family-key) |
| `wisps` | 0 | N/A (пусто) |
| `conversion` | 0 | N/A (пусто) |

**Примечание:** counts приведены для jewellery-only scope (6 файлов: amulet/ring/belt/jewel/jewel-desecrated/jewel-corrupted) — это scope используемый для аудита (iter 154: standalone script удалён, logic в `tests/shared/block-sort-rules.test.ts`). Для full-scope (10 файлов, с relic/tablet/waystone) блок `other` содержит 201 family-key, остальные блоки не меняются.

**Статус priority-блоков:** iter 119 закрыл все 3 priority-блока (`rage-charges` / `runes-barrier` / `penetration`). Оставшиеся 6 блоков не требуют правил: 4 содержат 0-1 family-key (правила избыточны для одного элемента), `other` heterogeneous и отложен. **Систематическая сортировка priority-блоков завершена в iter 119.**

---

## 5. Канонические порядки (реализованные и для будущих итераций)

Ниже — canonical orderings для functional blocks. §5.1–§5.14 — РЕАЛИЗОВАНЫ (iter 113–119). Все priority-блоки закрыты в iter 119.

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

### 5.3. `offence-speed` — РЕАЛИЗОВАН в iter 117 (12 family-keys)

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['offence-speed']`:

```
0:   Скорость атаки (attack speed — most commonly modded)
10:  Скорость сотворения чар (generic spells cast speed)
11:  Скорость сотворения чар (mark skills cast speed — subset of spells)
20:  Скорость передвижения (move speed)
30:  Скорость снарядов (projectile speed)
40:  Скорость перезарядки самострела (crossbow reload)
50:  Скорость применения боевых кличей (warcry application)
60:  Скорость броска ловушки (trap throw)
70:  Скорость установки тотемов (totem placement)
80:  Скорость смены оружия (weapon swap)
90:  Скорость умений (generic skill speed)
91:  Скорость умений будучи превращенным (transformed conditional)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'offence-speed':`).

**Корректировки плана** (vs первичной оценки в §5.3 plan):
- Фактически 12 family-keys (совпадает с планом).
- Добавлен mark-skill cast speed (order 11) — subset of generic spell cast speed (10). План не упоминал.
- Добавлен transformed-conditional skill speed (order 91) — variant of generic skill speed (90). План не упоминал.
- Two substring conflicts handled via first-match-wins (most-specific FIRST):
  1. `скорости сотворения чар` — в generic cast speed И в mark-skill cast speed.
  2. `скорости умений` — в generic skill speed И в transformed-conditional.

### 5.4. `crit` — РЕАЛИЗОВАН в iter 117 (9 family-keys)

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['crit']`:

```
0:   Шанс крит. удара (generic % increase — genitive "шанса")
10:  Шанс крит. удара атаками (% increase)
20:  Шанс крит. удара для чар (% increase)
30:  Шанс крит. удара шипами (flat + — dative "шансу")
40:  Бонус к крит. урону (generic % increase — genitive "бонуса")
41:  Бонус к крит. урону от чар (% increase — spells variant)
50:  Бонус к крит. урону для атак (flat + — dative "бонусу")
60:  Шанс крит. удара чар огня (flat + — dative "шансу")
70:  Силы состояний от крит. ударов (ailment strength from crits)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'crit':`).

**Корректировки плана** (vs первичной оценки в §5.4 plan):
- Фактически 9 family-keys (совпадает с планом).
- План §5.4 buckets:
  - 0-9 generic chance ✓
  - 10-19 attacks chance ✓
  - 20-29 spells chance ✓
  - 30-39 thorns chance ✓ (только 1 key, flat +)
  - 40-49 generic/spells bonus damage ✓ (2 keys)
  - 50-59 attacks bonus damage flat ✓ (только 1 key, не "атаками/шипами" как план — шипы нет в данных)
  - 60-69 fire-spell chance flat ✓ (1 key)
  - 70-79 ailment-from-crit ✓ (1 key)
- Russian morphology disambiguates % vs flat:
  - % increase uses genitive case: `шанса`, `бонуса`.
  - + flat uses dative case (after "к"): `шансу`, `бонусу`.
- End-anchored `$` на generic variants — defensive against specific variants.

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

### 5.6. `buff-skills` — РЕАЛИЗОВАН в iter 117 (7 family-keys)

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['buff-skills']`:

```
0:   Ауры (сила умений аур — skill strength)
10:  Вестники (эффективность удержания ресурсов умениями вестниками)
20:  Проклятия (сила проклятий — strength)
21:  Проклятия (быстрее активация проклятия — activation speed)
40:  Кличи (усиление положительного эффекта боевого клича — buff effect)
41:  Кличи (скорость перезарядки боевых кличей — reload speed)
50:  Метки (усиление эффекта ваших умений меток — effect)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'buff-skills':`).

**Корректировки плана** (vs первичной оценки в §5.6 plan):
- Фактически 7 family-keys (план говорил ~7).
- **Plan §5.6 mentioned "Знамёна (длительность)" at order 30 — NO знамёна family-keys в jewellery-scope data.** Bucket 30 left empty.
- **Plan §5.6 mentioned "скорость применения" для warcries — actual data has "скорость перезарядки" (reload speed).** Order 41 used for reload.
- **Plan §5.6 mentioned "скорость сотворения" для marks — actual data has only "усиление эффекта" (effect).** Mark cast speed классифицирован в `offence-speed` block (order 11), не в `buff-skills`. Order 50 used for effect only.
- Distinctive phrases avoid substring conflicts:
  - `силы умений аур` (auras) vs `силы проклятий` (curses) — both contain "силы" but full phrases distinct.
  - `усиление положительного эффекта боевого клича` (warcries) vs `усиление эффекта.*умений меток` (marks) — different word order.
- Mark rule uses `.*` bridge: "усиление эффекта ваших умений меток" has "ваших" between "эффекта" and "умений меток".

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

### 5.9. `skill-levels` — РЕАЛИЗОВАН в iter 118 (10 family-keys)

Все gem-level / quality / skill-duration / cooldown family-keys.

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['skill-levels']`:

```
0:   +# к уровню всех камней умений (ALL skills — most universal)
10:  +# к уровню всех камней умений чар (spells)
11:  +# к уровню всех камней умений ближнего боя (melee)
12:  +# к уровню всех камней умений приспешников (minion)
13:  +# к уровню всех камней умений снарядов (projectile)
20:  +#% к качеству всех умений (quality %)
21:  +#% к максимальному качеству (quality cap)
30:  #% увеличение длительности эффекта умения (generic duration)
31:  Умения меток имеют #% увеличение длительности эффекта умения (mark subset)
40:  #% повышение скорости перезарядки умений (cooldown recovery)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'skill-levels':`).

**Корректировки плана** (vs первичной оценки):
- iter 118 — первый план канонического порядка для skill-levels (раньше не предлагался).
- Levels FIRST (most-impactful — +1 level is huge), затем Quality, Duration, Cooldown LAST.
- Within levels: all-skills FIRST (most universal), then specific subsets (spells → melee → minion → projectile).
- Two substring conflicts handled via first-match-wins (most-specific FIRST):
  1. `увеличение длительности эффекта умения` в generic duration И в mark-skill duration — mark rule (с `умения меток имеют.*` prefix) listed FIRST.
  2. `уровню всех камней умений` в 5 family-keys — generic all-skills rule end-anchored `$`, specific subset rules match their own distinctive phrase.
- `качеству` в both quality % AND max-quality % — full phrases distinct.

### 5.10. `area-duration` — РЕАЛИЗОВАН в iter 118 (8 family-keys)

Все area-of-effect и skill-duration family-keys (curses/banners/spells/etc.).

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['area-duration']`:

```
0:   #% увеличение области действия (generic area)
10:  #% увеличение области действия умений чар (spells area)
11:  #% увеличение области действия проклятий (curses area)
12:  #% увеличение области действия умений знамён (banners area)
13:  #% увеличение области действия присутствия (presence area)
20:  Улучшает радиус до очень большого (special radius-improvement mod)
30:  #% увеличение длительности проклятий (curse duration)
31:  #% увеличение длительности умений знамён (banner duration)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'area-duration':`).

**Корректировки плана** (vs первичной оценки):
- iter 118 — первый план канонического порядка для area-duration (раньше не предлагался).
- Area FIRST (more universal — affects many skills).
- Radius improvement — special mod (order 20) between area-% and duration.
- `увеличение области действия` в 5 family-keys — generic rule end-anchored `$`, specific subset rules match their own distinctive phrase.
- `проклятий` и `умений знамён` appear in BOTH area AND duration variants — no conflict because leading phrase differs (`области действия` vs `длительности`).

### 5.11. `meta-skills` — РЕАЛИЗОВАН в iter 118 (6 family-keys)

Все meta-skill-related family-keys (Archon / sealed-skills / energy). Meta-skills in PoE2 are weapon-swap skills.

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['meta-skills']`:

```
0:   Мета-умения получают увеличенное на #% количество энергии (energy amount)
1:   #% увеличение максимума энергии вызываемых умений (max energy cap)
10:  #% усиление положительных эффектов Архонта на вас (Archon buff effect)
11:  #% увеличение длительности эффекта Архонта (Archon duration)
20:  Запечатанные умения имеют +1 к максимуму зарядов печати (sealed max charges)
21:  Запечатанные умения имеют (#)% увеличение частоты получения зарядов печати (sealed frequency)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'meta-skills':`).

**Корректировки плана** (vs первичной оценки):
- iter 118 — первый план канонического порядка для meta-skills (раньше не предлагался).
- Energy FIRST (most universal — powers all meta-skills), затем Archon, затем Sealed skills.
- Archon: buff effect before duration (same pattern as buff-skills).
- Sealed skills: max charges before frequency (cap is more fundamental than gain speed).
- `энергии` в 2 family-keys — distinctive phrases (`Мета-умения получают.*количество энергии` vs `максимума энергии вызываемых умений`).
- `Архонта` в 2 family-keys — distinctive phrases (`усиление положительных эффектов Архонта` vs `длительности эффекта Архонта`).
- `зарядов печати` в 2 family-keys — distinctive phrases (`максимуму зарядов печати` vs `частоты получения зарядов печати`).

### 5.12. `rage-charges` — РЕАЛИЗОВАН в iter 119 (4 family-keys)

Все rage (Свирепость) и glory (Слава) resource family-keys. Свирепость powers warcries; Слава powers banner skills.

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['rage-charges']`:

```
0:   +# к максимуму свирепости (flat cap — most fundamental)
10:  Дарует # свирепости при нанесении удара в ближнем бою (active gain — player triggers)
11:  Дарует # свирепости при получении удара от врага (passive gain — enemy triggers)
20:  #% повышение скорости накопления славы для умений знамён (alt-resource gain speed — Слава for banners)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'rage-charges':`).

**Корректировки плана** (vs первичной оценки):
- iter 119 — первый план канонического порядка для rage-charges (раньше не предлагался).
- Cap FIRST (sets ceiling — without cap, gain is unbounded).
- Active gain (player-initiated trigger) before passive gain (enemy-initiated) — more controllable.
- Glory (Слава) gain speed LAST — different resource, used by banner skills only. Grouped here because it's also a "charge accumulation" mechanic, but visually separated via order-20 bucket.
- `свирепости` в 3 family-keys — cap rule end-anchored `$` (matches `максимуму свирепости$`), gain rules match distinctive action phrase (`в ближнем бою` vs `получении удара`).
- `славы` в 1 family-key — no conflict.

### 5.13. `runes-barrier` — РЕАЛИЗОВАН в iter 119 (4 family-keys)

Все рунический барьер (runic barrier / ward-like resource) family-keys. Mirrors `resources` block pattern: flat max → % max → regen → on-event.

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['runes-barrier']`:

```
0:   +# к максимуму рунического барьера (flat cap)
1:   #% увеличение максимума рунического барьера (% cap)
10:  #% повышение скорости регенерации рунического барьера (regen speed)
20:  Восстанавливает # рунического барьера при использовании оберега (on-ward-use recovery)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'runes-barrier':`).

**Корректировки плана** (vs первичной оценки):
- iter 119 — первый план канонического порядка для runes-barrier (раньше не предлагался).
- Cap FIRST (flat before %, same pattern as resources health/mana).
- Regen speed SECOND (passive recharge — most common mechanic).
- Conditional recovery LAST (active trigger — when using ward, situational).
- `максимуму рунического барьера` в 2 family-keys — flat rule end-anchored `$`, % rule matches distinctive phrase `увеличение максимума`.
- `рунического барьера` appears in all 4 family-keys — each rule uses its own distinctive leading phrase.
- `оберега` — only in on-ward-use family-key, no conflict.

### 5.14. `penetration` — РЕАЛИЗОВАН в iter 119 (3 family-keys)

Все elemental penetration family-keys. Mirrors resistances element order (хаос → молния → холод → огонь), но без chaos — chaos-penetration family-keys не существуют в jewellery data.

Фактический canonical order, реализованный в `BLOCK_SORT_RULES['penetration']`:

```
0:  Урон пробивает #% сопротивления молнии (lightning — mirrors resistances order 1)
1:  Урон пробивает #% сопротивления холоду (cold — mirrors resistances order 2)
2:  Урон пробивает #% сопротивления огню (fire — mirrors resistances order 3)
```

Design notes см. в `src/shared/block-sort-rules.ts` (comment block перед `'penetration':`).

**Корректировки плана** (vs первичной оценки):
- iter 119 — первый план канонического порядка для penetration (раньше не предлагался).
- Element order mirrors `resistances` block (orders 1-3 there): молния → холод → огонь. Renumbered 0-2 since chaos-penetration family-key doesn't exist.
- No substring conflicts — `пробивает.*сопротивления <element>` is fully distinctive per family-key.
- Player builds around one element typically, so each element gets its own bucket (no need for sub-buckets within penetration).

---

## 6. Тестирование

### 6.1. Unit tests (`tests/shared/block-sort-rules.test.ts`)

- `computeSortKey()` для каждого canonical family-key (312 cases — 10 skill-levels + 8 area-duration + 6 meta-skills + 12 offence-speed + 9 crit + 7 buff-skills + 24 weapon-specific + 16 flasks + 29 resources + 28 defence-stats + 47 damage-type + 105 iter 112 + 4 rage-charges + 4 runes-barrier + 3 penetration).
- `sortGroupsAlphabetically()` использует sortKey когда set.
- `sortGroupsAlphabetically()` fallback к familyKey когда sortKey отсутствует (backward compat).
- End-to-end: `groupTokensByFamily()` → `classifyGroups()` → `sortGroupsAlphabetically()` — проверяет канонический порядок.
- Structural integrity: все regex case-insensitive, все orders в диапазоне 0-999, iter 119 scope = 18 блоков.

### 6.2. Audit (iter 154: standalone script удалён — logic в `tests/shared/block-sort-rules.test.ts`)

Раньше использовался `scripts/audit_block_sort_coverage.py` (iter 154: удалён, OP-1 закрыт iter 119). Regression protection теперь обеспечивается unit-тестом `tests/shared/block-sort-rules.test.ts` (312 case-tests + E2E). При изменении `BLOCK_SORT_RULES` — запусти `pnpm test tests/shared/block-sort-rules.test.ts` для верификации coverage.

### 6.3. Regression tests (`tests/etl/cross-validation.test.ts`)

iter 112 добавил 2 теста для regex-бага:
- `no token has range-like regexPrefixContext` — сканирует все 10 JSON на наличие range-like context.
- `jewel-desecrated.mod_3yl2ru has no range context` — точечная проверка исправленного бага.

---

## 7. Ключевые файлы

| Файл | Назначение |
|------|------------|
| `src/shared/block-sort-rules.ts` | Per-block ordering rules + `computeSortKey()` (18 блоков, 312 family-keys) |
| `src/shared/types.ts` | `FamilyGroup.sortKey?: string` |
| `src/shared/family-grouper.ts` | `buildFamilyGroup()` вычисляет sortKey |
| `src/shared/mod-classifier.ts` | `sortGroupsAlphabetically()` использует sortKey |
| `tests/shared/block-sort-rules.test.ts` | unit + e2e тесты (312 case-tests + relationship + E2E). iter 154: также заменяет удалённый `scripts/audit_block_sort_coverage.py` для coverage audit |
| `scripts/etl/iterative-optimizer.ts` | iter 112 fix: `tryAddContextForShortRegex` filter (≥3 letters) |
| `public/generated/jewel-desecrated.json` | iter 112 fix: `mod_3yl2ru` regexPrefixContext удалён |
| `tests/etl/cross-validation.test.ts` | iter 112 regression tests (2 новых) |

---

## 8. Точка остановки iter 119 → iter 120

**Сделано в iter 119:**
1. ✅ `rage-charges` block — 4 family-keys, 100% coverage. Canonical order: Flat cap → Active gain (melee hit) → Passive gain (being hit) → Glory gain speed (banners).
2. ✅ `runes-barrier` block — 4 family-keys, 100% coverage. Canonical order: Flat cap → % cap → Regen speed → Conditional recovery (on-ward-use).
3. ✅ `penetration` block — 3 family-keys, 100% coverage. Canonical order: Lightning → Cold → Fire (mirrors resistances element order without chaos).
4. ✅ Audit script обновлён — проверяет 18 блоков (resistances/attributes/minions/ailments/damage-type/defence-stats/resources/weapon-specific/flasks/offence-speed/crit/buff-skills/skill-levels/area-duration/meta-skills/rage-charges/runes-barrier/penetration, 312 family-keys total).
5. ✅ 28 новых unit/relationship/E2E теста — все green (1890/1890 total).
6. ✅ Документация — STATUS.md, AFFIX_ORDERING_PLAN.md (этот файл), worklog.md, AGENT_NAVIGATION.md.

**Корректировки плана в iter 119:**
- iter 119 — первый план канонических порядков для rage-charges / runes-barrier / penetration (раньше не предлагались).
- `rage-charges`: 4 family-keys ✓. Cap FIRST. Active gain before passive gain. Glory (Слава) gain speed LAST — different resource.
- `rage-charges`: `свирепости` в 3 family-keys — cap rule end-anchored, gain rules match distinctive action phrase.
- `runes-barrier`: 4 family-keys ✓. Mirrors `resources` block pattern: flat → % → regen → on-event.
- `runes-barrier`: `максимуму рунического барьера` в 2 family-keys — flat rule end-anchored, % rule matches distinctive phrase `увеличение максимума`.
- `penetration`: 3 family-keys ✓. Element order mirrors `resistances` block (молния → холод → огонь), без chaos (нет в данных).
- `penetration`: no substring conflicts — `пробивает.*сопротивления <element>` fully distinctive.
- **Все priority-блоки закрыты.** Оставшиеся 6 блоков (`other`/`magic-find`/`breach`/`spirit`/`wisps`/`conversion`) не требуют правил.

**НЕ сделано (переносится в iter 120+):**

1. **Визуальная верификация пользователем** (из iter 111 — НЕ СДЕЛАНО, переносится дальше):
   - UI в браузере: контрасты, читаемость 12px, рендеринг Noto Sans (Linux).
   - Особое внимание: affix ordering в resistances/attributes/minions/ailments + damage-type + defence-stats + resources + weapon-specific + flasks + offence-speed + crit + buff-skills + skill-levels + area-duration + meta-skills + **NEW iter 119: rage-charges + runes-barrier + penetration** — проверить, что канонический порядок выглядит правильно визуально.

2. **Опционально (iter 111 leftover):** удалить `--text-faint-val` alias и `--color-faint` из `@theme` после одного release cycle без использования `text-faint` (cleanup).

3. **При недовольстве dim-textом** (iter 111 leftover): опции (a) lift `--text-dim-val` до #8A92A2; (b) расширить `font-medium` на 8 page mod-counters; (c) принять текущее состояние.

4. **При желании дополнительно систематизировать `other` block** (27 family-keys): heterogeneous — потребует анализа группировки. LOW priority.

**Подсказка следующему агенту:** iter 119 = rage-charges (4) + runes-barrier (4) + penetration (3) block rules, 100% coverage each. **Все priority-блоки закрыты.** OP-1 closed. Перед стартом следующей итерации прочитай STATUS.md (актуальный статус), docs/AFFIX_ORDERING_PLAN.md (полный план, §4.2 — оставшиеся блоки без правил), worklog.md (последняя итерация). Audit: `pnpm test tests/shared/block-sort-rules.test.ts` (iter 154: standalone script удалён, logic в тестах). Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

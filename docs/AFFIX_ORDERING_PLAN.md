# План систематической сортировки аффиксов внутри блоков

> **iter 112** — внедрена инфраструктура + правила для 4 блоков.
> **iter 113** — добавлены правила для `damage-type` (47 family-keys).
> **iter 114** — добавлены правила для `defence-stats` (28 family-keys).
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

## 4. Текущее покрытие (iter 114)

### 4.1. Блоки с правилами (6 из 20 functional blocks)

| Блок | # family-keys | # rules | Покрытие |
|------|---------------|---------|----------|
| `resistances` | 18 | 18 | 100% |
| `attributes` | 13 | 13 | 100% |
| `minions` | 34 | 34 | 100% |
| `ailments` | 40 | 40 | 100% |
| `damage-type` | 47 | 47 | 100% |
| `defence-stats` | 28 | 28 | 100% |
| **Итого** | **180** | **180** | **100%** |

Скрипт аудита: `python3 scripts/audit_block_sort_coverage.py`

### 4.2. Блоки БЕЗ правил (14 из 20)

Возвращают `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).

| Блок | # family-keys | Приоритет iter 115+ |
|------|---------------|---------------------|
| `resources` | 33 | HIGH |
| `weapon-specific` | 24 | MEDIUM (jewel-only, есть sub-blocks) |
| `flasks` | 18 | MEDIUM |
| `other` | 27 | LOW (heterogeneous — сложно систематизировать) |
| `skill-levels` | 10 | MEDIUM |
| `buff-skills` | 8 | MEDIUM |
| `offence-speed` | 12 | MEDIUM |
| `crit` | 9 | MEDIUM |
| `area-duration` | 8 | LOW |
| `runes-barrier` | 4 | LOW |
| `magic-find` | 2 | LOW |
| `rage-charges` | 4 | LOW |
| `meta-skills` | 6 | LOW |
| `breach` | 2 | LOW (только 2 token-а: prefix/suffix Breach Lord's Mark) |
| `spirit` | 1 | LOW (только 1 token) |
| `penetration` | 3 | LOW |
| `wisps` | 0 | N/A |
| `conversion` | 0 | N/A |

---

## 5. Канонические порядки для будущих итераций

Ниже — предложения canonical orderings для priority-блоков iter 115+. Не реализовано, задокументировано для планирования.

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

### 5.5. `resources` (33 family-keys)
```
0-9:   Здоровье (max, плоский, регенерация, похищение, восстановление)
10-19: Мана (max, плоский, регенерация, похищение, восстановление, эффективность расхода)
20-29: Энергетический щит (max, плоский, конверсия в броню/порог)
30-39: Конверсия урона (MoM, урон→мана, урон→здоровье, стоимость маны→здоровье)
40-49: Тотем здоровье
50-59: Прочее (радиус обзора)
```

### 5.6. `buff-skills` (8 family-keys)
```
0:  Ауры (сила умений аур)
10: Вестники (эффективность удержания)
20: Проклятия (сила, скорость активации)
30: Знамёна (длительность)
40: Кличи (усиление положительного эффекта, скорость применения)
50: Метки (усиление эффекта, скорость сотворения)
```

---

## 6. Тестирование

### 6.1. Unit tests (`tests/shared/block-sort-rules.test.ts`)

- `computeSortKey()` для каждого canonical family-key (180 cases — 28 defence-stats + 47 damage-type + 105 iter 112).
- `sortGroupsAlphabetically()` использует sortKey когда set.
- `sortGroupsAlphabetically()` fallback к familyKey когда sortKey отсутствует (backward compat).
- End-to-end: `groupTokensByFamily()` → `classifyGroups()` → `sortGroupsAlphabetically()` — проверяет канонический порядок.
- Structural integrity: все regex case-insensitive, все orders в диапазоне 0-999, iter 114 scope = 6 блоков.

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
| `src/shared/block-sort-rules.ts` | Per-block ordering rules + `computeSortKey()` (6 блоков) |
| `src/shared/types.ts` | `FamilyGroup.sortKey?: string` |
| `src/shared/family-grouper.ts` | `buildFamilyGroup()` вычисляет sortKey |
| `src/shared/mod-classifier.ts` | `sortGroupsAlphabetically()` использует sortKey |
| `tests/shared/block-sort-rules.test.ts` | unit + e2e тесты (180 case-tests + relationship + E2E) |
| `scripts/audit_block_sort_coverage.py` | Audit script для coverage (6 блоков) |
| `scripts/etl/iterative-optimizer.ts` | iter 112 fix: `tryAddContextForShortRegex` filter (≥3 letters) |
| `public/generated/jewel-desecrated.json` | iter 112 fix: `mod_3yl2ru` regexPrefixContext удалён |
| `tests/etl/cross-validation.test.ts` | iter 112 regression tests (2 новых) |

---

---

## 8. Точка остановки iter 114 → iter 115

**Сделано в iter 114:**
1. ✅ `defence-stats` block — 28 family-keys, 100% coverage. Canonical order: Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони (8 buckets).
2. ✅ Audit script обновлён — проверяет 6 блоков (resistances/attributes/minions/ailments/damage-type/defence-stats).
3. ✅ 33 новых unit/relationship/E2E теста — все green (1687/1687 total).
4. ✅ Документация — STATUS.md, AFFIX_ORDERING_PLAN.md (этот файл), worklog.md.

**НЕ сделано (переносится в iter 115+):**

1. **Добавить правила для 14 functional blocks без правил** (см. §4.2).
   - Приоритет: `resources` (33), `weapon-specific` (24, jewel-only), `flasks` (18).
   - Канонические порядки предложены в §5.5 (`resources`).

2. **Визуальная верификация пользователем** (из iter 111 — НЕ СДЕЛАНО, переносится дальше):
   - UI в браузере: контрасты, читаемость 12px, рендеринг Noto Sans (Linux).
   - Особое внимание: новый affix ordering в resistances/attributes/minions/ailments + damage-type + **NEW iter 114: defence-stats** — проверить, что канонический порядок выглядит правильно визуально.

3. **Опционально (iter 111 leftover):** удалить `--text-faint-val` alias и `--color-faint` из `@theme` после одного release cycle без использования `text-faint` (cleanup).

4. **При недовольстве dim-textом** (iter 111 leftover): опции (a) lift `--text-dim-val` до #8A92A2; (b) расширить `font-medium` на 8 page mod-counters; (c) принять текущее состояние.

**Подсказка следующему агенту:** iter 114 = defence-stats block rules (28 family-keys, 100% coverage). Перед стартом iter 115 прочитай STATUS.md (актуальный статус + Known Issues #4), docs/AFFIX_ORDERING_PLAN.md (полный план + канонические порядки для 14 оставшихся блоков), worklog.md (этот раздел iter 114). Audit script: `python3 scripts/audit_block_sort_coverage.py` — показывает coverage правил для 6 активных блоков. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

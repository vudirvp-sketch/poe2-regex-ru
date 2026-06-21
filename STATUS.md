# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 117
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 117: расширение систематической сортировки на 3 priority-блока — `offence-speed` (12 family-keys), `crit` (9 family-keys), `buff-skills` (7 family-keys).**

### Сортировка аффиксов внутри блоков

iter 112 внедрил инфраструктуру `sortKey` (поле `FamilyGroup.sortKey` + `computeSortKey()` + интеграция в `sortGroupsAlphabetically()`). iter 113–116 добавили правила для `damage-type`, `defence-stats`, `resources`, `weapon-specific`, `flasks`. iter 117 добавляет правила для `offence-speed`, `crit`, `buff-skills`.

**12 блоков с правилами (iter 117 scope):**

| Блок | # family-keys | # rules | Канонический порядок |
|------|---------------|---------|----------------------|
| `resistances` | 18 | 18 | хаос → молния → холод → огонь; dual-element; all-elements; max-resist; meta; passive-tree |
| `attributes` | 13 | 13 | Сила → Ловкость → Интеллект → Все → dual → tri-or → % increase → requirement reduction |
| `minions` | 34 | 34 | Subject (Companion → Minion → Offering) × Stat (Health → Damage → Crit → Speed → Area → Resists → Utility) |
| `ailments` | 40 | 40 | Operation (Ув. силы → Ув. шанса → Ув. длительности → Ум. длительности → Шанс наложения → Порог → Скорость → Прочее) × State |
| `damage-type` | 47 | 47 | Физический → Огонь → Холод → Молния → Хаос → Стихийный → Generic/by-source → Conditional → By-target → Special |
| `defence-stats` | 28 | 28 | Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони |
| `resources` | 29 | 29 | Здоровье → Мана → ES → Конверсия → Тотем → Прочее |
| `weapon-specific` | 24 | 24 | Мечи → Топоры → Булавы → Боевые посохи → Кинжалы → Копья → Кистени → Луки → Самострелы → Без оружия |
| `flasks` | 16 | 16 | Health flask → Mana flask → Any flask → Flask buffs |
| `offence-speed` | 12 | 12 | attack → cast (generic→mark) → move → projectile → crossbow-reload → warcry → trap → totem → swap → skill (generic→transformed) |
| `crit` | 9 | 9 | chance % (generic→attacks→spells) → chance flat (thorns→fire-spells) → damage % (generic→spells) → damage flat (attacks) → ailment-from-crit |
| `buff-skills` | 7 | 7 | Ауры → Вестники → Проклятия (strength→activation) → Кличи (effect→reload) → Метки (effect) |

**Покрытие:** 100% — все 277 family-keys в 12 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 8 functional blocks:** без правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Это сознательная стратегия «не сломать» — будущие итерации добавят правила.

### offence-speed canonical order (iter 117)

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

**Design notes:**
- Two substring conflicts resolved via first-match-wins (most-specific FIRST):
  1. `скорости сотворения чар` в generic cast speed И в mark-skill cast speed — mark rule (с `умения метки имеют.*` prefix) listed FIRST.
  2. `скорости умений` в generic skill speed И в transformed-conditional — transformed rule (с `будучи превращенным` suffix) listed FIRST.
- End-anchored `$` на bare generic rules — defensive (first-match-wins уже handles).
- Mark skill cast speed имеет order 11 (subset of spell cast speed at 10).

### crit canonical order (iter 117)

```
0:   Шанс крит. удара (generic % increase)
10:  Шанс крит. удара атаками (% increase)
20:  Шанс крит. удара для чар (% increase)
30:  Шанс крит. удара шипами (flat + — dative "шансу")
40:  Бонус к крит. урону (generic % increase)
41:  Бонус к крит. урону от чар (% increase — spells variant)
50:  Бонус к крит. урону для атак (flat + — dative "бонусу")
60:  Шанс крит. удара чар огня (flat + — dative "шансу")
70:  Силы состояний от крит. ударов (ailment strength from crits)
```

**Design notes:**
- Russian morphology disambiguates % vs flat:
  - "% increase" uses genitive case: `шанса`, `бонуса`.
  - "+ flat" uses dative case (after "к"): `шансу`, `бонусу`.
  - These word forms are distinct — % rules don't match flat family-keys.
- End-anchored `$` на generic variant (e.g., `бонуса к критическому урону$`) prevents matching specific variant (e.g., `...от чар`).
- Crit-induced ailment strength comes LAST (order 70) — synergy mod, not direct crit stat.

### buff-skills canonical order (iter 117)

```
0:   Ауры (сила умений аур)
10:  Вестники (эффективность удержания ресурсов)
20:  Проклятия (сила проклятий)
21:  Проклятия (быстрее активация проклятия)
40:  Кличи (усиление положительного эффекта)
41:  Кличи (скорость перезарядки)
50:  Метки (усиление эффекта)
```

**Design notes:**
- Plan §5.6 mentioned "Знамёна (длительность)" at order 30 — NO знамёна family-keys в jewellery-scope data. Bucket 30 left empty.
- Plan §5.6 mentioned "скорость применения" for warcries — actual data has "скорость перезарядки" (reload speed). Order 41 used for reload.
- Plan §5.6 mentioned "скорость сотворения" for marks — actual data has only "усиление эффекта". Mark cast speed is in `offence-speed` block (order 11), not in `buff-skills`. Order 50 used for effect only.
- Distinctive phrases avoid substring conflicts: `силы умений аур` (auras) vs `силы проклятий` (curses); `усиление положительного эффекта боевого клича` (warcries) vs `усиление эффекта.*умений меток` (marks).
- Mark rule uses `.*` bridge: "усиление эффекта ваших умений меток" has "ваших" between "эффекта" and "умений меток".

### Проверки (iter 117)

- **vitest:** 1820/1820 tests passed (37 test files). +46 vs iter 116 baseline 1774 (12 case-tests + 7 relationship для offence-speed, 9 case-tests + 5 relationship для crit, 7 case-tests + 4 relationship для buff-skills, 3 E2E + 1 update structural).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 12/12 blocks fully covered (277 family-keys).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 12 functional blocks без явных правил** (iter 117):
   - Блоки БЕЗ правил: `spirit` (1), `skill-levels` (10), `runes-barrier` (4), `magic-find` (1), `penetration` (3), `area-duration` (8), `wisps` (0), `meta-skills` (6), `conversion` (0), `rage-charges` (4), `breach` (1), `other` (27).
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** iter 118+ добавит правила для оставшихся блоков. Канонические порядки для `area-duration` / `skill-levels` / `penetration` пока не предложены (требуется анализ данных). `other` heterogeneous — скорее всего останется без правил.
5. **Истощения Бездны regex bug** (closed iter 112): `jewel-desecrated.mod_3yl2ru` имел `regexPrefixContext: "(10—20)%"` (literal range) — regex не матчил реальные предметы. Фикс: data patch + ETL algorithm filter + 2 regression tests.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |
| Range-like regexPrefixContext | ❌ не работает — фильтруем на ETL | ✅ iter 112 (fix) |

---

Контакты: Discord **woonderdad**

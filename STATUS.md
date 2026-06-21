# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 118
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 118: расширение систематической сортировки на 3 priority-блока — `skill-levels` (10 family-keys), `area-duration` (8 family-keys), `meta-skills` (6 family-keys).**

### Сортировка аффиксов внутри блоков

iter 112 внедрил инфраструктуру `sortKey` (поле `FamilyGroup.sortKey` + `computeSortKey()` + интеграция в `sortGroupsAlphabetically()`). iter 113–117 добавили правила для 12 блоков. iter 118 добавляет правила для `skill-levels`, `area-duration`, `meta-skills`.

**15 блоков с правилами (iter 118 scope):**

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
| `skill-levels` | 10 | 10 | Levels (all→spells→melee→minion→projectile) → Quality (%→max) → Duration (generic→mark) → Cooldown |
| `area-duration` | 8 | 8 | Area (generic→spells→curses→banners→presence) → Radius improvement → Duration (curses→banners) |
| `meta-skills` | 6 | 6 | Energy (amount→max) → Archon (buff-effect→duration) → Sealed skills (max-charges→frequency) |

**Покрытие:** 100% — все 301 family-keys в 15 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 9 functional blocks:** без правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Это сознательная стратегия «не сломать» — будущие итерации добавят правила.

### skill-levels canonical order (iter 118)

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

**Design notes:**
- Levels FIRST (most-impactful stat), then Quality, then Duration, then Cooldown LAST (timing).
- Within levels: all-skills FIRST (most universal), then specific subsets (spells→melee→minion→projectile).
- Two substring conflicts handled via first-match-wins (most-specific FIRST):
  1. `увеличение длительности эффекта умения` в generic duration И в mark-skill duration — mark rule (с `умения меток имеют.*` prefix) listed FIRST.
  2. `уровню всех камней умений` в 5 family-keys — generic all-skills rule end-anchored `$`, specific subset rules match their own distinctive phrase (умений чар / ближнего боя / приспешников / снарядов).
- `качеству` в both quality % AND max-quality % — full phrases distinct (`качеству всех умений` vs `максимальному качеству`).

### area-duration canonical order (iter 118)

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

**Design notes:**
- Area FIRST (more universal — affects many skills).
- Radius improvement is a special mod (order 20) — between area-% and duration.
- `увеличение области действия` в 5 family-keys — generic rule end-anchored `$`, specific subset rules match their own distinctive phrase.
- `проклятий` и `умений знамён` appear in BOTH area AND duration variants — no conflict because leading phrase differs (`области действия` vs `длительности`).

### meta-skills canonical order (iter 118)

```
0:   Мета-умения получают увеличенное на #% количество энергии (energy amount)
1:   #% увеличение максимума энергии вызываемых умений (max energy cap)
10:  #% усиление положительных эффектов Архонта на вас (Archon buff effect)
11:  #% увеличение длительности эффекта Архонта (Archon duration)
20:  Запечатанные умения имеют +1 к максимуму зарядов печати (sealed max charges)
21:  Запечатанные умения имеют (#)% увеличение частоты получения зарядов печати (sealed frequency)
```

**Design notes:**
- Energy FIRST (most universal — powers all meta-skills).
- Archon SECOND (buff effect before duration, same pattern as buff-skills).
- Sealed skills THIRD (max charges before frequency — cap is more fundamental than gain speed).
- `энергии` в 2 family-keys — distinctive phrases (`Мета-умения получают.*количество энергии` vs `максимума энергии вызываемых умений`).
- `Архонта` в 2 family-keys — distinctive phrases (`усиление положительных эффектов Архонта` vs `длительности эффекта Архонта`).
- `зарядов печати` в 2 family-keys — distinctive phrases (`максимуму зарядов печати` vs `частоты получения зарядов печати`).

### Проверки (iter 118)

- **vitest:** 1862/1862 tests passed (37 test files). +42 vs iter 117 baseline 1820 (10 case-tests + 5 relationship для skill-levels, 8 case-tests + 4 relationship для area-duration, 6 case-tests + 6 relationship для meta-skills, 3 E2E + 1 update structural).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 15/15 blocks fully covered (301 family-keys).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 9 functional blocks без явных правил** (iter 118):
   - Блоки БЕЗ правил: `spirit` (1), `magic-find` (1), `breach` (1), `rage-charges` (4), `runes-barrier` (4), `penetration` (3), `wisps` (0), `conversion` (0), `other` (27).
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** iter 119+ добавит правила для оставшихся блоков. Канонические порядки для `rage-charges` (4) / `runes-barrier` (4) / `penetration` (3) пока не предложены (требуется анализ данных, но объём небольшой — 11 family-keys total). `other` heterogeneous — скорее всего останется без правил.
5. **Истощения Бездны regex bug** (closed iter 112): `jewel-desecrated.mod_3yl2ru` имел `regexPrefixContext: "(10—20)%"` (literal range) — regex не матчат реальные предметы. Фикс: data patch + ETL algorithm filter + 2 regression tests.

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

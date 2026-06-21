# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 119
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 119: расширение систематической сортировки на 3 оставшихся priority-блока — `rage-charges` (4 family-keys), `runes-barrier` (4 family-keys), `penetration` (3 family-keys).**

### Сортировка аффиксов внутри блоков

iter 112 внедрил инфраструктуру `sortKey` (поле `FamilyGroup.sortKey` + `computeSortKey()` + интеграция в `sortGroupsAlphabetically()`). iter 113–118 добавили правила для 15 блоков. iter 119 закрывает 3 оставшихся priority-блока. **Все priority-блоки закрыты.**

**18 блоков с правилами (iter 119 scope):**

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
| `rage-charges` | 4 | 4 | Flat cap → Active gain (melee hit) → Passive gain (being hit) → Glory gain speed (banners) |
| `runes-barrier` | 4 | 4 | Flat cap → % cap → Regen speed → Conditional recovery (on-ward-use) |
| `penetration` | 3 | 3 | Lightning → Cold → Fire (mirrors resistances element order without chaos) |

**Покрытие:** 100% — все 312 family-keys в 18 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 6 functional blocks:** без правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Эти блоки либо слишком heterogeneous (`other` — 27 family-keys), либо содержат только 1 family-key (`magic-find`, `breach`, `spirit`), либо пусты (`wisps`, `conversion`).

### rage-charges canonical order (iter 119)

```
0:   +# к максимуму свирепости (flat cap — most fundamental)
10:  Дарует # свирепости при нанесении удара в ближнем бою (active gain)
11:  Дарует # свирепости при получении удара от врага (passive gain)
20:  #% повышение скорости накопления славы для умений знамён (glory gain speed)
```

**Design notes:**
- Cap FIRST (sets ceiling — without cap, gain is unbounded).
- Active gain (player-initiated trigger) before passive gain (enemy-initiated) — more controllable.
- Glory (Слава) gain speed LAST — different resource, used by banner skills only.
- `свирепости` в 3 family-keys — cap rule end-anchored `$`, gain rules match distinctive action phrase (`в ближнем бою` vs `получении удара`).

### runes-barrier canonical order (iter 119)

```
0:   +# к максимуму рунического барьера (flat cap)
1:   #% увеличение максимума рунического барьера (% cap)
10:  #% повышение скорости регенерации рунического барьера (regen speed)
20:  Восстанавливает # рунического барьера при использовании оберега (on-ward-use)
```

**Design notes:**
- Mirrors `resources` block pattern: flat → % → regen → on-event recovery.
- `максимуму рунического барьера` в 2 family-keys — flat rule end-anchored `$`, % rule matches `увеличение максимума` distinctive phrase.
- `оберега` — only in on-ward-use family-key, no conflict.

### penetration canonical order (iter 119)

```
0:  Урон пробивает #% сопротивления молнии (lightning)
1:  Урон пробивает #% сопротивления холоду (cold)
2:  Урон пробивает #% сопротивления огню (fire)
```

**Design notes:**
- Element order mirrors `resistances` block (orders 1-3 there): молния → холод → огонь.
- Renumbered 0-2 since chaos-penetration family-key doesn't exist in jewellery data.
- No substring conflicts — `пробивает.*сопротивления <element>` is fully distinctive.

### Проверки (iter 119)

- **vitest:** 1890/1890 tests passed (37 test files). +28 vs iter 118 baseline 1862 (4 case + 5 relationship для rage-charges, 4 case + 5 relationship для runes-barrier, 3 case + 4 relationship для penetration, 3 E2E + 1 update structural).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 18/18 blocks fully covered (312 family-keys).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 6 functional blocks без явных правил** (iter 119):
   - Блоки БЕЗ правил: `other` (27), `magic-find` (1), `breach` (1), `spirit` (1), `wisps` (0), `conversion` (0).
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** `other` heterogeneous — скорее всего останется без правил. `magic-find`/`breach`/`spirit` содержат только 1 family-key каждый — правила не нужны (один элемент сортируется сам с собой). `wisps`/`conversion` пустые — нет данных. Таким образом, **iter 119 завершает систематическую сортировку priority-блоков**.
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

# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 116
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 116: расширение систематической сортировки на блоки `weapon-specific` (24 family-keys, jewel-only) + `flasks` (16 family-keys, belt+jewel).**

### Сортировка аффиксов внутри блоков

iter 112 внедрил инфраструктуру `sortKey` (поле `FamilyGroup.sortKey` + `computeSortKey()` + интеграция в `sortGroupsAlphabetically()`). iter 113–115 добавили правила для `damage-type`, `defence-stats`, `resources`. iter 116 добавляет правила для `weapon-specific` и `flasks`.

**9 блоков с правилами (iter 116 scope):**

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

**Покрытие:** 100% — все 249 family-keys в 9 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 11 functional blocks:** без правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Это сознательная стратегия «не сломать» — будущие итерации добавят правила.

### weapon-specific canonical order (iter 116)

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

**Design notes:**
- Все family-keys — jewel-only. Каждое правило использует weapon name (instrumental case: мечами/топорами/булавами/etc.) как дискриминатор.
- Stat-тип patterns — word-specific: «увеличение урона X» vs «скорости атаки X» vs «критического удара X» vs «бонуса к критическому урону X» vs «меткости X» vs «скорости накопления шкалы Y X».
- Некоторые weapons не имеют всех stat-типов в данных (мечи без crit, булавы без attack-speed, кистени без attack-speed) — канонический порядок оставляет gaps намеренно.
- «Без оружия» использует особый wording: «увеличение урона атаками без оружия» (с «атаками») vs другие weapons «увеличение урона X».

### flasks canonical order (iter 116)

```
0-9:    Health flask (5 keys: recovery-speed 0, recovery-amount 1, charges-gained 2,
        regen-during-effect 3, regen-per-sec 4)
10-19:  Mana flask (4 keys: recovery-speed 10, recovery-amount 11, charges-gained 12,
        regen-per-sec 13 — нет regen-during-effect в данных)
20-29:  Any flask (5 keys: duration 20, charges-gained 21, charges-used-reduction 22,
        keep-charges 23, regen-per-sec 24)
30-39:  Flask buffs (2 keys: cast-speed 30, spell-damage 31 — пока flask active)
```

**Design notes:**
- **Resource-first bucketing** (vs §5.8 plan's mechanic-first bucketing) — каждый resource (Health/Mana/Any) имеет parallel stat-типы (recovery-speed, recovery-amount, charges-gained). План «Passive regen» bucket разрезал бы parallel структуру.
- **End-anchored `$` для `флакона$`** (any-flask duration/charges-gained) предотвращает коллизию с `флакона здоровья` / `флакона маны` variants, которые заканчиваются на «здоровья» / «маны».
- **Start-anchored `^` для `^Флаконы получают зарядов`** (any-flask regen-per-sec) предотвращает коллизию с `^Флаконы здоровья получают` / `^Флаконы маны получают` variants.
- Specific (health/mana) правила listed BEFORE generic (any) — first-match-wins safety + readability.
- Health bucket имеет 5 keys (most prominent), Mana — 4 (нет regen-during-effect), Any — 5, Buffs — 2.
- Flask buffs отделены: они affect player stats пока flask active, не свойства flask.

### Проверки (iter 116)

- **vitest:** 1774/1774 tests passed (37 test files). +53 vs iter 115 baseline 1721 (24 case-tests + 4 relationship для weapon-specific + 16 case-tests + 6 relationship для flasks + 2 E2E + 1 update structural).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 9/9 blocks fully covered (249 family-keys).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 11 functional blocks без явных правил** (iter 116):
   - Блоки БЕЗ правил: `spirit`, `skill-levels`, `runes-barrier`, `magic-find`, `offence-speed`, `crit`, `penetration`, `area-duration`, `wisps`, `buff-skills`, `meta-skills`, `conversion`, `rage-charges`, `breach`, `other`.
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** iter 117+ добавит правила для следующих приоритетных блоков: `offence-speed` (12, §5.3), `crit` (9, §5.4), `buff-skills` (7, §5.6). Канонические порядки предложены в `docs/AFFIX_ORDERING_PLAN.md`.
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

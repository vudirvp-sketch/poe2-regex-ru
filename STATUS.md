# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 115
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 115: расширение систематической сортировки на блок `resources` (29 family-keys, 100% coverage).**

### Сортировка аффиксов внутри блоков

iter 112 внедрил инфраструктуру `sortKey` (поле `FamilyGroup.sortKey` + `computeSortKey()` + интеграция в `sortGroupsAlphabetically()`). iter 113–114 добавили правила для `damage-type` и `defence-stats`. iter 115 добавляет правила для `resources` (Health/Mana/ES pools + conversion — приоритетный блок, 3-й по видимости).

**7 блоков с правилами (iter 115 scope):**

| Блок | # family-keys | # rules | Канонический порядок |
|------|---------------|---------|----------------------|
| `resistances` | 18 | 18 | хаос → молния → холод → огонь; dual-element; all-elements; max-resist; meta; passive-tree |
| `attributes` | 13 | 13 | Сила → Ловкость → Интеллект → Все → dual → tri-or → % increase → requirement reduction |
| `minions` | 34 | 34 | Subject (Companion → Minion → Offering) × Stat (Health → Damage → Crit → Speed → Area → Resists → Utility) |
| `ailments` | 40 | 40 | Operation (Ув. силы → Ув. шанса → Ув. длительности → Ум. длительности → Шанс наложения → Порог → Скорость → Прочее) × State |
| `damage-type` | 47 | 47 | Физический → Огонь → Холод → Молния → Хаос → Стихийный → Generic/by-source → Conditional → By-target → Special |
| `defence-stats` | 28 | 28 | Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони |
| `resources` | 29 | 29 | Здоровье → Мана → ES → Конверсия → Тотем → Прочее |

**Покрытие:** 100% — все 209 family-keys в 7 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 13 functional blocks:** без правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Это сознательная стратегия «не сломать» — будущие итерации добавят правила.

### resources canonical order (iter 115)

```
0-9:    Здоровье (flat max, % max, flat regen, % regen, leech generic, leech phys,
        recovery generic, recovery fire, on-kill %, per-kill flat)
10-19:  Мана (flat max, % max, % regen, leech generic, recovery, leech phys,
        on-kill %, per-kill flat, cost efficiency)
20-29:  Энергетический щит (flat max, % max, ES→stun threshold, ES→ailment threshold)
30-39:  Конверсия урона (MoM, mana-cost→health, mana→armour)
40-49:  Тотем (здоровье тотема)
50-59:  Прочее (радиус обзора, Hexblast skill effect)
```

**Design notes:**
- **Health и Mana buckets параллельны** — 8 одинаковых stat-типов (flat max, % max, regen, leech, recovery, on-kill, per-kill). Мана имеет дополнительный stat — cost-efficiency (порядок 18).
- **End-anchor `$` для flat max правил** (`+# к максимуму здоровья$`) предотвращает коллизию с conversion-правилом `Дарует #% максимума маны в виде брони` (заканчивается на «брони», а не на «маны»).
- **ES→threshold conversions** (порядки 22, 23) используют `.*` bridge для длинных family-keys с wording «в размере #% от максимума энергетического щита».
- **Per-kill и on-kill правила** (`Дарует # ... за каждого убитого врага`, `Восстанавливает #% ... при убийстве`) используют `.*` bridge для `#`/`#%` placeholder.
- **Fire-variant recovery** (порядок 7) идёт ПОСЛЕ generic recovery (порядок 6) — generic более фундаментален.
- **Hexblast skill effect** (`#% усиление эффекта Колдовского выброса на вас`) классифицирован в `resources` в данных; правило помещено в Other bucket (порядок 51).

### Проверки (iter 115)

- **vitest:** 1721/1721 tests passed (37 test files). +34 vs iter 114 baseline 1687 (29 case-tests + 4 relationship + 1 E2E для resources).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 7/7 blocks fully covered (209 family-keys).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 13 functional blocks без явных правил** (iter 115):
   - Блоки БЕЗ правил: `spirit`, `skill-levels`, `runes-barrier`, `magic-find`, `offence-speed`, `crit`, `penetration`, `area-duration`, `wisps`, `buff-skills`, `meta-skills`, `weapon-specific`, `flasks`, `conversion`, `rage-charges`, `breach`, `other`.
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** iter 116+ добавит правила для следующих приоритетных блоков: `weapon-specific` (24, jewel-only), `flasks` (16, belt+jewel). Канонические порядки предложены в `docs/AFFIX_ORDERING_PLAN.md`.
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

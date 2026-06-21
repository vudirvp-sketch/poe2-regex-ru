# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 113
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 113: расширение систематической сортировки на блок `damage-type` (47 family-keys, 100% coverage).**

### Сортировка аффиксов внутри блоков

iter 112 внедрил инфраструктуру `sortKey` (поле `FamilyGroup.sortKey` + `computeSortKey()` + интеграция в `sortGroupsAlphabetically()`). iter 113 добавляет правила для самого видимого блока `damage-type`.

**5 блоков с правилами (iter 113 scope):**

| Блок | # family-keys | # rules | Канонический порядок |
|------|---------------|---------|----------------------|
| `resistances` | 18 | 18 | хаос → молния → холод → огонь; dual-element; all-elements; max-resist; meta; passive-tree |
| `attributes` | 13 | 13 | Сила → Ловкость → Интеллект → Все → dual → tri-or → % increase → requirement reduction |
| `minions` | 34 | 34 | Subject (Companion → Minion → Offering) × Stat (Health → Damage → Crit → Speed → Area → Resists → Utility) |
| `ailments` | 40 | 40 | Operation (Ув. силы → Ув. шанса → Ув. длительности → Ум. длительности → Шанс наложения → Порог → Скорость → Прочее) × State |
| `damage-type` | 47 | 47 | Физический → Огонь → Холод → Молния → Хаос → Стихийный → Generic/by-source → Conditional → By-target → Special |

**Покрытие:** 100% — все 152 family-keys в 5 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 15 functional blocks:** без правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Это сознательная стратегия «не сломать» — будущие итерации добавят правила.

### damage-type canonical order (iter 113)

```
0-9:    Физический (global %, added to attacks, thorns flat)
10-19:  Огонь (увеличение, added to attacks, насыщение, конверсия, thorns-per-100-HP)
20-29:  Холод (увеличение, added to attacks, насыщение, phys→cold conversion, conversion)
30-39:  Молния (увеличение, added to attacks, насыщение, конверсия)
40-49:  Хаос (увеличение, конверсия в хаос)
50-59:  Стихийный / насыщения (увеличение, max-насыщений, saturation preservation mechanic)
60-79:  Generic damage + by-source (bare, атаки, чары, снаряды, melee, тотемы, кличи,
        растения, ловушки, помехи, шипы, улучшенные атаки, срабатывающие чары, вестники)
80-89:  Условный (low-HP, full-ES, transformed, corpse, melee-if-proj, proj-if-melee)
90-99:  По мишени (редкие/уникальные враги)
100-109: Special (Проколы, элементальные недуги, Анемия, оскверненная кровь)
```

**Design notes:**
- Most-specific-first: conversion/added/saturation-conditional/thorns правила идут ПЕРЕД generic element rules (которые end-anchored через `$`).
- `^#% увеличение урона$` — exact match для bare generic damage (не match conditional variants).
- Stem "анем" для покрытия nominative/accusative ("Анемия"/"Анемию").

### Проверки (iter 113)

- **vitest:** 1654/1654 tests passed (37 test files). +52 vs iter 112 baseline 1602 (47 case-tests + 4 relationship + 1 E2E для damage-type).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 5/5 blocks fully covered.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 15 functional blocks без явных правил** (iter 113):
   - Блоки БЕЗ правил: `spirit`, `skill-levels`, `resources`, `runes-barrier`, `magic-find`, `defence-stats`, `offence-speed`, `crit`, `penetration`, `area-duration`, `wisps`, `buff-skills`, `meta-skills`, `weapon-specific`, `flasks`, `conversion`, `rage-charges`, `breach`, `other`.
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** iter 114+ добавит правила для следующих приоритетных блоков: `defence-stats` (32 family-keys), `resources` (33), `weapon-specific` (24, jewel-only), `flasks` (18). См. `docs/AFFIX_ORDERING_PLAN.md`.
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

# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 114
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 114: расширение систематической сортировки на блок `defence-stats` (28 family-keys, 100% coverage).**

### Сортировка аффиксов внутри блоков

iter 112 внедрил инфраструктуру `sortKey` (поле `FamilyGroup.sortKey` + `computeSortKey()` + интеграция в `sortGroupsAlphabetically()`). iter 113 добавил правила для `damage-type`. iter 114 добавляет правила для `defence-stats` (защитный блок — второй по видимости после damage-type).

**6 блоков с правилами (iter 114 scope):**

| Блок | # family-keys | # rules | Канонический порядок |
|------|---------------|---------|----------------------|
| `resistances` | 18 | 18 | хаос → молния → холод → огонь; dual-element; all-elements; max-resist; meta; passive-tree |
| `attributes` | 13 | 13 | Сила → Ловкость → Интеллект → Все → dual → tri-or → % increase → requirement reduction |
| `minions` | 34 | 34 | Subject (Companion → Minion → Offering) × Stat (Health → Damage → Crit → Speed → Area → Resists → Utility) |
| `ailments` | 40 | 40 | Operation (Ув. силы → Ув. шанса → Ув. длительности → Ум. длительности → Шанс наложения → Порог → Скорость → Прочее) × State |
| `damage-type` | 47 | 47 | Физический → Огонь → Холод → Молния → Хаос → Стихийный → Generic/by-source → Conditional → By-target → Special |
| `defence-stats` | 28 | 28 | Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони |

**Покрытие:** 100% — все 180 family-keys в 6 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 14 functional blocks:** без правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Это сознательная стратегия «не сломать» — будущие итерации добавят правила.

### defence-stats canonical order (iter 114)

```
0-9:    Броня (flat, %, from-body, shield-triple, global-triple)
10-19:  Уклонение (flat, %, from-body)
20-29:  Энергетический щит (from-body, from-focus, recharge-speed, recharge-start)
30-39:  Блок (% шанс)
40-49:  Порог оглушения (flat, %, conditional-recent, conditional-parry)
50-59:  Отклонение (%)
60-69:  Обереги (duration, charges-gained, charges-used-reduction, conditional-slow, free-use, regen, ward-active-damage)
70-79:  Разрушение брони (duration, quantity, damage-vs-broken)
```

**Design notes:**
- **Triple-stat правила идут ПЕРВЫМИ** (most-specific-first) — family-keys вроде «брони, уклонения и энергетического щита от щита в руках» содержат «брони», «уклонения», «энергетического щита», которые матчили бы более простые single-stat паттерны.
- **Conditional правила** (порог оглушения) идут перед bare `%`-правилом — bare end-anchored `увеличение порога оглушения$` всё равно не match conditional variant, но порядок clearer.
- **Flat-правила** (`к броне$`, `к уклонению$`, `к порогу оглушения$`) используют `$` end-anchor для уникальности.
- **Stem "оберег"** покрывает все падежи: оберега (genitive sg), оберегов (genitive pl), обереги (nominative pl).

### Проверки (iter 114)

- **vitest:** 1687/1687 tests passed (37 test files). +33 vs iter 113 baseline 1654 (28 case-tests + 4 relationship + 1 E2E для defence-stats).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **audit script:** 6/6 blocks fully covered.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 14 functional blocks без явных правил** (iter 114):
   - Блоки БЕЗ правил: `spirit`, `skill-levels`, `resources`, `runes-barrier`, `magic-find`, `offence-speed`, `crit`, `penetration`, `area-duration`, `wisps`, `buff-skills`, `meta-skills`, `weapon-specific`, `flasks`, `conversion`, `rage-charges`, `breach`, `other`.
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** iter 115+ добавит правила для следующих приоритетных блоков: `resources` (33 family-keys), `weapon-specific` (24, jewel-only), `flasks` (18). Канонические порядки предложены в `docs/AFFIX_ORDERING_PLAN.md`.
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

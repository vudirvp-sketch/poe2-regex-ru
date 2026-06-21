# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 112
> **Последний UI-аудит:** 2026-06-21 (v2, см. `docs/UI_AUDIT.md`)

---

## Текущее состояние

**iter 112: исправлен regex-баг «Истощения Бездны» + внедрена инфраструктура систематической сортировки аффиксов внутри функциональных блоков.**

### Regex-движок: фикс бага iter 112

**Баг:** `jewel-desecrated.mod_3yl2ru` (Истощения Бездны) имел `regexPrefixContext: "(10—20)%"` — literal range template, который никогда не встречается в реальных rolled-item текстах (там конкретные значения типа "15%"). Скомпилированный regex `"(10—20)%.*Бездны"` НЕ матчит ни один предмет в игре.

**Фикс (2 правки):**
1. **Data patch:** `public/generated/jewel-desecrated.json` — удалили ключ `regexPrefixContext` у `mod_3yl2ru`. Regex `"Бездны"` теперь работает один (он уникален в пределах jewel-desecrated.json).
2. **ETL algorithm fix:** `scripts/etl/iterative-optimizer.ts` `tryAddContextForShortRegex()` — добавлен фильтр: кандидат в `regexPrefixContext` должен содержать ≥3 кириллических/латинских букв. Range-шаблоны типа `"(10—20)%"` или `"—"` больше не выбираются как context.

**Регрессионные тесты:** `tests/etl/cross-validation.test.ts` — 2 новых теста: `no token has range-like regexPrefixContext` (сканирует все 10 JSON) + `jewel-desecrated.mod_3yl2ru (Истощения Бездны) has no range context` (точечная проверка).

### Сортировка аффиксов внутри блоков: iter 112

**Проблема:** Алфавитная сортировка по familyKey создавала «кашу» внутри функциональных блоков:
- «Сопротивления»: молния → огонь → хаос → холод (алфавит) — нарушает ментальную модель chaos → lightning → cold → fire.
- «Приспешники»: здоровье → урон → здоровье → урон (Companion/Minion перемешаны).
- «Состояния»: «увеличение силы» и «увеличение шанса» чередовались вместо группировки.

**Решение (инфраструктура + 4 блока):**

1. **Новое поле `sortKey` в `FamilyGroup`** (`src/shared/types.ts`) — canonical within-block sort key.
2. **Новый модуль `src/shared/block-sort-rules.ts`** — per-block ordering rules (regex-pattern → numeric-order).
3. **`groupTokensByFamily`** (`src/shared/family-grouper.ts`) — вычисляет `sortKey` через `computeSortKey(functionalCategory, familyKey)`.
4. **`sortGroupsAlphabetically`** (`src/shared/mod-classifier.ts`) — PRIMARY sort по `sortKey`, SECONDARY по familyKey (alpha), TIEBREAKER по tier.

**4 блока с правилами (iter 112 scope):**

| Блок | # family-keys | # rules | Канонический порядок |
|------|---------------|---------|----------------------|
| `resistances` | 18 | 18 | хаос → молния → холод → огонь; затем dual-element; затем all-elements; затем max-resist (тот же element order); затем meta; затем passive-tree (jewel) |
| `attributes` | 13 | 13 | Сила → Ловкость → Интеллект → Все → dual (Сила+Ловкость → Сила+Интеллект → Ловкость+Интеллект) → tri-or → % increase → requirement reduction |
| `minions` | 34 | 34 | Subject: Companion (0-99) → Minion (100-199) → Offering (200-299). Внутри subject: Health → Damage → Crit → Speed → Area → Resists → Utility |
| `ailments` | 40 | 40 | Operation: Увеличение силы (0-99) → Увеличение шанса (100-199) → Увеличение длительности (200-299) → Уменьшение длительности (300-399) → Шанс наложения (400-499) → Порог (500-599) → Скорость накопления (600-699) → Прочее (700-799). Внутри каждой operation — стандартный порядок состояний |

**Покрытие:** 100% — все 105 family-keys в 4 блоках покрыты правилами (см. `scripts/audit_block_sort_coverage.py`).

**Остальные 16 functional blocks:** не имеют правил в `BLOCK_SORT_RULES` → `computeSortKey` возвращает `"999::<familyKey>"` → поведение идентично pre-iter-112 (чистая алфавитная сортировка). Это сознательная стратегия «не сломать» — будущие итерации добавят правила.

### Проверки (iter 112)

- **vitest:** 1602/1602 tests passed (37 test files). +59 новых тестов (57 в `block-sort-rules.test.ts` + 2 в `cross-validation.test.ts`).
- **tsc:** 0 errors.
- **eslint:** 0 problems.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **j05iep stays crit** — intentional (CRIT шаг 14 > AILMENTS шаг 15).
3. **APCA Lc<75 для small text с weight 400** (accepted design tradeoff, iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как частичная компенсация.
4. **Сортировка внутри блоков: 16 functional blocks без явных правил** (iter 112):
   - Блоки БЕЗ правил: `spirit`, `skill-levels`, `resources`, `runes-barrier`, `magic-find`, `defence-stats`, `offence-speed`, `crit`, `damage-type`, `penetration`, `area-duration`, `wisps`, `buff-skills`, `meta-skills`, `weapon-specific`, `flasks`, `conversion`, `rage-charges`, `breach`, `other`.
   - Поведение: `computeSortKey` возвращает `"999::<familyKey>"` → чистая алфавитная сортировка (как pre-iter-112).
   - **План:** iter 113+ добавит правила для следующих приоритетных блоков: `damage-type` (47 family-keys — пользовательски видим), `defence-stats` (32), `offence-speed` (12), `crit` (9), `buff-skills` (8). См. `docs/AFFIX_ORDERING_PLAN.md`.
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

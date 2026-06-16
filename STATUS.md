# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/

---

## Текущая итерация: 41 — Path D COMPLETE (D1+D2+D4+D5+D6 DONE)

### Резюме

Path D полностью реализован и **production-verified** в игре на 5 категориях. Все ключевые risk-зоны проверены: scalability (6-9 alts), AND+Path D runtime combination, same-block AND semantics, clean TP/TN, multi-item TP + cross-category FP, truncated stems + broad `.*`.

- **D1** ✅ — In-game тест Path D на 3-4 alts (iter 39)
- **D2** ✅ — ETL: `path-d-transform.ts` + Phase D в `compute-optimizations.ts` + `iterative-optimizer.ts` (iter 40)
- **D4** ✅ — Runtime: `applyOptimizationTable` применяет Path D даже с negative savings (iter 40)
- **D5** ✅ — In-game верификация на production ETL output: 5/5 тестов PASS (iter 41)
- **D6** ✅ — Распространение на все категории: ETL применяет Path D ко всем 7 категориям; in-game verified на 5 (jewel, amulet, ring, waystone, tablet)
- **D3** ⏳ — regexExclude с усечёнными основами (отдельная задача, не блокирует Path D)

### Ключевые выводы iter 41 (D5 production-verification)

1. **Same-block AND confirmed в PoE2** — `"X" "Y"` матчит когда ОБА quoted-группы находятся в одном блоке. Проверено на `"имеют" "Path D regex"` — все 3 waystone с модом `Монстры имеют X повышение шанса критического удара` сматчились. **Вывод:** `optimization-strategies.ts` корректен — `regexPrefixContext` в формате `"ctx" "Path D regex"` РАБОТАЕТ.

2. **Path D работает на 6-9 alts в production** — D5-1 (6 alts, split-word `.*`), D5-5 (9 alts, truncated stems) PASS. 11-alt entries не тестировались напрямую (превышают лимит 250 chars в PoE2), но 9-alt PASS даёт высокую уверенность.

3. **Cross-category FP — ожидаемое поведение** — D5-4 (amulet regex матчит ring + jewel), D5-5 (waystone regex матчит 2 tablets). Opt-table regexes category-agnostic по дизайну. **Не баг, не требует D3 fix.**

4. **PoE2 regex char limit ≈ 250 chars** — NEW finding. D5-1 v1 (262 chars) и D5-2 v1 (327 chars) не влезли в лимит. ETL должен учитывать это при генерации opt-table entries — entries >250 chars нельзя использовать в игре как single regex.

5. **No code changes needed** — ETL pipeline, runtime optimization, optimization-strategies.ts — все корректны. Production Path D output работает в игре.

### Результаты 5 in-game тестов (D5)

| Test | Length | Category | Alts | prefix_ctx | TP matched | TN (FP-control) | Result |
|------|--------|----------|------|------------|------------|------------------|--------|
| D5-1 v2 | 98 | jewel | 6 | — | Гипнотическая сущность | 3 других jewel (no FP) | ✅ PASS |
| D5-2 v2 | 125 | jewel + waystone | 4 | `имеют` | jewel 2 + 3 waystone (same-block AND) | 3 других jewel | ✅ PASS |
| D5-3 | 139 | tablet | 6 | — | 2 tablets | 1 tablet (no "встретить") | ✅ PASS |
| D5-4 | 148 | amulet + cross-cat | 6 | — | 2 amulets + ring + jewel | 1 amulet (no "здоровья") | ✅ PASS |
| D5-5 | 229 | waystone + cross-cat | 9 | — | 3 waystones + 2 tablets (cross-cat) | All non-waystone | ✅ PASS |

### Статистика Path D по категориям (ETL output, iter 40)

| Категория | Всего opt-entries | Path D (top-level `\|`) | Flat (no `\|`) | Broken `()` с `\|` |
|-----------|-------------------|-------------------------|----------------|--------------------|
| Jewel | 113 | 112 | 1 | 0 |
| Amulet | 114 | 54 | 60 | 0 |
| Ring | 93 | 45 | 48 | 0 |
| Belt | 83 | 47 | 36 | 0 |
| Tablet | 35 | 30 | 5 | 0 |
| Waystone | 43 | 15 | 28 | 0 |
| **TOTAL** | **481** | **303** | **178** | **0** |

### Детерминированная стратегия регексов (8 принципов)

| # | Принцип | Описание |
|---|---------|----------|
| 1 | **One Mod = One Quoted Group** | Каждый выбранный мод → одна quoted group с suffix + `.*` bridge + number pattern |
| 2 | **Multi-Mod = AND Across Blocks** | N модов → N quoted groups через пробел: `"mod1" "mod2" "mod3"` |
| 3 | **`\|` Scope — TOP LEVEL of one quoted group** | `\|` работает на верхнем уровне одного quoted group (с или без `.*`). НЕ работает между quoted groups и внутри `()` с многословными. |
| 4 | **`.*` Bridging Within Single Block** | `"prefix.*suffix"` мостит число и слова в одном блоке |
| 5 | **Suffix Uniqueness** | Найти кратчайший suffix, уникальный для мода в категории (≥3 значимых символов на слово) |
| 6 | **Shared Suffix → Differentiate by Number** | Если suffix shared → number enumeration: `"(1[0-5])%.*suffix"` |
| 7 | **Cross-Block FP Risk** | `"X" "Y"` (AND) может-match разные блоки → FP. Использовать `.*` bridge: `"X.*Y"`. **Note (iter 41):** `"X" "Y"` ALSO матчит когда X и Y в одном блоке — same-block AND confirmed в PoE2. |
| 8 | **Same-Family OR → Path D** | `"prefix.*A\|prefix.*B\|prefix.*C"` — один quoted group, top-level `\|`, `.*` мосты. ✅ 2/3/4 alt verified (iter 38-39); ✅ AND-combination verified (iter 39); ✅ ETL реализован (iter 40); ✅ **production-verified на 6-9 alts + same-block AND + cross-cat FP (iter 41, D5)** |

### Подтверждённые ограничения PoE2 (актуально на iter 41)

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"`, `"луками\|посохами"` |
| `\|` top-level в одном quoted group с `.*` мостами (Path D) | ✅ | iter 38: 2 alt; iter 39: 3+4 alt + AND; iter 40: ETL; iter 41: production-verified 6-9 alts |
| `\|` между quoted groups (`"X"\|"Y"`) | ❌ | iter 38: B0 confirmed broken — zero matches |
| `\|` многословный внутри `()` | ❌ | Test 15 — ничего не матчит |
| `\|` после non-`.*` prefix внутри `"..."` (`"prefix (A\|B)"`) | ❌ | Test 16 — матчит только prefix broadly |
| Пробел = AND (cross-block AND **и** same-block AND) | ✅ | `"X" "Y"` матчит когда X и Y в одном блоке ИЛИ в разных блоках (iter 41 confirmed same-block) |
| `.*` внутри одного блока | ✅ | `"Бездн.*монстр"`, `"увеличение урона.*луками"` |
| `(?!…)` per-block | ✅ | `скорости(?!.*луками)` (симулятор не полностью моделирует — см. D4) |
| `!` item-wide negation | ✅ | `"!A\|B"` |
| `^` start-of-block anchor | ✅ | `"^2%.*скорости атаки"` |
| Number enumeration | ✅ | `"(1[0-5])%.*suffix"` |
| Regex char limit ≈ 250 chars | ⚠️ | iter 41: D5-1 v1 (262) и D5-2 v1 (327) не влезли в лимит. ETL должен учитывать. |

### План реализации Path D — финальный статус

| Шаг | Содержание | Статус |
|-----|-----------|--------|
| D1 | In-game test Path D на 3+ альтернативах | ✅ DONE iter 39 |
| D2 | ETL: `path-d-transform.ts` + Phase D + `reoptimizeTable` | ✅ DONE iter 40 |
| D3 | ETL: regexExclude → усечённые основы + `(?!…)` per-block | ⏳ Отдельная задача (не блокирует Path D) |
| D4 | Runtime: `applyOptimizationTable` + `buildLiteralNode` совместимость с Path D | ✅ DONE iter 40 |
| D5 | In-game верификация production ETL output | ✅ DONE iter 41 (5/5 PASS) |
| D6 | Распространение на все категории | ✅ DONE iter 41 (ETL applies to all; verified in-game on 5) |

### Известные проблемы

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 1 | **Opt-table `"prefix (A\|B\|C)"` сломан** | ✅ РЕШЁН iter 40 (Path D в ETL) | RESOLVED |
| 2 | **AND-in-OR = вложенные кавычки** | ✅ РЕШЁН для opt-table iter 40 (Path D) | RESOLVED for opt-table |
| 3 | **regexExclude: неполные словоформы** — «самострелами» ≠ «самострела» | MEDIUM — D3 | OPEN (отдельная задача) |
| 4 | **Симулятор `(?!…)`** — не полностью моделирует per-block semantics | LOW (только для тестов) | OPEN |
| 5 | **Симулятор `"X"\|"Y"`** — парсит как `"X"` AND `(\|Y)` = `"X"` | LOW (Path D делает эту конструкцию ненужной) | OPEN |
| 6 | **PoE2 regex char limit ≈ 250 chars** — opt-table entries >250 chars нельзя использовать в игре | MEDIUM — ETL нужно добавить constraint | NEW (iter 41) |
| 7 | **Path D `.*` bridges более permissive** — cross-category FP (D5-4, D5-5) | LOW — opt-table regexes category-agnostic по дизайну, не баг | RESOLVED (iter 41: confirmed acceptable) |

### SEO-статус

| Элемент | Статус |
|---------|--------|
| robots.txt + sitemap.xml | ✅ |
| Route-specific мета-теги | ✅ |
| Open Graph + Twitter Card | ✅ |
| Canonical URL | ✅ |
| JSON-LD | ✅ |
| SeoBlock (FAQ) | ✅ |
| Shell-пререндеринг | ✅ |
| Полный пререндеринг (Playwright) | ✅ |
| IndexNow при деплое | ✅ |
| GSC / Яндекс / Bing верификация | ✅ Мета-теги (ручная: подтвердить) |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**

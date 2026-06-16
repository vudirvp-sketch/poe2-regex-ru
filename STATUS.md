# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/

---

## Текущая итерация: 42 — ETL char-limit diagnostic

### Резюме

Path D полностью реализован и **production-verified** (iter 41). В iter 42 добавлен **диагностический constraint** для PoE2 char limit ≈ 250 chars: ETL теперь логирует предупреждения для opt-table entries, превышающих лимит. Записи НЕ удаляются и НЕ модифицируются — diagnostic-only (безопасно, ничего не ломает).

- **D1** ✅ — In-game тест Path D на 3-4 alts (iter 39)
- **D2** ✅ — ETL: `path-d-transform.ts` + Phase D в `compute-optimizations.ts` + `iterative-optimizer.ts` (iter 40)
- **D4** ✅ — Runtime: `applyOptimizationTable` применяет Path D даже с negative savings (iter 40)
- **D5** ✅ — In-game верификация на production ETL output: 5/5 тестов PASS (iter 41)
- **D6** ✅ — Распространение на все категории (iter 41)
- **D7** ✅ — ETL char-limit diagnostic (iter 42)
- **D3** ⏳ — regexExclude с усечёнными основами (отдельная задача, не блокирует Path D)

### Что сделано в iter 42

1. **`scripts/etl/path-d-transform.ts`** — добавлены:
   - `POE2_REGEX_CHAR_LIMIT = 250` — каноническая константа (единственный source of truth)
   - `findOverLimitEntries(table, locale?, limit?)` — diagnostic helper, возвращает entries > limit, отсортированные по длине (desc), не модифицирует table

2. **`scripts/etl/compute-optimizations.ts`** — добавлен Phase D1 (после Phase D Path D transform):
   - Логирует WARNING со списком entries >250 chars с length, key preview, regex preview
   - Diagnostic-only — записи остаются в table

3. **`scripts/etl/iterative-optimizer.ts`** — добавлен char-limit diagnostic в final summary:
   - После всех iterations + reoptimizeTable, сканирует финальные таблицы
   - Выводит per-category список over-limit entries + общее предупреждение

4. **`tests/etl/path-d-transform.test.ts`** — добавлено 10 unit-тестов для `findOverLimitEntries` (всего 45 тестов в файле, 1094 всего)

5. **Все 1094 теста проходят** (1084 + 10 новых); TypeScript компилируется без ошибок

6. **ETL verified end-to-end** — Phase D1 warning появляется в логах, final summary показывает 2 over-limit entries в jewel (317 и 260 chars), 0 entries удалено

### Ключевые выводы iter 41 (D5 production-verification) — сохранены

1. **Same-block AND confirmed в PoE2** — `"X" "Y"` матчит когда ОБА quoted-группы в одном блоке. `optimization-strategies.ts` корректен.
2. **Path D работает на 6-9 alts в production** — 11+ alts не тестировались напрямую (превышают 250-char лимит).
3. **Cross-category FP — ожидаемое поведение**, не баг.
4. **PoE2 regex char limit ≈ 250 chars** — iter 41 обнаружил, iter 42 реализовал diagnostic.
5. **No code changes needed (кроме diagnostic)** — ETL pipeline + runtime optimization корректны.

### Текущее состояние opt-table (iter 42, после ETL)

| Метрика | Значение |
|---------|----------|
| Total opt-entries (все 10 категорий) | 529 |
| Path D entries (с top-level `\|`) | 327 |
| Flat entries (без `\|`) | 202 |
| Broken `()`-with-`\|` | 0 |
| Entries > 250 chars | 2 (оба в jewel: 317, 260) |

### Детерминированная стратегия регексов (8 принципов)

| # | Принцип | Описание |
|---|---------|----------|
| 1 | **One Mod = One Quoted Group** | Каждый выбранный мод → одна quoted group с suffix + `.*` bridge + number pattern |
| 2 | **Multi-Mod = AND Across Blocks** | N модов → N quoted groups через пробел: `"mod1" "mod2" "mod3"` (также same-block AND, iter 41) |
| 3 | **`\|` Scope — TOP LEVEL of one quoted group** | `\|` работает на верхнем уровне одного quoted group (с или без `.*`). НЕ работает между quoted groups и внутри `()` с многословными. |
| 4 | **`.*` Bridging Within Single Block** | `"prefix.*suffix"` мостит число и слова в одном блоке |
| 5 | **Suffix Uniqueness** | Найти кратчайший suffix, уникальный для мода в категории (≥3 значимых символов на слово) |
| 6 | **Shared Suffix → Differentiate by Number** | Если suffix shared → number enumeration: `"(1[0-5])%.*suffix"` |
| 7 | **Cross-Block FP Risk** | `"X" "Y"` (AND) может-match разные блоки → FP. Использовать `.*` bridge: `"X.*Y"`. Also матчит same-block (iter 41). |
| 8 | **Same-Family OR → Path D** | `"prefix.*A\|prefix.*B\|prefix.*C"` — один quoted group, top-level `\|`, `.*` мосты. ✅ production-verified iter 41 (6-9 alts). Constraint: ≤250 chars total (iter 42 diagnostic). |

### Подтверждённые ограничения PoE2 (актуально на iter 42)

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"`, `"луками\|посохами"` |
| `\|` top-level в одном quoted group с `.*` мостами (Path D) | ✅ | iter 38-41 |
| `\|` между quoted groups (`"X"\|"Y"`) | ❌ | iter 38: B0 confirmed broken — zero matches |
| `\|` многословный внутри `()` | ❌ | Test 15 — ничего не матчит |
| `\|` после non-`.*` prefix внутри `"..."` (`"prefix (A\|B)"`) | ❌ | Test 16 — матчит только prefix broadly |
| Пробел = AND (cross-block AND **и** same-block AND) | ✅ | iter 41 confirmed same-block |
| `.*` внутри одного блока | ✅ | `"Бездн.*монстр"`, `"увеличение урона.*луками"` |
| `(?!…)` per-block | ✅ | `скорости(?!.*луками)` |
| `!` item-wide negation | ✅ | `"!A\|B"` |
| `^` start-of-block anchor | ✅ | `"^2%.*скорости атаки"` |
| Number enumeration | ✅ | `"(1[0-5])%.*suffix"` |
| Regex char limit ≈ 250 chars | ⚠️ | iter 41: discovered. iter 42: ETL diagnostic implemented. |

### План реализации Path D — финальный статус

| Шаг | Содержание | Статус |
|-----|-----------|--------|
| D1 | In-game test Path D на 3+ альтернативах | ✅ DONE iter 39 |
| D2 | ETL: `path-d-transform.ts` + Phase D + `reoptimizeTable` | ✅ DONE iter 40 |
| D3 | ETL: regexExclude → усечённые основы + `(?!…)` per-block | ⏳ Отдельная задача |
| D4 | Runtime: `applyOptimizationTable` + `buildLiteralNode` совместимость с Path D | ✅ DONE iter 40 |
| D5 | In-game верификация production ETL output | ✅ DONE iter 41 (5/5 PASS) |
| D6 | Распространение на все категории | ✅ DONE iter 41 |
| D7 | ETL char-limit diagnostic | ✅ DONE iter 42 |

### Известные проблемы

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 1 | **Opt-table `"prefix (A\|B\|C)"` сломан** | ✅ РЕШЁН iter 40 (Path D в ETL) | RESOLVED |
| 2 | **AND-in-OR = вложенные кавычки** | ✅ РЕШЁН для opt-table iter 40 (Path D) | RESOLVED for opt-table |
| 3 | **regexExclude: неполные словоформы** — «самострелами» ≠ «самострела» | MEDIUM — D3 | OPEN (отдельная задача) |
| 4 | **Симулятор `(?!…)`** — не полностью моделирует per-block semantics | LOW (только для тестов) | OPEN |
| 5 | **Симулятор `"X"\|"Y"`** — парсит как `"X"` AND `(\|Y)` = `"X"` | LOW (Path D делает эту конструкцию ненужной) | OPEN |
| 6 | **PoE2 regex char limit ≈ 250 chars** — opt-table entries >250 chars нельзя использовать в игре как single regex | MEDIUM | ✅ DIAGNOSTIC iter 42 (entries kept, warning logged) |
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

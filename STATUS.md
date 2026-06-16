# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/

---

## Текущая итерация: 40 — D2+D4 DONE (Path D реализован в ETL + runtime)

### Резюме

Итерация 40 реализовала Path D в ETL pipeline и runtime. Все opt-table записи с сломанным `"prefix (A|B|C)"` паттерном преобразованы в рабочий `"prefix.*A|prefix.*B|prefix.*C"` формат.

1. **D2 DONE** — Path D реализован в `compute-optimizations.ts` (Phase D) и `iterative-optimizer.ts` (`reoptimizeTable`).
2. **D4 DONE** — Runtime совместимость проверена: `applyOptimizationTable` применяет Path D entries даже с negative savings (альтернатива — separate quoted groups — сломана).
3. **303/481 opt-table entries** теперь в Path D формате (top-level `|`), **0 entries** с сломанным `()` паттерном.
4. **Все 1084 теста проходят** (1046 baseline + 35 path-d-transform + 3 D4 runtime).
5. **Код изменён** — ETL pipeline + optimization-strategies.ts + 2 новых файла.

### Что сделано в итерации 40

1. Создан `scripts/etl/path-d-transform.ts` — функция `pathDTransform()` + `hasPathDGroup()` для рекурсивного преобразования `prefix(A|B|C)` → `prefix.*A|prefix.*B|prefix.*C`. Поддержка: nested groups, `[char classes]`, optional `(ь|)`, combined `prefix(A|B)suffix`.
2. Добавлен Phase D в `compute-optimizations.ts` — применяется после Phase C (dialect optimizations).
3. Обновлён `iterative-optimizer.ts` `reoptimizeTable()` — применяет Path D после `applyDialectOptimizations`, с условием обновления broken-entries даже если Path D длиннее.
4. Обновлён `optimization-strategies.ts` `applyOptimizationTable()`:
   - `approxLength` для plain LITERAL теперь использует `approxCompiledLength` (с quotes) — консистентное сравнение savings.
   - Path D entries (regex с top-level `|`) применяются ВСЕГДА когда `matchedIds.size >= 2`, даже с negative savings — альтернатива (separate quoted groups `"X"|"Y"`) сломана в PoE2 (B0).
5. 35 unit-тестов для `path-d-transform.ts` (nested, optional, char classes, edge cases, real-world patterns).
6. 3 D4 runtime-теста в `optimizer.test.ts`: opt-table Path D → `optimize()` → `compile()` → single quoted group с top-level `|`.
7. Обновлены 2 теста в `compute-optimizations.test.ts` — assertions изменены с "shorter than flat OR" на "Path D format (top-level `|`, no `()` with `|`)".
8. ETL перегенерировал все 10 JSON файлов — 303 Path D entries, 0 broken `()` entries.
9. Документация актуализирована: STATUS.md, worklog.md (Task ID 40), AGENT_NAVIGATION.md, docs/IN_GAME_TESTS.md, docs/ARCHITECTURE.md.

### Статистика Path D по категориям

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
| 7 | **Cross-Block FP Risk** | `"X" "Y"` (AND) может-match разные блоки → FP. Использовать `.*` bridge: `"X.*Y"` |
| 8 | **Same-Family OR → Path D** | `"prefix.*A\|prefix.*B\|prefix.*C"` — один quoted group, top-level `\|`, `.*` мосты. ✅ 2/3/4 alt verified in-game (iter 38-39); ✅ AND-combination verified (iter 39); ✅ ETL реализован (iter 40) |

### Подтверждённые ограничения PoE2 (актуально на iter 40)

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"`, `"луками\|посохами"` |
| `\|` top-level в одном quoted group с `.*` мостами (Path D) | ✅ | iter 38: D7-3 verified (2 alt); iter 39: verified 3+4 alt + AND-combination; iter 40: ETL реализован |
| `\|` между quoted groups (`"X"\|"Y"`) | ❌ | iter 38: B0 confirmed broken — zero matches |
| `\|` многословный внутри `()` | ❌ | Test 15 — ничего не матчит |
| `\|` после non-`.*` prefix внутри `"..."` (`"prefix (A\|B)"`) | ❌ | Test 16 — матчит только prefix broadly |
| Пробел = AND (cross-block) | ✅ | `"X" "Y"` |
| `.*` внутри одного блока | ✅ | `"Бездн.*монстр"`, `"увеличение урона.*луками"` |
| `(?!…)` per-block | ✅ | `скорости(?!.*луками)` (симулятор не полностью моделирует — см. D4) |
| `!` item-wide negation | ✅ | `"!A\|B"` |
| `^` start-of-block anchor | ✅ | `"^2%.*скорости атаки"` |
| Number enumeration | ✅ | `"(1[0-5])%.*suffix"` |

### Баги

**Bug A: Opt-table паттерн `"prefix (A|B|C)"` сломан — РЕШЁН (iter 40)**

Path D реализован в ETL. Все 303 opt-table entries с `()` паттерном преобразованы в Path D формат. 0 broken entries остаются.

**Bug B: AND-in-OR = вложенные кавычки — РЕШЁН для opt-table (iter 40)**

С Path D, opt-table больше не генерирует OR(AND(...)) — вместо этого OR содержит только LITERALы (каждый с `.*` мостом внутри). Bug B может быть релевантен только для ручных OR+AND комбинаций.

**Bug C: regexExclude — неполные словоформы (MEDIUM)**

`самострелами` ≠ `самострела`. Нужно использовать усечённые основы: `самострел`, `посох`, `копь`.

### План реализации Path D — статус

| Шаг | Содержание | Статус |
|-----|-----------|--------|
| D1 | In-game test Path D на 3+ альтернативах | ✅ DONE iter 39 |
| D2 | ETL: переработать `compute-optimizations.ts` + `iterative-optimizer.ts` — Path D | ✅ DONE iter 40 |
| D3 | ETL: regexExclude → усечённые основы + `(?!…)` per-block | ⏳ NEXT |
| D4 | Runtime: `applyOptimizationTable` + `buildLiteralNode` совместимость с Path D | ✅ DONE iter 40 |
| D5 | In-game верификация после ETL изменений (4 самоцвета + расширенный набор) | ⏳ |
| D6 | Распространение: амулеты, кольца, пояса, плиты, путевые — ETL уже применяет Path D ко всем категориям; нужен in-game тест | ⏳ |

**⚠️ Шаг D5 — следующий приоритет.** D2/D4 cleared, ETL pipeline полностью преобразует opt-table в Path D формат. Следующая итерация должна:
1. **D5** — in-game тесты на 4 самоцветах + расширенный набор (предметы из `регис/предметы для теста с аффиксами имплиситами_новый.md`).
2. Если D5 PASS — D6 cleared (ETL уже применяет Path D ко всем категориям).
3. Если D5 выявит FP — D3 (regexExclude усечённые основы) или точечная починка конкретных entries.

### Известные проблемы

| # | Issue | Impact |
|---|-------|--------|
| 1 | **Opt-table `"prefix (A\|B\|C)"` сломан** | ✅ РЕШЁН iter 40 (Path D в ETL) |
| 2 | **AND-in-OR = вложенные кавычки** | ✅ РЕШЁН для opt-table iter 40 (Path D); ручные OR+AND комбинации всё ещё могут сломаться |
| 3 | **regexExclude: неполные словоформы** — «самострелами» ≠ «самострела» | MEDIUM — D3 |
| 4 | **Симулятор `(?!…)`** — не полностью моделирует per-block semantics | LOW (только для тестов) |
| 5 | **Симулятор `"X"\|"Y"`** — парсит как `"X"` AND `(\|Y)` = `"X"` | LOW (Path D делает эту конструкцию ненужной) |
| 6 | **Path D `.*` bridges более permissive** — могут вызвать FP в редких случаях | LOW — префикс/суффикс обычно уникальны; D5 in-game верификация подтвердит |

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

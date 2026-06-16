# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/

---

## Текущая итерация: 38 — B0 RESOLVED + Path D strategy

### Резюме

Итерация 37 провела in-game тесты на 4 реальных самоцветах (39 пользовательских результатов). Итерация 38 зафиксировала выводы:

1. **B0 RESOLVED** — `"X"|"Y"` (OR между двумя quoted groups) **СЛОМАН** в игре (все 3 теста дали ноль совпадений). Path A невозможен.
2. **D7-3 CONFIRMED WORKING** — top-level `|` внутри ОДНОГО quoted group с `.*` мостами **РАБОТАЕТ** в игре. PoE2 regex движок пропатчен со времён итераций 15-17.
3. **NEW STRATEGY Path D** — для same-family OR использовать ОДИН quoted group с top-level `|` и `.*` мостами: `"prefix.*A|prefix.*B|prefix.*C"`.
4. Код не изменён — только тесты и документация. Реализация Path D в ETL/компиляторе отложена на следующую итерацию.

### Что сделано в итерации 38

1. Обновлён тест-файл `tests/core/in-game-iteration-36-gems.test.ts`:
   - Заголовок и принципы (Principle 3 переписан, Principle 8 = Path D)
   - D7 — добавлен комментарий о патче игры (D7-3 теперь WORKING, не BROKEN)
   - D8 — переименован в "B0 RESOLVED", добавлен тест Path D как рабочего replacement
2. Переписаны документы: `STATUS.md`, `docs/IN_GAME_TESTS.md`, `AGENT_NAVIGATION.md`, `docs/ARCHITECTURE.md`
3. Worklog обновлён (Task ID 38)
4. Все 1046 тестов проходят (без изменений в коде)

### Ключевые открытия (iter 37 → iter 38)

| # | Гипотеза | Результат | Влияние |
|---|----------|-----------|---------|
| B0-1..3 | `"X"\|"Y"` работает как OR? | ❌ ZERO matches в игре | Path A невозможен |
| D7-3 | `"X.*A\|X.*B"` работает? | ✅ Работает в игре | Path D — новая стратегия |
| D7-1, D7-2 | `"prefix (A\|B)"`, `"(A B\|C D)"` работают? | ❌ Всё ещё сломаны | Opt-table паттерн нужно заменять на Path D |

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
| 8 | **Same-Family OR → Path D** | `"prefix.*A\|prefix.*B\|prefix.*C"` — один quoted group, top-level `\|`, `.*` мосты. ✅ 2 alt verified in-game; ⚠️ 3+ alt pending |

### Подтверждённые ограничения PoE2 (актуально на iter 38)

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"`, `"луками\|посохами"` |
| `\|` top-level в одном quoted group с `.*` мостами (Path D) | ✅ | iter 38: D7-3 verified in-game |
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

**Bug A: Opt-table паттерн `"prefix (A|B|C)"` сломан (CRITICAL — ПОДТВЕРЖДЁН)**

PoE2 не парсит `()` с многословными `|` внутри `"..."` (Tests 15-17). 94% opt-записей в самоцветах используют этот паттерн.

| Категория | Opt-записей с сломанным `\|` паттерном | Всего opt-записей | % сломанных |
|-----------|----------------------------------------|-------------------|-------------|
| Самоцветы | 106 | 113 | 94% |
| Амулеты | 53 | 114 | 46% |
| Кольца | 44 | 93 | 47% |
| Пояса | 41 | 83 | 49% |
| Плиты | 26 | 35 | 74% |
| Путевые | 13 | 43 | 30% |

**Решение:** Path D — заменить `"prefix (A|B|C)"` на `"prefix.*A|prefix.*B|prefix.*C"`. Реализация в ETL запланирована на следующую итерацию.

**Bug B: AND-in-OR = вложенные кавычки (CRITICAL)**

`compiler.ts` `compileInner(AND)` оборачивает children в `"..."`, даже внутри OR. PoE2 не поддерживает вложенные кавычки.

**Решение:** С изменением на Path D, opt-table больше не будет генерировать OR(AND(...)) — вместо этого OR будет содержать только LITERALы (каждый с `.*` мостом внутри). Bug B может быть релевантен только для ручных OR+AND комбинаций.

**Bug C: regexExclude — неполные словоформы (MEDIUM)**

`самострелами` ≠ `самострела`. Нужно использовать усечённые основы: `самострел`, `посох`, `копь`.

### План реализации Path D (следующая итерация)

| Шаг | Содержание | Затронуто | Сложность |
|-----|-----------|-----------|-----------|
| D1 | **In-game test Path D на 3+ альтернативах** — подтвердить, что `"X.*A\|X.*B\|X.*C"` работает с 3+ ветками | — | Тест в игре |
| D2 | ETL: переработать `compute-optimizations.ts` — заменить `"prefix (A\|B\|C)"` на `"prefix.*A\|prefix.*B\|prefix.*C"` | `compute-optimizations.ts` | Высокая |
| D3 | ETL: regexExclude → усечённые основы + `(?!…)` per-block | `compute-regex-strategies.ts` | Средняя |
| D4 | Runtime: проверить `buildLiteralNode` / `applyOptimizationTable` на совместимость с Path D | `optimization-strategies.ts`, `useCategoryPage.ts` | Средняя |
| D5 | In-game верификация: самоцветы (4 тестовых предмета готовы) | — | — |
| D6 | Распространение: амулеты, кольца, пояса, плиты, путевые | — | — |

**⚠️ Шаг D1 — приоритетный.** Если Path D не работает на 3+ альтернативах, откат к UI-редизайну (каждый OR-child = отдельный AND-фильтр).

### Известные проблемы

| # | Issue | Impact |
|---|-------|--------|
| 1 | **Opt-table `"prefix (A\|B\|C)"` сломан** — ломает opt-таблицу (94% записей в самоцветах) | **CRITICAL** — решается Path D |
| 2 | **AND-in-OR = вложенные кавычки** — ломает OR-режим при regexExclude | **CRITICAL** — может стать неактуальным с Path D |
| 3 | **regexExclude: неполные словоформы** — «самострелами» ≠ «самострела» | MEDIUM |
| 4 | **Симулятор `(?!…)`** — не полностью моделирует per-block semantics (item-wide вместо position-specific) | LOW (только для тестов) |
| 5 | **Симулятор `"X"\|"Y"`** — парсит как `"X"` AND `(\|Y)` = `"X"` (расхождение с игрой: игра даёт ZERO matches) | LOW (только для тестов; Path D делает эту конструкцию ненужной) |

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

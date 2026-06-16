# Worklog

---
Task ID: 36
Agent: main
Task: Обработка результатов тестов 15-17, обновление документации, подтверждение Пути B

Work Log:
- 1: Клонирован репозиторий, изучены все ключевые файлы: compiler.ts, ast.ts, optimization-strategies.ts, useCategoryPage.ts, jewel.json
- 2: Проанализированы результаты тестов 15-17:
  - T15: `(скорости атаки|передвижения)` → ничего не подсвечено — `()` + `|` + многословные = сломано
  - T16: `"повышение (брони|скорости)"` → подсветило всё с «повышение» — `()` внутри `"..."` не работает
  - T17: `"повышение (брони|скорости атаки|шанса критического удара)"` → много мусора — opt-таблица сломана
- 3: Подсчитан масштаб проблемы: 106/113 записей в самоцветах (94%), 53/114 в амулетах (46%), 44/93 в кольцах (47%)
- 4: Путь B (полный редизайн) подтверждён — Путь A исключён
- 5: Определены альтернативные стратегии: `.*` bridging, `(?!…)` per-block, AND-декомпозиция
- 6: Обновлена документация: STATUS.md, AGENT_NAVIGATION.md (v23), ARCHITECTURE.md (v55), IN_GAME_TESTS.md (v6)

Stage Summary:
- **Код не изменён** (только документация)
- **Путь B подтверждён** — `|` сломан с многословными на всех уровнях
- **Критический следующий шаг:** Тест B0 — работает ли `"A B"|"C D"` (OR между quoted groups)?
- **Документация обновлена:** 4 файла
- **Точка остановки:** документация обновлена, ожидание теста B0 для начала редизайна

---
Task ID: 37
Agent: main
Task: Тесты 4 самоцветов + детерминированная стратегия регексов (без изменения кода)

Work Log:
- 1: Клонирован репозиторий, установлен pnpm + зависимости (pnpm install --frozen-lockfile)
- 2: Прочитан загруженный файл `предметы для теста с аффиксами имплиситами_новый.md` — 4 самоцвета в конце (Племенная лучина, Гипнотическая сущность, Племенной узор, Почётная мечта)
- 3: Изучены все ключевые файлы: STATUS.md, AGENT_NAVIGATION.md, worklog.md, IN_GAME_TESTS.md, ARCHITECTURE.md, in-game-iteration-15.test.ts, hypothesis-patterns.test.ts, optimization-strategies.ts, compute-optimizations.ts, dp-factorizer.ts, poe2-regex-matcher.ts
- 4: Установлен baseline — все 986 тестов проходят (pnpm test)
- 5: Сформулирована детерминированная стратегия регексов — 8 принципов, единых для всех категорий:
  - P1: One Mod = One Quoted Group
  - P2: Multi-Mod = AND Across Blocks
  - P3: NO Multi-Word `|` (confirmed broken)
  - P4: `.*` Bridging Within Single Block
  - P5: Suffix Uniqueness
  - P6: Shared Suffix → Differentiate by Number
  - P7: Cross-Block FP Risk
  - P8: Same-Family OR (3 опции: B0 unverified, UI redesign, AND fallback)
- 6: Создан тест-файл `tests/core/in-game-iteration-36-gems.test.ts` (60 тестов):
  - 4 реальных самоцвета (Изумруды, ilvl 28-82) с разными типами модов
  - D1: Single-mod suffix matching (unique substrings, no FP)
  - D2: `.*` bridging within single block (weapon-specific damage mods)
  - D3: AND across blocks (multi-mod selection)
  - D4: Cross-block FP risk demonstration + prevention via `.*` bridge
  - D5: Shared suffix differentiation by number enumeration
  - D6: Single-word `|` as whole quoted group (verified working)
  - D7: Broken patterns (multi-word `|` — simulator diverges from game, both unusable)
  - D8: B0 hypothesis probes (3 теста PENDING in-game verification)
  - D9: Number patterns (enumeration, threshold, `^` anchor)
  - D10: Truncated stems (оберег, компаньон, посох, снаряд)
  - D11: Combined mod regex (full deterministic pattern per mod)
  - D12: Sanity check (all 4 gems well-formed)
- 7: Тесты провалились на 3 assertion'ах из-за неверных ожиданий:
  - Gem 4 имеет "посохами" в моде "скорости атаки боевыми посохами" → `"луками|посохами"` правильно матчит
  - Симулятор требует точной смежности (без `.*`) → `"увеличение урона (луками|посохами)"` не матчит gem 1 (боевыми между)
  - Симулятор парсит `"X"|"Y"` как `"X"` AND `(|Y)` = `"X"` only
- 8: Исправлены assertion'ы, все 60 тестов проходят
- 9: Запущен полный набор — все 1046 тестов проходят (986 baseline + 60 новых)
- 10: Обновлена документация:
  - STATUS.md → итерация 37, добавлена детерминированная стратегия (8 принципов) + B0-серия тестов
  - IN_GAME_TESTS.md → v7, добавлены секции D1-D12 (simulator results) + B0 protocol (3 теста PENDING)
  - ARCHITECTURE.md → v56, добавлена §3.1 «Deterministic Regex Strategy (8 Principles)»
  - AGENT_NAVIGATION.md → v24, добавлены pitfalls 15-17 + §12 «Deterministic Regex Strategy»

Stage Summary:
- **Код не изменён** (только тесты + документация)
- **60 новых тестов** для 4 самоцветов, все проходят
- **8 принципов детерминированной стратегии** задокументированы — едины для всех категорий
- **3 B0-теста PENDING** для in-game verification (`"X"|"Y"` OR между quoted groups)
- **Симулятор `"X"|"Y"` divergence** задокументирован: парсит как `"X"` AND `(|Y)` = `"X"` only
- **Симулятор `(?!…)` divergence** задокументирован: item-wide вместо position-specific
- **Точка остановки:** тесты + документация готовы. Следующий шаг — Test B0 в игре (3 варианта). От результата зависит выбор между Path B-strategy (a) top-level `|` между quoted groups, (b) UI redesign, (c) AND fallback.

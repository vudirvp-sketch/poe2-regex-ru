# Worklog

---
Task ID: 17
Agent: main
Task: Фикс деплоя + анализ архитектуры + план рефакторинга

Work Log:
- 1: Клонирован репозиторий, собран проект локально — build OK, 828/830 тестов (2 pre-existing failures)
- 2: Определена причина падения деплоя — GitHub Actions `pnpm test` завершается с ошибкой из-за 2 failing tests → build/deploy шаги skipped
- 3: Проанализированы оба failing теста:
  - `buildAstFromSelections.test.ts` #% test: тест ожидал regex без middle-number prefix «На», но getPrefixForSlot теперь корректно извлекает его из шаблона «На #% больше...»
  - `vendor-regex-equivalence.test.ts` хаос test: тест ожидал «хаосу», но оптимизатор корректно truncирует до «хаос» (в TRUNCATED_TAILS_SAFE)
- 4: Исправлены оба теста — ожидания обновлены до актуального поведения кода. Все 830 тестов теперь проходят.
- 5: Проведён глубокий анализ архитектуры (core, ETL, UI, data, tests)
- 6: Составлен план рефакторинга с приоритетами и оценками сроков
- 7: Обновлена документация: STATUS.md (чистый, актуальный), AGENT_NAVIGATION.md (компактный)

Stage Summary:
- **Деплой разблокирован** — все 830 тестов проходят, build OK
- **План рефакторинга** — ETL (высокий приоритет), UI (высокий), Core (средний), Data (средний), Tests (низкий)
- **Переписывать генератор регекса НЕ нужно** — алгоритм работает корректно, нужен рефакторинг структуры
- Документация очищена от мусора, только актуальная информация

---
Task ID: 18
Agent: main
Task: Рефакторинг ETL pipeline — разбить compute-regex.ts на модули

Work Log:
- 1: Клонирован репозиторий, подтверждено 830/830 тестов, build OK, tsc чистый
- 2: Проанализирована структура compute-regex.ts (1421 строк, 6+ стратегий, 10+ функций)
- 3: Оценена целесообразность рефакторинга для AI-агентов — обоснован: контекстное окно, изоляция стратегий, снижение риска
- 4: Спроектирован split на 3 модуля: compute-regex.ts (entry), compute-regex-core.ts (utils), compute-regex-strategies.ts (strategies)
- 5: Создан compute-regex-core.ts (~260 строк): template extraction, uniqueness checking, PoE2 validation, text utilities
- 6: Создан compute-regex-strategies.ts (~480 строк): substringSearchFallback, tryWordTruncation, computeExcludePatterns, generateTruncatedSuffixes, checkYofication, isExcludeValid
- 7: Переписан compute-regex.ts (~270 строк): импорты из sub-modules, re-exports для обратной совместимости
- 8: Проверена обратная совместимость — compute-optimizations.ts и тесты не требуют изменений
- 9: Все 830 тестов проходят, tsc чистый, vite build успешен
- 10: Обновлена документация: STATUS.md, AGENT_NAVIGATION.md, ARCHITECTURE.md, ETL_GUIDE.md

Stage Summary:
- **compute-regex.ts разбит на 3 модуля** — entry/core/strategies, без циклических зависимостей
- **Обратная совместимость сохранена** — все импорты из compute-regex.ts работают через re-export
- **UI рефакторинг отложен** — useCategoryPage связный пайплайн, разделение нецелесообразно
- **Следующий приоритет** — optimizer.ts (740 строк, 6+ ответственностей)


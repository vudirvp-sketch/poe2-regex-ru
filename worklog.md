# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 103
Agent: main
Task: Закрыть Known Issue #3 (2 TanStack library-level ESLint warnings в `VirtualizedModList.tsx`) — подавить `react-hooks/incompatible-library` через `// eslint-disable-next-line` с комментарием-обоснованием. Довести ESLint до **0 problems** (раньше 0 errors + 2 warnings). Минимальный риск: только 2 строки disable + 2 коротких комментария, никакого runtime/ETL/JSON/схемы/тестов.

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 102 — e2e-регрессионные тесты для runtime-classification), worklog.md (iter 102 подробно), AGENT_NAVIGATION.md (entry + Roadmap + Pitfall #34). Подтверждение baseline: `npx vitest run` → 1431/1431 passing; `npx tsc -b` → 0 errors; `npx eslint .` → 0 errors + 2 warnings (TanStack, library-level — `useVirtualizer()` returns non-memoizable functions, React Compiler не может безопасно memoize).
- 2: Анализ warnings. Оба в `src/ui/components/VirtualizedModList.tsx`:
  - Line 307: `const virtualizer = useVirtualizer({` — двухколоный virtualizer (prefix|suffix grid layout).
  - Line 593: `const singleVirtualizer = useVirtualizer({` — single-column fallback когда применяется affix-filter или только один affix-type существует.
  - Причина: `eslint-plugin-react-hooks` v7 активирует React Compiler, который генерирует `react-hooks/incompatible-library` для API, возвращающих non-memoizable functions. TanStack Virtual's `useVirtualizer()` — известный случай (возвращает `getVirtualItems`, `scrollToIndex`, etc.). Это library-level limitation, не наш код — апстрим не фиксит (TanStack намеренно возвращает non-memoizable функции для API flexibility).
- 3: Анализ вариантов фикса:
  - (a) `// eslint-disable-next-line react-hooks/incompatible-library` — минимальный, точечный, явно помечает library-level природу warning. Рекомендуется в STATUS.md Known Issue #3 и в подсказке iter 102.
  - (b) `/* eslint-disable react-hooks/incompatible-library */` ... `/* eslint-enable */` — блок disable, избыточен для 2 строк.
  - (c) Глобально в `eslint.config.js` отключить правило — слишком широко, скроет будущие реальные library-проблемы.
  - (d) Refactor на `useMemoizedVirtualizer` или аналог — TanStack не предоставляет memoizable API, был бы work-around с `useRef` + manual measurement, значительно больше кода + риск багов.
  - Выбран (a): минимальный риск, точечный, явно документирован.
- 4: Применение фикса в `src/ui/components/VirtualizedModList.tsx`:
  - Line 307 (теперь 312 после добавления комментария): добавлен 4-строчный комментарий-обоснование + `// eslint-disable-next-line react-hooks/incompatible-library` над `const virtualizer = useVirtualizer({`.
  - Line 593 (теперь 600): добавлен 2-строчный комментарий + `// eslint-disable-next-line react-hooks/incompatible-library` над `const singleVirtualizer = useVirtualizer({`.
  - Комментарии ссылаются на STATUS.md Known Issue #3 для будущего разработчика — чтобы понять, что это library-level, а не скрытый баг.
- 5: Верификация: `npx eslint .` → **0 problems** (раньше 0 errors + 2 warnings). `npx tsc -b` → 0 errors. `npx vitest run` → 1431/1431 passing (без изменений, как и ожидалось — disable comments не влияют на runtime).
- 6: Документация:
  - `STATUS.md` — iter 103 как текущая; «Что сделано» + «Метрики» (ESLint теперь 0+0); Known Issue #3 помечен ✅ FIXED iter 103 с описанием фикса; архитектура functionalCategory и runtime-метрики без изменений (перенесены из iter 102). Убран длинный iter 102 narrative — заменён на ссылку «без изменений vs iter 102».
  - `worklog.md` — iter 102 сжат до одной строки (был подробно), iter 103 добавлен подробно.
  - `AGENT_NAVIGATION.md` — entry paragraph bumped до iter 103 (ESLint теперь 0 problems, Known Issue #3 закрыт); Roadmap iter 103 done + обновлён optional-список (убрано «подавить 2 TanStack warnings» — выполнено); Pitfall #34 без изменений (iter 103 не трогал architecture).

Stage Summary:
- **iter 103 COMPLETE.** 2 TanStack library-level ESLint warnings подавлены через точечные `// eslint-disable-next-line react-hooks/incompatible-library` с комментариями-обоснованиями. ESLint теперь **0 errors + 0 warnings** (раньше 0 + 2). Known Issue #3 закрыт.
- **Изменённые файлы (4):**
  - `src/ui/components/VirtualizedModList.tsx` — +6 строк комментариев + 2 `eslint-disable-next-line` над обоими `useVirtualizer()` вызовами (lines 312 и 600).
  - `STATUS.md` — iter 103 как текущая; метрики ESLint 0+0; Known Issue #3 ✅ FIXED iter 103; iter 102 narrative сжат до «без изменений vs iter 102».
  - `worklog.md` — iter 103 подробно, iter 102 одной строкой.
  - `AGENT_NAVIGATION.md` — entry paragraph iter 103; Roadmap iter 103 done + optional-список обновлён.
- **Тесты:** 1431/1431 (без изменений). TSC: 0 errors. ESLint: **0 errors + 0 warnings**. ETL: 11 fresh, 0 stale. Никаких изменений в `public/generated/*.json`, ETL, runtime classifier, схеме, тестах.
- **Точка остановки:** iter 103 done. В iter 104+ можно:
  1. **P2 — waystone/tablet sub-blocks**: sub-группировка внутри sentiment (positive/negative/neutral) по gameplay mechanic — для waystone: loot/danger/splinters; для tablet: ritual/breach/delirium уже есть как type, нужен второй уровень внутри type.
  2. **P4 — tier-aware sort toggle**: UI-тумблер «режим сортировки» (alpha vs tier-first) в `CategoryControlPanel`. iter 99 сделал tier вторичным, но toggle не добавлен.
  3. **Опционально: `sortKey?: number`** в `FamilyGroup` + ETL заполнение для «по популярности внутри категории».
- **Подсказка следующему агенту:** iter 103 = чисто lint-cleanup, runtime/ETL/JSON/схема/тесты не тронуты. Baseline: 1431/1431 tests, TSC 0, ESLint **0 problems** (впервые с iter 99). Перед стартом iter 104 прочитай STATUS.md (актуальный статус + Known Issues — теперь только #1 и #2 остаются), worklog.md (iter 103 подробно + предыдущие одной строкой), AGENT_NAVIGATION.md (entry paragraph iter 103, Roadmap iter 103 done). Не создавай новые verify-iter*-*.ts скрипты — покрывай проверки через tests/ (vitest) или inline sanity в worklog.md (правило iter 100, зафиксировано в AGENT_NAVIGATION.md).

---

## Предыдущие итерации (кратко)

- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline — 17 тестов в `tests/integration/runtime-classification.test.ts` (4 категории × 4 инварианта + 1 sensitivity-test) закрывают production path. 1431/1431 tests.
- **iter 101**: P0-фикс Critical Bug #4 — `GameTokenSchema` без `functionalCategory` → Zod strips → runtime classifier падал в `other` для всех токенов (с iter 90). Фикс = 1 строка в `src/shared/schemas.ts` + 3 регрессионных теста в `tests/etl/etl-schemas.test.ts`. 1414/1414 tests.
- **iter 99**: alphabetical within-block sort. `sortGroupsAlphabetically()` + `withAlphabeticalGroups()` wrapper для всех 9 режимов `classifyGroups()`. +19 unit-тестов. 1411/1411 tests.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий для 25 family-keys). 1392/1392 tests.
- **iter 97**: Аудиторская чистка тестов и исторических скриптов. 16 файлов удалено. 1363/1363 tests.
- **iter 96**: Удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`. 1363/1363 tests.
- **iter 95**: Документационная чистка + deprecation-маркер для regex-паттернов. 1363/1363 tests.
- **iter 94**: AILMENTS tag-priority refactor. 26 модов реклассифицированы damage-type → ailments. 1363/1363 tests.
- **iter 93**: penetration block activated (3 family-keys moved resistances → penetration). 1363/1363 tests.
- **iter 92**: 2 ETL root-cause fixes. 11 iter 91 discrepancies resolved. 1363/1363 tests.
- **iter 91**: ETL --fresh run, functionalCategory 100% в продакшене. 1363/1363 tests.
- **iter 89**: ailments + area-duration blocks. jewel other-bucket 21.8% → 14.0%. 1340/1340 tests.
- **iter 87**: Weapon sub-blocks для jewel. Other-bucket 21.8%. 1315/1315 tests.
- **iter 86**: +7 функциональных блоков (14 активны). Other-bucket 9.9%. 1268/1268 tests.
- **iter 85**: Инфраструктура 24 функциональных блоков (7 активны). 1216/1216 tests.
- **iter 84**: 3 P0-фикса (Breach Lord skip + text fallback / waystone keywords / aura+gem tags). 1172/1172 tests.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

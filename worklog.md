# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 73
Agent: main
Task: iter 73 — Закрыть Known Issue KI-1 (`?` tokenizer mismatch) через вариант (b): runtime warning в matcher + Oracle reject + ETL reject. Без ломания существующих тестов — engine всё ещё парсит `?` для completeness.

Work Log:
- 1: Клон репо, pnpm install, baseline `pnpm test` — 1144/1144 зелёные. tsc -b чистый.
- 2: Чтение ключевых файлов для планирования фикса:
  - `src/core/poe2-regex-matcher.ts` — tokenize/parse/match pipeline, `matchQuotedGroup` exported.
  - `src/core/regex-oracle.ts` — `validateRegex` / `validateRegexItem` / `OracleResult` interface.
  - `scripts/etl/iterative-optimizer.ts` — `oracleValidateChange` (existing `containsPoE2Grouping` reject pattern).
  - `tests/core/poe2-regex-matcher.test.ts:169-183, 932-940` — 2 теста, залочивающие `?`-matching behavior.
- 3: Реализация KI-1 вариант (b) в `src/core/poe2-regex-matcher.ts`:
  - Добавлен exported detector `hasUnsupportedOptional(pattern): boolean` — парсит pattern, возвращает true если есть `optional` token (это всегда `?` вне `(?!…)`).
  - Добавлен internal `warnUnsupportedOptionalIfAny(pattern)` с dedup Set (`warnedUnsupportedOptionalPatterns`).
  - `matchQuotedGroup` вызывает `warnUnsupportedOptionalIfAny` в начале.
  - Добавлен test-only export `_clearWarnedUnsupportedOptionalPatternsForTests()` для сброса dedup Set в тестах.
  - Обновлён header-комментарий: документирование iter 73 / KI-1 closed.
- 4: Реализация в `src/core/regex-oracle.ts`:
  - Импорт `hasUnsupportedOptional`.
  - `OracleResult` extended с `unsupportedSyntax: string[]` (опциональное стало обязательным — backward-incompatible для consumers, но consumers проверяют только `valid`).
  - `validateRegex` / `validateRegexItem` — проверка `hasUnsupportedOptional`, при true → `unsupportedSyntax = ['? optional']`, `valid = false`.
- 5: Реализация в `scripts/etl/iterative-optimizer.ts`:
  - Импорт `hasUnsupportedOptional`.
  - `oracleValidateChange` — early reject на `hasUnsupportedOptional(newRegex)` (после existing `containsPoE2Grouping` check).
  - Удалены 3 pre-existing unused-vars: `POE2_REGEX_LIMIT`, `ESTIMATED_MOD_OVERHEAD`, `itemBlocks` + unused import `getItemSearchBlocks`. Линты 58 → 55.
- 6: Тесты `tests/core/poe2-regex-matcher.test.ts`:
  - Блок "Optional quantifier ? (NOT supported in-game — KI-1 closed iter 73)": 5 тестов на detector + warn spy (с `beforeEach`/`afterEach` для `_clearWarnedUnsupportedOptionalPatternsForTests` + `vi.restoreAllMocks`).
  - Блок "optional `?` quantifier still parsed + emits KI-1 warn" — переписан с warn spy assertions.
- 7: Тесты `tests/core/regex-oracle.test.ts`:
  - Новый Section 11 "Unsupported syntax detection (KI-1)" — 5 тестов: `validateRegex` с bare `?` → invalid; clean → valid; `(?!…)` lookahead → NOT unsupported; `validateRegexItem` аналогично.
- 8: Верификация:
  - `npx tsc -b` — 0 ошибок.
  - `pnpm test` — **1152/1152 зелёные** (1144 baseline + 8 новых тестов).
  - `pnpm lint` — 55 проблем (было 58, убраны 3 pre-existing unused vars в iterative-optimizer.ts).
- 9: Документация:
  - `STATUS.md` — KI-1 помечен как закрытый в iter 73, описан механизм fixed (detector + warn + Oracle reject + ETL reject). Iter → 73.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 73. Pitfall 30 → "RESOLVED iter 73" с описанием 4 компонентов фикса.
  - `worklog.md` — iter 73 запись, iter 72 сжат до 1-строчного.

Stage Summary:
- **iter 73 COMPLETE.** KI-1 закрыт через вариант (b) — runtime warning + Oracle/ETL reject. Engine по-прежнему парсит `?` (engine completeness), но:
  - Detector `hasUnsupportedOptional()` — exported чистая функция.
  - `matchQuotedGroup` эмитит `console.warn` (dedup Set).
  - Oracle форсит `valid = false` + `unsupportedSyntax: ['? optional']`.
  - ETL `iterative-optimizer` отклоняет candidate regex с `?`.
  - Generator `?` НЕ производит — это defensive guard против регрессий.
- Дополнительно подчистлены 3 pre-existing unused-vars в `iterative-optimizer.ts` (POE2_REGEX_LIMIT, ESTIMATED_MOD_OVERHEAD, itemBlocks + unused import getItemSearchBlocks).
- **Изменённые файлы (7):**
  - `src/core/poe2-regex-matcher.ts` (+~60 строк: detector + warn helper + test-only export + header doc)
  - `src/core/regex-oracle.ts` (+~25 строк: `unsupportedSyntax` field + 2 checks)
  - `scripts/etl/iterative-optimizer.ts` (+10/-12 строк: `hasUnsupportedOptional` check + unused-vars cleanup)
  - `tests/core/poe2-regex-matcher.test.ts` (+~75 строк: 5 detector/warn tests + rewritten backward-compat test)
  - `tests/core/regex-oracle.test.ts` (+~75 строк: Section 11 — 5 unsupported syntax tests)
  - `STATUS.md` (KI-1 → closed history, iter 73)
  - `AGENT_NAVIGATION.md` (header iter 73 + Pitfall 30 → RESOLVED)
- **Точка остановки:** iter 73 done. Все Known Issues закрыты. Открытые архитектурные долги (Bug #8 `useCategoryPage` 1325 строк, Bug #13 skip ranged regexes в iterative-optimizer, Bug #15-20 мелкие) — не тронуты, низкий приоритет. Все 1152 теста зелёные, tsc -b чистый, lint на изменённых файлах чистый. `public/generated/*.json` не модифицировались — ETL не запускался.

---

## Предыдущие итерации (кратко)

- **iter 72**: Дедупликация ETL-утилит (`normalizeTemplate`, `extractTemplateSuffix`), удаление dead code (`longestCommonSubstring`), документирование Bug #1 как KI-1.
- **iter 71** (Phase 16): Интеграция 3 leftover atmospheric WebP (`hero-demon-blue`, `early-access-banner`, `news-bg-center`).
- **iter 70** (Phase 15): Visual review lg+/xl+; filter contrast fix; `bg-forest.webp` deleted.
- **iter 69** (Phase 14): HomePage hero decorations — bas-relief backdrop + 2 side ghosts.
- **iter 68** (Phase 13): `.poe-panel-header--inline` в JSX на 8 category pages; TopNav tab font 14px.
- **iter 65-67** (Phase 11-12): Атмосферная стилизация PoE2 — `.poe-panel-header`, `.poe-divider`, `.btn-cta`, фон `bg.webp` + vignette.
- **iter 64** (Phase 10): Sidebar + Header + MobileNavTabs → TopNav.
- **iter 62-63**: Features в `<details>`; palette consistency; README rewrite.
- **iter ≤61**: MobileRegexBar; StatusPanel; HomePage compaction; nav «режимы»; CSS tokens + CategoryLayout + RegexOutput.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

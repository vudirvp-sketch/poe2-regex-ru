# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 72
Agent: main
Task: iter 72 — Верификация анализа кодовой базы, дедупликация ETL-утилит, удаление dead code, документирование Bug #1 (? tokenizer mismatch) как Known Issue.

Work Log:
- 1: Клон репо, чтение STATUS.md / worklog.md / AGENT_NAVIGATION.md / package.json.
- 2: pnpm install + `pnpm test` — baseline 1144 тестов зелёные.
- 3: Верификация анализа из чата (чтение исходников):
  - **Bug #1 (?)** — ПОДТВЕРЖДЁН. `poe2-regex-matcher.ts:111-113` парсит `?` как `optional`, matcher успешно матчит. Тесты в `tests/core/poe2-regex-matcher.test.ts:169-183, 932-940` явно залочивают поведение с комментарием "PoE2 does NOT support".
  - **Bug #5 (limits.ts escape в [...])** — НЕ ПОДТВЕРЖДЁН. Код корректно обрабатывает escape внутри char class.
  - **Bug #6 (path-d-transform.ts escape edge case)** — НЕ ПОДТВЕРЖДЁН. На практике regex не заканчивается на `\`, edge case не реален.
  - **Bug #9 (`hasYofication/yoficationPositions` dead data flow)** — АНАЛИЗ ОШИБСЯ. Поля ИСПОЛЬЗУЮТСЯ в `useCategoryPage.ts:950, 976` в `applyRuntimeYofication`.
  - **Bug #10 (`normalizeTemplate` дубликат)** — ПОДТВЕРЖДЁН. `compute-regex-core.ts:43-48` и `compute-optimizations.ts:30-35` — идентичны.
  - **Bug #11 (`extractTemplateSuffix` дубликат)** — ПОДТВЕРЖДЁН. `compute-regex-core.ts:61-89` и `iterative-optimizer.ts:446-458` — идентичны.
  - **Bug #12 (`longestCommonSubstring` dead code)** — ПОДТВЕРЖДЁН. 32 строки + `@ts-expect-error`.
- 4: Фикс Bug #10 — удалил дубликат `normalizeTemplate` из `compute-optimizations.ts`, импортировал из `compute-regex-core.ts`.
- 5: Фикс Bug #11 — удалил дубликат `extractTemplateSuffix` из `iterative-optimizer.ts`, импортировал из `compute-regex-core.ts`.
- 6: Фикс Bug #12 — удалил dead code `longestCommonSubstring` (32 строки) из `compute-optimizations.ts`.
- 7: Верификация: `npx tsc -b` — OK (0 ошибок). `pnpm test` — 1144/1144 зелёные. `npx eslint` на изменённых файлах — 3 ошибки в `iterative-optimizer.ts`, проверил через `git stash` — все 3 предсуществовали (POE2_REGEX_LIMIT, ESTIMATED_MOD_OVERHEAD, itemBlocks — unused vars), не связаны с моими правками.
- 8: Документация:
  - `STATUS.md` — полная переработка. Удалены устаревшие таблицы (UI Redesign phases, Atmospheric Assets table). Добавлен Known Issue KI-1 (`?` tokenizer mismatch) с описанием, mitigation, и планом фикса.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 72. Добавлен Pitfall 30 (`?` tokenizer mismatch = Oracle FP risk).
  - `worklog.md` — iter 72 section, старые итерации сжаты до 1-строчного списка.

Stage Summary:
- **iter 72 COMPLETE.** 3 safe-фикса: дедупликация 2 ETL-утилит + удаление dead code. Bug #1 задокументирован как Known Issue KI-1 (фикс отложен — требует решения: ломать тесты или добавлять warning в matcher).
- **Изменённые файлы (6):**
  - `scripts/etl/compute-optimizations.ts` (−47 строк: -17 дубликат `normalizeTemplate`, -32 dead code `longestCommonSubstring`)
  - `scripts/etl/iterative-optimizer.ts` (−16 строк: дубликат `extractTemplateSuffix` удалён, импорт из `compute-regex-core.ts`)
  - `STATUS.md` (полная переработка, ~50 строк против ~80 ранее)
  - `AGENT_NAVIGATION.md` (header iter 72 + Pitfall 30)
  - `worklog.md` (iter 72 + сжатие)
- **Точка остановки:** iter 72 done. Открыт Known Issue KI-1 (`?` tokenizer mismatch) — нужен дизайн-ф decision: (a) ломать тесты в `poe2-regex-matcher.test.ts` и делать `?` fatal-error, или (b) добавить runtime-warning в matcher + Oracle. Прочие архитектурные долги (Bug #8 `useCategoryPage` 1325 строк, Bug #13 skip ranged regexes) — не тронуты, низкий приоритет. Все 1144 теста зелёные, tsc -b чистый.

---

## Предыдущие итерации (кратко)

- **iter 71** (Phase 16): Интеграция 3 leftover atmospheric WebP (`hero-demon-blue`, `early-access-banner`, `news-bg-center`).
- **iter 70** (Phase 15): Visual review lg+/xl+; filter contrast fix; `bg-forest.webp` deleted.
- **iter 69** (Phase 14): HomePage hero decorations — bas-relief backdrop + 2 side ghosts.
- **iter 68** (Phase 13): `.poe-panel-header--inline` в JSX на 8 category pages; TopNav tab font 14px.
- **iter 65-67** (Phase 11-12): Атмосферная стилизация PoE2 — `.poe-panel-header`, `.poe-divider`, `.btn-cta`, фон `bg.webp` + vignette.
- **iter 64** (Phase 10): Sidebar + Header + MobileNavTabs → TopNav.
- **iter 62-63**: Features в `<details>`; palette consistency; README rewrite.
- **iter ≤61**: MobileRegexBar; StatusPanel; HomePage compaction; nav «режимы»; CSS tokens + CategoryLayout + RegexOutput.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

# Worklog

---
Task ID: 50
Agent: main
Task: Закрыть Known Issue #5 — runtime split для over-limit regex (>250 chars) + фикс ETL bug (patchOptimizationEntries mixed context). Документация: чисто, без мусора.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: AGENT_NAVIGATION v49, STATUS.md iter 49 (Known Issue #5 OPEN), worklog Task 49 (multi-LITERAL AND-in-OR transform).
- 2: Глубокий анализ проблемы — найдено 2 over-limit записи в jewel: 317 chars (9 alts, «увеличение.*области действия|...») и 260 chars (11 alts, «увеличение.*уклон.*ения|...»). Проанализированы два подхода: ETL split vs runtime split.
- 3: Семантический анализ: ETL split меняет семантику OR→AND (неверно). Runtime split — правильный подход: каждая часть — корректный OR, пользователь ищет по очереди.
- 4: Найден ETL Bug: `patchOptimizationEntries()` в `run-etl.ts` некорректно добавляла regexPrefixContext когда часть токенов имела контекст, а часть — нет. Условие `contexts.size <= 2 && contexts.has('')` → FN (не-миньонные альтернативы требовали "имеют").
- 5: Фикс ETL Bug: изменено условие на `contexts.size === 1` (ВСЕ токены должны иметь одинаковый непустой контекст). Файл: `scripts/run-etl.ts`.
- 6: Удалён некорректный `regexPrefixContext` из 317-char записи в `public/generated/jewel.json`.
- 7: Реализован runtime split — `splitOverLimitRegex()` в `src/core/limits.ts`:
  - `splitTopLevelAlternations()`: разбивает regex на альтернативы по top-level `|`
  - `groupAlternativesByBudget()`: группирует альтернативы в чанки ≤250 chars
  - `splitOverLimitRegex()`: публичная функция, вызывается из useCategoryPage
- 8: Обновлён `useCategoryPage.ts`: добавлено `regexParts: string[] | undefined` — результат `splitOverLimitRegex()` при overflow.
- 9: Обновлён `RegexOutput.tsx`: при `showParts` (overflow + regexParts.length > 1) отображает split hint + каждый part с кнопкой копирования и счётчиком символов. Компонент `PartCopyButton` для per-part copy.
- 10: Обновлён `CategoryControlPanel.tsx` + все 8 category pages — добавлен prop `regexParts`.
- 11: Добавлены i18n ключи: `regex.part_label` ("Часть {n} из {total}"), `regex.split_hint` ("Регулярка >250 символов — разбита на части...").
- 12: Добавлены 12 NEW tests в `tests/core/limits.test.ts` для `splitOverLimitRegex()`: within limit, no top-level |, split at |, reconstruct, escape sequences, character classes, grouping depth, actual jewel entries (317+260 chars), ^ anchor preservation.
- 13: Верификация: `npx tsc -b` → 0 errors. `npx vitest run` → **1144 passed** (1132 baseline + 12 NEW).

Stage Summary:
- **iter 50 FIX 1 (ETL Bug):** `patchOptimizationEntries()` в `run-etl.ts` — усилено условие для regexPrefixContext: `contexts.size === 1` вместо `contexts.size <= 2`. Смешанные контексты больше не патчатся.
- **iter 50 FIX 2 (Known Issue #5 CLOSED):** Runtime split для over-limit regex. `splitOverLimitRegex()` в `limits.ts` разбивает OR-группы >250 chars на 2+ части, каждая ≤250 chars. UI показывает части отдельно.
- **Real-world impact:** 2 over-limit записи в jewel (317+260 chars) теперь разбиваются на 2+ копируемых regex. 11 "увеличение" токенов больше не получают ошибочный regexPrefixContext "имеют".
- **Tests:** 1144 passed (+12 NEW). TypeScript clean.
- **Files MODIFIED (13) + NEW (0):**
  - `scripts/run-etl.ts` — patchOptimizationEntries context condition fix
  - `public/generated/jewel.json` — removed incorrect regexPrefixContext from 317-char entry
  - `src/core/limits.ts` — added `splitOverLimitRegex()`, `splitTopLevelAlternations()`, `groupAlternativesByBudget()`
  - `src/ui/hooks/useCategoryPage.ts` — added `regexParts` field, `splitOverLimitRegex()` call on overflow
  - `src/ui/components/RegexOutput.tsx` — split regex display with per-part copy buttons
  - `src/ui/components/CategoryControlPanel.tsx` — added `regexParts` prop
  - `src/ui/pages/jewel/JewelPage.tsx` — destructured + passed `regexParts`
  - `src/ui/pages/amulet/AmuletPage.tsx` — destructured + passed `regexParts`
  - `src/ui/pages/ring/RingPage.tsx` — destructured + passed `regexParts`
  - `src/ui/pages/belt/BeltPage.tsx` — destructured + passed `regexParts`
  - `src/ui/pages/relic/RelicPage.tsx` — destructured + passed `regexParts`
  - `src/ui/pages/waystone/WaystonePage.tsx` — destructured + passed `regexParts`
  - `src/ui/pages/tablet/TabletPage.tsx` — destructured + passed `regexParts`
  - `src/ui/pages/vendor/VendorPage.tsx` — destructured + passed `regexParts`
  - `src/shared/i18n.ts` — added `regex.part_label`, `regex.split_hint`
  - `tests/core/limits.test.ts` — added 12 NEW tests for `splitOverLimitRegex()`
  - `STATUS.md` — iter 50, Known Issue #5 CLOSED
  - `AGENT_NAVIGATION.md` — iter 50, §6 dialect + §8 Pitfall 17/18 updated
  - `worklog.md` — Task 50 entry (this)
- **Known Issues (после iter 50):**
  - ✅ #1-#5 ALL CLOSED
  - No open known issues
- **Точка остановки:** iter 50 COMPLETE. All Known Issues CLOSED. Code + tests + docs updated.

---
Task ID: 49
Agent: main
Task: Закрыть Known Issue #4 / Pitfall 11 — расширить `normalizeAst` transform в `src/core/compiler.ts` для AND с multi-LITERAL + EXCLUDE внутри OR. Документация: чисто, без мусора.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: AGENT_NAVIGATION v48 (§6 dialect, §8 Pitfall 11/16), STATUS.md iter 48 (Known Issues #4/#5 OPEN), worklog Task 48 (последний code-фикс — `(?!…)` lookahead tokenizer) + Task 47 (docs cleanup) + Task 46 (production form `^(?!…).*Z` in-game verified), src/core/compiler.ts (normalizeAst case 'OR' — текущий transform с restriction `child.children.length !== 2`), tests/core/optimizer.test.ts (test на строке 874 явно документирует limitation: "preserves AND with multiple LITERALs + EXCLUDE inside OR (no transform)"), tests/core/poe2-regex-matcher.test.ts Section 11 (iter 48 semantic regression tests).
- 2: Анализ данных — количество токенов с BOTH regexPrefixContext AND regexExclude (форма AND(LITERAL_ctx, LITERAL_regex, EXCLUDE(...))): amulet=6, jewel=6, ring=8 (миньоньи моды — "Приспешники имеют ... повышение..."). Без фикса эти 20 токенов в OR-mode компилируются в nested quotes (`"ctx" "regex" "!A|B"|other`), которые PoE2 не парсит. Реальный user-visible bug, не theoretical.
- 3: Базовая верификация: `pnpm test` → 1118 passed (baseline iter 48). `pnpm exec tsc -b` → 0 errors. `pnpm lint` → 59 problems (pre-existing).
- 4: Реализован фикс (1 surgical изменение в `src/core/compiler.ts` `normalizeAst` case 'OR'):
  - Заменена проверка `child.children.length !== 2` на более гибкую: filter LITERALs + EXCLUDEs; require ≥1 LITERAL + ровно 1 EXCLUDE + sum equals child.children.length (no RANGE/AND/MULTI_RANGE).
  - LITERALs мерджатся через `.*` bridges: `^(?!.*A).*lit1.*lit2.*...` (single quoted group).
  - tokenId preservation: берётся первый LITERAL с tokenId (regex LITERAL; context LITERAL обычно без tokenId).
  - Type guards через `(c): c is Extract<ASTNode, { type: 'LITERAL' }> => c.type === 'LITERAL'` — убирает `any` cast из baseline (lint improvement: 59 → 58 problems).
- 5: Обновлён существующий test в `tests/core/optimizer.test.ts` (строка 874) — теперь assertions подтверждают NEW behavior (`"^(?!.*A)(?!.*B).*ctx.*X|Q"`). Добавлены 3 NEW structural tests: 3 LITERALs stress, single-LITERAL EXCLUDE (not OR), tokenId preservation, RANGE block (conservative bail).
- 6: Добавлены 10 NEW semantic regression tests в `tests/core/poe2-regex-matcher.test.ts` Section 12 (iter 49): single-quoted multi-LITERAL, OR-context multi-LITERAL (^-no-leak), multiple excludes + multi-LITERAL, item-level matching. Source data: amulet.minioncriticalstrikechancering (регис/Амулеты моды.md + generated/amulet.json).
- 7: Создан `scripts/verify-iter49.ts` — end-to-end verification скрипт (5 tests: multi-LITERAL transform, semantic checks, multi-excludes, top-level AND boundary, real-world amulet scenario). Запуск: `pnpm exec tsx scripts/verify-iter49.ts` → ALL TESTS PASS.
- 8: Верификация:
  - `pnpm exec tsc -b` → 0 errors.
  - `pnpm test` (full suite) → **1132 passed** (1118 baseline + 4 structural iter 49 + 10 semantic iter 49).
  - `pnpm lint` → 58 problems (was 59 — на 1 меньше, благодаря proper type guards вместо `any` cast).
  - `pnpm exec tsx scripts/verify-iter49.ts` → ALL 5 verification tests PASS.
- 9: Обновлена документация:
  - `STATUS.md` — iter 49 fix section + Known Issue #4 → CLOSED. Tests count 1132. Стратегия "Token с regexPrefixContext + regexExclude в OR mode" добавлена в optimal strategies таблицу.
  - `AGENT_NAVIGATION.md` — current state iter 49, §6 dialect note updated (multi-LITERAL), §8 Pitfall 11 rewritten (closed) + Pitfall 16 updated.
  - `docs/IN_GAME_TESTS.md` — dialect table note + rule #10 updated.
  - `worklog.md` — Task 49 entry (this).

Stage Summary:
- **iter 49 FIX IMPLEMENTED:** `src/core/compiler.ts` `normalizeAst` case 'OR' — extended AND-in-OR-with-EXCLUDE transform to multi-LITERAL case (was: only 1 LITERAL + 1 EXCLUDE). 1 surgical change.
- **Known Issue #4 / Pitfall 11 CLOSED.** Compiler now handles `AND(LITERAL_ctx, LITERAL_regex, EXCLUDE(...))` inside OR → `^(?!…).*ctx.*regex` (single quoted group, no nested quotes).
- **Real-world impact:** 20 токенов с BOTH regexPrefixContext AND regexExclude (amulet=6, jewel=6, ring=8 — minion mods) теперь компилируются корректно в OR-mode. Раньше — nested quotes = broken regex.
- **Tests:** 1132 passed (+14 NEW: 4 structural + 10 semantic). TypeScript clean. Lint: −1 problem (59→58, proper type guards instead of `any`).
- **Files MODIFIED (5) + NEW (1):**
  - `src/core/compiler.ts` — `normalizeAst` case 'OR' extended (multi-LITERAL merge via `.*` bridges).
  - `tests/core/optimizer.test.ts` — 1 test updated (was: documents limitation; now: asserts fix). +4 NEW structural tests.
  - `tests/core/poe2-regex-matcher.test.ts` — Section 12 added (10 NEW semantic regression tests).
  - `scripts/verify-iter49.ts` — NEW end-to-end verification script (5 tests, run via `pnpm exec tsx`).
  - `STATUS.md` — iter 49 fix section + Known Issue #4 CLOSED.
  - `AGENT_NAVIGATION.md` — current state + §6 dialect + §8 Pitfall 11/16 updated.
  - `docs/IN_GAME_TESTS.md` — dialect table + rule #10 updated.
  - `worklog.md` — Task 49 entry (this).
- **Known Issues (после iter 49):**
  - ✅ #1 CLOSED iter 46 — `(?!…)` forward-only FP FIXED via `^(?!…).*Z`.
  - ✅ #2 CLOSED iter 48 — Simulator `(?!…)` gap CLOSED via explicit lookaheadNeg tokenizer + semantic tests.
  - ✅ #3 CLOSED iter 46 — `^` в OR-context verified in-game.
  - ✅ #4 CLOSED iter 49 — Multi-LITERAL AND-in-OR + EXCLUDE transform.
  - ⚠️ #5 OPEN — 2 over-limit entries в jewel (ETL diagnostic only). Next iter: ETL split-logic OR runtime UI split.
- **Точка остановки:** iter 49 COMPLETE. Code + tests + docs updated.
- **For new chat:** читать `AGENT_NAVIGATION.md` (entry, ~192 lines), `STATUS.md` (current state + Known Issue #5 OPEN, ~80 lines), `worklog.md` (Task 49 для деталей фикса + Task 48/46 для контекста `(?!…)`).

---
Task ID: 48
Agent: main
Task: Закрыть Known Issue #2 — добавить `(?!…)` lookahead tokenizer в `src/core/poe2-regex-matcher.ts` + semantic regression test против minion-блок data. Документация: чисто, без мусора.

Stage Summary:
- **iter 48 FIX:** `src/core/poe2-regex-matcher.ts` — explicit `(?!…)` lookahead tokenization (was: implicit via `?` being silently dropped). 3 surgical changes (tokenizer `lookaheadNegOpen`/`Close` + parser `lookaheadNeg` AST node + matcher `lookaheadNeg` case).
- **Known Issue #2 CLOSED.** 1118 passed (+10 NEW semantic regression tests в `tests/core/poe2-regex-matcher.test.ts` Section 11).

---
Task ID: 47
Agent: main
Task: Анализ репозитория + актуализация/чистка документации под LLM/agent consumption. Никаких правок кода — только docs cleanup.

Stage Summary:
- **Документация актуализирована.** Удалены: `README_ITER46.md`, `DELETIONS.txt`. Compact: `AGENT_NAVIGATION.md` (235→191 lines), `STATUS.md` (124→84), `docs/IN_GAME_TESTS.md` (257→147), `docs/ARCHITECTURE.md` (553→394). Total docs reduction: 1961→1568 lines (–20%).

---
## Older iterations (46 and before)

- **iter 46**: `(?!…)` forward-only FP FIXED — production form `^(?!…).*Z` IMPLEMENTED + in-game verified (Tests A+B PASS, Test C confirms old FP).
- **iter 45**: ROOT CAUSE analysis — `(?!…)` lookahead forward-only в PoE2, simulator gap. Код НЕ менялся — только документация.
- **iter 44**: 3 FP-бага исправлены в shared `src/core/` — surgical removeConflictingExcludes + strict-subset skip + AND-in-OR transform (`X(?!…)` forward-only, refined in iter 46).
- **iter 43**: D3 pre-analysis — 95 опасных пар, 5 типов опасностей, 8 паттернов. Код не изменён.
- **iter 42**: ETL char-limit diagnostic — `findOverLimitEntries()`.
- **iter 41**: D5 production-verified — 5/5 in-game tests PASS (jewel, amulet, ring, waystone, tablet).
- **iter 15-40**: covered legacy in-game tests, hypothesis pattern verification, FP prevention anchors, Path D D1-D7. See git history for details.

# Worklog

---
Task ID: 48
Agent: main
Task: Закрыть Known Issue #2 — добавить `(?!…)` lookahead tokenizer в `src/core/poe2-regex-matcher.ts` + semantic regression test против minion-блок data. Документация: чисто, без мусора.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: AGENT_NAVIGATION v47 (§6 dialect, §8 Pitfall 16), STATUS.md iter 46 (Known Issues #2/#4/#5 OPEN), worklog Task 47 (cleanup) + Task 46 (последний code-фикс), src/core/poe2-regex-matcher.ts (tokenizer + parser + matcher), tests/core/poe2-regex-matcher.test.ts (Sections 1-10), tests/core/optimizer.test.ts (iter 44/46 structural tests для AND-in-OR EXCLUDE), регис/Самоцветы моды.md:144 + Амулеты моды.md:57 (minion-block source data).
- 2: Базовая верификация `npx tsx scripts/verify-baseline.ts` — текущий симулятор ИМПЛИЦИТНО даёт корректные результаты для iter 46 production form `^(?!.*X).*Z` (потому что `?` молча дропается → `!` становится block-wide negation), но это fragile поведение. Forward-only form `Z(?!.*X)` тоже блок-wide (вместо in-game FP) — неконсистентно.
- 3: Реализован фикс (3 surgical изменения в `src/core/poe2-regex-matcher.ts`):
  - **Tokenizer:** добавлены `lookaheadNegOpen` + `lookaheadClose` token types. Stack-based paren tracking: при `(?!` emit `lookaheadNegOpen`, push 'lookaheadNeg' на стек; при `)` pop, emit `lookaheadClose` если 'lookaheadNeg', иначе `groupClose`.
  - **Parser:** новый AST node type `{ type: 'lookaheadNeg', inner }`. В `parseSequence`: при `lookaheadNegOpen` → parse inner alternation → expect `lookaheadClose` → push `lookaheadNeg` node. Также `lookaheadClose` добавлен в break-условие `parseSequence`.
  - **Matcher:** `case 'lookaheadNeg'` в `matchAt` — zero-width assertion: succeed iff `matchAt(regex.inner, text, startIndex).matched === false`. Для `^(?!.*X)`: at position 0, `.*X` matches iff X есть где-то от position 0 → lookahead = bidirectional block-wide absence.
- 4: Повторная верификация `npx tsx scripts/verify-baseline.ts`:
  - Single-quoted `^(?!.*Приспеш).*повышение скорости атаки`: non-minion=true, minion=false ✓
  - OR-context: ^ applies only to first alt, no leak ✓
  - Multi-block item-level matching ✓
  - Forward-only form `Z(?!.*X)` теперь даёт TRUE (как in-game FP из iter 45 finding) — симулятор теперь КОНСИСТЕНТЕН с in-game behavior.
- 5: Добавлены 10 NEW semantic regression tests в `tests/core/poe2-regex-matcher.test.ts` Section 11:
  - Single-quoted: non-minion matches, minion excluded (bidirectional exclude).
  - OR-context: non-minion via first alt, minion excluded (no second-alt fallback), ^-no-leak via second alt.
  - Multi-block item-level: minion + non-minion → matches via non-minion; only minion → no match; minion + second-alt-block → matches via second alt.
  - Multiple lookaheads `^(?!.*A)(?!.*B).*Z` — оба excludes enforced.
  - Backward compat: `?` outside lookahead context still parsed as `optional` (no regression).
- 6: Верификация:
  - `npx vitest run tests/core/poe2-regex-matcher.test.ts` → все тесты PASS (вкл. 10 NEW).
  - `pnpm test` (full suite) → **1118 passed** (1108 baseline + 10 NEW iter 48).
  - `pnpm exec tsc -b` → **0 errors**.
  - `pnpm lint` → 59 problems (pre-existing — same count before/after, no new errors in изменённых файлах).
- 7: Обновлена документация:
  - `STATUS.md` — iter 48 fix section + Known Issue #2 → CLOSED iter 48. Tests count 1118.
  - `AGENT_NAVIGATION.md` — current state iter 48, §6 dialect note updated, §8 Pitfall 16 rewritten (closed).
  - `docs/IN_GAME_TESTS.md` — dialect table note + rule #10 updated.
  - `tests/core/optimizer.test.ts` — комментарий iter 46 structural tests обновлён (refer to iter 48 semantic tests).
  - `worklog.md` — Task 48 entry (this).

Stage Summary:
- **iter 48 FIX IMPLEMENTED:** `src/core/poe2-regex-matcher.ts` — explicit `(?!…)` lookahead tokenization (was: implicit via `?` being silently dropped). 3 surgical changes.
- **Known Issue #2 CLOSED.** Simulator now models `(?!…)` as `lookaheadNeg` AST node. Semantic regression tests verify in-game behavior verified in iter 46.
- **Tests:** 1118 passed (+10 NEW semantic regression tests для minion-block data). TypeScript clean. Lint: no new errors.
- **Files MODIFIED (5):**
  - `src/core/poe2-regex-matcher.ts` — tokenizer (lookaheadNegOpen/Close tokens) + parser (lookaheadNeg AST node) + matcher (lookaheadNeg case).
  - `tests/core/poe2-regex-matcher.test.ts` — Section 11 added (10 semantic regression tests).
  - `STATUS.md` — iter 48 fix section + Known Issue #2 CLOSED.
  - `AGENT_NAVIGATION.md` — current state + §6 dialect note + §8 Pitfall 16 updated.
  - `docs/IN_GAME_TESTS.md` — dialect table + rule #10 updated.
  - `tests/core/optimizer.test.ts` — iter 46 structural test comment updated (refer to iter 48 semantic tests).
  - `worklog.md` — Task 48 entry (this).
- **Known Issues (после iter 48):**
  - ✅ #1 CLOSED iter 46 — `(?!…)` forward-only FP FIXED via `^(?!…).*Z`.
  - ✅ #2 CLOSED iter 48 — Simulator `(?!…)` gap CLOSED via explicit lookaheadNeg tokenizer + semantic tests.
  - ✅ #3 CLOSED iter 46 — `^` в OR-context verified in-game.
  - ⚠️ #4 OPEN — AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE — nested quotes (rare case).
  - ⚠️ #5 OPEN — 2 over-limit entries в jewel (ETL diagnostic only).
- **Точка остановки:** iter 48 COMPLETE. Code + tests + docs updated.
- **For new chat:** читать `AGENT_NAVIGATION.md` (entry, ~192 lines), `STATUS.md` (current state + Known Issues #4/#5 OPEN, ~82 lines), `worklog.md` (Task 48 для деталей фикса + Task 47/46 для контекста).

---
Task ID: 47
Agent: main
Task: Анализ репозитория + актуализация/чистка документации под LLM/agent consumption. Никаких правок кода — только docs cleanup.

Work Log:
- 1: Клонирован репозиторий, прочитаны все ключевые docs (AGENT_NAVIGATION v32, STATUS iter 46, worklog Task 46, docs/IN_GAME_TESTS, docs/ARCHITECTURE, docs/DATA_CONTRACTS, docs/ETL_GUIDE, docs/SEO_PLAN, README, README_ITER46, DELETIONS.txt). Также осмотрены: src/core/ (compiler.ts normalizeAst — фикс iter 46 на месте), регис/ (user test data — leave as-is).
- 2: Идентифицирован мусор:
  - `README_ITER46.md` — iteration-specific archive (заменён worklog + STATUS).
  - `DELETIONS.txt` — однострочная заметка, не нужна.
  - Дублирование dialect rules между AGENT_NAVIGATION §9 и ARCHITECTURE §3.
  - Длинные iter-by-iter narratives в AGENT_NAVIGATION §5/§9/§11/§12.
  - Старые iter blocks (37-45) в IN_GAME_TESTS.md.
  - Iter 45 section в STATUS.md (уже закрыт).
- 3: Удалены файлы: `README_ITER46.md`, `DELETIONS.txt`.
- 4: Перезаписан `AGENT_NAVIGATION.md` — компактная reference-структура без iter-history clutter: §1 Where things are, §2 Path aliases, §3 Dependency rules, §4 Build & Run, §5 Core optimizer (compact), §6 Dialect (current state only), §7 FP Prevention, §8 Frequent Pitfalls (key bugs only), §9 Strategy (8 principles), §10 Pre-rendering, §11 SEO assets, §12 i18n, §13 Doc map. ~155 lines (was 235).
- 5: Перезаписан `STATUS.md` — iter 46 fix + Known Issues + optimal strategies + Path D status. ~85 lines (was 124).
- 6: Compact `worklog.md` — Task 46 detailed (preserve), Task 45+ → one-line summaries.
- 7: Compact `docs/IN_GAME_TESTS.md` — keep iter 46 VERIFICATION + dialect table + FP Prevention Anchors + 9 Pattern Types + Truncated Word Tails; fold iter 37-41 history into one-line summary at bottom.
- 8: Compact `docs/ARCHITECTURE.md` — remove iter-history notes, dedupe dialect rules with AGENT_NAVIGATION (keep architecture-specific info: layer diagram, data flow, FP prevention levels, compiler rules, optimization pipeline, iterative optimizer, positive+negative mods, 250-char budget, number regex).
- 9: Light cleanup of `docs/ETL_GUIDE.md` and `docs/DATA_CONTRACTS.md` — remove iter mentions where they're informational only.
- 10: Упаковать результат в архив, загрузить на tmpfiles.org, прислать git-команды + точку остановки.

Stage Summary:
- **Документация актуализирована под LLM/agent consumption.** Никаких правок кода — только docs cleanup.
- **Удалены:** `README_ITER46.md` (iteration-specific archive), `DELETIONS.txt` (single-line note).
- **Перезаписаны/компактно:**
  - `AGENT_NAVIGATION.md` — 235 → 191 lines (–19%). Reference-style, current-state only, no iter-history clutter.
  - `STATUS.md` — 124 → 84 lines (–32%). Only current iter 46 fix + Known Issues + optimal strategies.
  - `worklog.md` — Task 46 detailed preserved, Task 45+ folded into one-line summaries. Task 47 entry added (this).
  - `docs/IN_GAME_TESTS.md` — 257 → 147 lines (–43%). Keep iter 46 verification + dialect table + FP Prevention Anchors + 9 Pattern Types + Truncated Word Tails. Old iter 37-41 blocks folded into one-line summary.
  - `docs/ARCHITECTURE.md` — 553 → 394 lines (–29%). Removed iter-history notes, dedupe dialect rules with AGENT_NAVIGATION.
  - `docs/ETL_GUIDE.md` — minor cleanup (removed iter numbers where informational only).
- **Total docs reduction:** 1961 → 1568 lines (–20%).
- **Verification:** `pnpm test` → 1108 passed. `pnpm exec tsc -b` → 0 errors. No source code touched.
- **Files MODIFIED (6 docs) + DELETED (2):** See Work Log step 4-9 above.
- **Точка остановки:** iter 47 (docs cleanup) COMPLETE. Готов к следующей итерации: фиксы Known Issues #2, #4, #5.
- **For new chat:** читать `AGENT_NAVIGATION.md` (entry, ~191 lines), `STATUS.md` (current state + Known Issues, ~84 lines), `worklog.md` (Task 47 для деталей cleanup + Task 46 для деталей последнего code-фикса).

---
## Older iterations (45 and before)

- **iter 45**: ROOT CAUSE analysis — `(?!…)` lookahead forward-only в PoE2, simulator gap. Код НЕ менялся — только документация. Proposed fix `^(?!…).*Z` → implemented in iter 46.
- **iter 44**: 3 FP-бага исправлены в shared `src/core/` — surgical removeConflictingExcludes + strict-subset skip + AND-in-OR transform (`X(?!…)` forward-only, refined in iter 46).
- **iter 43**: D3 pre-analysis — 95 опасных пар, 5 типов опасностей, 8 паттернов. Код не изменён.
- **iter 42**: ETL char-limit diagnostic — `findOverLimitEntries()`.
- **iter 41**: D5 production-verified — 5/5 in-game tests PASS (jewel, amulet, ring, waystone, tablet).
- **iter 15-40**: covered legacy in-game tests, hypothesis pattern verification, FP prevention anchors, Path D D1-D7. See git history for details.

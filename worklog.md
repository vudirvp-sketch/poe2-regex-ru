# Worklog

---
Task ID: 51
Agent: main
Task: UI redesign Фаза 0+1 — аудит CSS-токенов + миграция на тёплую dark-fantasy палитру ТЗ + удаление light-темы + приглушение bg-forest.webp. Документация: чисто, без мусора.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: AGENT_NAVIGATION v50, STATUS.md iter 50 (all Known Issues CLOSED), worklog Task 50 (runtime split + ETL context bug fix), src/index.css (832 lines — cold blue-gray palette + full light theme block), src/ui/layout/Header.tsx (theme toggle), src/ui/layout/Sidebar.tsx, src/ui/layout/Layout.tsx, src/shared/i18n.ts (theme.light/theme.dark keys), index.html.
- 2: Фаза 0 — составлена таблица маппинга токенов old → new по палитре ТЗ:
  - Core: `--poe-bg` `#0a0a0f→#0D0B09`, `--poe-bg-secondary` `#12121a→#15110E`, `--poe-bg-tertiary` `#1a1a25→#1F1812`, `--poe-border` `#2a2a3a→#3A2C22`, `--poe-text` `#c8c8d0→#D4C9B8`, `--poe-text-bright` `#e8e8f0→#F0E6D2`, `--poe-gold` `#af882b→#C89A4A` (ТЗ accent), `--poe-gold-bright` `#d4a843→#E0B570`.
  - Surface: `--input-bg` `#1f2937→#1F1812`, `--panel-bg` `#111827→#15110E`, `--raised-bg` `#374151→#3A2C22`, `--deep-bg` `#030712→#070503`.
  - Chip: `--chip-bg-selected` blue-tint `rgba(30,58,95,.4)→gold-tint rgba(200,154,74,.18)`.
  - Borders warm: `--input-border` `#4b5563→#4A3A2C`, `--panel-border` `#374151→#3A2C22`.
  - Scrollbar: `#3a3a4a→#4A3A2C`. Focus ring: `#3b82f6 blue → #C89A4A gold` (brand accent).
- 3: Подтверждено пользователем: (1) light-тему убрать; (2) bg-forest.webp приглушить; (3) HomePage = хаб; (4) mobile nav — решение за агентом (склоняюсь к горизонтальным чипам + усиленный active-state в Фазе 4).
- 4: Проверено отсутствие тестов/скриптов, ссылающихся на theme toggle или `[data-theme="light"]`. Только Header.tsx + i18n.ts + index.css.
- 5: Фаза 1 — `src/index.css` MultiEdit (атомарно):
  - (a) Обновлены все dark-theme токены на тёплую палитру (core palette + surface + borders + scrollbar + focus ring).
  - (b) Удалён весь `[data-theme="light"] { ... }` блок (123 строки — переопределения всех токенов).
  - (c) Удалены все scattered `[data-theme="light"] ...` правила: body, sidebar-atmosphere, header-atmosphere, layout-shell, content-area, form element defaults, checkbox, control-panel-sticky, regex-output, affix-header-prefix/suffix/implicit, 4 mobile media query rules, 1 480px media query rule.
  - (d) Atmospheric background: `background: #0a0a0f url(...)` заменено на `linear-gradient(rgba(13,11,9,0.40), rgba(13,11,9,0.40)), url(...)` — 40% warm dim overlay (приглушение). То же для mobile.
  - (e) Sidebar/Header atmosphere overlay: `rgba(10,10,15,0.75) → rgba(13,11,9,0.78)` (warm).
  - (f) Удалён `transition: background-color 0.2s ease, color 0.2s ease` из body (нет theme toggle — не нужен).
  - (g) Подчищены устаревшие комментарии про light-тему (primary text, danger border).
- 6: `src/ui/layout/Header.tsx` переписан: удалены `getInitialTheme`, `useState<'dark'|'light'>`, `toggleTheme`, toggle-кнопка (☀️/🌙). Только `useEffect` — выставляет `data-theme="dark"` + theme-color meta `#0D0B09` на mount.
- 7: `src/shared/i18n.ts` — удалены ключи `theme.light` и `theme.dark` (больше не используются).
- 8: `index.html` — `theme-color` meta: `#0f0f1a → #0D0B09`.
- 9: Верификация:
  - `npx tsc -b` → 0 errors.
  - `npx vitest run` → **1144 passed** (35 test files). Тесты не затронуты — все зелёные.
  - `npx eslint .` → 59 problems (55 errors, 4 warnings) — все pre-existing в `tests/`, ни одной в изменённых файлах. Baseline (Task 50) был 59 — не ухудшилось.
- 10: `index.css` 832 → 633 строки (−199, −24%).
- 11: Документация:
  - `STATUS.md` — полная перезапись: iter 51, таблица палитры (old → new), раздел "UI Redesign — план (9 фаз)" с чек-листом статусов, удалена длинная история iter 50 fix details (оставлен только итог).
  - `AGENT_NAVIGATION.md` — current state iter 51, добавлен Pitfall 19 (Dark-only theme).
  - `worklog.md` — Task 51 entry (этот). Удалены детальные записи Task 49 (оставлен только Stage Summary) и все Task 41-48 (оставлен compact "Older iterations" блок).

Stage Summary:
- **iter 51 Фаза 0+1 COMPLETE.** Миграция CSS design tokens на тёплую dark-fantasy палитру ТЗ + полное удаление light-темы + приглушение bg-forest.webp (40% warm overlay).
- **Изменённые файлы (4):**
  - `src/index.css` — палитра warm dark-fantasy + удалено 199 строк light-темы (832 → 633 строки).
  - `src/ui/layout/Header.tsx` — dark-only, toggle удалён.
  - `src/shared/i18n.ts` — удалены `theme.light`/`theme.dark`.
  - `index.html` — `theme-color` meta → `#0D0B09`.
- **Документация (3):**
  - `STATUS.md` — iter 51 rewrite + 9-фазный план.
  - `AGENT_NAVIGATION.md` — iter 51 + Pitfall 19.
  - `worklog.md` — Task 51 entry + чистка длинной истории.
- **Tests:** 1144 passed (без изменений — код движка/ETL не тронут). TypeScript clean. Lint baseline сохранён.
- **Known Issues:** открытыми нет (все 5 закрыты в iter 46-50).
- **Риски:** нулевые для regex-движка/ETL/тестов. Имена CSS-переменных не менялись — весь JSX работает как прежде.
- **Точка остановки:** iter 51 Фаза 1 COMPLETE. Следующая итерация — Фаза 2 (CategoryLayout 2-колоночный desktop / 1-col mobile).

---

Task ID: 50
Agent: main
Task: Закрыть Known Issue #5 — runtime split для over-limit regex (>250 chars) + фикс ETL bug (patchOptimizationEntries mixed context).

Stage Summary:
- **iter 50 FIX 1 (ETL Bug):** `patchOptimizationEntries()` в `run-etl.ts` — усилено условие для regexPrefixContext: `contexts.size === 1` вместо `contexts.size <= 2`. Смешанные контексты больше не патчатся.
- **iter 50 FIX 2 (Known Issue #5 CLOSED):** Runtime split для over-limit regex. `splitOverLimitRegex()` в `limits.ts` разбивает OR-группы >250 chars на 2+ части, каждая ≤250 chars. UI показывает части отдельно.
- **Tests:** 1144 passed (+12 NEW). TypeScript clean.

---

## Older iterations (49 and before)

- **iter 49**: Known Issue #4 CLOSED — `normalizeAst` extended for multi-LITERAL AND-in-OR with EXCLUDE. `^(?!…).*lit1.*lit2.*...`. +14 tests.
- **iter 48**: Known Issue #2 CLOSED — explicit `(?!…)` lookahead tokenizer + semantic tests.
- **iter 47**: Docs cleanup — AGENT_NAVIGATION 235→191, STATUS 124→84, IN_GAME_TESTS 257→147, ARCHITECTURE 553→394. Total −20%.
- **iter 46**: `(?!…)` forward-only FP FIXED via `^(?!…).*Z` + in-game verified. Known Issue #1/#3 CLOSED.
- **iter 44-45**: FP-bug analysis + 3 surgical fixes (removeConflictingExcludes, strict-subset skip, AND-in-OR transform).
- **iter 41-43**: D5 production-verified (5/5 in-game PASS), D3 pre-analysis, ETL char-limit diagnostic.
- **iter 15-40**: legacy in-game tests, hypothesis patterns, FP prevention anchors, Path D D1-D7. See git history.

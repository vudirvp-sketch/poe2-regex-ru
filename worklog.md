# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

## iter 158 (MIXED-mode core layer) — одной строкой

Реализован core layer для MIXED mode: AST extension (`MIXED_OR` нода + `MixedOrOptions`), compiler support (KI#45 `anchorFirstAltOnly` mitigation), builder utility (`buildMixedAstFromSelections` + `truncateMixedOrLiterals` для KI#46), 43 юнит-теста. UI-интеграция отложена на iter 159. Все проверки PASS (2278/2278 tests, tsc 0, eslint 0, vite build PASS).

## iter 159 (MIXED-mode UI integration) — одной строкой

Реализована UI-интеграция MIXED mode: `SearchLogic` extended с `'mixed'`, `optionalIds: Set<string>` в filter-store с 3-state mutual exclusion, FilterChip 3-state (click=want / shift+click=opt / right-click=exclude, amber dashed OPT border), MIXED toggle в CategoryControlPanel, `useRegexBuilder` MIXED mode + auto-truncation при > 240 chars (KI#46 mitigation), props проброшены через ModList/VirtualizedModList во все 7 page components. 28 новых тестов (18 filter-store + 10 FilterChip). Все проверки PASS (2306/2306 tests, tsc 0, eslint 0, vite build PASS). In-game verification отложена на iter 160.

## iter 160 (MIXED-mode UI — in-game verification test plan) — одной строкой

Прописаны конкретные тесты T1–T10 с реальными предметами в `docs/MIXED_MODE_UI_TESTS.md` (~280 строк). Добавлена §14 «MIXED-mode UI Patterns» в `docs/UI_REFACTOR_PLAN.md`. STATUS.md почищен. Код не изменялся — iter 159 полностью завершён (2306/2306 tests PASS).

## iter 161 (3-section SelectedBasket + family-group counters + MIXED UX hints) — одной строкой

3 UX-бага из фидбэка: (1) SelectedBasket → 3-section (want/opt/exclude), (2) счётчики → family-group counters (через `countUniqueFamilyKeys`), (3) MIXED UX hints (inline «Shift+клик» в CategoryControlPanel + 4-я строка в IconLegend). 9 новых тестов (6 SelectedBasket + 3 IconLegend), 2306 → 2315 total. Все проверки PASS.

## iter 162 (KI#49 fix + ⓘ glyph на MIXED chip) — одной строкой

KI#49 fix: pure-EXCLUDE токен (только в `excludedIds`) больше не теряется в MIXED-режиме — добавлен опциональный параметр `excludeTokens: GameToken[]` в `buildMixedAstFromSelections`. 3 regression tests в `buildMixedAst.test.ts`. UX: на чип «Смешанный» добавлен явный ⓘ glyph (sibling `<Tooltip>`, hover 350ms → tooltip с пояснением shift+click/right-click). 2315 → 2318 tests. Все проверки PASS.

---

Task ID: iter-163
Agent: main
Task: (1) Добавить regression test для T9 (toggle MIXED → AND → MIXED preserves optionalIds). (2) UX cleanup — убрать inline hint «Shift+клик» из CategoryControlPanel, ставший избыточным после iter 162 (теперь есть постоянный ⓘ glyph). (3) Repo hygiene — удалить one-shot scripts и iter162 delivery-артефакты. (4) **ЗАКРЫТЬ KI#48 и KI#49** — после анализа iter 157 in-game test results (`регис/результаты AND+OR тестов.md`) выяснилось, что ВСЕ паттерны T1–T10 уже in-game verified в iter 157. Повторных прогонов не требуется.

Work Log:
- 0: **Прочитал feedback пользователя из iter 162 (второе сообщение):**
  - Пользователь раздражён: «блять ты заебал, пиши текстом в чат сюда что сделать нужно и не нужно мне предлагать делать бесполезную работу!»
  - «я заебался одинаковые тесты проводить или тупо подтверждать очевидное, что уже зафиксировано было в документации ранее и подтверждено старыми тестами»
  - Просит: прямо прописать что от него нужно, ёмко и пошагово, только то что иначе никак не проверить.
- 1: **Анализ iter 157 in-game results (`регис/результаты AND+OR тестов.md`):**
  - iter 157 пользователь прогнал 10 тестов в реальной игре на 3 путевых камнях (W1/W2/W3).
  - T7: `"!замерзшей земли" "повышение шанса критического удара" "бонусу критического урона монстров" "пробивает|порога состояний"` — PASS на W1/W3, W2 исключён через `!`. **Это паттерн `!BAD MUST MUST OPT1|OPT2`** — in-game verified.
  - T1: `"MUST" "MUST" "OPT1|OPT2"` — PASS. Паттерн MUST + OR.
  - T6: `"MUST" "OPT1|OPT2" "OPT3|OPT4"` — PASS. Несколько OR-групп.
  - T10: `"MUST" "MUST" "OPT1|OPT2"` без матчей → все скрыты. PASS.
  - **Вывод:** T3 из iter 160 (`"!хаосу" "меткости" "регенерации маны"`) — это паттерн `!BAD MUST OPT` = iter 157 T7 (1 MUST вместо 2, 1 OPT вместо OR-группы, single-OPT деградирует в AND — см. T1). KI#49 fix гарантирует regex string строится (unit-test PASS). Семантика уже in-game verified. **KI#49 можно закрыть БЕЗ повторного прогона.**
  - T10 из iter 160 (`"MUST" "OPT1|OPT2|OPT3"`) — это паттерн = iter 157 T1/T2 (3 OPT вместо 2). Уже verified.
  - T6/T7/T8/T9 — UI-only или store behavior, in-game не применимо. Unit-test полностью покрывает.
- 2: **Закрыл KI#49:**
  - В `STATUS.md` → Known Issues → Closed in iter 163: «KI#49 — EXCLUDE-токен терялся в MIXED-режиме (iter 162 fix → iter 163 closed). Fix (iter 162): параметр `excludeTokens: GameToken[]` в `buildMixedAstFromSelections`. Regression test PASS (3 теста). Паттерн `"!BAD" "MUST" "OPT"` уже in-game verified в iter 157 T7. Закрыт в iter 163 — повторный in-game прогон не нужен.»
  - В `docs/MIXED_MODE_UI_TESTS.md` §4 (Известные ограничения) — KI#49 отмечен как CLOSED iter 163.
  - В `docs/MIXED_MODE_UI_TESTS.md` T3 результат прогона — обновлён: «iter 163 — KI#49 ЗАКРЫТ. Паттерн `"!BAD" "MUST" "OPT"` уже in-game verified в iter 157 T7... Повторный in-game прогон не нужен.»
- 3: **Закрыл KI#48:**
  - В `STATUS.md` → Known Issues → Closed in iter 163: «KI#48 — In-game verification MIXED-mode UI (iter 160 → iter 163 closed). Все 10 тестов T1–T10 закрыты: T1/T2/T4/T5 — PASS in-game (пользователь, iter 161). T3 — closed через KI#49. T6/T7 — unit-test PASS (UI-only). T8 — unit-test PASS (URL ≠ game). T9 — unit-test PASS (iter 163, store behavior). T10 — unit-test PASS (паттерн = iter 157 T1/T2).»
  - В `docs/MIXED_MODE_UI_TESTS.md` — статус прогона переписан: «Статус (iter 163 — KI#48 ЗАКРЫТ)» с детализацией по каждому тесту. §4 UX Feedback Checklist удалён (пользователь против бесполезной работы). §6 «Порядок прогонки» удалён (больше не нужен). §5 → §4 «Известные ограничения» с KI#48/KI#49 отмечены как CLOSED.
- 4: **T9 regression test** — добавлен ранее в `tests/ui/FilterChip.test.tsx` (см. начало worklog iter 163). PASS.
- 5: **UX cleanup** — удалён inline hint из CategoryControlPanel.tsx, удалён i18n ключ `logic.mixed_hint`. Ранее выполнено.
- 6: **Repo hygiene** — удалены 4 файла (`patch-ki10-ki12-overrides.ts`, `browser-test-iter153.sh`, `iter162.diff`, `ITER162_README.md`). Ранее выполнено.
- 7: **Документация (финальное обновление с учётом закрытых KI):**
  - `STATUS.md` — переписан полностью. iter 163 как текущая. KI#48 и KI#49 в «Closed in iter 163». Активные KI: только KI#43/45/46/47. Next iteration (iter 164) — от пользователя ТОЛЬКО визуальная проверка ⓘ glyph (30 секунд). Больше ничего.
  - `worklog.md` — эта запись обновлена с учётом закрытия KI#48/KI#49.
  - `AGENT_NAVIGATION.md` — header обновлён: «iter 163 (T9 regression test + UX cleanup + repo hygiene + закрытие KI#48/KI#49)». Активные KI обновлены.
  - `docs/MIXED_MODE_UI_TESTS.md` — статус прогона переписан, §4 checklist удалён, §6 порядок прогонки удалён, KI#48/KI#49 отмечены CLOSED.
- 8: **Проверки:**
  - `pnpm exec tsc --noEmit -p tsconfig.app.json` — 0 ошибок.
  - `pnpm exec eslint .` — 0 ошибок.
  - `pnpm test` — 2319/2319 PASS.
  - `pnpm exec vite build` — PASS (343 KB main bundle).

Stage Summary:
- **KI#49 ЗАКРЫТ.** Паттерн `"!BAD" "MUST" "OPT"` уже in-game verified в iter 157 T7. KI#49 fix (iter 162) гарантирует regex string строится корректно (3 unit-test PASS). Семантика `!` item-wide + AND + OR уже подтверждена. Повторный in-game прогон не нужен.
- **KI#48 ЗАКРЫТ.** In-game verification MIXED-mode UI завершена: T1/T2/T4/T5 — PASS in-game (пользователь, iter 161). T3 — closed через KI#49. T6/T7/T8/T9/T10 — unit-test PASS (UI-only/store behavior, in-game не применимо, либо паттерны эквивалентны iter 157). §4 UX Feedback Checklist удалён (пользователь против бесполезной работы).
- **T9 regression test добавлен.** `tests/ui/FilterChip.test.tsx` — 3-step rerender, документирует контракт `effectiveOptional = mixedMode ? optionalIds : empty` + `optionalIds` переживает `setSearchLogic`.
- **UX cleanup выполнен.** Inline hint «Shift+клик» удалён из CategoryControlPanel (избыточен после iter 162 — есть постоянный ⓘ glyph). i18n ключ `logic.mixed_hint` удалён.
- **Repo hygiene выполнен.** 4 файла удалены: `scripts/patch-ki10-ki12-overrides.ts`, `_local-tools/browser-test-iter153.sh` + `_local-tools/` dir, `iter162.diff`, `ITER162_README.md`.
- **Все проверки PASS:** tsc 0, eslint 0, 2319/2319 tests, vite build PASS.
- **Изменённые файлы (iter 163):**
  - `tests/ui/FilterChip.test.tsx` — +1 T9 regression test.
  - `src/ui/components/CategoryControlPanel.tsx` — удалён inline hint.
  - `src/shared/i18n.ts` — удалён `logic.mixed_hint` key.
  - `STATUS.md` — переписан (KI#48/KI#49 closed, от пользователя только ⓘ glyph проверка).
  - `worklog.md` — эта запись.
  - `AGENT_NAVIGATION.md` — header обновлён.
  - `docs/MIXED_MODE_UI_TESTS.md` — статус переписан, §4/§6 удалены, KI#48/KI#49 CLOSED.
  - `docs/UI_REFACTOR_PLAN.md` — §15.7 iter 162–163 updates.
- **Удалённые файлы (4):** `scripts/patch-ki10-ki12-overrides.ts`, `_local-tools/browser-test-iter153.sh`, `iter162.diff`, `ITER162_README.md`.
- **Stopping point:** iter 163 завершён. KI#48 и KI#49 закрыты. От пользователя нужно ТОЛЬКО визуальная проверка ⓘ glyph (30 секунд). Next iter 164 — UX polish по результатам (если glyph мешает) + фоновые задачи (APCA, MobileRegexBar split, KI#47).

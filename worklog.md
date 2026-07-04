# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

## iter 158–173 — одной строкой

**iter 158:** core MIXED mode (`MIXED_OR` AST + `anchorFirstAltOnly` mitigation для KI#45 + `truncateMixedOrLiterals` для KI#46, 43 теста).
**iter 159:** UI MIXED integration (`optionalIds`, FilterChip 3-state, MIXED toggle, 28 новых тестов).
**iter 160:** test plan T1-T10 в `docs/MIXED_MODE_UI_TESTS.md`.
**iter 161:** 3-section SelectedBasket (want/opt/exclude) + family-group counters.
**iter 162:** KI#49 fix (EXCLUDE-токен не теряется в MIXED) + ⓘ glyph на MIXED chip.
**iter 163:** T9 regression test + UX cleanup. **KI#48 и KI#49 ЗАКРЫТЫ**. 2319 tests.
**iter 164:** UX redesign v3 — P1 (`.affix-origin-header` mini-frame для L2), P2 (усиление `.nav-mode-active`), P3 (усиление `.regex-output` + pulse 600ms). CSS 60→61 KB.
**iter 165:** Концепт-спецификация `docs/REDESIGN_CONCEPT_v4.md` — детальная проработка 7 аспектов аудита с вариантами решений. Код НЕ изменялся.
**iter 166 (A2):** Display-layer override: 7 сайтов L3 sub-group рендера переведены с `${bgClass} border ${borderClass}` на `bg-panel/15 border border-edge/15` + цветной `colorClass` (text-only). 2319/2319 PASS, CSS +0.14 KB.
**iter 167 (A3):** Empty-state RegexOutput переписан (`.regex-output__empty` dashed gold border + ↑ arrow + hint). Новый компонент `BasketToRegexFlow.tsx`. +9 тестов (2328/2328). CSS +1.03 KB.
**iter 168 (A1 Вариант B):** Усиление контраста L1/L2 corner accents: L1 6×6/0.4 → 8×8/0.55, L2 5×5/0.35 → 4×4/0.30 (контраст ~12% → ~25%). 4 правки в `src/index.css`. 2328/2328 PASS.
**iter 169 (KI#50):** Фикс потери expand/collapse состояния при смене вкладок. Helpers `readUiState`/`writeUiState`/`clearUiState`/`filterInCategoryKeys` в `src/store/local-settings.ts`. useState initializer + persist block в `useCategoryPage.ts`. +31 тест (2359/2359). Per-category `poe2:uistate:<categoryId>` localStorage, pattern mirrors KI#30 favorites.
**iter 170 (A4):** Conditional rendering кнопок «Развернуть/Свернуть все подкатегории» в `ModList.tsx` + `VirtualizedModList.tsx`. `allSubKeys` extracted в `useMemo`. +2 i18n ключа. +6 новых A4 тестов, 7 existing обновлены. 2366/2366 PASS. CSS без изменений (61.17 KB).
**iter 171:** Cleanup — удалены `ITER163_README.md` + `DELETED.txt` (stale delivery-артефакты iter 163). Только docs.
**iter 172:** Fix `act()` warnings в `tests/ui/RegexOutput.test.tsx` (background issue closed). Паттерн `vi.useFakeTimers()`/`vi.useRealTimers()` (как в `Tooltip.test.tsx`) + flush microtasks внутри `act()` вместо `vi.waitFor`. 0 warnings, 2366/2366 PASS, 0 регрессий.
**iter 173 (KI#51 + GitHub link):** Fix hidden categories on narrow viewports. Новый wrapper `.topnav-tabs-wrap` (relative, `flex:1`, `overflow:hidden`) вокруг `.topnav-tabs` с `::before`/`::after` fade-градиентами (24px, `var(--poe-bg)` → transparent). JS scroll-position tracking через `useRef`/`useEffect`/`useState` toggles `--can-left`/`--can-right` классы. GitHub link добавлен в `.topnav-feedback` рядом с Discord-хинтом: `Баги и идеи → Discord: woonderdad · GitHub ↗` (lg+, `target="_blank" rel="noopener noreferrer"`). Новый i18n ключ `nav.github`. A5 CLOSED (iter 164 sufficient). A7 partial. 2366/2366 PASS, tsc 0, eslint 0, CSS 61.17 → 62.37 KB (+1.20 KB raw / +0.05 KB gzip).
**iter 174 (KI#52 + FAQ regexExclude):** Fix search auto-expand подкатегорий. Пользователь сообщил: при поиске отображаются только закрытые категории, чипы спрятаны внутри — приходится вручную раскрывать. Зафиксирован KI#52 (правило «сначала документируй»). Fix: в `ModList.tsx` и `VirtualizedModList.tsx` при непустом `searchText` вычисляются ЛОКАЛЬНЫЕ `effectiveCollapsedGroups` (= `new Set()`) и `effectiveExpandedSubGroups` (= `new Set(allSubKeys)`) — store НЕ мутируется. Effective Set'ы передаются во все AffixColumn/buildColumnRows callsites ВМЕСТО raw props. Кнопки «Развернуть/Свернуть все подкатегории» скрываются во время поиска (`isSearchActive` guard). В `VirtualizedModList.tsx` `allSubKeys` moved up до `buildColumnRows` (нужно для effective Sets). FAQ про `regexExclude` / `"!100%"` задокументирован в STATUS.md (не баг — намеренная FP-защита, когда два мода разделяют подстроку). +4 новых теста (3 в ModList.test.tsx, 1 в VirtualizedModList.test.tsx). 2370/2370 PASS, tsc 0, eslint 0, CSS без изменений (62.37 KB).

---

Task ID: iter-174
Agent: main
Task: (1) Fix bug: при поиске отображаются только закрытые категории — чипы спрятаны внутри, приходится вручную раскрывать. (2) Ответить на вопрос пользователя про `"!100%"` токен в сгенерированном регексе (баг или фича?). Принцип: «лучше недоделать, чем сломать». UI-layer fix, нулевой риск для regex-engine.

Work Log:
- 0: **Контекст из чата:** iter 173 завершён, ждёт визуальной валидации. Пользователь сообщил новый баг (KI#52) и задал вопрос про `"!100%"`.
- 1: **Клонировал репозиторий.** `npm install`, `npx vitest run` — 2366/2366 PASS (baseline).
- 2: **Изучил ModList.tsx + VirtualizedModList.tsx + filter-store.ts.** Root cause KI#52: `expandedSubGroups` defaults to empty Set = all sub-groups COLLAPSED. При поиске tokens фильтруются, но `expandedSubGroups` НЕ обновляется → sub-groups с матчами остаются collapsed, чипы спрятаны. Дополнительно: `collapsedGroups` (L1) может быть collapsed → sub-groups вообще не рендерятся.
- 3: **Изучил `"!100%"` вопрос.** Нашёл в `public/generated/tablet.json`: мод `(10—15)% увеличение эффективности монстров` имеет `regexExclude: ["100%"]`. Конфликтующий мод `(8—12)% увеличение эффективности монстров Бездны за каждый закрытый провал, вплоть до 100%` содержит ту же подстроку → без `"!100%"` regex матчит оба (FP). Поле `regexExclude` определено в `src/shared/types.ts` (GameToken + OptimizationEntry), работает на уровне ETL + AST builder + compiler. НЕ БАГ.
- 4: **Документировал KI#52 в STATUS.md ПЕРВЫМ** (правило: «сначала документируй, потом фиксись»). KI#52 = «Search не авто-раскрывает подкатегории». Добавлен в Known Issues → Недавно закрытые. FAQ regexExclude добавлен в STATUS.md отдельной секцией.
- 5: **Спроектировал fix:** при непустом `searchText` вычислять ЛОКАЛЬНЫЕ `effectiveCollapsedGroups` (= `new Set()`, force L1 expanded) и `effectiveExpandedSubGroups` (= `new Set(allSubKeys)`, force L3 expanded). Store НЕ мутируется → ручное состояние сохраняется при очистке поиска. `allSubKeys` выведен из `filteredTokens`, поэтому содержит только sub-groups с матчами. Кнопки «Развернуть/Свернуть все подкатегории» скрываются во время поиска.
- 6: **Реализовал ModList.tsx:** добавил `isSearchActive`, `effectiveCollapsedGroups`, `effectiveExpandedSubGroups` useMemo после `allSubKeys`. Заменил все downstream `collapsedGroups`/`expandedSubGroups` usages в AffixColumn calls (4 места) на effective-версии через `replace_all`. Добавил `isSearchActive` guard в conditional rendering expand/collapse-all кнопок. ВАЖНО: обнаружил что single-column path (lines 1183-1184, 1209-1210) НЕ был покрыт `replace_all` из-за другой индентации — вручную исправил через MultiEdit.
- 7: **Реализовал VirtualizedModList.tsx:** переместил `allSubKeys` useMemo ВЫШЕ `buildColumnRows` calls (нужно для effective Sets). Добавил `isSearchActive`, `effectiveCollapsedGroups`, `effectiveExpandedSubGroups` useMemo после `allSubKeys`. Обновил все 3 `buildColumnRows` calls (implicit/prefix/suffix) на effective-версии. Добавил `isSearchActive` guard в conditional rendering expand/collapse-all кнопок.
- 8: **Добавил тесты:** 3 теста в `tests/ui/ModList.test.tsx` (search auto-expand L3 chips видны; L1 collapsed → force-expand; кнопки hidden во время поиска). 1 тест в `tests/ui/VirtualizedModList.test.tsx` (кнопки hidden во время поиска). Все тесты используют `searchText="сопротивлению"` (matches p1, p2 — prefix family 'Резист').
- 9: **Проверки:** `npx tsc -b` — 0 errors. `npx eslint .` — 0 errors. `npx vitest run` — 2370/2370 PASS (2366 baseline + 4 новых). `npx vite build` — PASS, CSS без изменений (62.37 KB).
- 10: **Документация актуализирована:** STATUS.md (header iter 173→174, "Текущее состояние" переписана под iter 174, iter 173 → одной строкой в "История", KI#52 в "Недавно закрытые", FAQ regexExclude секция добавлена, Next iteration iter 173→174 → iter 174→175). AGENT_NAVIGATION.md (header iter 173→174, KI#52 в активных KI, pitfall #25 search auto-expand + #26 regexExclude FAQ добавлены, ModList/VirtualizedModList описание обновлено с KI#52 fix). worklog.md (iter 174 добавлен в shared-секцию и как Task ID section).

Stage Summary:
- **iter 174 завершён.** KI#52 (search auto-expand) — fixed через локальные effective Sets в ModList/VirtualizedModList. FAQ regexExclude задокументирован.
- **Изменённые файлы (iter 174):**
  - `src/ui/components/ModList.tsx` — `effectiveCollapsedGroups`/`effectiveExpandedSubGroups` useMemo + замена всех downstream usages (5 AffixColumn callsites); `isSearchActive` guard для expand/collapse-all кнопок.
  - `src/ui/components/VirtualizedModList.tsx` — `allSubKeys` moved up до `buildColumnRows`; `effectiveCollapsedGroups`/`effectiveExpandedSubGroups` useMemo; 3 `buildColumnRows` calls обновлены; `isSearchActive` guard для кнопок.
  - `tests/ui/ModList.test.tsx` — +3 теста на search-auto-expand.
  - `tests/ui/VirtualizedModList.test.tsx` — +1 тест на search-auto-expand.
  - `STATUS.md` — iter 174 header, "Текущее состояние" переписана, iter 173 в "История", KI#52 в "Недавно закрытые", FAQ regexExclude секция, Next iteration → iter 175.
  - `AGENT_NAVIGATION.md` — iter 174 header, KI#52 в активных KI, pitfall #25 + #26 добавлены, ModList/VirtualizedModList описание обновлено.
  - `worklog.md` — iter 174 в shared-секции + этот Task ID section.
- **Проверки:** tsc 0 errors, eslint 0 errors, vitest 2370/2370 PASS (4 новых теста, 0 регрессий), vite build PASS, CSS без изменений (62.37 KB).
- **Stopping point:** iter 174 завершён. Ожидается визуальная валидация пользователя: (1) Ввести аффикс в поиск → чипы с матчами видны сразу, без ручного раскрытия категорий. После очистки поиска — ручное expand/collapse состояние сохраняется. (2) Визуальная валидация iter 173 (если ещё не сделана). (3) Конкретика по A7. (4) Понял ли пользователь объяснение про `"!100%"` (FAQ regexExclude).
- **Что от пользователя нужно (опционально):** (1) Визуальная валидация KI#52 fix на любой странице категории. (2) Визуальная валидация iter 173 (fade-индикаторы + GitHub link). (3) Конкретика по A7. (4) Подтверждение что объяснение про `"!100%"` понятно. Активные KI без изменений: KI#45/46/47/43. Оставшиеся фоновые issues: APCA Lc<75, MobileRegexBar 168 KB.

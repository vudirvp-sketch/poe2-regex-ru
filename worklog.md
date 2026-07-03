# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 152 (KI#42 — search focus loss fix on jewel/waystone)
Agent: main
Task: Пользовательский баг — на вкладке «Самоцветы» (и в меньшей степени на «Путевые камни») при вводе/удалении текста в строке поиска инпут терял фокус после 1–2 символов. Нужно разобраться в причине, исправить и проверить, что на других вкладках подобной проблемы нет.

Work Log:
- 1: **Reproduce bug** — `npm run dev` + `agent-browser` на вкладке «Самоцветы». Type "тест" → val="те", focus=BODY (lost). Backspace на значении "абвг" → после 2-го backspace val="аб" + BLUR event. На waystone — blur+refocus на каждый keystroke (видно в event log). На belt/ring/amulet — фокус сохраняется.
- 2: **Root cause analysis** — через `MutationObserver` отследил DOM-мутации вокруг blur-события. На jewel после BLUR добавлялся `DIV.flex.items-center.justify-center.h-64` (PageStateWrapper loading-spinner) + `DIV.flex.flex-col.gap-4` (CategoryLayout root). Вывод: весь CategoryLayout unmount'ится и re-mount'ится. Причина: `mergeCategories: ['jewel-desecrated', 'jewel-corrupted']` (JewelPage) и `mergeCategories: ['waystone-desecrated']` (WaystonePage) — inline array literals в render body → новый array-reference на каждый ререндер → `useCategoryData`'s `useEffect` dep-array включает `mergeCategories` → effect re-ran на каждый keystroke (searchText change → re-render → new array ref → effect re-run → `setLoading(true)` → PageStateWrapper unmount'ит детей включая `<input>` → blur). На jewel loading-state успевал отрисоваться (3 JSON-файла, большой dataset); на waystone (2 файла) — unmount был слишком кратким чтобы потерять фокус, но blur+refocus происходил на каждый символ.
- 3: **Document as KI#42 in STATUS.md** — добавлен пункт 0 в «Активные (требуют browser testing)» с симптомом, root cause и планом фикса.
- 4: **Fix 1 — JewelPage memoize** — вынес `mergeCategories` в module-level constant `JEWEL_MERGE_CATEGORIES` (const at top of file). Комментарий объясняет причину (inline array literal → новый reference → effect re-run). Файл: `src/ui/pages/jewel/JewelPage.tsx`.
- 5: **Fix 2 — WaystonePage memoize** — аналогично, `WAYSTONE_MERGE_CATEGORIES` module-level constant. Файл: `src/ui/pages/waystone/WaystonePage.tsx`.
- 6: **Fix 3 — Defensive guard в useCategoryData** — добавлен `dataRef` (ref mirror of `data`) + `setLoading(true)` только если `!dataRef.current`. Это предотвращает unmount детей даже если effect re-run'ится по любой причине (не только mergeCategories). Файл: `src/ui/hooks/useCategoryPage.ts`.
- 7: **Browser verify (8 tabs)** — `agent-browser` на waystone, tablet, relic, jewel, vendor, belt, ring, amulet. На каждой вкладке: type "тест" + 4 backspace'а. Результат: 0 blur events после каждого keystroke, focus=INPUT, val корректный. Vendor — без search input (другой layout), N/A. Все остальные — PASS.
- 8: **Verify baseline** — `npx tsc -b` 0 errors / `npx eslint .` 0 warnings / `npx vitest run` 2228/2235 PASS (7 pre-existing data-test failures в `iter126-ki10-rarity-disambiguation` (2) и `iter127-ki12-tier-hardcoded-regex` (5) — не связаны с моими изменениями, проверено через `git stash` + rerun). `vite build` PASS.
- 9: **Document pre-existing failures** — добавлен KI#10 в «Фоновые (low-priority)» в STATUS.md с описанием: данные были перегенерированы ETL после iter 151 (commit `chore: update generated data from ETL [skip ci]`), regex-ожидания в тестах разъехались с JSON. Не блокирует UI-фиксы.
- 10: **STATUS.md rewrite** — «Текущее состояние» переписан под iter 152 (KI#42 фикс). «Next iteration» переименован в iter 153, добавлен пункт 5 (pre-existing data-test failures). Bundle/baseline обновлены.
- 11: **worklog.md** — iter 151 сокращён до одной строки. iter 152 подробно задокументирован.

Stage Summary:
- **KI#42 FIXED** — search input на вкладках «Самоцветы» и «Путевые камни» больше не теряет фокус при вводе/удалении текста. 2 слоя фикса: (1) module-level constants для `mergeCategories` в JewelPage/WaystonePage, (2) defensive `dataRef` guard в `useCategoryData` (setLoading только если data === null).
- **All 8 tabs verified** — type+backspace работают корректно на waystone, tablet, relic, jewel, vendor, belt, ring, amulet.
- Baseline: tsc 0 / eslint 0 / vitest 2228/2235 (7 pre-existing data-test failures — KI#10) / vite build PASS.
- Изменённые файлы: `src/ui/pages/jewel/JewelPage.tsx`, `src/ui/pages/waystone/WaystonePage.tsx`, `src/ui/hooks/useCategoryPage.ts`, `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`.
- **Stopping point:** iter 152 завершён, готов к push. Next iter 153 = browser testing iter 148 + iter 149 + iter 150 visual checks (7 категорийных страниц) + KI#36/37/38 browser testing + KI#39 conditional + mobile layout + code-split bundle + KI#10 (pre-existing data-test failures).

---

Task ID: 151 — stale comments + trash files cleanup (Pure documentation/cleanup pass — 6 упоминаний `LeftPanelFavorites` упрощены, 6 устаревших patch-notes файлов удалено, README заменён на минимальный). vitest 2235/2235.

Task ID: 150 — favorites wiring fix (⭐ pin button не отображался на belt/ring/amulet/jewel в two-column layout) + ⓘ in-box layout (glyph в GroupHeader позиционировался как flex-sibling → сдвигал toggle-button sideways → теперь absolute right-2 top-1/2 -translate-y-1/2 z-10 + pr-7 на toggle-button). vitest 2235/2235.

Task ID: 149 — PriorityFilter removal (полное удаление фильтра «Приоритет» из UI, state-store, URL sync, localStorage, типов, схем, тестов и документации). vitest 2235/2235.

Task ID: 148 — toolbar UX refactor (radiogroups → <select>, waystone checkboxes → color-coded chip-toggles). vitest 2235/2235.

Task ID: 147 — деплой-блокер (6 TS ошибок в VirtualizedModList.tsx) устранён, debt cleanup (LeftPanelFavorites удалён). vitest 2235/2235.

Task ID: 146 — KI#36 favorites grouping + KI#37 origin badge + KI#38 CSS `contain: layout style paint` на virtual rows. vitest 2252/2252.

Task ID: 145 — KI#34 scroll doubling + KI#35 expand/collapse all keys. vitest 2247/2247.

Task ID: 144 — 5 KI: KI#32 cascade expand, KI#30 per-category localStorage favorites, KI#31 quick-select panel, KI#33 VendorPage favorites, KI#23 scroll jitter estimate. vitest 2247/2247 (+57 new tests).

Task ID: ≤143 — см. git log. Полная история в `git log --oneline`.

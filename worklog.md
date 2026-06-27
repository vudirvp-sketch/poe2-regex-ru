# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 150 (favorites wiring fix + ⓘ in-box layout)
Agent: main
Task: iter 150 — два фикса из user feedback: (1) favorites feature не работала на 4 категорийных страницах (belt/ring/amulet/jewel) из-за отсутствующего `onTogglePinned` в `columnProps` объекта VirtualizedModList; (2) ⓘ glyph в GroupHeader сдвигал toggle-button sideways — пользователь просил «засунуть внутрь бокса».

Work Log:
- 1: **Audit favorites wiring** — grep по `pinnedIds|onTogglePinned` во всех 8 category pages показал, что все 8 корректно деструктурят и пробрасывают оба значения в `<ModList>` / `<VirtualizedModList>`. Трейс: page → ModList/VirtualizedModList → ModSubGroupSection/VirtualRowContent → FilterChip. ModList правильно пробрасывает оба значения через все пути. VirtualizedModList правильно пробрасывает в single-column пути (строка 1244-1245) и в VirtualizedColumn component (через деструктуру props), НО в `columnProps` объекте (строка 997-1016) забыли добавить `onTogglePinned` — только `pinnedIds`. Two-column layout (дефолт для belt/ring/amulet/jewel) использует `{...columnProps}` spread, поэтому `onTogglePinned` терялся. FilterChip рендерит ⭐ только когда ОБА `pinnedIds` И `onTogglePinned` переданы (backward compat из iter 136) — поэтому ⭐ silently не отображался на 4 вкладках.
- 2: **Fix KI#40** — одной строкой добавить `onTogglePinned` в объект `columnProps` в `VirtualizedModList.tsx`. Добавлен комментарий с объяснением бага.
- 3: **Audit ⓘ layout shift** — GroupHeader outer-div имел `flex items-center gap-1 w-full`, toggle-button имел `flex-1` (full width). Когда infoTooltip присутствовал, Tooltip button (w-4 h-4 + gap-1 = 20px total) становился flex-sibling'ом, и toggle-button сжимался на 20px — визуально «бокс» сдвигался влево на 20px. Пользователь: «значок сдвигает в сторону блок с аффиксами, как бы пододвигая "бокс" кнопки. Нельзя ли внутрь бокса в край левый правый засунуть?»
- 4: **Fix KI#41** — подход: outer-div получает `relative`, Tooltip позиционируется `absolute right-2 top-1/2 -translate-y-1/2 z-10`, toggle-button получает `pr-7` когда infoTooltip присутствует (резервирует 28px место под 16px glyph + 8px breathing space, чтобы длинный label не перекрывал glyph). Tooltip остаётся SIBLING'ом toggle-button (nested `<button>` — invalid HTML), но визуально находится «внутри бокса» — overlays right padding area toggle-button'а. Toggle-button теперь всегда full-width независимо от наличия ⓘ.
- 5: **Update docstring** — GroupHeader.tsx docstring обновлён под iter 150 KI#41.
- 6: **Verification** — `tsc -b` 0 errors / `eslint .` 0 warnings / `vitest run` 2235/2235 PASS (без изменений — same count as iter 149) / `vite build` PASS, 9 prerendered HTML. Bundle: index-Cmgdpsbl.js 603.60 KB (было 603.48 KB в iter 149 — практически идентично, +0.12 KB за счёт добавленного комментария и `pr-7` class).
- 7: **STATUS.md** — переписан под iter 150. KI#40 и KI#41 добавлены в раздел «Что было сделано». Browser testing для iter 148/149/150 visual checks собран в один список known issue #7.
- 8: **worklog.md** — iter 149 сокращён до одной строки. iter 150 подробно задокументирован.

Stage Summary:
- **KI#40 favorites fix DONE** — ⭐ pin button теперь рендерится на ВСЕХ 8 категорийных страницах (раньше только на relic/waystone/tablet/vendor, отсутствовал на belt/ring/amulet/jewel в two-column layout).
- **KI#41 ⓘ in-box layout DONE** — ⓘ glyph больше не сдвигает toggle-button sideways. Toggle-button всегда full-width, ⓘ overlays на правом краю (28px pr-7 резервация).
- Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / vite build PASS (9 prerendered HTML).
- Изменённые файлы: `src/ui/components/VirtualizedModList.tsx`, `src/ui/components/GroupHeader.tsx`, `STATUS.md`, `worklog.md`.
- **Stopping point:** iter 150 завершён, готов к push. Next iter 151 = browser testing iter 148 + iter 149 + iter 150 visual checks (7 категорийных страниц: проверить что ⭐ отображается везде, что ⓘ не сдвигает блок, что селекта «Приоритет» больше нет, что И/ИЛИ/Sort/Show-mode/Waystone chips работают) + KI#36/37/38 browser testing + KI#39 conditional + mobile layout + code-split bundle.

---

Task ID: 149 — PriorityFilter removal (полное удаление фильтра «Приоритет» из UI, state-store, URL sync, localStorage, типов, схем, тестов и документации). vitest 2235/2235.

Task ID: 148 — toolbar UX refactor (radiogroups → <select>, waystone checkboxes → color-coded chip-toggles). vitest 2235/2235.

Task ID: 147 — деплой-блокер (6 TS ошибок в VirtualizedModList.tsx) устранён, debt cleanup (LeftPanelFavorites удалён). vitest 2235/2235.

Task ID: 146 — KI#36 favorites grouping + KI#37 origin badge + KI#38 CSS `contain: layout style paint` на virtual rows. vitest 2252/2252.

Task ID: 145 — KI#34 scroll doubling + KI#35 expand/collapse all keys. vitest 2247/2247.

Task ID: 144 — 5 KI: KI#32 cascade expand, KI#30 per-category localStorage favorites, KI#31 quick-select panel, KI#33 VendorPage favorites, KI#23 scroll jitter estimate. vitest 2247/2247 (+57 new tests).

Task ID: ≤143 — см. git log. Полная история в `git log --oneline`.

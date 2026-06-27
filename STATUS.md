# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 141
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (все 7 фаз ✅ DONE + iter 138-141 fixes) + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 141: 4 UI bug fixes по feedback пользователя (KI#26, KI#27, KI#28, KI#29) + 2 KI documented as monitoring (KI#30, KI#31).**

Пользователь после iter 140 сообщил о 4 новых UX-проблемах: (1) настройки (round10 и
прочие) не сохраняются при переключении вкладок + round10 должен быть default off;
(2) счётчик избранного считает N (по числу tier-ов) вместо 1 на семейство;
(3) в VirtualizedModList префиксы/суффиксы всё ещё 40/60 вместо 50/50;
(4) collapse-панель правой колонки слишком громоздкая. Все 4 задокументированы
как KI#26-29 ДО фикса; 2 более крупных запроса (cross-tab persistence favorites,
favorites как quick-select) задокументированы как KI#30-31 (monitoring).

### iter 141 deliverables

1. **KI#26 (FIXED): round10 default off + global settings cross-tab persistence.**
   `defaultRound10` было `true` → стало `false` (per user request). Добавлен
   `src/store/local-settings.ts` — тонкая обёртка над `localStorage` с JSON
   serialize + try/catch fallback. В `useCategoryPage.ts` 6 useState-backed
   настроек (`round10Enabled`, `searchLogic`, `minValue`, `maxValue`,
   `priorityFilter`, `thresholdEnabled`, `sortMode`) теперь читаются из
   localStorage если URL не задал значение, и пишутся в localStorage при каждом
   изменении. URL остаётся primary source для shareable links; localStorage
   заполняет пробел между вкладками.
2. **KI#27 (FIXED): Prefix/suffix 50/50 alignment в VirtualizedModList.** iter 139
   KI#17 фикс (`md:grid-cols-2`) был применён ТОЛЬКО к `ModList.tsx` (relic,
   tablet, waystone), но НЕ к `VirtualizedModList.tsx` (belt, ring, amulet,
   jewel) — там осталось `md:grid-cols-[2fr_3fr]` (40/60 split). Fix: одна строка
   в VirtualizedModList.tsx заменена на `md:grid-cols-2`.
3. **KI#28 (FIXED): Favorites counter — 1 per family, not N per tier.** Раньше
   `handleTogglePinned(ids)` в каждой странице вызывал `togglePinned(id)` для
   КАЖДОГО member ID семьи (5 tier-ов → 5 IDs → счётчик показывал 5). Теперь
   вызывается только для первого member ID — `pinnedIds.size` теперь = число
   favorited семей, что соответствует mental model пользователя «1 клик = 1
   избранное». `FilterChip.isPinned` (`memberIds.some(...)`) продолжает работать.
4. **KI#29 (FIXED): Aside collapse header упрощён.** Раньше это была полная панель
   (`bg-panel border p-2`) с пустым `<span>` и chevron-кнопкой. Стало: компактный
   flex-row с маленькой иконкой-кнопкой `p-1`, без panel-wrapper, без пустого
   span. Визуально легче, но функция (collapse/expand) сохранена.

### iter 141 changes (files)

- `src/store/local-settings.ts` — NEW file. `readLocalSetting<T>(key, fallback)`
  + `writeLocalSetting<T>(key, value)`. JSON serialize, try/catch silent fallback.
- `src/ui/hooks/useCategoryPage.ts` — `defaultRound10` true→false; 6 useState
  initializers extended с `readLocalSetting` fallback; URL-sync effect extended
  с `writeLocalSetting` calls.
- `src/ui/components/VirtualizedModList.tsx` — line ~1018: `md:grid-cols-[2fr_3fr]`
  → `md:grid-cols-2` (parity with ModList.tsx iter 139 KI#17).
- `src/ui/pages/{amulet,belt,jewel,relic,ring,tablet,waystone}/*.tsx` —
  `handleTogglePinned` упрощён: `ids.forEach(id => togglePinned(id))` →
  `if (ids.length > 0) togglePinned(ids[0])`. Комментарий обновлён.
- `src/ui/layout/CategoryLayout.tsx` — aside header переписан: удалён пустой
  `<span>`, panel-wrapper заменён на compact flex-row с маленькой кнопкой.
- `tests/store/local-settings.test.ts` — NEW file (8 tests).
- `tests/ui/CategoryLayout.test.tsx` — NEW describe block (4 tests for KI#29:
  no bg-panel wrapper, no empty span, toggle functional, no header when no basket).
- `tests/ui/VirtualizedModList.test.tsx` — NEW describe block (1 test for KI#27:
  md:grid-cols-2 present, 2fr_3fr absent).

### Проверки (iter 141)

- **vitest:** 2190/2190 passed (53 test files). Was 2177 in iter 140 → **+13 net**
  (8 new local-settings + 4 new CategoryLayout KI#29 + 1 new VirtualizedModList
  KI#27). Existing tests unchanged.
- **tsc:** 0 errors.
- **eslint:** 0 problems 0 warnings.
- **Backward compat:** `pinnedIds` semantic preserved (Set<string> of token IDs).
  Only page-level `handleTogglePinned` behavior changed (calls togglePinned once
  per family instead of once per member). `LeftPanelFavorites` component file
  unchanged. URL serialization of `pinnedIds` unchanged (`pn` key).

### iter 140 reference (brief)

iter 140: 4 UI bug fixes (KI#21, 22, 24, 25) + KI#23 monitoring — duplicate
icons fix, StatusPanel rewrite (badges+alerts only), FavoritesIndicator NEW
component (compact `★ N` badge in 7 page headers), show-selected-only tooltip.
2177/2177 tests.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
3. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
4. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай.
5. **Phase 2 UX change: sub-groups default COLLAPSED** (iter 133). In-game verification pending (KI#15).
6. **Phase 3 UX change: show-selected-only filter** (iter 135) + **iter 140 (KI#25) tooltip clarification**. In-game verification pending (KI#15).
7. **Phase 3 UX change: SelectedBasket panel + collapsible right aside** (iter 135) + **iter 141 (KI#29) compact aside header**. In-game verification pending (KI#15).
8. **Phase 5 UX change: ⭐ pin/unpin icon on FilterChip** (iter 136) + **iter 140 (KI#24) FavoritesIndicator в header** + **iter 141 (KI#28) 1-ID-per-family counter fix**. In-game verification pending (KI#15).
9. **Phase 4 UX change: stronger bg tints on `.affix-header-*` + compact chip density** (iter 137). In-game verification pending (KI#15).
10. **Phase 4 UX change: ⓘ tooltip on affix column headers** (iter 137). In-game verification pending (KI#15).
11. **Phase 4.5 UX change: «Обозначения» icon legend** (iter 137) + **iter 140 (KI#21) duplicate icons fix**. In-game verification pending (KI#15).
12. **Phase 4 iter 138 UX change: `--strong` modifier wiring в tier-first mode**. In-game verification pending (KI#15).
13. **KI#23 (iter 140 — MONITORING): Scroll jitter / «doubling» в virtualized lists.**
    На belt/ring/amulet/jewel страницах при скролле видны «дрожащие»/«прыгающие»
    названия категорий и affix chips. Root cause: TanStack Virtual's dynamic
    `measureElement` + `ResizeObserver` — estimate sizes (60px для subgroup)
    отличаются от actual sizes (40–120px), при scroll ResizeObserver fires →
    totalSize changes → paddingTop/paddingBottom shifted → visible rows jump.
    Файлы: `src/ui/components/VirtualizedModList.tsx` (VirtualizedColumn, ROW_ESTIMATES).
    Возможные решения: (a) static row heights (требует измерения всех вариантов
    chip layouts); (b) improved estimateSize per-row-state (selected+range vs
    collapsed); (c) CSS Grid virtualization вместо TanStack. Не фиксировано —
    требует отдельной итерации с careful testing.
14. **KI#30 (iter 141 — MONITORING): Cross-tab persistence favorites (pinnedIds).**
    `pinnedIds` хранятся в per-category Zustand store, который уничтожается при
    unmount. URL hash shared между вкладками и перезаписывается при переходе.
    Сессия: при reload вкладки favorites теряются (если URL не был сохранён).
    Решения: (a) per-category localStorage keys (`poe2:favorites:belt`, ...);
    (b) global Zustand store с category-keyed map (вне React tree); (c) IndexedDB.
    iter 141 уже добавил `src/store/local-settings.ts` infrastructure для global
    settings — расширение до per-category favorites требует design decision
    (format, expiry, migration). Отложено на iter 142+.
15. **KI#31 (iter 141 — MONITORING): Favorites как quick-select feature.**
    Пользователь ожидает: клик на ★ в избранном → аффикс выбирается (added to
    selectedIds) ИЛИ scroll-to-mod срабатывает. Текущая реализация: ★ только
    визуальный маркер + фильтр show-selected-only. Feature gap, не bug.
    Решения: (a) click на ★ в FavoritesIndicator → диалог/панель со списком
    favorited семей + быстрый select; (b) click на ★ в FilterChip → toggle AND
    scroll-to-mod (если не в viewport); (c) отдельный «Favorites» tab/drawer.
    Требует UX design + user feedback. Отложено на iter 142+.

### Закрытые KI (краткая справка)

- **KI#7** (iter 121 → VERIFIED iter 129): HomePage hero decorations.
- **KI#8** (iter 122 → VERIFIED iter 129): SeoBlock atmosphere backdrop.
- **KI#10** (iter 126 → VERIFIED iter 127): ambiguous suffix FP для `Редкость предметов`.
- **KI#11** (iter 126 → DISPROVEN iter 127): cross-block `.*` hypothesis.
- **KI#12** (iter 127 → FIXED): tier-hardcoded regex для 7 single-`#` relic tokens.
- **KI#13** (iter 128 → FIXED): пропущен implicit `Редкость монстров` + BTS-статы.
- **KI#16-20** (iter 139 → VERIFIED iter 140): aside overflow, prefix/suffix 50/50, chip truncation reverted, non-sticky search, LeftPanelFavorites removed.
- **KI#21** (iter 140 → FIXED): duplicate icons in legend.
- **KI#22** (iter 140 → FIXED): redundant "Выбрано" block removed.
- **KI#24** (iter 140 → FIXED): favorites restored as compact indicator.
- **KI#25** (iter 140 → FIXED): show-selected-only tooltip clarification.
- **KI#26** (iter 141 → FIXED): round10 default off + global settings localStorage persistence.
- **KI#27** (iter 141 → FIXED): VirtualizedModList prefix/suffix 50/50 alignment.
- **KI#28** (iter 141 → FIXED): favorites counter — 1 per family.
- **KI#29** (iter 141 → FIXED): aside collapse header simplified.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone (вся quoted group) | ✅ | in-game verified (iter 15) |
| `prefix (A\|B\|C)%.*suffix` | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` | ❌ | iter 125 — игнорируется in-game. Fix: Path D |
| Ambiguous suffix → multi-implicit FP | ✅ | iter 126 VERIFIED iter 127 |
| `.*` cross-block/line boundaries | ✅ | iter 127 VERIFIED — `.*` НЕ пересекает lines/blocks |
| Single-`#` template → tier-hardcoded regex (FN) | ✅ | iter 127. Fix: explicit override |
| BTS-статы в waystone-аффиксах (FP clutter) | ✅ | iter 128 |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Next iteration (iter 142)

**iter 141 завершён: 4 UI bug fixes (KI#26, 27, 28, 29) + 2 KI documented (KI#30, 31). Pending: in-browser UX verification пользователем iter 141 changes.**

Следующий агент: читать `docs/UI_REFACTOR_PLAN.md` §12 (Phase Status) + §13.7 (Recommendation для iter 142 = UX verification + KI#23/30/31 fixes + remaining optional enhancements).

**Приоритеты для iter 142+:**

1. **In-browser UX verification feedback** пользователем iter 141 changes:
   - **KI#26**: round10 OFF by default; after toggling ON on Belt, navigating to
     Ring → round10 still ON (localStorage); coming back to Belt → still ON.
   - **KI#27**: belt/ring/amulet/jewel pages show 50/50 prefix/suffix (was 40/60).
   - **KI#28**: clicking ★ on a 5-tier family shows counter = 1 (was 5).
   - **KI#29**: right aside header is a small chevron button, no big panel.
   Если найден новый баг — сначала документировать в STATUS.md как Known Issue, потом фиксить.

2. **KI#23 (scroll jitter)** — fix candidate. Изучить virtualization measurement.
   Возможно: static heights, improved estimateSize, OR shift to CSS Grid virtualization.

3. **KI#30 (cross-tab favorites persistence)** — implement. Расширить
   `local-settings.ts` до per-category keys (`poe2:favorites:belt`, ...) или
   ввести global store. Требует careful testing URL sync interaction.

4. **KI#31 (favorites как quick-select)** — UX design + implementation. Click
   ★ → select affix OR scroll-to-mod.

5. **KI#9** (MULTI_RANGE slot N>0) — monitoring, не фиксировано.

6. **Remaining optional enhancements** (если user запросит):
   - Persist `rightPanelCollapsed` to URL.
   - VendorPage Phase 5 wiring (⭐ pin slot).
   - Phase 5 scroll-to-mod on mobile / virtualized lists.
   - Tooltip `--strong` styling variant.
   - IconLegend `items` prop extension.

**Главные ограничения для iter 142:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue,
  потом фиксий.
- KI#23 fix требует careful testing — лучше недоделать, чем сломать virtualization.
- KI#30/31 требуют UX design решения — сначала обсудить с user, потом реализовывать.

---

Контакты: Discord **woonderdad**

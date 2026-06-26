# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 136
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (план, Phase 1+2+2.5+3+5 DONE) + `docs/UI_VISUALIZATION_AUDIT.md` (эталон iter 130 + iter 131 corrections)

---

## Текущее состояние

**iter 136: UI Refactor Phase 5 — favorites in left panel готовы.**

Phase 5 потребляет `pinnedIds` (уже в store с Phase 1, iter 132) и добавляет:
новый `LeftPanelFavorites.tsx` компонент в ЛЕВОЙ колонке (над `CategoryControlPanel`,
под header — финальный visual order: Header → Favorites → Filters → Search (sticky
inside ModList) → ModList, с sticky Search становящимся primary control после
скролла). Каждый chip = ⭐ filled icon + colored affix badge (ПРЕФ=blue, СУФ=orange,
ИМПЛ=amber per iter 130 visualization) + displayText + ✗ unpin button. Click на
chip body → scroll-to-mod via `document.querySelector('[data-family-key="..."]')`
+ 2s `.favorite-pulse` CSS highlight (gold/amber). Click ✗ → `onTogglePinned(memberIds)`
unpins that family. Header «⭐ Избранные: N» + «Очистить» link → `clearPinned()`.
Empty state → «Нажмите ★ на аффиксе, чтобы добавить в избранное» placeholder.
Max-height 30vh + internal scroll (matches SelectedBasket).

`FilterChip.tsx` extended with `pinnedIds?: Set<string>` + `onTogglePinned?: (ids:
string[]) => void` optional props. When BOTH provided → ⭐ icon button renders
LEFT of label. Filled `★` (text-accent-amber-soft) when any member is pinned;
outline `☆` (text-muted) otherwise. Click → `onTogglePinned(memberIds)` (toggles
whole family). `stopPropagation` prevents the click from also toggling selection.
`aria-pressed` reflects pinned state. `data-family-key={group.familyKey}`
attribute on the wrapping div enables scroll-to-mod from LeftPanelFavorites.

`CategoryLayout.tsx` extended with `favorites?: React.ReactNode` optional prop —
rendered ABOVE `controls` in the left column. 7 page files (Belt/Ring/Amulet/
Jewel/Waystone/Tablet/Relic) wire `favorites={<LeftPanelFavorites .../>}` +
`pinnedIds` + `handleTogglePinned` (useCallback wrapper around `togglePinned(id)`)
+ `onTogglePinned={handleTogglePinned}` to `<VirtualizedModList>`/`<ModList>`.
VendorPage не тронут (custom FilterChip — no ModList).

**Сделано в iter 136:**

1. **`src/shared/i18n.ts`** — +7 keys (Phase 5 section): `favorites.title`
   («⭐ Избранные: {n}»), `favorites.empty` («Нажмите ★ на аффиксе, чтобы добавить
   в избранное»), `favorites.clear` («Очистить»), `favorites.clear_aria`,
   `favorites.unpin_aria` («Убрать из избранного»), `favorites.scroll_aria`
   («Перейти к аффиксу в списке»), `chip.pin_tooltip` («Добавить в избранное»),
   `chip.unpin_tooltip` («Убрать из избранного»), `chip.pin_aria`, `chip.unpin_aria`.

2. **`src/ui/components/LeftPanelFavorites.tsx`** (NEW, ~230 строк) — renders
   one chip per favorited family group (NOT per token — same `groupTokensByFamily`
   logic as SelectedBasket). Each chip = ⭐ filled icon + colored affix badge
   (ПРЕФ=blue, СУФ=orange, ИМПЛ=amber) + displayText + ✗ unpin button. Click
   chip body → `handleScrollToChip(familyKey)` via `document.querySelector` +
   `scrollIntoView({behavior:'smooth', block:'center'})` + `classList.add('favorite-pulse')`
   (CSS 2s gold/amber animation, removed via `window.setTimeout(2000)`). Click ✗
   → `onTogglePinned(memberIds)` unpins that family. Header «⭐ Избранные: N» +
   «Очистить» link → `onClearPinned()`. Empty state → placeholder text. Max-height
   30vh + internal scroll. Accessible: `role="button"` + `tabIndex=0` + Enter/Space
   keydown + `aria-label` «{displayText} — Перейти к аффиксу в списке».

3. **`src/ui/components/FilterChip.tsx`** расширено — `FilterChipProps` +2
   optional props (`pinnedIds`, `onTogglePinned`). `data-family-key={group.familyKey}`
   attribute on wrapping div. When BOTH props provided → ⭐ icon button renders
   LEFT of label. `★` filled (text-accent-amber-soft) when any member is pinned;
   `☆` outline (text-muted) otherwise. Click → `handlePinClick` calls
   `onTogglePinned(memberIds)` with `e.stopPropagation()`. `aria-pressed={isPinned}`
   reflects state. Backward compat: when EITHER prop omitted → ⭐ NOT rendered.

4. **`src/ui/layout/CategoryLayout.tsx`** расширено — `CategoryLayoutProps` +1
   optional prop (`favorites`). Rendered ABOVE `controls` in left column. Per
   iter 131 §13.7 #1 — Search is sticky inside ModList (Phase 2), so initial
   visual order is Header → Favorites → Filters → Search (sticky) → ModList;
   after scroll, Search sticks to top of viewport as primary control.

5. **`src/ui/hooks/useCategoryPage.ts`** расширено — `CategoryPageState` +3
   fields (`pinnedIds`, `togglePinned`, `clearPinned`). +3 `useStore(state =>
   state.X)` subscriptions. URL-sync effect deps array +`pinnedIds` (so pin/unpin
   triggers URL re-sync via `pn` compact key — already in store since iter 132).
   +3 return fields.

6. **`src/ui/components/ModList.tsx`** + **`src/ui/components/VirtualizedModList.tsx`**
   — each: +1 optional prop (`onTogglePinned`). Prop chain: ModList → AffixColumn
   → ModSubGroupSection → FilterChip + ModList → direct FilterChip usages.
   `pinnedIds` prop already existed (iter 134 forward-compat) — only `onTogglePinned`
   is new. Pass `pinnedIds={pinnedIds}` + `onTogglePinned={onTogglePinned}` to
   every FilterChip usage (4 in ModList, 1 in VirtualizedModList).

7. **`src/index.css`** — +`.favorite-pulse` CSS class (2s ease-out animation,
   gold/amber box-shadow + background-color pulse, runs once via
   `animation-iteration-count: 1`). Matches PoE2 gold tone (`rgba(212, 175, 55, 0.x)`).

8. **7 page files** (Belt/Ring/Amulet/Jewel/Waystone/Tablet/Relic) — каждый:
   +1 import (`LeftPanelFavorites`), +1 import (`useCallback` from react), +3
   destructured fields из `useCategoryPage()` (`pinnedIds`, `togglePinned`,
   `clearPinned`), +`handleTogglePinned` useCallback wrapper (calls `togglePinned(id)`
   for each member ID — signature adapter between FilterChip's `(ids: string[])`
   and store's `(id: string) => void`), +1 prop to `<CategoryLayout>` (`favorites={
   <LeftPanelFavorites .../>}`), +2 props to `<VirtualizedModList>`/`<ModList>`
   (`pinnedIds`, `onTogglePinned`). VendorPage не тронут (custom FilterChip).

9. **Tests:**
   - `tests/ui/LeftPanelFavorites.test.tsx` (NEW, ~440 строк, 17 tests): empty
     state, renders one chip per favorited family (not per token), affix-type
     badges (ПРЕФ/СУФ/ИМПЛ), ⭐ filled icon on each chip, header count, ✗ unpin
     button calls onTogglePinned with member IDs, «Очистить» calls onClearPinned,
     «Очистить» NOT rendered in empty state, click-to-scroll calls
     document.querySelector with data-family-key selector, scrollIntoView called
     with smooth/center args, favorite-pulse CSS class added then removed after
     2s, degrades gracefully when chip not in DOM (virtualized out), Enter key
     triggers scroll, Space key triggers scroll, category prop optional,
     max-height 30vh + overflow-y-auto layout.
   - `tests/ui/FilterChip.test.tsx` +8 tests (Phase 5 describe block): ⭐ NOT
     rendered when pinnedIds omitted (backward compat), ⭐ NOT rendered when
     onTogglePinned omitted (backward compat), ☆ outline when not pinned, ★
     filled when any member pinned, click ⭐ calls onTogglePinned with member
     IDs, click ⭐ does NOT call onToggleTokens (stopPropagation), aria-pressed
     reflects state, data-family-key attribute on wrapping div.

### Проверки (iter 136)

- **vitest:** 2124/2124 tests passed (47 test files). Was 2099 in iter 135 →
  **+25 new tests** (17 LeftPanelFavorites + 8 FilterChip Phase 5).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **Backward compat:** все new props optional — legacy callers (tests, future
  use) без wiring рендерят как раньше (no ⭐ icon, no favorites panel, no
  data-family-key attribute).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как компенсация.
3. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
4. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай. Mitigation: расширить `distributeAlternation` при FP.
5. **Phase 2 UX change: sub-groups default COLLAPSED** (iter 133). In-game/in-browser verification pending (KI#15).
6. **Phase 2.5 UX change: chips truncated to first 3 + «+N ещё»** (iter 134). In-game/in-browser verification pending (KI#15).
7. **Phase 3 UX change: show-selected-only filter** (iter 135). In-game/in-browser verification pending (KI#15).
8. **Phase 3 UX change: SelectedBasket panel + collapsible right aside** (iter 135). In-game/in-browser verification pending (KI#15).
9. **Phase 5 UX change: favorites in left panel** (iter 136). LeftPanelFavorites
   renders ABOVE CategoryControlPanel (filters). Final spec order is Search →
   Favorites → Filters (§13.7 #1). Search is sticky inside ModList (Phase 2),
   so initial visual order is Header → Favorites → Filters → Search (sticky)
   → ModList. After scroll, Search sticks to top of viewport as primary control.
   In-game/in-browser verification pending (KI#15).
10. **Phase 5 UX change: ⭐ pin/unpin icon on FilterChip** (iter 136). Filled ★
    when family is pinned, outline ☆ otherwise. Click toggles whole family's
    pinned state. In-game/in-browser verification pending (KI#15).
11. **Phase 5 UX change: click-to-scroll from LeftPanelFavorites** (iter 136).
    Click chip body → `document.querySelector('[data-family-key="..."]')` +
    `scrollIntoView({behavior:'smooth', block:'center'})` + 2s `.favorite-pulse`
    gold/amber highlight. Degrades gracefully if chip is virtualized out of DOM
    (mobile / long list) — no-op. In-game/in-browser verification pending (KI#15).

### Закрытые KI (краткая справка)

- **KI#7** (iter 121 → VERIFIED iter 129): HomePage hero decorations.
- **KI#8** (iter 122 → VERIFIED iter 129): SeoBlock atmosphere backdrop.
- **KI#10** (iter 126 → VERIFIED iter 127): ambiguous suffix FP для `Редкость предметов`.
- **KI#11** (iter 126 → DISPROVEN iter 127): cross-block `.*` hypothesis.
- **KI#12** (iter 127 → FIXED): tier-hardcoded regex для 7 single-`#` relic tokens.
- **KI#13** (iter 128 → FIXED): пропущен implicit `Редкость монстров` + BTS-статы в waystone-аффиксах.

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
| `prefix (A\|B\|C)%.*suffix` (`()` после literal+space) | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` (`()` после `^`) | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` (`()` ПОСЛЕ `.*` bridge) | ❌ | iter 125 — игнорируется in-game. Fix: Path D distribution |
| Ambiguous suffix → multi-implicit FP | ✅ | iter 126 VERIFIED iter 127. Fix: более specific suffix |
| `.*` cross-block/line boundaries | ✅ | iter 127 VERIFIED — `.*` НЕ пересекает lines/blocks |
| Single-`#` template → tier-hardcoded regex (FN) | ✅ | iter 127. Fix: explicit override |
| BTS-статы в waystone-аффиксах (FP clutter) | ✅ | iter 128. Fix: расширить `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` + добавить implicit `Редкость монстров` |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Next iteration (iter 137)

Следующий агент: читай `docs/UI_REFACTOR_PLAN.md` end-to-end, особенно
§12 (Phase Status — Phase 1+2+2.5+3+5 ✅ DONE), §13 (iter 130 visualization audit)
AND §13.7 (iter 131 user feedback corrections).

**Рекомендованный старт:** Phase 4 (colors + compact + tooltips) или Phase 4.5
(«Обозначения» icon legend) — оба independent of Phase 1, можно делать в любой
итерации как warmup work для нового агента.

**Phase 4 files:**
- `src/index.css` — stronger bg tints (rgba blue/orange/amber per affix type).
- `src/ui/components/FilterChip.tsx` — compact density 25% (px-1.5 py-0.5 text-[12px]).
- NEW `src/ui/components/Tooltip.tsx` (portal-based) — для ⭐ pin icon, exclude
  button, dual-number slot labels.

**Phase 4.5 file:**
- NEW `src/ui/components/IconLegend.tsx` — 3 rows в right panel (below status,
  above profile): ⭐ = favorite, — = excluded, ⓘ = tooltip/info. Companion to
  Phase 4 tooltips.

**Главные ограничения для iter 137:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Phase 4: chip density 25% (px-1.5 py-0.5 text-[12px]); stronger bg tints
  (rgba blue/orange/amber per affix type).
- Phase 4.5: «Обозначения» legend section в right panel (below status, above
  profile) с 3 icon rows.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue,
  потом фиксий.

**Подсказка:** для Phase 4 — read `AGENT_NAVIGATION.md` Pitfall 46 (Phase 5 —
LeftPanelFavorites + FilterChip ⭐ slot + click-to-scroll). Phase 4 является
visual-only — никаких state changes, можно приземлить в любой итерации.

**UX verification request for user (iter 136 deliverable):**
Откройте 7 category pages (Belt, Ring, Amulet, Jewel, Waystone, Tablet, Relic)
на десктопе. Проверьте:
1. В левой колонке над фильтрами появился «⭐ Избранные: 0» блок с placeholder
   «Нажмите ★ на аффиксе, чтобы добавить в избранное».
2. Кликните ☆ (outline star) слева от любого chip в ModList — иконка меняется
   на ★ (filled), и в «⭐ Избранные: N» появляется новый chip с ⭐ + colored
   badge (ПРЕФ=синий, СУФ=оранжевый, ИМПЛ=янтарный) + displayText + ✗.
3. Кликните ещё раз на ★ — chip исчезает из избранного, иконка возвращается к ☆.
4. Кликните на chip body (текст) в «⭐ Избранные» — ModList скроллится к
   соответствующему chip + 2 секунды подсветки gold/amber пульсом.
5. Кликните ✗ на chip в «⭐ Избранные» — chip исчезает (unpin).
6. Кликните «Очистить» в шапке «⭐ Избранные» — все favorites очищаются.
7. State сохраняется в URL: `pn=token1,token2` после refresh восстанавливает
   favorites.
8. Если выбрано > 5-10 семей — favorites блок прокручивается внутри (max-height 30vh).
9. На мобильных — favorites блок виден над фильтрами, без отдельного collapse toggle.

Если замечен баг — сначала документируйте в STATUS.md как Known Issue, потом фиксий.

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**

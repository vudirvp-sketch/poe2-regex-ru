# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 133
> **UI-документация:** `docs/UI_AUDIT.md` (v2) + `docs/UI_REFACTOR_PLAN.md` (план, Phase 1+2 DONE iter 132-133) + `docs/UI_VISUALIZATION_AUDIT.md` (эталон iter 130 + iter 131 corrections)

---

## Текущее состояние

**iter 133: UI Refactor Phase 2 implementation — collapsible affix groups + sticky search готовы.**

Phase 2 — это UI-итерация: wired `collapsedGroups` (top-level) + `expandedSubGroups`
(sub-group) в `ModList` + `VirtualizedModList` через новый shared `GroupHeader.tsx`.
Search row стал sticky (CSS `.sticky-search-bar`), добавлены «Развернуть все» /
«Свернуть все» кнопки (desktop only). Asymmetric default per iter 131 §13.7 #4:
top-level EXPANDED, sub-groups COLLAPSED.

**Сделано в iter 133:**

1. **`src/ui/hooks/useCategoryPage.ts` расширено** — `CategoryPageState` добавлены:
   - `collapsedGroups`, `expandedSubGroups` (Sets)
   - `toggleGroupCollapsed`, `toggleSubGroupExpanded`
   - `expandAllGroups`, `collapseAllGroups(keys)`, `expandAllSubGroups(keys)`, `collapseAllSubGroups`
   - Все wired к filter-store (Phase 1, iter 132). URL-sync effect расширен —
     collapse state триггерит re-sync URL hash сразу при toggle.

2. **Новый `src/ui/components/GroupHeader.tsx`** — shared collapsible header
   component. Props: `label`, `count`, `isCollapsed`, `onToggle`, `controlsId?`,
   `className?`, `icon?`, `variant?` (`'top' | 'sub' | 'origin'`). Renders как
   `<button>` с `aria-expanded` + `aria-controls`. Chevron — CSS-rotated `▶`
   glyph (no inline SVG, no extra deps). Variant-driven Tailwind classes.

3. **`src/ui/components/ModList.tsx` расширено** — новые optional props
   (`collapsedGroups`, `expandedSubGroups`, `onToggleGroupCollapsed`,
   `onToggleSubGroupExpanded`, `onExpandAllGroups`, `onCollapseAllGroups`,
   `onExpandAllSubGroups`, `onCollapseAllSubGroups`). Все optional — backward
   compatible (legacy callers без collapse wiring рендерят как раньше).
   `AffixColumn` рендерит `GroupHeader` (top-level) + skip sub-groups когда
   collapsed. `ModSubGroupSection` рендерит `GroupHeader` (sub-level) + skip
   chips когда collapsed. Search row обёрнут в `.sticky-search-bar`.
   «Развернуть все» / «Свернуть все» кнопки (desktop only, `hidden lg:inline-flex`).

4. **`src/ui/components/VirtualizedModList.tsx` расширено** — те же optional props
   что у ModList. `buildColumnRows()` принимает `topKey`, `collapsedGroups`,
   `expandedSubGroups` и фильтрует rows: collapsed top-level → только
   `column-header` row; collapsed sub-group → `subgroup-header` row (header-only,
   без chips). Новый `VirtualRow` variant `subgroup-header` + `ROW_ESTIMATES`
   entry (30px). `VirtualRowContent` рендерит `GroupHeader` для `column-header`
   и `subgroup-header` rows когда collapse wiring provided; legacy path — static
   text (pre-Phase-2 behaviour). Search row sticky + expand/collapse-all кнопки.

5. **7 page files обновлены** — BeltPage, RingPage, AmuletPage, JewelPage,
   WaystonePage, TabletPage, RelicPage. Все forward'ят новые collapse props
   из `useCategoryPage` → `<ModList>` / `<VirtualizedModList>`. VendorPage
   использует custom FilterChip rendering (без ModList) — не тронут.

6. **CSS** — `src/index.css` +`.sticky-search-bar` (position: sticky, top: 52px
   mobile / 56px md+, backdrop-blur, z-index: 20) + `.group-header-chevron`
   (CSS transition + rotate 90deg when `[aria-expanded="true"]`).

7. **i18n** — `src/shared/i18n.ts` +4 keys: `group.expand_all`, `group.collapse_all`,
   `group.collapse_btn_label`, `group.expand_btn_label`.

8. **3 новых test files**:
   - `tests/ui/GroupHeader.test.tsx` (14 tests) — label/count render, click →
     onToggle, aria-expanded, aria-controls, aria-label (Русский expand/collapse
     verbs), chevron aria-hidden + glyph, variants ('top'/'sub'/'origin'),
     custom className merge, icon render order, count=0 edge case.
   - `tests/ui/ModList.test.tsx` (11 tests) — default state (top expanded),
     sub-group expand shows chips, top-level collapse hides chips, click top
     header → onToggleGroupCollapsed, sticky-search-bar class present,
     expand/collapse-all buttons render only when wiring provided, backward
     compat (no wiring → no GroupHeader, chips render normally), expand-all /
     collapse-all button click behaviour.
   - `tests/ui/VirtualizedModList.test.tsx` (11 tests) — sticky-search-bar,
     expand/collapse-all buttons rendering + click behaviour, backward compat,
     GroupHeader rendering when wiring provided, collapsed top-level state
     (component mounts without crash in jsdom — actual row filtering verified
     via ModList tests since jsdom virtualizer renders 0 rows).

### Проверки (iter 133)

- **vitest:** 2070/2070 tests passed (45 test files). Was 2034 in iter 132 →
  **+36 new tests** (14 GroupHeader + 11 ModList + 11 VirtualizedModList).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **Backward compat:** все existing tests проходят без изменений. Legacy callers
  ModList/VirtualizedModList без collapse wiring рендерят как раньше.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как компенсация.
3. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
4. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай. Mitigation: расширить `distributeAlternation` при FP.
5. **Phase 2 UX change: sub-groups default COLLAPSED** (iter 133). Пользователи
   теперь видят только top-level headers (ИМПЛИСИТЫ/ПРЕФИКСЫ/СУФФИКСЫ) +
   sub-group headers (ДОБЫЧА/УСИЛЕНИЯ/...) при первом открытии category page.
   Chips скрыты до expand. Кнопка «Развернуть все» (desktop) или individual
   chevron clicks восстанавливают вид. State persistится в URL. In-game
   verification pending (KI#14 below).

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

## Next iteration (iter 134)

Следующий агент: читай `docs/UI_REFACTOR_PLAN.md` end-to-end, особенно
§12 (Phase Status — Phase 1+2 ✅ DONE), §13 (iter 130 visualization audit)
AND §13.7 (iter 131 user feedback corrections). Затем
`docs/UI_VISUALIZATION_AUDIT.md` — user-approved visual target (note §8
iter 131 corrections).

**Рекомендованный старт:** Phase 2.5 («+N ещё» per-sub-group chip expander).
Phase 2.5 потребляет `chipExpandState` (уже wired в store с Phase 1). UI: when
sub-group has >3 chips, show first 3 + «+N ещё» button → click toggles
`chipExpandState`. Selected/pinned chips ALWAYS visible even when truncated.

**Главные ограничения для iter 134:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Phase 3: basket cap = 20 (was 12), 3-column 20%/60%/20% + collapsible right
  panel (§13.7 #2, #3). `showSelectedOnly` поле уже готово.
- Phase 5: left panel order Search → Favorites → Filters (§13.7 #1).
  `pinnedIds` поле уже готово.
- Phase 4 и Phase 4.5 — независимы от Phase 1, можно делать в любой итерации.

**Подсказка:** для Phase 2.5 — read `AGENT_NAVIGATION.md` Pitfall 42 + 43.
Pitfall 43 describes Phase 2 wiring (collapse state consumption pattern).
Phase 2.5 wires `chipExpandState` analogously — read `CHIP_PREVIEW_COUNT`
constant (to be added to `src/shared/constants.ts`). Modify `ModList.tsx` +
`VirtualizedModList.tsx` to slice chips to preview count + render «+N ещё»
button. See `docs/UI_REFACTOR_PLAN.md` §4 Phase 2.5 for full spec.

**UX verification request for user (iter 133 deliverable):**
Откройте 7 category pages (Belt, Ring, Amulet, Jewel, Waystone, Tablet, Relic)
на десктопе. Проверьте:
1. Top-level headers (ИМПЛИСИТЫ/ПРЕФИКСЫ/СУФФИКСЫ) отображаются с chevron ▶.
2. Sub-group headers (ДОБЫЧА/УСИЛЕНИЯ/...) отображаются с chevron ▶.
3. По умолчанию chips скрыты (sub-groups collapsed). Клик по sub-group header
   расширяет его. State сохраняется в URL после refresh.
4. Кнопка «Развернуть все» / «Свернуть все» в sticky search row (desktop).
5. Search row остаётся видимым при скролле.
6. Mobile: chevron работает per-group, но без «Развернуть все» кнопки.

Если замечен баг — сначала документируйте в STATUS.md как Known Issue, потом фиксий.

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**

# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 134
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (план, Phase 1+2+2.5 DONE) + `docs/UI_VISUALIZATION_AUDIT.md` (эталон iter 130 + iter 131 corrections)

---

## Текущее состояние

**iter 134: UI Refactor Phase 2.5 — «+N ещё» per-sub-group chip expander готов.**

Phase 2.5 потребляет `chipExpandState` (уже в store с Phase 1, iter 132).
Когда sub-group содержит > `CHIP_PREVIEW_COUNT` (=3) chips, UI показывает
первые 3 + «+N ещё» кнопку. Клик по кнопке toggles `chipExpandState` →
показываются все chips + «свернуть» кнопка. Selected/excluded/pinned chips
ВСЕГДА видимы даже в truncated состоянии (важные chips не теряются).

**Сделано в iter 134:**

1. **`src/shared/constants.ts`** — добавлена `CHIP_PREVIEW_COUNT = 3`
   константа с подробным JSDoc.

2. **`src/shared/i18n.ts`** — +4 keys: `chip.more` («+{n} ещё»),
   `chip.more_aria` («Развернуть оставшиеся {n} аффиксов»), `chip.collapse`
   («свернуть»), `chip.collapse_aria` («Свернуть оставшиеся аффиксы»).

3. **`src/ui/hooks/useCategoryPage.ts`** расширено — `CategoryPageState`
   добавлены `chipExpandState: Set<string>` + `toggleChipExpand: (key) => void`.
   +2 `useStore(state => state.X)` subscriptions. URL-sync effect deps array
   расширен — toggle chipExpand триггерит re-sync URL hash сразу.

4. **`src/ui/components/ModList.tsx`** расширено — `ModListProps` +3 optional
   props (`chipExpandState`, `onToggleChipExpand`, `pinnedIds`). All optional —
   backward compatible. `ModSubGroupSection` реализует slicing logic: когда
   chip-expand wiring provided AND sub-group NOT in `chipExpandState` AND
   chips count > `CHIP_PREVIEW_COUNT` → render first N + important chips past N
   (selected/excluded/pinned) + «+N ещё» button. Когда sub-group IN
   `chipExpandState` → render all chips + «свернуть» button. Когда wiring
   absent → render all chips (pre-Phase-2.5 behaviour). `AffixColumn` пробрасывает
   3 новых props во все 6 callsites `ModSubGroupSection`.

5. **`src/ui/components/VirtualizedModList.tsx`** расширено — same +3 optional
   props. `VirtualRowContent` subgroup row реализует identical slicing logic
   (kept in sync с ModList). `VirtualizedColumnProps` +3 props forwarded to
   `VirtualRowContent`. `columnProps` object + 3 fields. Single-column render
   path also forwards 3 props.

6. **7 page files** (Belt/Ring/Amulet/Jewel/Waystone/Tablet/Relic) — каждый:
   +2 destructured fields из `useCategoryPage()` (`chipExpandState`,
   `toggleChipExpand`) + 2 forwarded props to `<ModList>`/`<VirtualizedModList>`.
   VendorPage не тронут (custom FilterChip).

7. **Tests:**
   - `tests/ui/ModList.test.tsx` — +6 tests (Phase 2.5 chip truncation
     describe block): truncated state, click «+N ещё» → onToggleChipExpand
     call, expanded state shows «свернуть», selected chip always visible past
     preview, backward compat (no wiring → no truncation), small sub-group
     (≤3 chips) renders all without button.
   - `tests/ui/VirtualizedModList.test.tsx` — +3 tests (Phase 2.5 chip-expand
     wiring describe block): mounts with wiring, backward compat (no wiring),
     accepts `pinnedIds` prop (Phase 5 forward-compat). Note: jsdom virtualizer
     renders 0 rows, so chip truncation behaviour verified via ModList tests.

### Проверки (iter 134)

- **vitest:** 2079/2079 tests passed (45 test files). Was 2070 in iter 133 →
  **+9 new tests** (6 ModList + 3 VirtualizedModList).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **Backward compat:** все existing tests проходят без изменений. Legacy callers
  ModList/VirtualizedModList без chip-expand wiring рендерят как раньше.

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
   verification pending (KI#15 below).
6. **Phase 2.5 UX change: chips truncated to first 3 + «+N ещё»** (iter 134).
   Когда sub-group expanded AND содержит > 3 chips, UI показывает только
   первые 3 + «+N ещё» кнопку (плюс selected/pinned chips past preview window).
   In-game/in-browser verification pending (KI#15).

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

## Next iteration (iter 135)

Следующий агент: читай `docs/UI_REFACTOR_PLAN.md` end-to-end, особенно
§12 (Phase Status — Phase 1+2+2.5 ✅ DONE), §13 (iter 130 visualization audit)
AND §13.7 (iter 131 user feedback corrections). Затем
`docs/UI_VISUALIZATION_AUDIT.md` — user-approved visual target (note §8
iter 131 corrections).

**Рекомендованный старт:** Phase 3 (selected-only + basket panel).
Phase 3 потребляет `showSelectedOnly` (уже wired в store с Phase 1). UI:
toggle "Все / Выбранные" в `CategoryControlPanel` (фильтрует `familyGroups`
до только выбранных). Новый `SelectedBasket.tsx` компонент в правой панели
(max-height 30vh, scrollable, cap = 20 chips). 3-column layout 20%/60%/20%
+ collapsible right panel per iter 131 §13.7 #2, #3.

**Главные ограничения для iter 135:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Phase 3: basket cap = 20 (was 12), 3-column 20%/60%/20% + collapsible right
  panel (§13.7 #2, #3). `showSelectedOnly` поле уже готово.
- Phase 5: left panel order Search → Favorites → Filters (§13.7 #1).
  `pinnedIds` поле уже готово (и `pinnedIds` prop уже проброшен в ModList +
  VirtualizedModList в iter 134 — Phase 5 wiring будет проще).
- Phase 4 и Phase 4.5 — независимы от Phase 1, можно делать в любой итерации.

**Подсказка:** для Phase 3 — read `AGENT_NAVIGATION.md` Pitfall 44 (Phase 2.5
wiring pattern as template). Phase 3 wires `showSelectedOnly` analogously.
Modify `CategoryControlPanel.tsx` (add toggle) + create `SelectedBasket.tsx`
+ restructure `CategoryLayout.tsx` right `<aside>` (basket → regex → status →
profile). Phase 1 `showSelectedOnly` поле уже готово к потреблению.

**UX verification request for user (iter 134 deliverable):**
Откройте 7 category pages (Belt, Ring, Amulet, Jewel, Waystone, Tablet, Relic)
на десктопе. Проверьте:
1. Раскройте sub-group chevron (например ДОБЫЧА в префиксах).
2. Если sub-group содержит > 3 chips — первые 3 видны + «+N ещё» кнопка.
3. Клик по «+N ещё» — показываются все chips + «свернуть» кнопка.
4. Selected/excluded/pinned chips остаются видимыми даже в truncated состоянии
   (даже если они за пределами первых 3).
5. State сохраняется в URL после refresh.
6. Sub-groups с ≤ 3 chips показываются полностью без кнопки.

Если замечен баг — сначала документируйте в STATUS.md как Known Issue, потом фиксий.

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**

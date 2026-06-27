# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 139
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (все 7 фаз ✅ DONE + iter 139 KI#16-20 fixes) + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 139: 5 UI bug fixes по feedback пользователя (KI#16-20).**

Пользователь сообщил о проблемах в UX category pages после iter 138:
горизонтальный скролл в правой панели, разные ширины колонок prefix/suffix,
лишние «+N ещё» кнопки, ломаный sticky search, перегруженная левая колонка.
Все 5 багов задокументированы как KI#16-20 → исправлены в iter 139.

### iter 139 deliverables

1. **KI#16 (FIXED): Right aside overflow protection.** `<aside>` в `CategoryLayout` получил CSS-класс `category-aside` (`min-width: 0; overflow-x: hidden`). RegexOutput header row теперь `flex-wrap: wrap` + кнопки `flex-shrink: 0` — кнопка «Копировать» больше не уходит за пределы 320px колонки.
2. **KI#17 (FIXED): Prefix/Suffix 50/50.** ModList grid изменён с `md:grid-cols-[2fr_3fr]` (40/60) на `md:grid-cols-2` (50/50). Колонки равной ширины — соответствует референс-макету.
3. **KI#18 (FIXED): «+N ещё» truncation reverted.** Phase 2.5 (iter 134) chip truncation logic удалена из `ModSubGroupSection` (ModList.tsx) + `VirtualRowContent` (VirtualizedModList.tsx). Все chips в expanded sub-group рендерятся безусловно. `chipExpandState` / `onToggleChipExpand` props остаются в API для backward compat (no-op). `CHIP_PREVIEW_COUNT` константа stays в `@shared/constants` (no breaking change).
4. **KI#19 (FIXED): Non-sticky search bar.** `.sticky-search-bar` CSS rule изменена: `position: sticky; top: 52px` → `position: relative`. Search теперь статичен вверху левой колонки (как в референсе), больше не перекрывается прокручивающимися chips. Bg + border-bottom сохранены как визуальный разделитель.
5. **KI#20 (FIXED): LeftPanelFavorites removed from left column.** Все 7 category pages (Belt/Ring/Amulet/Jewel/Waystone/Tablet/Relic) больше не передают `favorites={...}` prop в `CategoryLayout`. `LeftPanelFavorites` компонент остаётся в коде для backward compat. ★ кнопка на FilterChip остаётся (pinnedIds используются в show-selected-only режиме).

### iter 139 changes (files)

- `src/index.css` — `.sticky-search-bar` non-sticky (KI#19); NEW `.category-aside` + `.regex-output > .flex...` overflow rules (KI#16).
- `src/ui/layout/CategoryLayout.tsx` — `<aside>` получил `category-aside` класс (KI#16).
- `src/ui/components/ModList.tsx` — grid `md:grid-cols-2` (KI#17); `ModSubGroupSection` truncation removed (KI#18); `CHIP_PREVIEW_COUNT` import removed.
- `src/ui/components/VirtualizedModList.tsx` — `VirtualRowContent` truncation removed (KI#18); `CHIP_PREVIEW_COUNT` import removed.
- `src/ui/pages/{belt,jewel,tablet,waystone,amulet,ring,relic}/*.tsx` — `favorites={...}` prop + `LeftPanelFavorites` import removed (KI#20). `clearPinned` removed from useCategoryPage destructure (unused).
- `tests/ui/ModList.test.tsx` — Phase 2.5 describe block rewritten as «iter 139 (KI#18): chip truncation reverted» (4 tests вместо 6). NEW «iter 139 (KI#17): prefix/suffix equal column widths» (1 test).
- `tests/ui/CategoryLayout.test.tsx` — NEW file (3 tests: KI#16 aside class, KI#20 no favorites, KI#20 backward compat with favorites).

### Проверки (iter 139)

- **vitest:** 2165/2165 tests passed (50 test files). Was 2163 in iter 138 → **+2 net** (4 new KI#18 revert tests + 1 new KI#17 grid test + 3 new CategoryLayout tests − 2 removed Phase 2.5 truncation tests that no longer apply).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **Backward compat:** `chipExpandState` / `onToggleChipExpand` / `favorites` props remain in API (no-op when passed). `CHIP_PREVIEW_COUNT` / `SELECTED_BASKET_CAP` constants unchanged. `LeftPanelFavorites` component file kept.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как компенсация.
3. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
4. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай. Mitigation: расширить `distributeAlternation` при FP.
5. **Phase 2 UX change: sub-groups default COLLAPSED** (iter 133). In-game/in-browser verification pending (KI#15).
6. **Phase 3 UX change: show-selected-only filter** (iter 135). In-game/in-browser verification pending (KI#15). **iter 139 note:** user спросил «кнопка режим отображения аффиксов и сама функция для чего собственно?» — нужен tooltip/label explanation в iter 140.
7. **Phase 3 UX change: SelectedBasket panel + collapsible right aside** (iter 135). In-game/in-browser verification pending (KI#15).
8. **Phase 5 UX change: ⭐ pin/unpin icon on FilterChip** (iter 136). In-game/in-browser verification pending (KI#15).
9. **Phase 4 UX change: stronger bg tints on `.affix-header-*` + compact chip density 25%** (iter 137). In-game/in-browser verification pending (KI#15).
10. **Phase 4 UX change: ⓘ tooltip on affix column headers** (iter 137). In-game/in-browser verification pending (KI#15).
11. **Phase 4.5 UX change: «Обозначения» icon legend in right panel** (iter 137). In-game/in-browser verification pending (KI#15).
12. **Phase 4 iter 138 UX change: `--strong` modifier wiring на `.affix-header-*` в tier-first mode**. Bg alpha 0.14→0.22, border-left-color alpha 0.65→0.85 when sortMode='tier-first'. In-game/in-browser verification pending (KI#15).

### iter 139 UX changes pending in-browser verification (KI#15)

- **KI#16**: horizontal scrollbar + Copy button cut off → FIXED via `.category-aside` + `.regex-output` header row CSS.
- **KI#17**: prefix/suffix 40/60 mismatch → FIXED via `md:grid-cols-2`.
- **KI#18**: «+N ещё» buttons unwanted → FIXED (truncation reverted, all chips render).
- **KI#19**: sticky search bar overlap → FIXED (non-sticky now).
- **KI#20**: LeftPanelFavorites cluttering left column → FIXED (favorites prop removed from all 7 pages).

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

## Next iteration (iter 140)

**iter 139 завершён: 5 UI bug fixes (KI#16-20). UI Refactor Phase 1-5 + iter 138 `--strong` + iter 139 fixes — всё в коде. Pending: in-browser UX verification пользователем.**

Следующий агент: читать `docs/UI_REFACTOR_PLAN.md` §12 (Phase Status — все 7 фаз ✅ DONE) + §13.6 (Recommendation для iter 140 = UX verification feedback + remaining optional enhancements).

**Приоритеты для iter 140+:**

1. **In-game / in-browser UX verification feedback** пользователем Phase 2 + Phase 3
   + Phase 4 + Phase 4.5 + Phase 4 iter 138 `--strong` + iter 139 KI#16-20 fixes —
   перенос с iter 133+. Все UI UX changes теперь в одном batch. Если найден новый
   баг — сначала документировать в STATUS.md как Known Issue, потом фиксить.

2. **Show-selected-only toggle clarification** (iter 139 leftover). User спросил:
   «кнопка режим отображения аффиксов и сама функция для чего собственно?».
   Нужно добавить tooltip / более понятный label к radio toggle в
   `CategoryControlPanel.tsx` (currently `t('filter.show_mode_label')` =
   «Режим:» + «Все» / «Только выбранные: N»). Deferred to iter 140.

3. **KI#9** (MULTI_RANGE slot N>0) — monitoring, не фиксировано. Если найден
   новый in-game FP case — сначала документировать в STATUS.md как
   Known Issue (расширить KI#9), потом фиксить.

4. **Remaining optional enhancements** (если user запросит):
   - Persist `rightPanelCollapsed` to URL — currently local state. Add `rpc`
     boolean field to filter-store if user requests.
   - VendorPage Phase 5 wiring — VendorPage uses custom FilterChip. To wire
     favorites for vendor, need to add ⭐ pin slot to vendor FilterChip +
     render LeftPanelFavorites. Deferred until user requests.
   - Phase 5 scroll-to-mod on mobile / virtualized lists — currently degrades
     gracefully (no-op) when chip is virtualized out of DOM. Could be enhanced
     to scroll to sub-group header instead. Deferred.
   - Tooltip `--strong` styling variant — currently single style. Could add
     variant for tier-first mode if user requests.
   - IconLegend `items` prop — currently hardcoded 3 rows. Could be extended
     to include additional icons (e.g. ⚡ optimizer-collapsed, ⚓ prefix
     anchor, 2x dual-number) if user requests.

**Главные ограничения для iter 140:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue,
  потом фиксий.

**UX verification request for user (iter 139 deliverable):**

Откройте 7 category pages (Belt, Ring, Amulet, Jewel, Waystone, Tablet, Relic)
на десктопе. Проверьте iter 139 изменения:

**KI#16 — Right aside overflow fix:**
1. Выберите 5-10 аффиксов, дождитесь generation regex > 180 chars.
2. Правая панель (320px) НЕ должна показывать горизонтальный скроллбар.
3. Кнопка «Копировать» в RegexOutput всегда видна, не уходит за правый край.

**KI#17 — Prefix/Suffix 50/50:**
1. Откройте Belt page. Колонки Префикс и Суффикс должны быть ОДИНАКОВОЙ ширины.

**KI#18 — No «+N ещё» buttons:**
1. Раскройте любой sub-group (например «Награды Ритуала (6)»).
2. Все 6 chips должны быть видны сразу — без «+3 ещё» кнопки, без «свернуть».

**KI#19 — Non-sticky search:**
1. Прокрутите ModList вниз.
2. Search input + фильтры должны прокручиваться ВМЕСТЕ с контентом (не залипать
   вверху). Не должно быть перекрытия chips поверх search bar.

**KI#20 — No favorites panel in left column:**
1. Левая колонка должна содержать ТОЛЬКО: CategoryControlPanel + ModList.
2. Блока «⭐ Избранные: N» над Controls быть НЕ должно.

Дополнительно проверьте все предыдущие фазы (Phase 2+3+4+4.5+5 + iter 138 `--strong`)
— см. `docs/UI_REFACTOR_PLAN.md` §13.6 «UX verification request for user».

Если замечен баг — сначала документируйте в STATUS.md как Known Issue, потом фиксий.

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**

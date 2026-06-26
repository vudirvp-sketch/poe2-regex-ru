# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 137
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (план, Phase 1+2+2.5+3+4+4.5+5 DONE — все 7 фаз готовы) + `docs/UI_VISUALIZATION_AUDIT.md` (эталон iter 130 + iter 131 corrections)

---

## Текущее состояние

**iter 137: UI Refactor Phase 4 + Phase 4.5 готовы — ВСЕ 7 ФАЗ UI REFACTOR DONE.**

Phase 4 (colors + compact + tooltips) + Phase 4.5 («Обозначения» icon legend)
— visual-only изменения, никаких state changes, все new props optional.

**Phase 4 deliverables:**

1. **`src/index.css`** — stronger bg tints на `.affix-header-*`:
   border-left 3px → 4px, alphas 0.08/0.03 → 0.14/0.06. NEW `--strong`
   modifier (`.affix-header-prefix--strong` и т.д.) для tier-first mode
   (deeper bg + brighter border, applied via caller когда sortMode='tier-first').
   NEW `.filter-chip` CSS class token — min-height 22px desktop / 32px mobile
   (touch target a11y per Phase 4 risk register mitigation). Future density
   tweaks — CSS-only, не JSX edits.

2. **`src/ui/components/FilterChip.tsx`** — compact density 25%:
   container `px-2.5 py-1.5 text-[13px]` → `px-1.5 py-0.5 text-[12px]`,
   inline badges (⚡ ⚓ 2x ×N range) `text-[12px]` → `text-[10px]`.
   `.filter-chip` class добавлен к outer div (CSS hook). Mobile touch target
   floor 32px via CSS media query.

3. **NEW `src/ui/components/Tooltip.tsx`** (~280 строк) — portal-based tooltip
   via `createPortal(... document.body)`. Hover (350ms delay) + focus (no
   delay) triggers. Closes on click-outside (global mousedown listener) +
   Escape (local onKeyDown on trigger button — NOT global, из-за React 19
   + jsdom flushing issue, см. Pitfall 47). ARIA: `role="tooltip"` on portal
   content, `aria-describedby` on trigger pointing to tooltip id,
   `aria-expanded` reflecting open state. Viewport-edge clamping (left/right
   + top/bottom flip when near bottom 25%). Max width 280px (wraps long
   Russian sentences). Recomputes position on viewport resize.

4. **`src/ui/components/GroupHeader.tsx`** — NEW optional `infoTooltip?`
   prop (ReactNode). When provided → renders `ⓘ` glyph via `<Tooltip>` как
   SIBLING кнопки (NOT child — клик не должен toggle collapse).
   `stopPropagation` в Tooltip.handleClick prevents parent onClick.
   When omitted → no ⓘ (backward compat).

5. **`src/ui/components/ModList.tsx` + `src/ui/components/VirtualizedModList.tsx`**
   — wire `infoTooltip={t('tooltip.prefix_explanation')}` / `suffix_explanation`
   / `implicit_explanation` на top-level affix column headers (ПРЕФИКСЫ/СУФФИКСЫ/ИМПЛИСЕТ).
   Только когда top-level collapse wiring is present (legacy static text path
   не тронут).

**Phase 4.5 deliverables:**

6. **NEW `src/ui/components/IconLegend.tsx`** (~75 строк) — static 3-row legend:
   «★ — в избранное» / «✗ — исключить аффикс (не хочу)» / «ⓘ — наведите для
   подсказки». Pure presentational, optional `items` prop for testing.
   Semantic `<ul>/<li>`, icons `aria-hidden`, section `aria-labelledby`.

7. **`src/ui/layout/CategoryLayout.tsx`** — NEW optional `legend?` slot
   rendered at BOTTOM of right `<aside>` (below ProfilePanel). Also rendered
   in mobile section when `hasMobileBar`. When omitted → no legend (backward
   compat — pre-Phase-4.5 pages had no legend).

8. **7 page files** (Belt/Ring/Amulet/Jewel/Waystone/Tablet/Relic) — каждый:
   +1 import (`IconLegend`), +1 prop to `<CategoryLayout>` (`legend={<IconLegend />}`).
   VendorPage не тронут (custom FilterChip, no ModList, no CategoryLayout).

**i18n:** +7 keys (Phase 4 section: `tooltip.prefix_explanation`,
`tooltip.suffix_explanation`, `tooltip.implicit_explanation`,
`tooltip.info_aria`; Phase 4.5 section: `legend.title`, `legend.star`,
`legend.exclude`, `legend.info`).

**Tests:** +34 (16 Tooltip + 10 IconLegend + 4 GroupHeader infoTooltip + 4
FilterChip compact density). vitest 2124 → 2158. tsc 0, eslint 0.

### Проверки (iter 137)

- **vitest:** 2158/2158 tests passed (49 test files). Was 2124 in iter 136 →
  **+34 new tests** (16 Tooltip + 10 IconLegend + 4 GroupHeader infoTooltip +
  4 FilterChip compact density).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **Backward compat:** все new props optional (`infoTooltip` на GroupHeader;
  `legend` на CategoryLayout) — legacy callers без wiring рендерят как раньше
  (no ⓘ icon, no legend panel, no .filter-chip class effect beyond min-height).

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
9. **Phase 5 UX change: favorites in left panel** (iter 136). In-game/in-browser verification pending (KI#15).
10. **Phase 5 UX change: ⭐ pin/unpin icon on FilterChip** (iter 136). In-game/in-browser verification pending (KI#15).
11. **Phase 5 UX change: click-to-scroll from LeftPanelFavorites** (iter 136). In-game/in-browser verification pending (KI#15).
12. **Phase 4 UX change: stronger bg tints on `.affix-header-*` + compact chip density 25%** (iter 137). Bumped alphas 0.08/0.03 → 0.14/0.06, border-left 3px → 4px, chip `px-1.5 py-0.5 text-[12px]`, badges `text-[10px]`. Mobile touch target floor 32px via CSS. In-game/in-browser verification pending (KI#15).
13. **Phase 4 UX change: ⓘ tooltip on affix column headers** (iter 137). Hover/focus → tooltip with explanation of prefix/suffix/implicit. Tooltip closes on Escape + click-outside. In-game/in-browser verification pending (KI#15).
14. **Phase 4.5 UX change: «Обозначения» icon legend in right panel** (iter 137). Static 3-row legend below ProfilePanel: ★ favorite / ✗ exclude / ⓘ info. In-game/in-browser verification pending (KI#15).

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

## Next iteration (iter 138)

**UI Refactor полностью завершён: Phase 1+2+2.5+3+4+4.5+5 ✅ DONE.**

Следующий агент: читать `docs/UI_REFACTOR_PLAN.md` §12 (Phase Status — все 7
фаз ✅ DONE) + §13 (iter 130 visualization audit) AND §13.7 (iter 131 user
feedback corrections). Документация актуальна.

**Приоритеты для iter 138+:**

1. **In-game / in-browser UX verification** пользователем Phase 2 + Phase 2.5
   + Phase 3 + Phase 5 + Phase 4 + Phase 4.5 — перенос с iter 133+. Все UI
   UX changes теперь в одном batch.

2. **KI#9** (MULTI_RANGE slot N>0) — monitoring, не фиксировано. Если найден
   новый in-game FP case — сначала документировать в STATUS.md как
   Known Issue (расширить KI#9), потом фиксить.

3. **Optional enhancements** (если user запросит):
   - `--strong` modifier на `.affix-header-*` в tier-first mode (CSS ready,
     wiring deferred — applied via caller когда sortMode='tier-first').
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

**Главные ограничения для iter 138:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue,
  потом фиксий.

**UX verification request for user (iter 137 deliverable):**

Откройте 7 category pages (Belt, Ring, Amulet, Jewel, Waystone, Tablet, Relic)
на десктопе. Проверьте:

**Phase 4 — colors + compact + tooltips:**
1. `.affix-header-prefix` / `-suffix` / `-implicit` рамки стали более
   контрастными (border-left 4px, bg tint глубже — alpha 0.14/0.06).
2. Chips в ModList стали плотнее (text-[12px] вместо 13px, padding px-1.5
   py-0.5 вместо px-2.5 py-1.5). Inline badges (⚡ ⚓ 2x ×N range) — text-[10px]
   вместо 12px.
3. На мобильных chips сохраняют min-height 32px (touch target a11y).
4. Наведите курсор (или сфокусируйте Tab) на ⓘ glyph рядом с заголовком
   «ПРЕФИКСЫ» / «СУФФИКСЫ» / «ИМПЛИСЕТ» — появляется tooltip с пояснением
   этого типа аффикса (1 предложение на русском).
5. Tooltip закрывается по Escape или клику вне него.
6. Клик на ⓘ НЕ сворачивает/развёртывает группу (sibling button, не child).

**Phase 4.5 — «Обозначения» legend:**
7. В правой колонке (под ProfilePanel) появился блок «Обозначения» с 3 строками:
   - ★ — в избранное
   - ✗ — исключить аффикс (не хочу)
   - ⓘ — наведите для подсказки
8. На мобильных (when mobileBar present) legend также виден в мобильной секции.
9. Когда правая панель свернута (chevron toggle from Phase 3) — legend скрыт
   вместе с остальным контентом aside.

Если замечен баг — сначала документируйте в STATUS.md как Known Issue, потом фиксий.

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**

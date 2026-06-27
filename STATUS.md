# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 140
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (все 7 фаз ✅ DONE + iter 138-140 fixes) + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 140: 4 UI bug fixes по feedback пользователя (KI#21, KI#22, KI#24, KI#25) + KI#23 documented as monitoring.**

Пользователь после iter 139 сообщил о 4 новых UX-проблемах: дублирующиеся иконки в
легенде, старый «Выбрано» блок дублирует SelectedBasket, пропал блок «Избранное»,
jitter при скролле в виртуализированных списках, непонятный show-selected-only
toggle. Все 5 задокументированы как KI#21-25 ДО фикса — per project rule.

### iter 140 deliverables

1. **KI#21 (FIXED): Duplicate icons in IconLegend.** i18n строки `legend.star` /
   `legend.exclude` / `legend.info` содержали prefix-icon (`'★ — в избранное'`),
   а компонент рендерил иконку отдельным `<span>`. Результат: `★ ★ — в избранное`.
   Fix: убрать icon prefix из i18n, оставив только текст.
2. **KI#22 (FIXED): Redundant "Выбрано" block removed.** StatusPanel ранее рендерил
   main summary panel («Выбрано: N аффикс(ов)» + truncated token list) — дублировал
   SelectedBasket. Fix: StatusPanel теперь рендерит ТОЛЬКО `badges` + `alerts`.
   Props `wantTokens`/`excludeTokens`/`allActiveTokens` остаются в interface для
   backward compat (ignored when passed).
3. **KI#23 (MONITORING — not fixed): Scroll jitter в virtualized lists.** На
   belt/ring/amulet/jewel страницах при скролле видны «дрожащие»/«прыгающие»
   названия категорий и chips. Root cause: TanStack Virtual's `measureElement` +
   `ResizeObserver` — estimate sizes (60px) отличаются от actual (40–120px) →
   totalSize shifts → visible rows jump. Решение требует тщательного тюнинга.
   Отложено на iter 141+.
4. **KI#24 (FIXED): Favorites block restored as compact indicator.** iter 139 KI#20
   полностью убрал LeftPanelFavorites из левой колонки. Decision iter 140: вернуть
   favorites как COMPACT indicator в page header — `★ N` badge рядом с mod count.
   NEW `FavoritesIndicator` component.
5. **KI#25 (FIXED): Show-selected-only toggle clarification.** Добавлен tooltip
   (`title` + `aria-label`) к radio toggle в CategoryControlPanel с пояснением.
   NEW i18n key `filter.show_mode_hint`.

### iter 140 changes (files)

- `src/shared/i18n.ts` — `legend.*` cleanup (no icon prefix); NEW
  `filter.show_mode_hint`; NEW `favorites.indicator_label` + `favorites.indicator_empty`.
- `src/ui/components/StatusPanel.tsx` — removed main summary panel; renders badges + alerts only.
- `src/ui/components/CategoryControlPanel.tsx` — `title` + `aria-label` on show-selected-only radio.
- `src/ui/components/FavoritesIndicator.tsx` — NEW file. Compact `★ N` badge.
- `src/ui/pages/{belt,jewel,tablet,waystone,amulet,ring,relic}/*.tsx` — header
  extended with `<FavoritesIndicator pinnedIds={pinnedIds} />` next to mod count.
- `tests/ui/IconLegend.test.tsx` — updated text assertions (no icon prefix).
- `tests/ui/StatusPanel.test.tsx` — updated to verify badges-only behavior.
- `tests/ui/FavoritesIndicator.test.tsx` — NEW file (5 tests).

### Проверки (iter 140)

- **vitest:** 2177/2177 tests passed (52 test files). Was 2165 in iter 139 → **+12 net**
  (5 new FavoritesIndicator + 6 new StatusPanel badges/alerts + 1 new IconLegend
  no-duplication test).
- **tsc:** 0 errors.
- **eslint:** 0 problems 0 warnings.
- **Backward compat:** StatusPanel props `wantTokens`/`excludeTokens`/`allActiveTokens`
  remain in interface (ignored when passed, destructured as `_wantTokens` etc).
  SelectedBasket unchanged. `LeftPanelFavorites` component file stays for backward
  compat. `favorites` slot in CategoryLayout stays (optional, no-op when passed).

### iter 139 reference (brief)

iter 139: 5 UI bug fixes (KI#16-20) — right aside overflow (`.category-aside` CSS),
prefix/suffix 50/50 (`md:grid-cols-2`), «+N ещё» truncation reverted, non-sticky
search bar, LeftPanelFavorites removed from left column. All verified in iter 140.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
3. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
4. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай.
5. **Phase 2 UX change: sub-groups default COLLAPSED** (iter 133). In-game verification pending (KI#15).
6. **Phase 3 UX change: show-selected-only filter** (iter 135) + **iter 140 (KI#25) tooltip clarification**. In-game verification pending (KI#15).
7. **Phase 3 UX change: SelectedBasket panel + collapsible right aside** (iter 135). In-game verification pending (KI#15).
8. **Phase 5 UX change: ⭐ pin/unpin icon on FilterChip** (iter 136) + **iter 140 (KI#24) FavoritesIndicator в header**. In-game verification pending (KI#15).
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
    collapsed); (c) CSS Grid virtualization вместо TanStack. Не фиксировано в
    iter 140 — требует отдельной итерации с careful testing.

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

## Next iteration (iter 141)

**iter 140 завершён: 4 UI bug fixes (KI#21, 22, 24, 25) + KI#23 documented. Pending: in-browser UX verification пользователем iter 140 changes.**

Следующий агент: читать `docs/UI_REFACTOR_PLAN.md` §12 (Phase Status) + §13.6 (Recommendation для iter 141 = UX verification + KI#23 virtualization fix + remaining optional enhancements).

**Приоритеты для iter 141+:**

1. **In-browser UX verification feedback** пользователем iter 140 changes:
   - **KI#21**: legend shows each icon ONCE (not twice).
   - **KI#22**: only ONE «Выбрано» block (the SelectedBasket at top of right aside);
     StatusPanel no longer renders the old summary panel below RegexOutput.
   - **KI#24**: page header shows `★ N` favorites counter next to mod count.
   - **KI#25**: hovering show-selected-only toggle shows tooltip explaining the function.
   Если найден новый баг — сначала документировать в STATUS.md как Known Issue, потом фиксить.

2. **KI#23 (scroll jitter)** — fix candidate. Изучить virtualization measurement.
   Возможно: static heights, improved estimateSize, OR shift to CSS Grid virtualization.

3. **KI#9** (MULTI_RANGE slot N>0) — monitoring, не фиксировано.

4. **Remaining optional enhancements** (если user запросит):
   - Persist `rightPanelCollapsed` to URL.
   - VendorPage Phase 5 wiring (⭐ pin slot).
   - Phase 5 scroll-to-mod on mobile / virtualized lists.
   - Tooltip `--strong` styling variant.
   - IconLegend `items` prop extension.

**Главные ограничения для iter 141:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue,
  потом фиксий.

---

Контакты: Discord **woonderdad**

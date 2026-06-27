# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 144 (5 KI реализованы — KI#23/30/31/32/33)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (все 7 фаз ✅ DONE + iter 138-144 fixes) + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 144: реализованы ВСЕ 5 KI из плана iter 143.**

| KI | Описание | Файлы | Тесты |
|----|----------|-------|-------|
| KI#32 | Cascade expand fix — origin в sub-group key | `VirtualizedModList.tsx`, `ModList.tsx` | +5 (cascade isolation) |
| KI#30 | Per-category localStorage favorites + multi-tab sync | `local-settings.ts`, `useCategoryPage.ts` | +32 (round-trip, sanitization, ranges) |
| KI#31 variant (d) | Quick-select panel с диапазонами | `FavoritesQuickSelectPanel.tsx` (NEW), `FavoritesIndicator.tsx`, 7 pages | +8 (panel open/close, select, remove) |
| KI#33 | VendorPage favorites — ⭐ pin slot + FavoritesIndicator | `VendorPage.tsx` | covered by KI#31 tests |
| KI#23 variant (b) | Improved estimateSize per-row-state | `VirtualizedModList.tsx` | +12 (estimate heuristics) |

**Baseline: tsc 0 / eslint 0 / vitest 2247/2247 (было 2190 baseline + 57 new tests).**

### Архитектурные изменения iter 144

1. **Sub-group key format:** `${cat}:${affix}:${origin}:${sg.key}` (раньше без origin — KI#32). Старые URL `es=...` silently reset (per Q3).

2. **localStorage keys (KI#30 + KI#31):**
   - `poe2:favorites:<cat>` → `string[]` (favorited token IDs, first member per family).
   - `poe2:favorites:<cat>:ranges` → `Record<tokenId, {min?, max?}>` (per-favorite range overrides).
   - Multi-tab sync через `storage` event listener в `useCategoryPage`.

3. **FavoritesIndicator (KI#31):** теперь clickable button → открывает `FavoritesQuickSelectPanel` через `createPortal`. Когда panel props не переданы — backward-compatible presentational mode.

4. **FavoritesQuickSelectPanel (NEW, KI#31):** portal-based dropdown с:
   - Affix badge + displayText для каждой favorited family.
   - «Выбрать» button → `onToggleTokens(allMemberIds)`.
   - Range inputs (min/max) для семей с `rangeSlots.length > 0` — pre-filled из `perTokenRanges` или saved favorites ranges.
   - «Убрать» (✗) button → `onTogglePinned(firstMemberId)`.
   - Escape / click-outside → close.

5. **VendorPage (KI#33):** теперь использует общий `FilterChip` с ⭐ pin slot (раньше был custom chip без pin). FavoritesIndicator рендерится в header. KI#30 localStorage + KI#31 quick-select panel работают.

6. **estimateSubgroupHeight (KI#23 variant b):** per-row-state estimate для virtualizer. Возвращает 60/80/110 вместо статичного 60 — уменьшает jitter при scroll.

---

## Known Issues

### Активные (требуют browser testing / user feedback)

1. **KI#23 (iter 144 — variant b IMPLEMENTED, NEEDS BROWSER TESTING):** Scroll jitter в virtualized lists.
   Variant (b) реализован — improved `estimateSize` per-row-state. Vitest покрывает эвристику (12 tests), но **browser testing обязателен** — записать video scroll before/after на 4 страницах (belt/ring/amulet/jewel). Если jitter всё ещё заметный — рассмотреть variant (a) static row heights как fallback.

2. **KI#31 variant (d) (iter 144 — IMPLEMENTED, NEEDS UX FEEDBACK):** Quick-select panel.
   Реализован минимальный MVP: список favorited семей + «Выбрать» + range inputs + «Убрать». **User feedback нужен** по:
   - Расположение panel (right-anchored ниже trigger).
   - Range inputs UX (pre-fill из saved ranges работает?).
   - Accessibility (focus trap, Escape, click-outside).
   - Mobile layout (panel может быть слишком wide на mobile — 360px max).

3. **KI#32 (iter 144 — IMPLEMENTED, NEEDS BROWSER TESTING):** Cascade expand fix.
   Sub-group key теперь включает origin. Vitest покрывает изоляцию (5 tests). **Browser testing на 7 страницах** — раскрыть sub-group в normal → проверить что в corrupted/desecrated НЕ раскрылось. Особое внимание jewel page (showJewelTypeSubGroups — ключ теперь `${cat}:${affix}:${origin}:${jewelType}:${sg.key}`).

4. **In-browser UX verification iter 141 changes (KI#26/27/28/29).** 4 фикса iter 141 формально прошли, но user не предоставил UX feedback. Если найден новый баг — сначала в STATUS.md как KI, потом фиксий.

### Фоновые (low-priority / редкие)

5. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
6. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
7. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
8. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай.

### Закрытые KI (краткая справка)

- **KI#7-8** (iter 121-122 → VERIFIED iter 129): HomePage hero decorations + SeoBlock.
- **KI#10** (iter 126 → VERIFIED iter 127): ambiguous suffix FP для `Редкость предметов`.
- **KI#11** (iter 127 → DISPROVEN): cross-block `.*` hypothesis.
- **KI#12** (iter 127 → FIXED): tier-hardcoded regex для 7 single-`#` relic tokens.
- **KI#13** (iter 128 → FIXED): пропущен implicit `Редкость монстров` + BTS-статы.
- **KI#16-20** (iter 139 → VERIFIED iter 140): aside overflow, prefix/suffix 50/50, chip truncation reverted, non-sticky search, LeftPanelFavorites removed.
- **KI#21-22, 24-25** (iter 140 → FIXED): duplicate icons, redundant «Выбрано» block, favorites restored as compact indicator, show-selected-only tooltip.
- **KI#26-29** (iter 141 → FIXED, pending browser verification): round10 default off + cross-tab persistence, VirtualizedModList 50/50, favorites counter 1-per-family, aside header compact.
- **KI#23/30/31/32/33** (iter 144 → IMPLEMENTED, pending browser verification): scroll jitter estimate, per-category localStorage favorites, quick-select panel, cascade expand fix, VendorPage favorites.

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

## Next iteration (iter 144 → iter 145)

**iter 144 завершён: 5 KI реализованы, tsc 0 / eslint 0 / vitest 2247/2247.**

**Приоритеты для iter 145 (по результатам browser testing user'ом):**

1. **Browser testing iter 144 changes (BLOCKING).** User должен протестировать все 5 KI в browser:
   - KI#32: раскрыть sub-group в normal → проверить что в corrupted/desecrated НЕ раскрылось (7 страниц).
   - KI#30: pin на belt → navigate to ring → return to belt → favorites на месте. Multi-tab sync (опционально).
   - KI#31: click ★ N badge → panel открывается → «Выбрать» работает → range inputs persist → ✗ remove работает.
   - KI#33: pin на vendor page → favorites видны в header → quick-select panel работает.
   - KI#23: scroll на amulet/ring (large lists) — jitter уменьшился? Если нет — variant (a).

2. **Если найдены баги** — сначала документировать в STATUS.md как NEW KI, потом фиксить.

3. **Возможные follow-up задачи (если user запросит):**
   - KI#31 mobile layout optimization (panel может быть слишком wide).
   - KI#31 bulk actions («Выбрать все favorites», «Очистить все selections»).
   - KI#23 variant (a) fallback если (b) недостаточен.
   - KI#9 (MULTI_RANGE slot N>0) — monitoring, не фиксировано.
   - Persist `rightPanelCollapsed` to URL.
   - Phase 5 scroll-to-mod on mobile / virtualized lists.
   - Tooltip `--strong` styling variant.
   - IconLegend `items` prop extension.

**Главные ограничения для iter 145:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.
- KI#23 (b) требует careful browser testing — vitest недостаточен. Лучше недоделать, чем сломать virtualization.

---

Контакты: Discord **woonderdad**

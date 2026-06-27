# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 138
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (все 7 фаз ✅ DONE) + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 138: `--strong` modifier wiring на `.affix-header-*` в tier-first mode — optional enhancement завершён.**

Все 7 фаз UI Refactor готовы с iter 137 (Phase 1+2+2.5+3+4+4.5+5). iter 138 добавил
wiring `--strong` CSS modifier (rules были готовы с iter 137, но не были подключены
к caller). Теперь при `sortMode='tier-first'` top-level affix column headers
(ПРЕФИКСЫ/СУФФИКСЫ/ИМПЛИСЕТ) получают дополнительный CSS-класс
`affix-header-{prefix,suffix,implicit}--strong` — deeper bg (alpha 0.22/0.10)
+ brighter border-left (alpha 0.85), визуально подчёркивая выбранный sort mode.

Wiring: `src/ui/components/ModList.tsx` (`AffixColumn`) + `src/ui/components/VirtualizedModList.tsx` (`VirtualRowContent`).
При `sortMode='alpha'` (default) или omitted — modifier НЕ добавляется (backward compat).

### iter 138 deliverables

1. **`src/ui/components/ModList.tsx`** — `affixHeaderClass` extended:
   ```ts
   const affixBase = isImplicit ? 'affix-header-implicit' : isPrefix ? 'affix-header-prefix' : 'affix-header-suffix';
   const affixHeaderClass = sortMode === 'tier-first' ? `${affixBase} ${affixBase}--strong` : affixBase;
   ```
2. **`src/ui/components/VirtualizedModList.tsx`** — `headerClass` restructured to compose `${affixBase}--strong` when `sortMode === 'tier-first'`, with `.replace(/\s+/g, ' ').trim()` to normalize whitespace when `strongClass` is empty.
3. **5 new tests** (3 ModList + 2 VirtualizedModList): alpha mode → no `--strong` (backward compat); tier-first mode → `--strong` applied to prefix + suffix headers; omitted sortMode → no `--strong` (default backward compat); VirtualizedModList mounts without crash in both modes (smoke tests — TanStack Virtual renders 0 rows in jsdom).

### Проверки (iter 138)

- **vitest:** 2163/2163 tests passed (49 test files). Was 2158 in iter 137 → **+5 new tests** (3 ModList Phase 4 strong modifier wiring + 2 VirtualizedModList Phase 4 strong modifier wiring).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **Backward compat:** sortMode prop опциональный; при отсутствии → 'alpha' → нет `--strong` modifier class. Legacy callers рендерят идентично pre-iter-138.

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
12. **Phase 4 UX change: stronger bg tints on `.affix-header-*` + compact chip density 25%** (iter 137). In-game/in-browser verification pending (KI#15).
13. **Phase 4 UX change: ⓘ tooltip on affix column headers** (iter 137). In-game/in-browser verification pending (KI#15).
14. **Phase 4.5 UX change: «Обозначения» icon legend in right panel** (iter 137). In-game/in-browser verification pending (KI#15).
15. **Phase 4 iter 138 UX change: `--strong` modifier wiring на `.affix-header-*` в tier-first mode**. Bg alpha 0.14→0.22, border-left-color alpha 0.65→0.85 when sortMode='tier-first'. In-game/in-browser verification pending (KI#15).

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

## Next iteration (iter 139)

**UI Refactor полностью завершён: Phase 1+2+2.5+3+4+4.5+5 ✅ DONE. iter 138 added `--strong` modifier wiring (optional enhancement).**

Следующий агент: читать `docs/UI_REFACTOR_PLAN.md` §12 (Phase Status — все 7 фаз ✅ DONE) + §13.6 (Recommendation для iter 139 = UX verification feedback + remaining optional enhancements).

**Приоритеты для iter 139+:**

1. **In-game / in-browser UX verification feedback** пользователем Phase 2 + Phase 2.5
   + Phase 3 + Phase 5 + Phase 4 + Phase 4.5 + Phase 4 iter 138 `--strong` — перенос
   с iter 133+. Все UI UX changes теперь в одном batch. Если найден новый баг —
   сначала документировать в STATUS.md как Known Issue, потом фиксить.

2. **KI#9** (MULTI_RANGE slot N>0) — monitoring, не фиксировано. Если найден
   новый in-game FP case — сначала документировать в STATUS.md как
   Known Issue (расширить KI#9), потом фиксить.

3. **Remaining optional enhancements** (если user запросит):
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

**Главные ограничения для iter 139:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue,
  потом фиксий.

**UX verification request for user (iter 138 deliverable):**

Откройте 7 category pages (Belt, Ring, Amulet, Jewel, Waystone, Tablet, Relic)
на десктопе. Проверьте iter 138 изменение:

**Phase 4 iter 138 — `--strong` modifier wiring:**
1. Переключите sortMode на «По приоритету» (radio toggle в CategoryControlPanel).
2. Заголовки ПРЕФИКСЫ / СУФФИКСЫ / ИМПЛИСЕТ должны стать более насыщенными:
   bg alpha 0.14 → 0.22 (deeper tint), border-left-color alpha 0.65 → 0.85
   (brighter). Визуально: рамки «горят» сильнее, подчёркивая tier-first mode.
3. Переключите sortMode обратно на «По алфавиту» — рамки возвращаются к
   обычному состоянию (alpha 0.14/0.06, border-left 0.65).

Дополнительно проверьте все предыдущие фазы (Phase 2+2.5+3+4+4.5+5) — см.
`docs/UI_REFACTOR_PLAN.md` §13.6 «UX verification request for user» для
9-point checklist.

Если замечен баг — сначала документируйте в STATUS.md как Known Issue, потом фиксий.

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**

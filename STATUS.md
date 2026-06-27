# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 142
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (все 7 фаз ✅ DONE + iter 138-141 fixes + iter 142 doc cleanup + proposals) + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 142: documentation cleanup + design proposals для KI#23/30/31. Никаких кодовых изменений.**

iter 141 завершил 4 UI bug fixes (KI#26/27/28/29) + 2 KI documented as monitoring
(KI#30/31). Все 4 фикса требуют in-browser UX verification пользователем — это
главное blocker для закрытия KI#26-29. Остальные 3 KI (KI#23 scroll jitter,
KI#30 cross-tab favorites persistence, KI#31 favorites как quick-select) требуют
либо careful browser testing (KI#23), либо UX design решения от user (KI#30/31).

iter 142 выполнен как **documentation-only итерация** — без кодовых изменений,
чтобы не нарушить правило «лучше недоделать, чем сломать»:

1. **STATUS.md / AGENT_NAVIGATION.md / worklog.md / docs/UI_REFACTOR_PLAN.md**
   сжаты — убрана длинная история итераций, оставлены только ключевые Known
   Issues и активные контексты. Файлы стали легче для модели/агента.
2. **NEW `docs/ITER142_PROPOSALS.md`** — design proposals для KI#23/30/31 с 3
   вариантами каждый, pros/cons, recommendation, тест-планом. Документ
   подготовлен для review пользователем — после выбора варианта можно
   реализовывать в iter 143.
3. **Никаких изменений в `src/`** — baseline проверен: tsc 0, eslint 0, vitest
   2190/2190 (без изменений относительно iter 141).

### iter 142 deliverables

1. Documentation cleanup (4 файла).
2. NEW `docs/ITER142_PROPOSALS.md` — design proposals для KI#23/30/31.
3. Baseline проверки подтверждены: tsc 0 / eslint 0 / vitest 2190/2190.

### iter 141 reference (brief)

iter 141: 4 UI bug fixes (KI#26-29) + 2 KI monitoring (KI#30/31). round10 default
off + global settings localStorage persistence; VirtualizedModList 50/50 parity
with ModList (iter 139 KI#17 missed in VirtualizedModList); favorites counter
1-per-family (was N-per-tier); aside collapse header compact. NEW
`src/store/local-settings.ts` infrastructure. vitest 2177→2190 (+13).

---

## Known Issues

### Активные (требуют действий)

1. **KI#23 (iter 140 — MONITORING): Scroll jitter / «doubling» в virtualized lists.**
   На belt/ring/amulet/jewel страницах при скролле видны «дрожащие»/«прыгающие»
   названия категорий и affix chips. Root cause: TanStack Virtual's dynamic
   `measureElement` + `ResizeObserver` — estimate sizes (60px для subgroup)
   отличаются от actual sizes (40–120px), при scroll ResizeObserver fires →
   totalSize changes → paddingTop/paddingBottom shifted → visible rows jump.
   Файлы: `src/ui/components/VirtualizedModList.tsx` (VirtualizedColumn, ROW_ESTIMATES).
   Возможные решения: (a) static row heights; (b) improved estimateSize
   per-row-state; (c) CSS Grid virtualization. **Не фиксировано** — требует
   careful browser testing, риск сломать virtualization. Design proposal — в
   `docs/ITER142_PROPOSALS.md` §1.

2. **KI#30 (iter 141 — MONITORING): Cross-tab persistence favorites (pinnedIds).**
   `pinnedIds` хранятся в per-category Zustand store, который уничтожается при
   unmount. URL hash shared между вкладками и перезаписывается при переходе.
   Сессия: при reload вкладки favorites теряются (если URL не был сохранён).
   Решения: (a) per-category localStorage keys (`poe2:favorites:belt`, ...);
   (b) global Zustand store с category-keyed map (вне React tree); (c) IndexedDB.
   iter 141 уже добавил `src/store/local-settings.ts` infrastructure для global
   settings — расширение до per-category favorites требует design decision
   (format, expiry, migration). **Не фиксировано** — требует user decision.
   Design proposal — в `docs/ITER142_PROPOSALS.md` §2.

3. **KI#31 (iter 141 — MONITORING): Favorites как quick-select feature.**
   Пользователь ожидает: клик на ★ в избранном → аффикс выбирается (added to
   selectedIds) ИЛИ scroll-to-mod срабатывает. Текущая реализация: ★ только
   визуальный маркер + фильтр show-selected-only. Feature gap, не bug.
   Решения: (a) click на ★ в FavoritesIndicator → диалог/панель со списком
   favorited семей + быстрый select; (b) click на ★ в FilterChip → toggle AND
   scroll-to-mod (если не в viewport); (c) отдельный «Favorites» tab/drawer.
   **Не фиксировано** — требует UX design + user feedback. Design proposal —
   в `docs/ITER142_PROPOSALS.md` §3.

4. **In-browser UX verification iter 141 changes (KI#26/27/28/29).** 4 фикса
   iter 141 (round10 default off + cross-tab persistence, VirtualizedModList
   50/50, favorites counter 1-per-family, aside header compact) требуют
   проверки пользователем в браузере. Шаги — в `docs/UI_REFACTOR_PLAN.md`
   §13.6 «UX verification request for user». Если найден новый баг — сначала
   документировать в STATUS.md как Known Issue, потом фиксить.

### Фоновые (low-priority / редкие)

5. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
6. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
7. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
8. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай.

### Закрытые KI (краткая справка)

- **KI#7-8** (iter 121-122 → VERIFIED iter 129): HomePage hero decorations + SeoBlock.
- **KI#10** (iter 126 → VERIFIED iter 127): ambiguous suffix FP для `Редкость предметов`.
- **KI#11** (iter 126 → DISPROVEN iter 127): cross-block `.*` hypothesis.
- **KI#12** (iter 127 → FIXED): tier-hardcoded regex для 7 single-`#` relic tokens.
- **KI#13** (iter 128 → FIXED): пропущен implicit `Редкость монстров` + BTS-статы.
- **KI#16-20** (iter 139 → VERIFIED iter 140): aside overflow, prefix/suffix 50/50, chip truncation reverted, non-sticky search, LeftPanelFavorites removed.
- **KI#21-22, 24-25** (iter 140 → FIXED): duplicate icons, redundant «Выбрано» block, favorites restored as compact indicator, show-selected-only tooltip.
- **KI#23** (iter 140 → MONITORING): scroll jitter — см. Known Issue #1 выше.
- **KI#26-29** (iter 141 → FIXED, pending browser verification): round10 default off + cross-tab persistence, VirtualizedModList 50/50, favorites counter 1-per-family, aside header compact.
- **KI#30-31** (iter 141 → MONITORING): cross-tab favorites persistence, favorites как quick-select — см. Known Issues #2-3 выше.

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

## Next iteration (iter 143)

**iter 142 завершён: documentation cleanup + design proposals. Никаких кодовых изменений.**

Следующий агент: читать `docs/ITER142_PROPOSALS.md` (design proposals для
KI#23/30/31) + `docs/UI_REFACTOR_PLAN.md` §13.6 (UX verification request для
iter 141 changes).

**Приоритеты для iter 143+:**

1. **In-browser UX verification feedback** пользователем iter 141 changes
   (KI#26/27/28/29). Шаги — в `docs/UI_REFACTOR_PLAN.md` §13.6. Если найден
   новый баг — сначала документировать в STATUS.md как Known Issue, потом фиксить.

2. **KI#23 (scroll jitter)** — обсудить с user вариант из
   `docs/ITER142_PROPOSALS.md` §1. Рекомендованный: (b) improved estimateSize
   per-row-state (минимальный риск, без изменения virtualization machinery).
   После выбора варианта — careful browser testing обязателен.

3. **KI#30 (cross-tab favorites persistence)** — обсудить с user вариант из
   `docs/ITER142_PROPOSALS.md` §2. Рекомендованный: (a) per-category localStorage
   keys (простая миграция, переиспользует iter 141 infrastructure).
   После выбора варианта — careful testing URL sync interaction.

4. **KI#31 (favorites как quick-select)** — обсудить с user UX вариант из
   `docs/ITER142_PROPOSALS.md` §3. Рекомендованный: (b) click на ★ в FilterChip
   → toggle AND scroll-to-mod (минимальные UI изменения, переиспользует Phase 5
   scroll-to-mod pattern). После выбора варианта — UX design + implementation.

5. **KI#9** (MULTI_RANGE slot N>0) — monitoring, не фиксировано.

6. **Remaining optional enhancements** (если user запросит):
   - Persist `rightPanelCollapsed` to URL.
   - VendorPage Phase 5 wiring (⭐ pin slot).
   - Phase 5 scroll-to-mod on mobile / virtualized lists.
   - Tooltip `--strong` styling variant.
   - IconLegend `items` prop extension.

**Главные ограничения для iter 143:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue,
  потом фиксий.
- KI#23 fix требует careful browser testing — лучше недоделать, чем сломать
  virtualization. Прогон vitest недостаточен для проверки virtualization.
- KI#30/31 требуют UX design решения — сначала обсудить с user (через
  `docs/ITER142_PROPOSALS.md`), потом реализовывать.

---

Контакты: Discord **woonderdad**

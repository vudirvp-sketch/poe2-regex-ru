# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 143 (user feedback received — готовимся к iter 144 реализации)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (все 7 фаз ✅ DONE + iter 138-141 fixes + iter 142 doc cleanup + proposals) + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 143: user feedback получен по 6 вопросам + 2 новых бага задокументированы (KI#32, KI#33). Никаких кодовых изменений.**

iter 143 получил от user:
- ✅ Ответы на 6 вопросов из `docs/ITER142_PROPOSALS.md` §5 (KI#23/30/31 variant selection).
- 🐛 **NEW KI#32** — cascade expand одинаковых названий sub-групп (раскрытие «Уровень умений» в «обычных» раскрывает все «Уровень умений» в очерненных/оскверненных/разлома).
- 🐛 **NEW KI#33** — favorites не реализованы на VendorPage (известно — VendorPage uses custom FilterChip, нет ⭐ pin slot).

Все 5 KI (KI#23, KI#30, KI#31, KI#32, KI#33) теперь готовы к реализации в iter 144. **Baseline: tsc 0 / eslint 0 / vitest 2190/2190 (без изменений).**

### User decisions по 6 вопросам (для iter 144)

| # | Вопрос | User answer | Решение |
|---|--------|-------------|---------|
| Q1 | KI#23 partial fix OK? | ✅ Да, вариант (b) — improved estimateSize per-row-state | `VirtualizedModList.tsx` ~20 строк |
| Q2 | Если (b) не хватит — fallback на (a)? | ✅ Сразу нормально сделать | Реализуем (b) с тест-планом; если browser testing покажет что не хватает — добавим (a) |
| Q3 | Silent reset старого избранного OK? | ✅ Пофигу | Тихий reset, без миграции |
| Q4 | Realtime multi-tab sync нужна? | ✅ Только если стабильно и не усложняет код | Пробуем через `storage` event (~20 строк); если нестабильно — выкинем |
| Q5 | Формат хранения? | ✅ Простой массив ID | `string[]` JSON-serialized |
| Q6 | ⭐ button 2 функции (toggle + scroll) OK? | ❌ Toggle только, но не scroll-to-mod! | **NEW KI#31 variant (d)** — quick-select с возможностью ввода значений диапазона (см. ниже) |

### NEW KI#31 variant (d) — Quick-select с диапазонами (пересмотренный)

User видит favorites как **список быстрого доступа** для часто используемых наборов аффиксов. Клик на ★ в избранном → выбор аффикса (added to selectedIds) + возможность **ввести значения диапазона** прямо из quick-select (если у аффикса есть диапазон). Если в избранном уже были значения диапазона — они **сохраняются по умолчанию**.

Подробный design — в `docs/ITER142_PROPOSALS.md` §3 variant (d) (новый, добавлен iter 143).

---

## Known Issues

### Активные (требуют действий в iter 144)

1. **KI#23 (iter 140 — MONITORING → iter 144): Scroll jitter в virtualized lists.**
   На belt/ring/amulet/jewel при скролле видны «дрожащие»/«прыгающие» названия категорий и chips. Root cause: TanStack Virtual's dynamic `measureElement` + `ResizeObserver` — estimate sizes (60px для subgroup) отличаются от actual (40-120px), при scroll ResizeObserver fires → totalSize changes → visible rows jump. **User approved variant (b)** — improved `estimateSize` per-row-state. ~20 строк в `src/ui/components/VirtualizedModList.tsx`. Browser testing обязателен. Design proposal — в `docs/ITER142_PROPOSALS.md` §1.

2. **KI#30 (iter 141 — MONITORING → iter 144): Cross-tab persistence favorites.**
   `pinnedIds` хранятся в per-category Zustand store, уничтожается при unmount. URL hash shared между вкладками. **User approved variant (a)** — per-category localStorage keys `poe2:favorites:<cat>`. ~30 строк (3 functions в `src/store/local-settings.ts` + wiring в `src/ui/hooks/useCategoryPage.ts`). Тихий reset старого избранного (без миграции). Realtime multi-tab sync через `storage` event — попробовать, если нестабильно выкинем. Design proposal — в `docs/ITER142_PROPOSALS.md` §2.

3. **KI#31 (iter 141 — MONITORING → iter 144): Favorites как quick-select с диапазонами.**
   **NEW variant (d)** — user видит favorites как список быстрого доступа для частых наборов аффиксов. Клик на ★ в избранном → выбор аффикса + возможность ввести значения диапазона. Если значения уже были — сохраняются. **НЕ variant (b)** из iter 142 (scroll-to-mod) — user явно сказал: «не думаю что будет удобно кликать по избранным аффиксам и смотреть как тебя скролит». Подробный design — в `docs/ITER142_PROPOSALS.md` §3 variant (d).

4. **KI#32 (iter 143 — NEW BUG): Cascade expand одинаковых sub-group ключей.**
   При раскрытии sub-группы (например, «Уровень умений» в разделе «обычных» аффиксов) на странице раскрываются ВСЕ sub-группы с тем же названием в других разделах (очерненных, оскверненных, разлома). Root cause: sub-group ключ строится как `${categoryId}:${affix}:${sg.key}` где `sg.key` — это название функционального блока (например, `skill-levels`). Когда в одной категории (например, ring) в префиксе есть `skill-levels` в normal/corrupted/desecrated — все получают **одинаковый** ключ `ring:prefix:skill-levels`. Toggle одного → toggle всех (поиск в Set). Файлы: `src/shared/mod-classifier.ts` (mode `affix-functional`, line 2090: `key: block`), `src/ui/components/ModList.tsx` (line 449/481: `${topLevelKey}:${sg.key}`), `src/ui/components/VirtualizedModList.tsx` (line 232: `${topKey}:${sg.key}`). Возможные решения: (a) добавить origin в ключ: `${categoryId}:${affix}:${origin}:${sg.key}`; (b) использовать уникальный index из classifyGroups; (c) менять ModSubGroup.key на origin-aware в `affix-functional` mode. Требует analysis + testing на всех 7 страницах.

5. **KI#33 (iter 143 — NEW, was known): Favorites не реализованы на VendorPage.**
   VendorPage использует custom FilterChip без ⭐ pin slot. Известно с iter 136 (Phase 5), deferred. iter 144 должен добавить: ⭐ pin slot в vendor FilterChip + FavoritesIndicator + KI#30 localStorage wiring. ~40-50 строк. Depends on: KI#31 variant (d) design (quick-select с диапазонами) — vendor FilterChip должен поддержать тот же UX pattern.

6. **In-browser UX verification iter 141 changes (KI#26/27/28/29).** 4 фикса iter 141 (round10 default off + cross-tab persistence, VirtualizedModList 50/50, favorites counter 1-per-family, aside header compact) формально прошли, но user не предоставил UX feedback (сказал «по KI#26-29 — вопросов нет, всё работает как ожидалось» по аналогии с предыдущими итерациями). Если найден новый баг — сначала в STATUS.md как KI, потом фиксий.

### Фоновые (low-priority / редкие)

7. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
8. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
9. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
10. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай.

### Закрытые KI (краткая справка)

- **KI#7-8** (iter 121-122 → VERIFIED iter 129): HomePage hero decorations + SeoBlock.
- **KI#10** (iter 126 → VERIFIED iter 127): ambiguous suffix FP для `Редкость предметов`.
- **KI#11** (iter 126 → DISPROVEN iter 127): cross-block `.*` hypothesis.
- **KI#12** (iter 127 → FIXED): tier-hardcoded regex для 7 single-`#` relic tokens.
- **KI#13** (iter 128 → FIXED): пропущен implicit `Редкость монстров` + BTS-статы.
- **KI#16-20** (iter 139 → VERIFIED iter 140): aside overflow, prefix/suffix 50/50, chip truncation reverted, non-sticky search, LeftPanelFavorites removed.
- **KI#21-22, 24-25** (iter 140 → FIXED): duplicate icons, redundant «Выбрано» block, favorites restored as compact indicator, show-selected-only tooltip.
- **KI#26-29** (iter 141 → FIXED, pending browser verification): round10 default off + cross-tab persistence, VirtualizedModList 50/50, favorites counter 1-per-family, aside header compact.

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

## Next iteration (iter 143 → iter 144)

**iter 143 завершён: user feedback получен + 2 новых бага задокументированы (KI#32, KI#33). Никаких кодовых изменений.**

User дал ясные ответы на 6 вопросов — все 3 первоначальные KI (23/30/31) готовы к реализации. KI#31 variant пересмотрен: вместо scroll-to-mod (variant b) — quick-select с диапазонами (variant d) по явному запросу user. Дополнительно найдены 2 новых бага: KI#32 (cascade expand — высокий приоритет, ломает UX) и KI#33 (VendorPage favorites gap — был известен, теперь явно в KI).

**Приоритеты для iter 144** (по оценке risk + dependency):

1. **KI#32 (cascade expand) — СРОЧНО, blocking UX.** Этот баг ломает основной сценарий использования — раскрытие категорий. Должен быть исправлен ПЕРВЫМ, до KI#30/31 (favorites), потому что favorites полагаются на корректное поведение sub-groups. Analysis + fix: `src/shared/mod-classifier.ts` mode `affix-functional` — добавить origin в ключ ИЛИ использовать unique index. ~30-50 строк. Тесты на 7 страницах.

2. **KI#30 (per-category localStorage favorites) — MEDIUM.** Расширяет `src/store/local-settings.ts` iter 141 infrastructure. ~30 строк. Realtime multi-tab sync — попробовать, если нестабильно выкинем. Тихий reset старого избранного.

3. **KI#31 variant (d) — quick-select с диапазонами — MEDIUM, requires design.** User видит favorites как список быстрого доступа: клик → выбор аффикса + ввод значений диапазона + сохранение диапазона в избранном. Зависит от KI#30 (favorites должны persist). Реализация: ~80-120 строк (NEW quick-select panel ИЛИ расширение FavoritesIndicator). Design proposal — в `docs/ITER142_PROPOSALS.md` §3 variant (d).

4. **KI#33 (VendorPage favorites) — LOW, after KI#31.** Зависит от KI#31 variant (d) — vendor FilterChip должен поддержать тот же UX pattern. ~40-50 строк.

5. **KI#23 (scroll jitter — variant b) — LOW, independent.** ~20 строк в `VirtualizedModList.tsx`. Browser testing обязателен.

6. **In-browser UX verification KI#26/27/28/29** — user сказал «всё работает как ожидалось», формально pending browser verification но по факту OK. Если найден новый баг — сначала в STATUS.md как KI, потом фиксий.

**Главные ограничения для iter 144:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.
- KI#23 fix требует careful browser testing — vitest недостаточен. Лучше недоделать, чем сломать virtualization.
- KI#32 fix требует testing на всех 7 страницах (Belt/Ring/Amulet/Jewel/Waystone/Tablet/Relic) — sub-группы могут вести себя по-разному в разных group modes.
- KI#31 variant (d) — сначала реализовать quick-select panel, потом добавлять диапазоны. Итеративно.

**Фоновые задачи (если user запросит):**

- KI#9 (MULTI_RANGE slot N>0) — monitoring, не фиксировано.
- Persist `rightPanelCollapsed` to URL.
- Phase 5 scroll-to-mod on mobile / virtualized lists.
- Tooltip `--strong` styling variant.
- IconLegend `items` prop extension.

---

Контакты: Discord **woonderdad**

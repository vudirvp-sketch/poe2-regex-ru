# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 152 (KI#42 — фикс потери фокуса в поиске на jewel/waystone)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 152: фикс KI#42 — поиск на вкладках «Самоцветы» и «Путевые камни» терял фокус при вводе/удалении текста.**

Симптом: при вводе или удалении текста в строке поиска на вкладке «Самоцветы» (и в меньшей степени на «Путевые камни») инпут терял фокус после 1–2 символов. Пользователю приходилось кликать на инпут заново. На waystone курсор не терялся, но каждый keystroke вызывал blur+refocus (видно в event log).

**Root cause:** inline-arrays `mergeCategories: ['jewel-desecrated', 'jewel-corrupted']` (JewelPage) и `mergeCategories: ['waystone-desecrated']` (WaystonePage) создавали новый array-reference на каждом ререндере. `useCategoryData`'s `useEffect` dep-array включал `mergeCategories` → effect re-ran на каждый keystroke (searchText change → re-render → new array ref → effect re-run). В effect'е вызывалось `setLoading(true)` → `PageStateWrapper` показывал loading-spinner вместо children → unmount `<input>` → blur. На jewel (3 JSON-файла, большой dataset) loading-state успевал отрисоваться; на waystone (2 файла, меньше) — unmount был слишком кратким чтобы потерять фокус, но blur+refocus происходил на каждый символ.

**Fix (2 слоя):**
1. **Memoize at call site** — `JEWEL_MERGE_CATEGORIES` и `WAYSTONE_MERGE_CATEGORIES` вынесены в module-level constants → стабильный reference → effect не re-ran.
2. **Defensive guard в `useCategoryData`** — `setLoading(true)` только если `data === null` (через `dataRef`). Даже если effect re-ran по любой причине, существующие данные не unmount'ятся.

**Проверка (browser):** на всех 8 вкладках (waystone, tablet, relic, jewel, vendor, belt, ring, amulet) ввод+backspace работают без потери фокуса. 0 blur events после каждого keystroke. Vendor — без search input (другой layout).

**Baseline: tsc 0 / eslint 0 / vitest 2228/2235 (7 pre-existing data-test failures — см. KI#10 ниже) / `vite build` PASS.**

### Что было сделано в iter 152

| Изменение | Файлы | Что сделано |
|-----------|-------|-------------|
| KI#42 fix (JewelPage) | `src/ui/pages/jewel/JewelPage.tsx` | `mergeCategories` вынесен в module-level constant `JEWEL_MERGE_CATEGORIES`. |
| KI#42 fix (WaystonePage) | `src/ui/pages/waystone/WaystonePage.tsx` | `mergeCategories` вынесен в module-level constant `WAYSTONE_MERGE_CATEGORIES`. |
| KI#42 defensive guard | `src/ui/hooks/useCategoryPage.ts` | В `useCategoryData`: `dataRef` mirror + `setLoading(true)` только если `data === null`. Предотвращает unmount детей при re-run effect'а. |
| Документация | `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` | Переписаны под iter 152. |

---

## Known Issues

### Активные (требуют browser testing)

0. **KI#42 (search input loses focus on jewel/waystone)** — **FIXED iter 152**. Симптом: при вводе/удалении текста в строке поиска на вкладках «Самоцветы» и «Путевые камни» инпут терял фокус после 1–2 символов, курсор «сбрасывался» — приходилось кликать заново. **Root cause:** `mergeCategories: ['jewel-desecrated', 'jewel-corrupted']` (JewelPage) и `mergeCategories: ['waystone-desecrated']` (WaystonePage) создавались inline в render → новый array-reference на каждый ререндер → `useCategoryData` effect re-ran → `setLoading(true)` → `PageStateWrapper` unmount'ил детей (включая `<input>`) → blur. На jewel (3 JSON-файла, большой dataset) loading-state успевал отрисоваться; на waystone (2 файла, меньше) — unmount был слишком кратким чтобы потерять фокус, но blur всё равно происходил на каждый символ (см. лог). **Fix:** (1) `useMemo` для `mergeCategories` в JewelPage/WaystonePage (стабильный reference); (2) defensive guard в `useCategoryData` — `setLoading(true)` только если `data === null` (через `dataRef`). Файлы: `JewelPage.tsx`, `WaystonePage.tsx`, `useCategoryPage.ts`.
1. **KI#36 (favorites panel grouping)** — фикс iter 146 готов, нужен browser test.
2. **KI#37 (origin badge)** — фикс iter 146 готов, нужен browser test.
3. **KI#38 (scroll jitter CSS contain)** — фикс iter 146 готов, нужен browser test на jewels tab.
4. **KI#39 (условный)** — если KI#38 jitter остаётся: убрать `ref={virtualizer.measureElement}` с virtual row, оставить только `estimateSize`.
5. **KI#31 (mobile layout для favorites panel)** — фикс iter 144 готов, mobile UX требует user feedback.
6. **KI#32 (cascade expand)** — фикс iter 144 готов, browser testing на 7 страницах не проведён.
7. **iter 148 + iter 149 + iter 150 visual check** — на 7 категорийных страницах (belt/ring/amulet/jewel/waystone/tablet/relic):
   - `<select>` для Сортировка/Показывать должны корректно рендериться.
   - **Приоритет-селект больше не должен присутствовать** (iter 149).
   - **⭐ pin button должен отображаться на всех 7 категорийных страницах** (iter 150 KI#40 fix).
   - **ⓘ glyph больше не должен сдвигать toggle-button** (iter 150 KI#41 fix).
   - И/ИЛИ остаются prominent amber.
   - Waystone chip-тоглы (Оскв/Неоскв/Делир) — color-coding при active.
   - Mobile layout не сломан.

### Фоновые (low-priority)

8. **Bundle > 500 KB** — `index-B4oIacg-.js` 603.60 KB. Code-split через dynamic import() для категорийных страниц.
9. **APCA Lc<75 для small text с weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
10. **Pre-existing data tests failing (7 tests)** — `tests/core/iter126-ki10-rarity-disambiguation.test.ts` (2) и `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` (5). Тесты валидируют содержимое `public/generated/*.json` — данные были перегенерированы ETL после iter 151 (commit `chore: update generated data from ETL [skip ci]`), и регулярки в JSON разъехались с hardcoded-ожиданиями в тестах. **Не блокирует UI-фиксы** — это data-content тесты, не функциональные. Фикс требует либо ETL-override для соответствующих токенов, либо обновления ожиданий в тестах.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone | ✅ | in-game verified |
| `prefix (A\|B\|C)%.*suffix` | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` | ❌ | Fix: Path D |
| Regex char limit ≈ 250 chars | ✅ | runtime split |

---

## Next iteration (iter 152 → iter 153)

**iter 152 завершён: KI#42 фикс (search focus loss на jewel/waystone) готов. Готов к push.**

**Приоритеты для iter 153:**

1. **Browser testing** на 7 категорийных страницах (всё ещё не проведено):
   - iter 148 toolbar refactor — селекты Сортировка/Показывать.
   - iter 149 priority filter — проверить, что селекта «Приоритет» больше нет.
   - **iter 150 KI#40 — ⭐ pin button должен отображаться на ВСЕХ 7 страницах** (раньше не было на belt/ring/amulet/jewel).
   - **iter 150 KI#41 — ⓘ glyph не должен сдвигать toggle-button sideways** (должен быть внутри правого края «бокса»).
   - KI#36/37/38 (favorites grouping, origin badge, scroll jitter).

2. **Если KI#38 jitter остаётся → применить KI#39**.

3. **Mobile layout optimization** для favorites panel (KI#31 follow-up).

4. **Code-split bundle** — `index-*.js` > 500 KB warning при build.

5. **Pre-existing data-test failures (KI#10)** — 7 тестов в `iter126-ki10-rarity-disambiguation` (2) и `iter127-ki12-tier-hardcoded-regex` (5) failing из-за устаревших regex-ожиданий после ETL-регенерации `public/generated/*.json`. Нужно либо обновить i18n-overrides, либо обновить ожидания в тестах.

---

Контакты: Discord **woonderdad**

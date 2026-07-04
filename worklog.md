# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

## iter 158–168 (MIXED-mode + redesign v3/v4 + A1) — одной строкой

**iter 158:** core MIXED mode (`MIXED_OR` AST + `anchorFirstAltOnly` mitigation для KI#45 + `truncateMixedOrLiterals` для KI#46, 43 теста).
**iter 159:** UI MIXED integration (`optionalIds`, FilterChip 3-state, MIXED toggle, 28 новых тестов).
**iter 160:** test plan T1-T10 в `docs/MIXED_MODE_UI_TESTS.md`.
**iter 161:** 3-section SelectedBasket (want/opt/exclude) + family-group counters.
**iter 162:** KI#49 fix (EXCLUDE-токен не теряется в MIXED) + ⓘ glyph на MIXED chip.
**iter 163:** T9 regression test + UX cleanup. **KI#48 и KI#49 ЗАКРЫТЫ** (T1-T10 уже in-game verified в iter 157). 2319 tests.
**iter 164:** UX redesign v3 — P1 (`.affix-origin-header` mini-frame для L2), P2 (усиление `.nav-mode-active`), P3 (усиление `.regex-output` + pulse 600ms). CSS 60→61 KB.
**iter 165:** Концепт-спецификация `docs/REDESIGN_CONCEPT_v4.md` — детальная проработка 7 аспектов аудита с вариантами решений. Код НЕ изменялся. Ожидание фидбека пользователя.
**iter 166 (A2):** Display-layer override: 7 сайтов L3 sub-group рендера в `ModList.tsx` + `VirtualizedModList.tsx` переведены с `${bgClass} border ${borderClass}` на `bg-panel/15 border border-edge/15` + цветной `colorClass` (text-only). L2 origin не тронут. 2319/2319 PASS, CSS 60→60.14 KB.
**iter 167 (A3):** Empty-state RegexOutput переписан как structured block (`.regex-output__empty` dashed gold border + ↑ arrow + hint). Новый компонент `BasketToRegexFlow.tsx` (~30 строк) — тонкая золотистая линия + ↓ arrow между basket и regex, fade-in 200ms. `CategoryLayout` получил optional prop `basketHasContent`. +9 тестов (2328/2328). CSS 60.14→61.17 KB.
**iter 168 (A1 Вариант B):** Усиление контраста L1/L2 corner accents: L1 6×6/0.4 → 8×8/0.55, L2 5×5/0.35 → 4×4/0.30 (контраст ~12% → ~25%). 4 правки в `src/index.css`. 2328/2328 PASS, CSS +0 KB.

---

Task ID: iter-169
Agent: main
Task: Пользователь сообщал баг: «При смене вкладок постоянно приходится заново кликать на 'развернуть все' — состояние и выбор не сохраняется». По правилу «найден баг → документируй в STATUS.md как KI → потом фиксись» — реализовать iter 169 как фикс KI#50 (вместо запланированного A4). Принцип: «лучше недоделать, чем сломать». Упаковать архив, git-команды, точка остановки.

Work Log:
- 0: **Прочитал контекст из чата:**
  - iter 168 завершён (A1 — Вариант B — усиление контраста L1/L2 corner accents). 2328/2328 PASS.
  - План iter 169 был A4 (кнопки «Свернуть/Развернуть все подкатегории», ~60-80 строк, низкий риск).
  - НО пользователь сообщал новый баг: при смене вкладок теряется expand/collapse состояние.
  - По правилу: «найден баг → сначала документируй в STATUS.md как Known Issue, потом фиксись» — фикс приоритетнее A4.
- 1: **Клонировал репозиторий** `https://github.com/vudirvp-sketch/poe2-regex-ru.git`, установил pnpm@11.5.2 глобально, `pnpm install --frozen-lockfile`. Запустил `pnpm test` — 2328/2328 PASS (baseline подтверждена).
- 2: **Изучил архитектуру управления expand/collapse состоянием:**
  - `src/store/filter-store.ts` — Zustand store с полями `expandedSubGroups` / `collapsedGroups` / `chipExpandState` / `showSelectedOnly`. Каждая category page создаёт свой instance через `createFilterStore()`.
  - `src/ui/hooks/useCategoryPage.ts` — `useFilterStore(categoryId)` создаёт store через `useMemo(() => createFilterStore(), [categoryId])` и сразу вызывает `syncFromUrl(useStore.getState())` для restore из URL hash.
  - `src/store/url-sync.ts` — URL hash сериализация через lz-string. Ключи: `es` (expandedSubGroups), `c` (collapsedGroups), `ce` (chipExpandState), `so` (showSelectedOnly), `pn` (pinnedIds).
  - `src/store/local-settings.ts` — pattern для per-category localStorage (KI#30 favorites): `poe2:favorites:<categoryId>` + helpers `readFavorites` / `writeFavorites` / `clearFavorites` / `favoritesStorageKey` + multi-tab `storage` event listener.
- 3: **Нашёл корневую причину бага (KI#50):**
  - Каждый categoryId создаёт **новый Zustand store** на mount с defaults: `expandedSubGroups = new Set()` (= все sub-groups COLLAPSED).
  - URL hash **shared между категориями** — при переходе amulet→ring в `syncFromUrl` ring store попадают amulet-ключи (например `amulet:prefix:positive-loot`).
  - Эти ключи **не матчятся** с ring-подгруппами (формально `${categoryId}:${affix}:${subBlockKey}`) → sub-groups ring остаются COLLAPSED (default).
  - Когда пользователь взаимодействует на ring → URL sync пишет ring-состояние в URL hash → amulet-данные теряются.
  - Возврат на amulet → новый store → `syncFromUrl` читает ring-данные из URL → amulet expand state потерян навсегда.
  - **Нет localStorage-персистенции** для этих полей (в отличие от favorites KI#30) — `writeFavorites`/`clearFavorites` есть только для `pinnedIds`.
- 4: **Документировал KI#50 в STATUS.md** (по правилу bug → doc first → fix):
  - Обновил header: «Текущая итерация: 169 (KI#50 — фикс потери expand/collapse состояния при переключении вкладок)».
  - Добавил секцию «Текущее состояние (iter 169)» с описанием бага, фикса, таблицей до/после, списком изменённых файлов, критериями приёмки.
  - Обновил «Next iteration»: iter 169 = KI#50 fix в работе, iter 170 = A4 (план).
- 5: **Реализовал helpers в `src/store/local-settings.ts`** (+~190 строк в конце файла):
  - `function uiStateKey(categoryId)` — возвращает `uistate:${categoryId}` (без `poe2:` prefix).
  - `interface CategoryUiState` — `{ expandedSubGroups?: string[]; collapsedGroups?: string[]; chipExpandState?: string[] }`. `showSelectedOnly` умышленно НЕ включён — у него нет category-prefix, URL-only persistence сохранено (можно добавить позже если пользователь сообщит).
  - `readUiState(categoryId): CategoryUiState | null` — читает из `poe2:uistate:<categoryId>`, sanitize non-string entries, возвращает null если все поля empty/corrupt/missing.
  - `writeUiState(categoryId, state): void` — пишет JSON-сериализованный объект, drop empty arrays, remove key entirely если все empty (omit-when-default pattern как у favorites).
  - `clearUiState(categoryId): void` — remove key.
  - `uiStateStorageKey(categoryId): string` — для будущего `storage` event listener (как `favoritesStorageKey`).
  - `filterInCategoryKeys(set, categoryId): Set<string>` — pure helper для фильтрации cross-category leak. Возвращает тот же Set instance если empty (no allocation), иначе новый Set только с ключами `${categoryId}:*`. Граничный случай: `belts:` и `pocket-belt:` НЕ матчатся с `belt:` (требуется `:` после categoryId).
- 6: **Интегрировал в `src/ui/hooks/useCategoryPage.ts`:**
  - Добавил импорты `readUiState`, `writeUiState`, `clearUiState`, `filterInCategoryKeys`.
  - Добавил useState initializer СРАЗУ после favorites restore (line ~805): фильтрует cross-category leak из URL-restored Sets, если in-category ключей нет — восстанавливает из per-category localStorage. URL wins для shareable links с in-category ключами.
  - Добавил persist block внутри URL sync effect (после `clearFavorites`): фильтрует Sets (defensive — initializer уже отфильтровал) и пишет в localStorage через `writeUiState`/`clearUiState`.
  - Подробные комментарии с объяснением root cause, fix strategy, shareable-link semantics, и почему `showSelectedOnly` НЕ включён.
- 7: **Написал тесты `tests/store/KI50UiState.test.ts`** (+31 тест, mirror KI30Favorites pattern):
  - `readUiState`: null when key not set, parsed object when set, per-category independence, null on corrupt JSON, null on non-plain-object, filters non-string entries, null when all arrays empty, null when no known fields, drops empty arrays, null when localStorage throws.
  - `writeUiState`: persists under right key, per-category, drops empty arrays, removes key when all empty, removes key when all undefined, silent no-op on throw.
  - `clearUiState`: removes key, doesn't touch other categories, silent no-op on missing key.
  - Round-trip: write then read.
  - `uiStateStorageKey` helper.
  - `filterInCategoryKeys`: returns same instance for empty Set, returns new Set with only in-category keys, preserves both 2-part and 3-part formats, returns empty Set when no keys match (core KI#50 scenario), doesn't match categoryId as substring (`belts:` ≠ `belt:`), handles single-character categoryIds, doesn't mutate input, handles 400-element Set efficiently.
- 8: **Запустил проверки — ВСЕ PASS:**
  - `npx tsc -b` — 0 errors.
  - `npx eslint .` — 0 errors.
  - `npx vitest run tests/store/KI50UiState.test.ts` — 31/31 PASS (smoke test новых тестов).
  - `npx vitest run` — 2359/2359 PASS (58 files: 2328 baseline + 31 новых). Regression отсутствует.
  - `npx vite build` — PASS. CSS 61.17 KB (без изменений — CSS не трогал). Main bundle `index-DmYfKIBv.js` 343 KB / 105 KB gzip — в пределах нормы.
- 9: **Обновил документацию:**
  - `STATUS.md` — iter 169 как текущая (см. шаг 4).
  - `AGENT_NAVIGATION.md` — указатель текущей итерации обновлён до iter 169 (2359 тестов). Pitfall 19 (`useCategoryPage` hook architecture) расширен: добавлено описание KI#50 fix — `readUiState` / `writeUiState` / `clearUiState` / `filterInCategoryKeys` в `src/store/local-settings.ts`, localStorage key `poe2:uistate:<categoryId>`, useState initializer filter + restore, URL sync effect persist, pattern mirrors KI#30 favorites.
  - `worklog.md` — iter 158-168 сжаты в одну секцию «одной строкой», iter 169 добавлен детально (эта запись). Файл 73 → ~60 строк.

Stage Summary:
- **iter 169 завершён.** KI#50 (потеря expand/collapse состояния при смене вкладок) реализован и протестирован.
- **Изменённые файлы (5):**
  - `src/store/local-settings.ts` — +190 строк: 4 новых helper'а (`readUiState` / `writeUiState` / `clearUiState` / `filterInCategoryKeys`) + `uiStateStorageKey` + `CategoryUiState` interface. Без breaking changes — все существующие exports сохранены.
  - `src/ui/hooks/useCategoryPage.ts` — +5 imports + useState initializer (~33 строки) + persist block внутри URL sync effect (~17 строк). Без breaking changes — все существующие exports сохранены, hook signature unchanged.
  - `tests/store/KI50UiState.test.ts` — новый файл, +31 тест (16 на read/write/clear + 8 на filterInCategoryKeys + 7 на round-trip и edge cases).
  - `STATUS.md` — iter 169 как текущая, секция «Текущее состояние» переписана, «Next iteration» обновлена.
  - `AGENT_NAVIGATION.md` — указатель iter 169 + Pitfall 19 расширен (KI#50 fix описание).
  - `worklog.md` — iter 158-168 сжаты, iter 169 добавлен.
- **Проверки:** tsc 0, eslint 0, vitest 2359/2359 PASS (2328 baseline + 31 новых), vite build PASS, CSS 61.17 KB (без изменений).
- **Stopping point:** iter 169 завершён. Expand/collapse состояние (`expandedSubGroups` / `collapsedGroups` / `chipExpandState`) теперь persist'ится per-category в `poe2:uistate:<categoryId>` localStorage. При смене вкладок: (1) URL cross-category leak фильтруется, (2) если URL не содержит in-category ключей — restore из localStorage, (3) каждое изменение пишет в localStorage. Shareable links с expand state продолжают работать (URL wins если есть in-category ключи). `showSelectedOnly` умышленно НЕ тронут (нет category-prefix — URL-only persistence сохранено, можно добавить позже если пользователь сообщит). Ожидается визуальная валидация пользователя: раскрыть подгруппы на amulet → перейти на ring → вернуться на amulet → подгруппы amulet остаются раскрытыми. Следующая iter 170 = A4 (кнопки «Свернуть/Развернуть все подкатегории», ~60-80 строк, низкий риск).
- **Что от пользователя нужно (опционально):** (1) Визуальная проверка iter 169 — раскрыть подгруппы на amulet → переключиться на ring → вернуться на amulet → подгруппы должны остаться раскрытыми. (2) Ретро-валидация iter 168 (L1 corner accents 8×8/0.55 vs L2 4×4/0.30), iter 166 (разделение палитр L2/L3), iter 167 (placeholder + ↓ коннектор) — если ещё не проверены. Если все одобряет — продолжаем iter 170 (A4).

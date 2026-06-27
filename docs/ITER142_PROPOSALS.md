# iter 142/143 Design Proposals — KI#23 / KI#30 / KI#31 + KI#32 / KI#33

> **Status:** iter 143 — user feedback получен по 6 вопросам. Все 3 первоначальные KI (23/30/31) готовы к реализации в iter 144. KI#31 variant пересмотрен: вместо (b) scroll-to-mod — NEW variant (d) quick-select с диапазонами (по явному запросу user). Дополнительно задокументированы 2 новых бага: KI#32 (cascade expand) и KI#33 (VendorPage favorites gap).
> **Источник:** STATUS.md Known Issues #1 (KI#23), #2 (KI#30), #3 (KI#31), #4 (KI#32 NEW), #5 (KI#33 NEW).
> **Контекст:** AGENT_NAVIGATION.md Pitfall 51 (iter 141 patterns).
> **Принцип:** «лучше недоделать, чем сломать» — все KI требуют либо careful browser testing (KI#23), либо UX design решения от user (KI#30/31/33). KI#32 — blocking UX bug, должен быть исправлен первым.

---

## §0. User answers (iter 143 feedback)

| # | Вопрос | User answer | Решение |
|---|--------|-------------|---------|
| Q1 | KI#23 partial fix OK (variant b)? | ✅ Да | Variant (b) — improved estimateSize per-row-state |
| Q2 | Если (b) не хватит — fallback на (a)? | ✅ Сразу нормально сделать | Реализуем (b) с тест-планом; если browser testing покажет что не хватает — добавим (a) в следующей итерации |
| Q3 | Silent reset старого избранного OK? | ✅ Пофигу | Тихий reset, без миграции |
| Q4 | Realtime multi-tab sync нужна? | ✅ Только если стабильно и не усложнит код | Пробуем через `storage` event (~20 строк); если нестабильно — выкинем |
| Q5 | Формат хранения? | ✅ Простой массив ID | `string[]` JSON-serialized |
| Q6 | ⭐ button 2 функции (toggle + scroll) OK? | ❌ Toggle только, не scroll! | **NEW variant (d)** — quick-select с диапазонами (см. §3 ниже) |

**Дополнительно user сообщил:**
- 🐛 **NEW KI#32** — cascade expand одинаковых названий sub-групп (раскрытие «Уровень умений» в «обычных» раскрывает все «Уровень умений» в очерненных/оскверненных/разлома).
- 🐛 **NEW KI#33** — favorites не реализованы на VendorPage (было известно с iter 136, теперь явно в KI).
- 💡 User видит favorites как «список быстрого доступа» для часто используемых наборов аффиксов — не как «scroll-to-mod». Это меняет дизайн KI#31 полностью.
- 💡 User хочет: если в избранном уже были значения диапазона — они сохраняются по умолчанию при quick-select.

---

## §1. KI#23 — Scroll jitter / «doubling» в virtualized lists

### Симптом

На belt/ring/amulet/jewel страницах (используют `VirtualizedModList.tsx`) при скролле видны «дрожащие»/«прыгающие» названия категорий (GroupHeader) и affix chips (FilterChip). Эффект особенно заметен на крупных списках (amulet: 427 tokens, ring: 366 tokens) при быстром скролле.

### Root cause (из STATUS.md Known Issue #1)

TanStack Virtual's dynamic `measureElement` + `ResizeObserver`:
1. `estimateSize` возвращает `ROW_ESTIMATES[row.type]` (статичные значения: `subgroup` = 60px).
2. Actual row sizes варьируются 40-120px в зависимости от состояния (1-3 chips / 5+ chips / selected+range inputs / collapsed sub-group).
3. При scroll ResizeObserver fires → actual size измеряется → `totalSize` пересчитывается → `paddingTop`/`paddingBottom` shifted → visible rows jump.
4. Особенно заметно когда estimate (60px) сильно отличается от actual (110px для selected+range) — padding-bottom растёт на ~50px на каждый такой row.

Файлы: `src/ui/components/VirtualizedModList.tsx` (`VirtualizedColumn`, `ROW_ESTIMATES` lines 149-155, `estimateSize` callback lines 567-571 + 845-849).

### Варианты решения

#### Вариант (a) — Static row heights

**Описание:** Убрать `measureElement` ref + `ResizeObserver`. Использовать фиксированные высоты для каждого row type. Если контент не помещается — обрезать (CSS `max-height` + `overflow: hidden`).

**Pros:**
- Полностью устраняет jitter — никаких динамических измерений.
- Детерминированная производительность (no ResizeObserver callbacks).
- Проще mental model.

**Cons:**
- Теряется гибкость — chips с range inputs (selected tokens) требуют ~110px, без range = ~60px. С static heights придется выбрать max (~110px) или обрезать.
- Визуальная деградация: chips с range будут иметь много empty space (если выбрать max); либо контент будет обрезаться (если выбрать min).
- Сломает существующий UX — пользователь привык видеть весь контент без обрезки.
- **Высокий риск регрессии** — нужно careful browser testing на всех 4 страницах (belt/ring/amulet/jewel) с разными состояниями (selected/excluded/pinned + range + collapsed).

**Risk level:** HIGH.

**Тест-план:**
1. Vitest: regression tests — все существующие `tests/ui/VirtualizedModList.test.tsx` (13 tests) должны проходить.
2. Browser testing (user):
   - 4 страницы (belt/ring/amulet/jewel) × 5 состояний (empty / 1 selected / 5 selected / 1 pinned / collapse-all) = 20 screenshots before/after.
   - Проверить: no jitter (главное), no clipping, no empty space > 20px.
   - Проверить mobile (virtualization on mobile может отличаться).

---

#### Вариант (b) — Improved `estimateSize` per-row-state ⭐ RECOMMENDED

**Описание:** Сохранить `measureElement` + `ResizeObserver` (TanStack Virtual dynamic measurement). Улучшить `estimateSize` callback — вместо статичного `ROW_ESTIMATES[row.type]` возвращать оценку на основе **состояния конкретной строки**:

```ts
estimateSize: (index) => {
  const row = rows[index];
  if (!row) return 40;
  switch (row.type) {
    case 'column-header': return 44;
    case 'origin-header': return 36;
    case 'jewel-type-header': return 30;
    case 'subgroup-header': return 30; // collapsed sub-group, header-only
    case 'subgroup': {
      // Improved estimate based on row state
      const group = row.group; // FamilyGroup
      const memberCount = group.memberIds.length;
      const hasSelected = group.memberIds.some(id => selectedIds.has(id));
      const hasRange = group.memberIds.some(id => perTokenRanges[id] !== undefined);
      
      if (hasSelected && hasRange) return 110; // selected + range inputs
      if (hasSelected) return 80;              // selected, no range
      if (memberCount > 3) return 80;          // 4+ chips
      return 60;                                // 1-3 chips, default
    }
    default: return 40;
  }
}
```

**Pros:**
- **Минимальный риск** — virtualization machinery не трогается (`measureElement` + `ResizeObserver` продолжают работать).
- Уменьшает jitter — estimate теперь ближе к actual size (60-110px диапазон вместо фиксированного 60px).
- Backward compat — если `selectedIds`/`perTokenRanges` не переданы, fallback на старую логику.
- Реализуется в одном файле (`VirtualizedModList.tsx`), один callback.

**Cons:**
- Не устраняет jitter полностью — `measureElement` всё ещё fires, но разница estimate vs actual теперь ~10-20px вместо ~50px.
- Нужно careful sync с ModList.tsx — там нет virtualization, но логика subgroup sizing должна быть consistent (хотя ModList не страдает от jitter).
- Нужно передать `selectedIds` + `perTokenRanges` в `VirtualizedColumn` (уже передаются как props — нужно только добавить в estimateSize closure).

**Risk level:** LOW.

**Тест-план:**
1. Vitest: NEW test в `tests/ui/VirtualizedModList.test.tsx` — verify estimateSize returns different values for selected+range vs default state. Существующие 13 tests должны проходить без изменений.
2. Browser testing (user):
   - 4 страницы (belt/ring/amulet/jewel) × 3 состояния (empty / 5 selected with range / collapse-all) = 12 screenshots before/after.
   - Проверить: jitter уменьшился (subjective measurement — записать video scroll before/after).
   - Проверить: no regression в scroll position preservation (после toggle chip expand/collapse).

---

#### Вариант (c) — CSS Grid virtualization (replace TanStack Virtual)

**Описание:** Полностью заменить TanStack Virtual на CSS Grid с `content-visibility: auto` + `contain-intrinsic-size`. Это нативная browser virtualization — каждый row рендерится в DOM, но browser не рисует невидимые.

**Pros:**
- Native browser virtualization — no JS measurement overhead.
- No jitter — `content-visibility: auto` handles visibility automatically.
- Simpler code (no virtualizer setup).

**Cons:**
- **Очень высокий риск** — full rewrite `VirtualizedModList.tsx` (1085 строк). Сломает все 13 existing tests.
- `content-visibility: auto` browser support: Chrome 85+, Firefox 125+, Safari 18+. Для older browsers нужен fallback.
- `contain-intrinsic-size` требует static size estimate — те же проблемы что и вариант (a).
- Phase 2 collapse logic (`buildColumnRows` с `topKey`/`collapsedGroups`/`expandedSubGroups` filtering) нужно переписать.
- iter 120 уже устранил jump-to-top bug — regression риск очень высокий.
- **Не рекомендуется** — cost/risk ratio намного хуже варианта (b).

**Risk level:** VERY HIGH.

**Тест-план:**
1. Vitest: rewrite all 13 tests в `tests/ui/VirtualizedModList.test.tsx`.
2. Browser testing (user): full regression suite — 4 страницы × 5 состояний × mobile/desktop = 40 screenshots.
3. Performance testing: measure FPS during scroll on amulet (427 tokens) — должно быть ≥ 60 FPS.

---

### §1 Recommendation

**Вариант (b) — Improved `estimateSize` per-row-state.**

Обоснование:
- Минимальный риск — virtualization machinery не трогается.
- Уменьшает jitter (не устраняет полностью, но делает его менее заметным).
- Реализуется в одном файле, один callback.
- Backward compat — fallback на старую логику если props не переданы.
- Соответствует правилу «лучше недоделать, чем сломать».

**Implementation order:**
1. Сначала обсудить с user — устраивает ли partial fix (уменьшение jitter, не полное устранение).
2. Если user OK с partial fix — реализовать вариант (b).
3. Browser testing пользователем — записать video scroll before/after.
4. Если jitter всё ещё слишком заметный — рассмотреть вариант (a) с max-height + overflow:hidden как fallback.

**Files to change (variant b):**
- `src/ui/components/VirtualizedModList.tsx` — `estimateSize` callback в 2 `useVirtualizer` calls (lines 567-571 + 845-849). +20 строк logic.
- `tests/ui/VirtualizedModList.test.tsx` — +1 test для verify improved estimateSize.

---

## §2. KI#30 — Cross-tab persistence favorites (pinnedIds)

### Симптом

`pinnedIds` (favorited affix families) хранятся в per-category Zustand store (`createFilterStore()` создаёт НОВЫЙ store на каждый mount, уничтожается на unmount). URL hash shared между категориями и перезаписывается при переходе. Результат: при reload вкладки favorites теряются (если URL не был сохранён); при переключении между вкладками favorites каждой категории изолированы.

### Root cause (из STATUS.md Known Issue #2)

- `src/store/filter-store.ts` line 174: `createFilterStore()` — каждый вызов создаёт новый store instance.
- `src/store/url-sync.ts` line 18: `HASH_PREFIX = '#q='` — один hash на origin, перезаписывается на каждом page mount.
- `pinnedIds` сериализуется в URL через `pn` compact key (filter-store.ts line 431), но при переходе на другую категорию hash перезаписывается — старые pinnedIds теряются.

iter 141 уже добавил `src/store/local-settings.ts` infrastructure для global settings (round10, searchLogic, и т.д.) — но **не для per-category state** (selectedIds, pinnedIds, collapsedGroups).

### Варианты решения

#### Вариант (a) — Per-category localStorage keys ⭐ RECOMMENDED

**Описание:** Расширить `src/store/local-settings.ts` (iter 141) до per-category favorites. Каждая категория получает свой localStorage key: `poe2:favorites:belt`, `poe2:favorites:ring`, и т.д. Значение — JSON-serialized array of token IDs (first member ID per family, per iter 141 KI#28).

```ts
// src/store/local-settings.ts (extension)
export function readFavorites(categoryId: string): string[] {
  return readLocalSetting<string[]>(`favorites:${categoryId}`, []);
}
export function writeFavorites(categoryId: string, ids: string[]): void {
  writeLocalSetting(`favorites:${categoryId}`, ids);
}
export function clearFavorites(categoryId: string): void {
  clearLocalSetting(`favorites:${categoryId}`);
}
```

В `useCategoryPage.ts`:
- При mount: `set({ pinnedIds: new Set(readFavorites(categoryId)) })` после URL restore (URL > localStorage > default).
- При `togglePinned` / `clearPinned`: `writeFavorites(categoryId, Array.from(state.pinnedIds))`.

**Pros:**
- **Простая миграция** — переиспользует iter 141 `local-settings.ts` infrastructure.
- **Прозрачная семантика** — `poe2:favorites:belt` = favorited IDs для belt. Легко debug через DevTools → Application → LocalStorage.
- **Независимость категорий** — favorites для belt не влияют на favorites для ring (соответствует mental model «разные категории — разные списки favourites»).
- **Survives reload** — localStorage persistent across sessions.
- **Backward compat** — если key не существует, fallback на пустой array (no favorites).

**Cons:**
- Нет realtime sync между вкладками (если user открыл belt в 2 вкладках и pinned affix в одной — вторая не обновится, пока не reload). Решается через `storage` event listener (medium complexity).
- 7 keys в localStorage (`poe2:favorites:belt` ... `poe2:favorites:relic`) — небольшой overhead.
- Migration: существующие users (если есть) потеряют текущие favorites при первом visit после deploy — нужно decide: silent reset (acceptable) ИЛИ migration script (overkill для < 100 users).

**Format:** `string[]` (JSON-serialized array of token IDs).
**Expiry:** нет (favorites постоянны, пока user не очистит).
**Migration:** silent reset (старые favorites теряются, user может re-pin). Acceptable для < 100 users.

**Risk level:** LOW.

**Тест-план:**
1. Vitest: NEW `tests/store/local-settings.test.ts` — +3 tests для `readFavorites`/`writeFavorites`/`clearFavorites` (round-trip, missing key fallback, corrupt JSON fallback).
2. Vitest: NEW test в `tests/ui/...` — verify useCategoryPage восстанавливает pinnedIds из localStorage при mount (mock localStorage).
3. Browser testing (user):
   - Pin 2 affixes на Belt → navigate to Ring → navigate back to Belt → favorites должны быть на месте.
   - Pin 1 affix на Ring → reload page → favorites должны быть на месте.
   - Pin 1 affix на Belt → open new tab to Belt → favorites НЕ видны во второй вкладке (acceptable для iter 143; realtime sync = future enhancement).

---

#### Вариант (b) — Global Zustand store с category-keyed map

**Описание:** Создать global Zustand store (вне React tree, singleton) с `Record<categoryId, Set<string>>` map. Каждый category page читает/пишет в свой slice global store.

```ts
// src/store/favorites-store.ts (NEW)
import { create } from 'zustand';

interface FavoritesState {
  favorites: Record<string, Set<string>>; // categoryId → pinnedIds
  togglePinned: (categoryId: string, id: string) => void;
  clearPinned: (categoryId: string) => void;
  getPinnedIds: (categoryId: string) => Set<string>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: {},
  togglePinned: (categoryId, id) =>
    set((state) => {
      const current = new Set(state.favorites[categoryId] ?? []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { favorites: { ...state.favorites, [categoryId]: current } };
    }),
  clearPinned: (categoryId) =>
    set((state) => {
      const { [categoryId]: _, ...rest } = state.favorites;
      return { favorites: rest };
    }),
  getPinnedIds: (categoryId) => get().favorites[categoryId] ?? new Set(),
}));
```

В `useCategoryPage.ts` — подписка на `useFavoritesStore(s => s.favorites[categoryId])` + actions через `useFavoritesStore.getState().togglePinned(categoryId, id)`.

**Pros:**
- **Realtime sync между вкладками** — если подписаться через `useSyncExternalStore` с `storage` event, вторая вкладка увидит изменения (нужен `subscribeWithSelector` middleware + `storage` event listener).
- Single source of truth — все favorites в одном месте.
- Cleaner architecture — global store отделён от per-category store.

**Cons:**
- **Больше complexity** — NEW file `favorites-store.ts`, migration logic (старый `pinnedIds` в filter-store → новый global store), tests для global store.
- **Persistence** — Zustand store не persistent по умолчанию. Нужен `persist` middleware ИЛИ manual localStorage sync (всё равно localStorage). Если через `persist` middleware — `partialize` config чтобы хранить только `favorites` field.
- **Backward compat** — `pinnedIds` в `filter-store.ts` нужно либо удалить (breaking change для URL `pn` key), либо синхронизировать с global store (дублирование state).
- **FilterStore API change** — все 7 pages читают `pinnedIds` из `useCategoryPage()` — нужно либо transparent proxy (filter-store делегирует в global store), либо refactor всех 7 pages.

**Format:** `Record<string, string[]>` (Zustand persist middleware → JSON).
**Expiry:** нет.
**Migration:** сложная — нужно sync filter-store.pinnedIds ↔ favorites-store.favorites[categoryId] на first load.

**Risk level:** MEDIUM.

**Тест-план:**
1. Vitest: NEW `tests/store/favorites-store.test.ts` — 8-10 tests (initial state, toggle, clear, getPinnedIds, persistence via persist middleware).
2. Vitest: regression tests — все existing tests с `pinnedIds` должны проходить.
3. Browser testing (user): то же что вариант (a) + multi-tab sync test.

---

#### Вариант (c) — IndexedDB

**Описание:** Использовать IndexedDB через обёртку (например, `idb-keyval` или `idb` library). Каждый categoryId → object store с favorited IDs.

**Pros:**
- Большой storage limit (~50MB+ vs localStorage 5MB).
- Async API — не блокирует main thread.
- Structured storage — можно хранить complex objects (например, `{ id, familyKey, affixType, pinnedAt }`).

**Cons:**
- **Overkill** — для < 100 IDs на категорию localStorage более чем достаточно.
- Async API усложняет React integration (нужен `useEffect` для initial load, loading state, error handling).
- NEW runtime dependency (`idb-keyval` ~1KB) — нарушает «zero npm dependencies» rule для core, но OK для UI (UI уже имеет zustand, react-virtual, etc.).
- Migration сложнее — async initialization.
- Debug сложнее — DevTools support хуже чем localStorage.

**Format:** `Array<{ id: string, pinnedAt: number }>` per category.
**Expiry:** нет (можно добавить cleanup для stale entries > 90 days, но overkill).
**Migration:** самая сложная — async init, race conditions с first render.

**Risk level:** MEDIUM-HIGH (overkill для current requirements).

**Тест-план:**
1. Vitest: NEW `tests/store/favorites-idb.test.ts` — 10+ tests (init, get, set, delete, error handling, async behavior).
2. Browser testing: то же что (a) + indexedDB quota tests.

---

### §2 Recommendation

**Вариант (a) — Per-category localStorage keys.**

Обоснование:
- Минимальный risk — переиспользует iter 141 `local-settings.ts` infrastructure.
- Простая migration (silent reset acceptable для < 100 users).
- Соответствует mental model «разные категории — разные списки favourites».
- Debug-friendly — DevTools → Application → LocalStorage.
- Realtime multi-tab sync не критичен (user обычно работает в одной вкладке за раз) — можно добавить позже через `storage` event listener если user запросит.

**Implementation order:**
1. Сначала обсудить с user — устраивает ли silent reset существующих favorites (accept able для < 100 users) ИЛИ нужна migration.
2. Если user OK с silent reset — реализовать вариант (a).
3. Browser testing пользователем — pin на belt → navigate → return → favorites на месте.
4. Если user хочет realtime multi-tab sync — добавить `storage` event listener в useCategoryPage (medium complexity, ~20 строк).

**Files to change (variant a):**
- `src/store/local-settings.ts` — +3 functions `readFavorites`/`writeFavorites`/`clearFavorites`.
- `src/ui/hooks/useCategoryPage.ts` — `pinnedIds` initialization из localStorage после URL restore; `togglePinned`/`clearPinned` wrappers с `writeFavorites`/`clearFavorites` side-effects.
- `tests/store/local-settings.test.ts` — +3 tests для favorites functions.

---

## §3. KI#31 — Favorites как quick-select feature

### Симптом

Пользователь ожидает: клик на ★ в избранном → аффикс выбирается (added to `selectedIds`) ИЛИ scroll-to-mod срабатывает. Текущая реализация (Phase 5 iter 136 + iter 140 KI#24 + iter 141 KI#28): ★ только визуальный маркер + фильтр show-selected-only. Click на ★ в `FavoritesIndicator` (header badge) не делает ничего. Click на ★ в `FilterChip` только toggle pinned state.

### Root cause (из STATUS.md Known Issue #3)

Feature gap, не bug. Phase 5 iter 136 реализовал scroll-to-mod через click на chip в `LeftPanelFavorites` (удалён в iter 139 KI#20). iter 140 KI#24 восстановил favorites как compact indicator (`FavoritesIndicator.tsx`) — но БЕЗ click handler (pure presentational). `FilterChip` ⭐ button только toggle pinned (Phase 5).

### Варианты решения

#### Вариант (a) — Click ★ в FavoritesIndicator → диалог/панель со списком favorited семей + быстрый select

**Описание:** `FavoritesIndicator.tsx` становится clickable. При click открывается dropdown/dialog (через `createPortal` в `document.body`, как `Tooltip.tsx` iter 137) со списком всех favorited семей. Каждый item в списке имеет 2 действия: «Select» (добавить в `selectedIds`) и «Scroll» (scroll-to-mod через `data-family-key` + `scrollIntoView`).

```tsx
// FavoritesIndicator.tsx (extended)
export const FavoritesIndicator = ({ pinnedIds, favoritesList, onToggleTokens, onScrollToFamily }) => {
  const [isOpen, setIsOpen] = useState(false);
  // ... existing badge rendering ...
  return (
    <>
      <button onClick={() => setIsOpen(true)} className="...badge...">
        ★ Избранные аффиксы: {count}
      </button>
      {isOpen && createPortal(
        <FavoritesDialog
          favoritesList={favoritesList}
          onToggleTokens={onToggleTokens}
          onScrollToFamily={(familyKey) => {
            onScrollToFamily(familyKey);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />,
        document.body
      )}
    </>
  );
};
```

**Pros:**
- Минимальные изменения в FilterChip (не трогается).
- Список favorited семей в одном месте — удобно для overview.
- Можно добавить bulk actions («Select all favorites», «Clear all selections»).

**Cons:**
- **Зависит от KI#30** — favorites должны persist между вкладками чтобы quick-select имел смысл (иначе user lost favorites before he can click ★).
- NEW component `FavoritesDialog.tsx` (~150 строк) — additional maintenance.
- Dropdown UI pattern — нужно careful accessibility (focus trap, Escape close, click-outside).
- `FavoritesIndicator` нужно передать `favoritesList` (FamilyGroup[]) + `onToggleTokens` + `onScrollToFamily` callbacks — prop drilling через 7 page files.
- Dropdown может конфликтовать с mobile layout (нужно mobile-specific positioning).

**UX flow:**
1. User pins affix via ⭐ на FilterChip (existing behavior).
2. User click ★ badge в header → dialog открывается.
3. User see list of favorited семей (affix badge + displayText + tier count).
4. User click «Select» → family добавляется в selectedIds (regex output обновляется).
5. User click «Scroll» → dialog закрывается, scroll к family в ModList/VirtualizedModList.

**Risk level:** MEDIUM.

**Тест-план:**
1. Vitest: NEW `tests/ui/FavoritesDialog.test.tsx` — 10+ tests (open/close, list rendering, Select action, Scroll action, Escape close, click-outside close, accessibility).
2. Vitest: `tests/ui/FavoritesIndicator.test.tsx` — +3 tests (clickable, opens dialog, dialog receives correct props).
3. Browser testing: 7 pages × pin 1-2 families × click ★ badge → verify dialog opens, Select works, Scroll works.

---

#### Вариант (b) — Click ★ в FilterChip → toggle AND scroll-to-mod ⭐ RECOMMENDED

**Описание:** Расширить существующий ⭐ button на `FilterChip` (Phase 5 iter 136). Сейчас click только toggle pinned state. Новое поведение: toggle pinned + scroll-to-mod (если chip не в viewport).

```tsx
// FilterChip.tsx (extended Phase 5)
const handlePinClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  onTogglePinned(memberIds);
  
  // NEW: scroll-to-mod if chip is NOT in viewport (otherwise no scroll)
  const chip = e.currentTarget.closest('[data-family-key]') as HTMLElement;
  if (chip) {
    const rect = chip.getBoundingClientRect();
    const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!isInViewport) {
      chip.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Optional: trigger .favorite-pulse animation (already exists from iter 136)
      chip.classList.add('favorite-pulse');
      setTimeout(() => chip.classList.remove('favorite-pulse'), 2000);
    }
  }
};
```

**Pros:**
- **Минимальные изменения** — расширяет существующий ⭐ button, без NEW components.
- **Переиспользует Phase 5 infrastructure** — `data-family-key` attribute + `scrollIntoView` + `.favorite-pulse` CSS animation (всё из iter 136).
- **No prop drilling** — `FilterChip` уже имеет `memberIds` + `onTogglePinned`.
- **Соответствует mental model** — user click ★ → chip остается в фокусе (если виден) ИЛИ scroll к нему (если не виден).
- **Не зависит от KI#30** — работает даже без cross-tab persistence (favorites в current session).

**Cons:**
- ⭐ button теперь имеет 2 функции (toggle + scroll) — может confusing для user. Решение: tooltip «Pin/Unpin + scroll to mod» через `title` attribute.
- Scroll-to-mod на virtualized lists (belt/ring/amulet/jewel) может не работать если chip virtualized out of DOM. Решение (из iter 136): graceful degradation — `chip` будет null если virtualized out, no-op. Можно улучшить: scroll к sub-group header вместо chip (future enhancement).
- `e.currentTarget.closest('[data-family-key]')` — fragile если DOM structure меняется. Альтернатива: передать `familyKey` prop в FilterChip (уже есть `group.familyKey`).

**UX flow:**
1. User pins affix via ⭐ на FilterChip — scroll к chip если не в viewport.
2. User unpins affix via ⭐ — scroll к chip если не в viewport (для verify unpin).
3. User click ★ badge в header — ничего не происходит (BADGE остаётся pure presentational indicator).

**Risk level:** LOW.

**Тест-план:**
1. Vitest: `tests/ui/FilterChip.test.tsx` — +3 tests в Phase 5 describe block (scroll-to-mod when not in viewport, no scroll when in viewport, graceful degradation when chip not in DOM).
2. Browser testing: 7 pages × pin 1 family × scroll away × click ⭐ на another family в header — verify scroll back. Virtualized pages (belt/ring/amulet/jewel) — verify graceful degradation.

---

#### Вариант (c) — Отдельный «Favorites» tab/drawer

**Описание:** Добавить новый tab в TopNav (или drawer слева) «⭐ Избранное» со списком ВСЕХ favorited семей из ВСЕХ категорий. Click на family → navigate to category page + scroll-to-mod + auto-select.

**Pros:**
- Cross-category overview — user видит все favorites в одном месте.
- Можно добавить bulk actions + export/import.

**Cons:**
- **Высокая complexity** — NEW route `/favorites`, NEW page component, NEW TopNav tab (нарушает «9 URLs» SEO structure).
- **Зависит от KI#30** — без cross-tab persistence favorites из разных категорий невозможно собрать в одном place.
- TopNav уже имеет 9 tabs — добавление 10-го может сделать nav cramped на mobile.
- Не соответствует mental model «favorites per category» — user может ожидать что favorites для belt хранятся отдельно от favorites для ring.
- **Не рекомендуется** — cost/complexity слишком высокая для current requirements.

**UX flow:**
1. User navigates to /favorites tab.
2. User see list of all favorited семей across all categories (grouped by category).
3. User click family → navigate to category page + scroll-to-mod + auto-select.

**Risk level:** HIGH.

**Тест-план:**
1. Vitest: NEW `tests/ui/FavoritesPage.test.tsx` — 15+ tests.
2. Browser testing: full regression — nav, routing, SEO (sitemap.xml update), mobile layout.

---

#### Вариант (d) — Quick-select с диапазонами ⭐ RECOMMENDED (NEW, iter 143)

> **NEW variant added iter 143** после user feedback: «не думаю что будет удобно кликать по избранным аффиксам и смотреть как тебя скролит автоматически и кидает к чипу аффикса туда-сюда. То есть, я это видел изначально как список "быстрого доступа", когда ты часто пользуешься одним и тем же набором аффиксов и хочешь просто в несколько кликов выбрать нужные из них (хорошо бы чтобы и если были выбраны какие-либо значения в диапазоне аффикса, то чтобы они по умолчанию сохранялись в избранном).»

**Описание:** Превратить `FavoritesIndicator.tsx` (сейчас pure presentational ★ N badge) в clickable. При click открывается dropdown/panel (через `createPortal` в `document.body`, как `Tooltip.tsx` iter 137) со списком ВСЕХ favorited семей текущей категории. Каждый item в списке:
- Affix badge (ПРЕФ=blue/СУФ=orange/ИМПЛ=amber) — как SelectedBasket.
- Display text (familyKey template с подставленными диапазонами).
- **Quick-select button** — клик → добавляет ВСЕ tier-ы семьи в `selectedIds` (как клик на chip в ModList).
- **Range inputs** (если у семьи есть `##` placeholder) — два input'а «от» и «до». Если в `perTokenRanges` уже были значения для этой семьи — они **подставляются по умолчанию** (сохраняются в избранном).
- **Remove from favorites** (✗) — убирает из `pinnedIds`.

**Ключевая фича:** значения диапазона сохраняются в `poe2:favorites:<cat>:ranges` (расширение KI#30 variant a). При quick-select:
1. Аффикс добавляется в `selectedIds` (как обычный click на chip).
2. Если у аффикса есть диапазон И в favorites сохранены значения — они применяются к `perTokenRanges`.
3. Если значений нет — user может ввести их прямо в panel ИЛИ в chip после select.

**Зависимости:**
- **KI#30 (variant a)** ДОЛЖЕН быть реализован первым — favorites должны persist между сессиями чтобы quick-select имел смысл. Расширение storage format с `string[]` на `Array<{ id, range?: { min, max } }>` — см. §2 update ниже.
- **KI#32 (cascade expand)** ДОЛЖЕН быть исправлен первым — иначе quick-select на странице с раскрытыми sub-groups будет визуально ломаться.

**Pros:**
- Соответствует mental model user: «список быстрого доступа для часто используемых наборов аффиксов».
- Сохранение диапазонов — мощная фича для power users (например, «всегда выбирать +(30-40)% к сопротивлению чести»).
- Не требует scroll-to-mod (user явно отверг).
- Можно реализовать как extension `FavoritesIndicator` (минимальные изменения в FilterChip — ⭐ button остаётся как toggle только).

**Cons:**
- NEW component `FavoritesQuickSelectPanel.tsx` (~150-200 строк) — additional maintenance.
- Dropdown UI pattern — careful accessibility (focus trap, Escape close, click-outside).
- Зависит от KI#30 (storage format extension) + KI#32 (cascade fix) — должен быть реализован ПОСЛЕ них.
- Сохранение диапазонов усложняет storage format (был `string[]`, станет `Array<{ id, range?: { min, max } }>`).
- `FavoritesIndicator` нужно передать `favoritesList` (FamilyGroup[]) + `onToggleTokens` + `onSetTokenRange` + `onRemoveFavorite` callbacks — prop drilling через 7 page files.

**UX flow:**
1. User pins affix via ⭐ на FilterChip (existing behavior — toggle только, без scroll).
2. User click ★ N badge в header → открывается FavoritesQuickSelectPanel.
3. User видит список favorited семей с affix badge + displayText + range inputs (если есть `##`).
4. User click «Выбрать» на семье → семья добавляется в `selectedIds` + диапазон (если сохранён) применяется к `perTokenRanges`.
5. User может изменить диапазон в panel → сохраняется в `poe2:favorites:<cat>:ranges`.
6. User click ✗ на семье → убирается из favorites.
7. User click Escape / click-outside → panel закрывается.

**Risk level:** MEDIUM (NEW component + storage format extension, но LOW risk per file).

**Тест-план:**
1. Vitest: NEW `tests/ui/FavoritesQuickSelectPanel.test.tsx` — 12+ tests (open/close, list rendering, quick-select action, range inputs default values, range inputs persistence, remove from favorites, Escape close, click-outside close, accessibility).
2. Vitest: `tests/ui/FavoritesIndicator.test.tsx` — +3 tests (clickable, opens panel, panel receives correct props).
3. Vitest: `tests/store/local-settings.test.ts` — +3 tests для extended format `Array<{ id, range?: { min, max } }>`.
4. Browser testing: 7 pages × pin 1-2 families with range × click ★ badge → verify panel opens, quick-select works, range inputs default + persistence.

**Files to change (variant d):**
- NEW `src/ui/components/FavoritesQuickSelectPanel.tsx` (~150-200 строк).
- `src/ui/components/FavoritesIndicator.tsx` — добавить click handler + state + createPortal.
- `src/store/local-settings.ts` — extension storage format для ranges (см. §2 update).
- `src/ui/hooks/useCategoryPage.ts` — wiring `favoritesList` + `onSetTokenRange` + `onRemoveFavorite` callbacks.
- 7 page files — prop drilling (CategoryLayout `favorites` slot уже существует из Phase 5).
- `src/index.css` — dropdown styling (если не переиспользуем Tooltip.tsx portal pattern).

---

### §3 Recommendation

**Вариант (d) — Quick-select с диапазонами (NEW, iter 143).**

User явно отверг variant (b) (scroll-to-mod): «не думаю что будет удобно кликать по избранным аффиксам и смотреть как тебя скролит автоматически и кидает к чипу аффикса туда-сюда». Вместо этого user видит favorites как «список быстрого доступа» для часто используемых наборов аффиксов + сохранение диапазонов.

**Implementation order (iter 144):**
1. **KI#32 first** — cascade expand fix (blocking UX, ломает sub-groups — favorites panel будет визуально ломаться).
2. **KI#30 second** (variant a + extension) — per-category localStorage с расширенным format `Array<{ id, range?: { min, max } }>`.
3. **KI#31 third** (variant d) — FavoritesQuickSelectPanel с range inputs.
4. **KI#33 fourth** — VendorPage favorites wiring (после KI#31, переиспользует тот же pattern).
5. **KI#23 fifth** (variant b) — independent, можно в любой момент.

**Files to change (variant d):**
- NEW `src/ui/components/FavoritesQuickSelectPanel.tsx` (~150-200 строк).
- `src/ui/components/FavoritesIndicator.tsx` — clickable + createPortal.
- `src/store/local-settings.ts` — extended storage format.
- `src/ui/hooks/useCategoryPage.ts` — wiring callbacks.
- 7 page files — prop drilling.
- `src/index.css` — dropdown styling.

---

## §4. Implementation order recommendation (iter 144)

**Updated iter 143** после user feedback:

1. **KI#32 first (NEW, blocking UX)** — cascade expand fix. ~30-50 строк в `src/shared/mod-classifier.ts` (mode `affix-functional`) ИЛИ в `src/ui/components/ModList.tsx` + `VirtualizedModList.tsx` (sub-group key construction). Testing на 7 страницах.

2. **KI#30 second (variant a + extension)** — per-category localStorage с расширенным format `Array<{ id, range?: { min, max } }>`. ~40 строк (3 functions в `local-settings.ts` + wiring в `useCategoryPage.ts` + storage event listener для multi-tab sync).

3. **KI#31 third (variant d, NEW)** — FavoritesQuickSelectPanel с range inputs. ~150-200 строк NEW component + extensions в `FavoritesIndicator.tsx` + `useCategoryPage.ts` + 7 page files prop drilling.

4. **KI#33 fourth** — VendorPage favorites wiring. ~40-50 строк (⭐ pin slot в vendor FilterChip + FavoritesIndicator + KI#30 wiring).

5. **KI#23 fifth (variant b, independent)** — improved estimateSize per-row-state. ~20 строк в `VirtualizedModList.tsx`. Browser testing обязателен.

Каждое можно реализовать в отдельной итерации ИЛИ несколько в одной (если testing проходит). Главное — KI#32 → KI#30 → KI#31 в этом порядке (dependencies).

---

## §5. User questions — ANSWERED (iter 143)

Все 6 вопросов из iter 142 получили ответы в iter 143 — см. §0 таблицу выше. Краткое резюме:

| # | Вопрос | Answer | Решение |
|---|--------|--------|---------|
| Q1 | KI#23 partial fix OK? | ✅ Да | Variant (b) |
| Q2 | Fallback на (a) если (b) не хватит? | ✅ Сразу нормально | (b) с тест-планом |
| Q3 | Silent reset старого избранного? | ✅ Пофигу | Без миграции |
| Q4 | Realtime multi-tab sync? | ✅ Если стабильно | `storage` event, ~20 строк |
| Q5 | Формат хранения? | ✅ Простой массив | `string[]` (расширен до `Array<{id, range?}>` для KI#31) |
| Q6 | ⭐ button 2 функции? | ❌ Toggle только | **NEW variant (d)** — quick-select panel |

**Дополнительно user сообщил о 2 новых багах (KI#32, KI#33) — см. §8, §9 ниже.**

---

## §6. Constraints (per STATUS.md «Главные ограничения для iter 144»)

- **НЕ реализовывать TopNav dropdowns** — visualization keeps flat nav (per `docs/UI_AUDIT.md` §10 SUPERSEDED).
- **Если найден новый баг** — сначала документируй в STATUS.md как Known Issue, потом фиксий.
- **KI#23 fix требует careful browser testing** — лучше недоделать, чем сломать virtualization. Vitest недостаточен — обязательно user browser testing.
- **KI#32 fix требует testing на всех 7 страницах** — sub-groups могут вести себя по-разному в разных group modes (`affix-functional`, `jewel-functional`, `origin`, и т.д.).
- **KI#31 variant (d) — сначала реализовать quick-select panel БЕЗ range inputs, потом добавлять диапазоны**. Итеративно, не всё сразу.
- **KI#30 + KI#31 должны быть реализованы в порядке dependencies**: KI#32 → KI#30 → KI#31 (variant d) → KI#33.

---

## §7. References

- `STATUS.md` Known Issues #1 (KI#23), #2 (KI#30), #3 (KI#31), #4 (KI#32 NEW), #5 (KI#33 NEW).
- `AGENT_NAVIGATION.md` Pitfall 51 (iter 141 patterns: localStorage for cross-tab persistence, audit ALL similar components, counter semantic should match user mental model, empty placeholder elements are visual noise, monitoring a feature request is a valid outcome).
- `docs/UI_REFACTOR_PLAN.md` §13.6 (iter 141 reference) + §13.7 (iter 142/143 reference).
- `src/ui/components/VirtualizedModList.tsx` (KI#23 — `ROW_ESTIMATES` lines 149-155, `estimateSize` lines 567-571 + 845-849).
- `src/store/local-settings.ts` (KI#30 — iter 141 infrastructure, extensible до per-category favorites + ranges).
- `src/store/filter-store.ts` (KI#30 — `pinnedIds` field, `togglePinned`/`clearPinned` actions, URL serialization через `pn` key).
- `src/ui/components/FavoritesIndicator.tsx` (KI#31 variant d — нужно сделать clickable + createPortal для quick-select panel).
- `src/ui/components/FilterChip.tsx` (KI#31 — ⭐ button handlePinClick, остаётся как toggle только).
- `src/index.css` (KI#31 — `.favorite-pulse` animation из iter 136, переиспользуется для visual feedback).
- `src/shared/mod-classifier.ts` (KI#32 — mode `affix-functional` line 2090 `key: block`, нужно добавить origin в ключ).
- `src/ui/components/ModList.tsx` (KI#32 — line 449/481 `${topLevelKey}:${sg.key}`, нужно добавить origin).
- `src/ui/components/VirtualizedModList.tsx` (KI#32 — line 232 `${topKey}:${sg.key}`, нужно добавить origin).
- `src/ui/pages/vendor/VendorPage.tsx` (KI#33 — custom FilterChip без ⭐ pin slot, нужно добавить).

---

## §8. KI#32 — Cascade expand одинаковых sub-group ключей (NEW, iter 143)

### Симптом

При раскрытии sub-группы (например, «Уровень умений» в разделе «обычных» аффиксов на странице Ring) раскрываются ВСЕ sub-группы с тем же названием в других разделах (очерненных, оскверненных, разлома). User: «я раскрываю категорию "уровень умений" в разделе "обычных" аффиксов ----> и мне на странице сразу раскрывает все категории "уровней умений" не только в разделе обычных, но и очерненных, оскверненных и разлома».

### Root cause

Sub-group ключ строится как `${categoryId}:${affix}:${sg.key}` где `sg.key` — это название функционального блока (например, `skill-levels`). Когда в одной категории (например, ring) в префиксе есть `skill-levels` в normal/corrupted/desecrated — все получают **одинаковый** ключ `ring:prefix:skill-levels`. Toggle одного → toggle всех (поиск в Set `expandedSubGroups`).

Файлы:
- `src/shared/mod-classifier.ts` line 2090 (`affix-functional` mode): `key: block` — block это просто название функционального блока без origin.
- `src/ui/components/ModList.tsx` line 449/481: `subGroupKey={topLevelKey ? \`${topLevelKey}:${sg.key}\` : undefined}` — topLevelKey это `${categoryId}:${affix}`.
- `src/ui/components/VirtualizedModList.tsx` line 232: `const subKey = topKey ? \`${topKey}:${sg.key}\` : undefined;` — то же самое.

### Варианты решения

#### Вариант (a) — Добавить origin в ключ ⭐ RECOMMENDED

**Описание:** Модифицировать конструктор ключа: `${categoryId}:${affix}:${origin}:${sg.key}`. Origin уже определён для каждого FamilyGroup (через `splitGroupByOrigin`). При `affix-functional` mode — добавить origin-aware sub-grouping.

Реализация:
1. В `src/shared/mod-classifier.ts` mode `affix-functional` — если группа имеет mixed origins, split по origin first, потом classify по functional block. Каждый получившийся sub-group получает `key: \`${origin}:${block}\`` (например, `normal:skill-levels`, `corrupted:skill-levels`).
2. В `src/ui/components/ModList.tsx` + `VirtualizedModList.tsx` — sub-group key construction не меняется (всё ещё `${topLevelKey}:${sg.key}`), но `sg.key` теперь уникален.

**Pros:**
- Уникальные ключи — нет cascade expand.
- Соответствует mental model: «Уровень умений в обычных» ≠ «Уровень умений в оскверненных».
- Origin уже есть в данных — не нужно новое API.

**Cons:**
- Может сломать URL serialization (`es` compact key в filter-store.ts) — старые ссылки с `es=ring:prefix:skill-levels` перестанут работать (тихий reset, acceptable per Q3).
- Нужно testing на всех 7 страницах — разные group modes (`affix-functional`, `jewel-functional`, `origin`, `affix-sentiment-subblocks`, и т.д.).
- Может потребовать update FUNCTIONAL_BLOCK_ORDER если origin-split меняет visual order.

**Risk level:** MEDIUM (логика classifier меняется, но UI компоненты не трогаются).

**Тест-план:**
1. Vitest: `tests/shared/mod-classifier.test.ts` — +5-8 tests для origin-aware sub-grouping в `affix-functional` mode.
2. Vitest: regression tests — все existing tests с `expandedSubGroups` должны проходить (или обновиться под новый ключ).
3. Browser testing (user):
   - 7 страниц × раскрыть sub-group в normal → проверить что в corrupted/desecrated НЕ раскрылось.
   - 7 страниц × раскрыть sub-group в corrupted → проверить что в normal НЕ раскрылось.

#### Вариант (b) — Использовать unique index из classifyGroups

**Описание:** В `classifyGroups()` возвращать `sg.key` как уникальный index (например, `${block}#${counter}` где counter инкрементируется для каждого уникального origin).

**Pros:**
- Минимальные изменения в classifier.

**Cons:**
- Ключи становятся нечитаемыми (`skill-levels#0`, `skill-levels#1`) — плохо для debugging.
- URL serialization станет нечитаемой.
- Плохо для SEO если ключи попадают в DOM.

**Risk level:** LOW, но не рекомендуется (bad DX).

#### Вариант (c) — Менять ModSubGroup.key на origin-aware в `affix-functional` mode

**Описание:** Same as (a), но explicit — в `affix-functional` mode всегда prepend origin: `key: \`${origin}:${block}\``.

**Pros/Cons:** Same as (a), но explicit (лучше для readability).

### §8 Recommendation

**Вариант (a) — Добавить origin в ключ.** Реализовать в iter 144 ПЕРВЫМ (до KI#30/31), потому что favorites panel (KI#31 variant d) будет визуально ломаться на странице с раскрытыми sub-groups если cascade expand не исправлен.

**Files to change:**
- `src/shared/mod-classifier.ts` — mode `affix-functional` (line 2074-2098): origin-aware sub-grouping.
- `tests/shared/mod-classifier.test.ts` — +5-8 tests.
- Возможно `src/ui/components/ModList.tsx` + `VirtualizedModList.tsx` — minor adjustments if sub-group key construction breaks.

---

## §9. KI#33 — Favorites не реализованы на VendorPage (NEW, iter 143)

### Симптом

VendorPage использует custom FilterChip без ⭐ pin slot. Известно с iter 136 (Phase 5), deferred. iter 143 user явно отметил: «прямо сейчас возможность выбрать аффикс в избранное не на всех вкладках реализовано».

### Root cause

`src/ui/pages/vendor/VendorPage.tsx` — использует custom FilterChip (не общий `src/ui/components/FilterChip.tsx`), который не имеет ⭐ pin slot. FavoritesIndicator не рендерится. `pinnedIds`/`togglePinned`/`clearPinned` не wired.

### Варианты решения

Только один разумный вариант — расширить vendor FilterChip:
1. Добавить ⭐ pin slot в vendor FilterChip (по образцу общего FilterChip из Phase 5 iter 136).
2. Рендерить FavoritesIndicator в VendorPage header.
3. Wire `pinnedIds`/`togglePinned`/`clearPinned` через `useCategoryPage()`.
4. После KI#30 — wire per-category localStorage persistence.
5. После KI#31 variant (d) — добавить clickable FavoritesIndicator → quick-select panel.

**Зависимости:**
- KI#30 — для cross-tab persistence.
- KI#31 variant (d) — для quick-select panel (vendor FilterChip должен поддержать тот же UX pattern).

**Risk level:** LOW (расширение existing pattern, не NEW architecture).

**Тест-план:**
1. Vitest: `tests/ui/VendorPage.test.tsx` (NEW или extension) — +5 tests для favorites wiring.
2. Browser testing: pin 1-2 affixes на VendorPage → navigate → return → favorites на месте.

### §9 Recommendation

**Реализовать ПОСЛЕ KI#31 variant (d).** ~40-50 строк (⭐ pin slot в vendor FilterChip + FavoritesIndicator + KI#30 localStorage wiring + KI#31 quick-select panel integration).

**Files to change:**
- `src/ui/pages/vendor/VendorPage.tsx` — wire `pinnedIds`/`togglePinned`/`clearPinned` + FavoritesIndicator.
- Vendor-specific FilterChip (inline в VendorPage.tsx или отдельный файл) — добавить ⭐ pin slot.
- `tests/ui/VendorPage.test.tsx` — +5 tests.
- `src/ui/components/FilterChip.tsx` (KI#31 — ⭐ button handlePinClick, `data-family-key` attribute, `stopPropagation`).
- `src/index.css` (KI#31 — `.favorite-pulse` animation из iter 136).

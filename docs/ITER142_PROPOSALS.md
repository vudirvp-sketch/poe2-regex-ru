# iter 142 Design Proposals — KI#23 / KI#30 / KI#31

> **Status:** iter 142 — design proposals подготовлены для user review. **Реализация отложена на iter 143+** после выбора варианта.
> **Источник:** STATUS.md Known Issues #1 (KI#23), #2 (KI#30), #3 (KI#31).
> **Контекст:** AGENT_NAVIGATION.md Pitfall 51 (iter 141 patterns).
> **Принцип:** «лучше недоделать, чем сломать» — все 3 KI требуют либо careful browser testing (KI#23), либо UX design решения от user (KI#30/31). Реализация без discussion была бы guesswork.

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

### §3 Recommendation

**Вариант (b) — Click ★ в FilterChip → toggle AND scroll-to-mod.**

Обоснование:
- Минимальный risk — расширяет существующий ⭐ button, без NEW components.
- Переиспользует Phase 5 infrastructure (`data-family-key` + `scrollIntoView` + `.favorite-pulse`).
- Не зависит от KI#30 — работает в current session даже без cross-tab persistence.
- Соответствует mental model «click ★ → chip остается в фокусе».
- Можно реализовать в одном файле (`FilterChip.tsx`), один handler.

**Implementation order:**
1. Сначала обсудить с user — устраивает ли что ⭐ button имеет 2 функции (toggle + scroll), или user хочет разделить на 2 кнопки.
2. Если user OK с 2 функциями — реализовать вариант (b).
3. Browser testing пользователем — pin family, scroll away, click ⭐ на another family, verify scroll back.
4. Если user хочет separate «favorites overview» — рассмотреть вариант (a) как future enhancement (после KI#30).

**Files to change (variant b):**
- `src/ui/components/FilterChip.tsx` — extend `handlePinClick` с scroll-to-mod logic (~15 строк).
- `tests/ui/FilterChip.test.tsx` — +3 tests в Phase 5 describe block.

---

## §4. Implementation order recommendation

Если user approve все 3 recommendations (b/a/b):

1. **KI#23 first** (variant b — improved estimateSize) — independent, lowest risk, можно реализовать и test изолированно.
2. **KI#30 second** (variant a — per-category localStorage) — расширяет iter 141 infrastructure, independent от KI#23.
3. **KI#31 third** (variant b — click ★ → toggle + scroll) — формально independent, но semantic лучше если KI#30 уже реализован (favorites persist → quick-select имеет смысл).

Каждое можно реализовать в отдельной итерации (iter 143, 144, 145 соответственно) ИЛИ все три в одной iter 143 если user approve.

---

## §5. User questions for iter 143 planning

Перед реализацией нужно обсудить с user:

### KI#23 questions:
1. **Q1:** Устраивает ли partial fix (уменьшение jitter, не полное устранение) через improved estimateSize? Или обязательно полное устранение (тогда вариант (a) с max-height + overflow:hidden, но теряем гибкость)?
2. **Q2:** Если jitter останется после варианта (b) — нужно ли добавлять option (a) как fallback (max-height + overflow:hidden на subgroup rows)?

### KI#30 questions:
3. **Q3:** Silent reset существующих favorites acceptable? Или нужна migration script (старые `pn` URL key → новые per-category localStorage keys)?
4. **Q4:** Realtime multi-tab sync (через `storage` event listener) нужна? Или достаточно что favorites persist при reload?
5. **Q5:** Format `string[]` (только token IDs) OK, или нужно rich format `Array<{ id, familyKey, affixType, pinnedAt }>` для future features (например, sort by pinnedAt)?

### KI#31 questions:
6. **Q6:** ⭐ button имеет 2 функции (toggle + scroll) OK? Или нужно разделить на 2 отдельные кнопки (⭐ toggle + ↗ scroll)?

---

## §6. Constraints (per STATUS.md «Главные ограничения для iter 143»)

- **НЕ реализовывать TopNav dropdowns** — visualization keeps flat nav (per `docs/UI_AUDIT.md` §10 SUPERSEDED).
- **Если найден новый баг** — сначала документируй в STATUS.md как Known Issue, потом фиксий.
- **KI#23 fix требует careful browser testing** — лучше недоделать, чем сломать virtualization. Vitest недостаточен — обязательно user browser testing.
- **KI#30/31 требуют UX design решения** — сначала обсудить с user (через этот document), потом реализовывать.

---

## §7. References

- `STATUS.md` Known Issues #1 (KI#23), #2 (KI#30), #3 (KI#31).
- `AGENT_NAVIGATION.md` Pitfall 51 (iter 141 patterns: localStorage for cross-tab persistence, audit ALL similar components, counter semantic should match user mental model, empty placeholder elements are visual noise, monitoring a feature request is a valid outcome).
- `docs/UI_REFACTOR_PLAN.md` §13.6 (iter 141 reference) + §13.7 (iter 142 reference).
- `src/ui/components/VirtualizedModList.tsx` (KI#23 — `ROW_ESTIMATES` lines 149-155, `estimateSize` lines 567-571 + 845-849).
- `src/store/local-settings.ts` (KI#30 — iter 141 infrastructure, extensible до per-category favorites).
- `src/store/filter-store.ts` (KI#30 — `pinnedIds` field, `togglePinned`/`clearPinned` actions, URL serialization через `pn` key).
- `src/ui/components/FavoritesIndicator.tsx` (KI#31 — pure presentational, click handler NONE).
- `src/ui/components/FilterChip.tsx` (KI#31 — ⭐ button handlePinClick, `data-family-key` attribute, `stopPropagation`).
- `src/index.css` (KI#31 — `.favorite-pulse` animation из iter 136).

# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 146 (KI#36 favorites grouping + KI#37 origin badge + KI#38 jitter CSS)
Agent: main
Task: iter 146 — исправление 3 user-reported багов: (1) панель избранных не показывает закреплённые аффиксы (особенно non-normal origin), (2) нет бейджа origin в панели, (3) scroll jitter на jewels tab остался после iter 145. Baseline: vitest 2247/2247. Result: vitest 2252/2252 (+5 new tests for KI#36).

Work Log:
- 1: **Baseline + анализ** — клонировал репозиторий, прочитал STATUS.md (iter 145), FavoritesIndicator.tsx, FavoritesQuickSelectPanel.tsx, FilterChip.tsx, useCategoryPage.ts, family-grouper.ts, VirtualizedModList.tsx. Проверил данные: в merged jewel.json (normal + desecrated + corrupted) 29 семей имеют несколько origin-вариантов — это сценарий бага.
- 2: **Root cause KI#36 (favorites panel grouping bug)** — `FavoritesQuickSelectPanel.tsx` группировал токены по чистому `${affix}:${familyKey.ru}` (без origin-split), тогда как FilterChip рендерится через `splitGroupByOrigin`. Когда user закреплял desecrated/corrupted вариант, `pinnedIds` содержал ID desecrated-токена, но `members[0]` объединённой группы был normal-токен (первый в порядке `data.tokens`). Mismatch → семья не появлялась в панели. Также displayText был `members[0].rawText.ru` (normal-вариант), а не закреплённый origin.
    - **Fix:** переписан `favoritedFamilies` useMemo — теперь использует canonical `groupTokensByFamily(data.tokens)` + `splitGroupByOrigin(group)` из `@shared/family-grouper`. Проверка pinned: `splitGroup.members.some(m => pinnedIds.has(m.id))` (любой member, не только первый). Возвращает `Array<{ origin: ModOrigin; group: FamilyGroup }>` — каждая запись соответствует конкретному (family, origin) tuple, который user реально закрепил.
    - **Effect:** панель корректно показывает закреплённый desecrated/corrupted вариант с правильным displayText (substituted familyKey, scoped to origin).
- 3: **KI#37 (origin badge)** — добавлен `ORIGIN_BADGE: Partial<Record<ModOrigin, ...>>` с короткими лейблами (ОЧЕРН/ОСКВ/СУЩН/РАЗЛ) и цветами. Badge рендерится рядом с affix-бейджем только для non-normal origins (normal implied). Aria-label: `Происхождение: <t('origin.<origin>')>`.
- 4: **KI#38 (scroll jitter CSS containment)** — добавлен `contain: layout style paint` на `.virtualized-mod-list [data-index]` (виртуальные ряды). Изолирует layout reflow — measurement update одного ряда не форсирует синхронный re-layout соседних. Безопасное подмножество (`strict` добавляет `size` → virtual rows с dynamic height зануляются, нельзя). Browser support: Chrome 52+, Firefox 69+, Safari 15.4+.
- 5: **Tests** — обновлён `tests/ui/FavoritesIndicator.test.tsx`:
    - Fixture `makeCategoryData()` переписан с `#` placeholder в familyKey (realistic shape). displayText теперь substituted (e.g., `+(10—50) к сопротивлению огню`).
    - NEW `makeMultiOriginCategoryData()` — семья `+#% к сопротивлению` с normal + desecrated variants.
    - 5 новых тестов в `describe('iter 146 (KI#36) multi-origin grouping')`: pinning desecrated показывает в панели (regression guard), origin badge для non-normal, hidden для normal, both variants → 2 entries, «Выбрать» на desecrated → только desecrated member IDs.
    - Существующие 13 тестов адаптированы под новый displayText (rawText → substituted familyKey).
- 6: **Verification** — eslint 0 на изменённых файлах, vitest 2252/2252 (56 files), vite build succeeds. Пред-существующие 6 TypeScript errors в `VirtualizedModList.tsx` (от iter 145 — `row.affix` на origin-header/jewel-type-header + `shouldAdjustScrollPositionOnItemSizeChange` не в типе) НЕ тронуты — выходят за рамки задачи.
- 7: **Documentation** — STATUS.md обновлён под iter 146 (3 KI в таблице + архитектурные изменения + Known Issues + Next iter 147). worklog.md сжат — оставлены только iter 146 (подробно) + iter 145/144/... одной строкой.

Stage Summary:
- KI#36 FIXED: панель избранных теперь корректно показывает закреплённые non-normal origin variants (29 multi-origin семей в jewel.json).
- KI#37 FIXED: origin badge (ОЧЕРН/ОСКВ/СУЩН/РАЗЛ) рядом с affix badge для non-normal origins.
- KI#38 APPLIED: CSS `contain: layout style paint` для изоляции virtual row layout — низкий риск, browser support широкий.
- Persistence проверено: pinnedIds → `poe2:favorites:<cat>` localStorage, ranges → `poe2:favorites:<cat>:ranges`, profiles → `poe2-regex-profiles` (zustand persist), multi-tab sync через `storage` event.
- Изменённые файлы: `src/ui/components/FavoritesQuickSelectPanel.tsx`, `tests/ui/FavoritesIndicator.test.tsx`, `src/index.css`, `STATUS.md`, `worklog.md`
- vitest 2252/2252 (+5 new tests), eslint 0, vite build OK
- **Stopping point:** Готово к browser testing. Если jitter остаётся — iter 147 вариант (a) static row heights.

---

Task ID: 145 — KI#34 scroll doubling (shouldAdjustScroll=false + stable getItemKey + overscan 5 + items-start) + KI#35 expand/collapse all keys (origin/jewelType в subKey). Файлы: VirtualizedModList.tsx, ModList.tsx, STATUS.md. vitest 2247/2247.

Task ID: 144 — 5 KI: KI#32 cascade expand fix, KI#30 per-category localStorage favorites, KI#31 variant (d) quick-select panel, KI#33 VendorPage favorites, KI#23 variant (b) scroll jitter estimate. vitest 2247/2247 (+57 new tests).

Task ID: ≤143 — см. git log. Полная история в `git log --oneline`.

# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 106
Agent: main
Task: P4 — tier-aware sort toggle (alpha vs tier-first) в CategoryControlPanel. iter 99 сделал tier вторичным tiebreaker'ом в within-block sort, но UI-тумблер не добавил. iter 106 закрывает UX-долг: пользователь может переключаться между alphabetical flow (iter 99 default) и tier-first (legacy pre-iter-99, surfaces S-tier first). Минимальный риск: новый опциональный SortMode тип, опциональный 3-й аргумент в classifyGroups (default 'alpha' — backward compat со всеми существующими tests), UI-toggle только на страницах с priority classification.

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 105 — tablet sub-blocks, 1500/1500), worklog.md (iter 105 подробно), AGENT_NAVIGATION.md (entry iter 105 + Roadmap + Pitfall #34). Подтверждение baseline: `npx vitest run` → 1500/1500; `npx tsc -b` → 0 errors; `npx eslint .` → 0 problems. Выбор scope: только P4 (tier-aware sort toggle). Опциональные пункты (sortKey, waystone neutral-generic, tablet Разломы vs Бездна) отложены в iter 107+.
- 2: Анализ архитектуры. `sortGroupsAlphabetically()` (iter 99) — единственная точка within-block sort. `withAlphabeticalGroups()` применяет её ко всем sub-groups перед return из `classifyGroups()`. `classifyGroups()` имеет 11 веток режимов, каждая возвращает `withAlphabeticalGroups(result)` → единая post-processing точка. `useCategoryPage` уже имеет pattern для URL-persist через `extraState` (priorityFilter как референс). Дизайн: добавить `SortMode = 'alpha' | 'tier-first'` type → `sortGroupsByTierFirst()` функция → `sortGroupsByMode()` dispatch → `withSortedGroups(result, sortMode)` rename (default 'alpha') → `classifyGroups()` += опциональный 3-й аргумент → `ModList`/`VirtualizedModList` += опциональный prop → `useCategoryPage` += useState + URL-sync + restore → `CategoryControlPanel` += radio-group UI → 6 category pages wire toggle → tests.
- 3: Type system. `src/shared/types.ts` — добавлен `export type SortMode = 'alpha' | 'tier-first';` с подробным JSDoc (iter 106 P4 reference, default 'alpha', persistence note).
- 4: Sort logic. `src/shared/mod-classifier.ts`:
  - Импорт `SortMode` из `./types`.
  - Добавлена `sortGroupsByTierFirst(groups)` функция — mirror `sortGroupsAlphabetically()` архитектуры (new array, ref preservation, length ≤ 1 short-circuit, `::origin` stripping), но comparator: tier primary (S→A→B→C), familyKey alpha tiebreaker.
  - Добавлена `sortGroupsByMode(groups, mode = 'alpha')` dispatch entry point — внешние callers используют её.
  - `withAlphabeticalGroups()` переименована в `withSortedGroups(result, sortMode = 'alpha')` — пробрасывает sortMode в `sortGroupsByMode()`.
  - Все 11 `withAlphabeticalGroups(...)` вызовов в `classifyGroups()` заменены на `withSortedGroups(..., sortMode)`. Python-скрипт `patch_with_sorted_groups.py` автоматически патчит (находит `withSortedGroups(`, walk-forward к matching `)`, inject `, sortMode` перед closing paren). Skipped 1 вызов в `affix-only` ветке (там я вручную прописал `sortMode` для consistency с JSDoc комментом).
  - `classifyGroups()` signature: `classifyGroups(groups, mode, sortMode: SortMode = 'alpha')`. Default 'alpha' = iter 99 backward compat.
- 5: UI компоненты. `src/ui/components/ModList.tsx` + `src/ui/components/VirtualizedModList.tsx`:
  - Import `SortMode` из `@shared/types`.
  - `interface ModListProps` / `interface VirtualizedModListProps` += опциональный `sortMode?: SortMode` с JSDoc.
  - Destructuring `sortMode = 'alpha'` default.
  - `splitByOriginThenSemantic()` + `buildColumnRows()` += `sortMode: SortMode = 'alpha'` параметр, пробрасывается в `classifyGroups()`.
  - Все `classifyGroups(...)` вызовы внутри компонентов пробрасывают `sortMode` (включая `renderJewelTypeSubGroups` и origin-mode fallback render в ModList).
  - Все `useMemo` deps обновлены: `sortMode` добавлен к `[implicitGroups, groupMode, sortMode]` etc.
- 6: useCategoryPage hook. `src/ui/hooks/useCategoryPage.ts`:
  - Import `SortMode` из `@shared/types`.
  - `UseCategoryPageResult` interface += `sortMode: SortMode` + `setSortMode: (v: SortMode) => void` с JSDoc.
  - `useState<SortMode>` lazy-init из `useStore.getState().getExtraState('sortMode')` (defaults 'alpha' on bad/absent value). Размещён после `priorityFilter` useState — mirror pattern.
  - URL-sync `useEffect`: добавлен `useStore.getState().setExtraState('sortMode', sortMode);` + `sortMode` в deps array. Комментарий обновлён (iter 106 P4 reference).
  - `restoreFilterState()`: добавлен restore block для `sortMode` из restored extraState (defaults 'alpha' on bad value).
  - Return value += `sortMode, setSortMode`.
- 7: UI-toggle в CategoryControlPanel. `src/ui/components/CategoryControlPanel.tsx`:
  - Import `SortMode`.
  - `interface CategoryControlPanelProps` += `sortMode?: SortMode`, `setSortMode?: (v: SortMode) => void`, `showSortMode?: boolean` с JSDoc.
  - Destructuring `sortMode = 'alpha'`, `setSortMode`, `showSortMode`.
  - `sortOptions` array для arrow-key navigation (mirror `priorityOptions` pattern): `[{value: 'alpha', action: ...}, {value: 'tier-first', action: ...}]`.
  - Render: radio-group с 2 кнопками после `priorityFilter` блока. ARIA: `role="radiogroup"`, `aria-label={t('sort.label')}`, `aria-checked`, arrow-key handler. Visual: `bg-raised text-bright` для active alpha (neutral), `bg-amber-700 text-bright` для active tier-first (deeper amber — соответствует S+A tier button color, signals «priority-based»).
- 8: i18n labels. `src/shared/i18n.ts`:
  - `sort.label`: 'Сортировка:'
  - `sort.alpha`: 'По алфавиту'
  - `sort.tier_first`: 'По приоритету'
- 9: Wire 6 category pages. Для каждой страницы (`BeltPage`, `AmuletPage`, `RingPage`, `WaystonePage`, `TabletPage`, `JewelPage`):
  - Destructuring из `useCategoryPage` += `sortMode, setSortMode`.
  - `<CategoryControlPanel>` += `sortMode={sortMode} setSortMode={setSortMode} showSortMode` (размещён после `showPriorityFilter` — conceptually related: priorityFilter решает КАКИЕ tier'ы показывать, sortMode решает КАК их сортировать).
  - `<VirtualizedModList>` или `<ModList>` += `sortMode={sortMode}` (размещён после `priorityFilter`).
  - Relic/Vendor pages НЕ затронуты (нет `showPriorityFilter` — sortMode там не нужен).
- 10: Tests. `tests/shared/mod-classifier.test.ts`:
  - Import += `sortGroupsByTierFirst, sortGroupsByMode` из `@shared/mod-classifier` + `SortMode` из `@shared/types`.
  - +22 новых тестов в 3 новых `describe` блоках:
    - `sortGroupsByTierFirst (iter 106 P4)` (8 tests): new-array, ref-preservation, empty/single edge cases, tier-primary sort (S→A→B→C на same familyKey), alpha-tiebreaker (same tier S → alpha), tier-first-vs-alpha difference regression (Сила S + Ловкость S + Интеллект A — alpha vs tier-first differ), `::origin` stripping (tier primary + alpha tiebreaker), all-tiers S→A→B→C across distinct families.
    - `sortGroupsByMode (iter 106 P4 — dispatch entry point)` (5 tests): default 'alpha' backward compat, 'alpha' delegates to sortGroupsAlphabetically, 'tier-first' delegates to sortGroupsByTierFirst, no-mutation в обоих режимах, empty-array edge cases.
    - `classifyGroups respects sortMode argument (iter 106 P4)` (9 tests): default alpha (no 3rd arg) backward compat, tier-first surfaces S-tier first в `affix-functional`/`jewel-functional`/`relic-semantic`/`tablet-type-subblocks`/`affix-sentiment-subblocks`, alpha-explicit matches default, ref-preservation в обоих режимах. 1 тест упал на initial run (`jewel-functional` + `weapon-specific` — weapon-class sub-blocks требуют полного ETL-контекста) → упрощён до `attributes` block (functional category, доступная в unit-test без ETL).
- 11: Верификация. `npx vitest run` → **1522/1522** (было 1500, +22). `npx tsc -b` → 0 errors. `npx eslint .` → 0 problems. ETL не запускался — `public/generated/*.json` не тронуты (verified via `git status`).
- 12: Документация:
  - `STATUS.md` — iter 106 как текущая; «Что сделано» (детальный список всех 8 затронутых файлов + 6 pages); «Метрики» (1522/1522, +22); Known Issues без изменений (только #1 и #2 остаются); «Открытые долги» обновлены — P4 closed, sortKey + waystone neutral-generic + tablet Разломы vs Бездна остаются; runtime-метрики таблица без изменений.
  - `worklog.md` — iter 105 сжат до одной строки, iter 106 добавлен подробно.
  - `AGENT_NAVIGATION.md` — entry paragraph bumped до iter 106 (P4 sort toggle); Roadmap iter 106 done + обновлён optional-список (P4 closed, остаются только low-priority).

Stage Summary:
- **iter 106 COMPLETE.** P4 — tier-aware sort toggle реализован. UI-тумблер «Сортировка: По алфавиту / По приоритету» в `CategoryControlPanel` на 6 страницах (ring/amulet/belt/jewel/waystone/tablet). URL-persistent через `extraState.sortMode` (shareable links + profile restore). Default `'alpha'` — iter 99 backward compat со всеми 1500 существующими тестами.
- **Изменённые файлы (12):**
  - `src/shared/types.ts` — +14 строк (SortMode type + JSDoc).
  - `src/shared/mod-classifier.ts` — +85 строк (sortGroupsByTierFirst + sortGroupsByMode + withSortedGroups rename, classifyGroups += 3-й аргумент, все 11 веток пробрасывают sortMode).
  - `src/ui/components/ModList.tsx` — +12 строк (sortMode prop + classifyGroups/splitByOriginThenSemantic проброс + useMemo deps).
  - `src/ui/components/VirtualizedModList.tsx` — +12 строк (sortMode prop + buildColumnRows проброс + useMemo deps).
  - `src/ui/hooks/useCategoryPage.ts` — +25 строк (useState + URL-sync + restoreFilterState + return value).
  - `src/ui/components/CategoryControlPanel.tsx` — +50 строк (3 props + radio-group UI с arrow-key navigation).
  - `src/shared/i18n.ts` — +4 строки (3 ключа + комментарий).
  - `src/ui/pages/belt/BeltPage.tsx` — +5 строк (sortMode wire).
  - `src/ui/pages/amulet/AmuletPage.tsx` — +5 строк.
  - `src/ui/pages/ring/RingPage.tsx` — +5 строк.
  - `src/ui/pages/waystone/WaystonePage.tsx` — +5 строк.
  - `src/ui/pages/tablet/TabletPage.tsx` — +5 строк.
  - `src/ui/pages/jewel/JewelPage.tsx` — +5 строк.
  - `tests/shared/mod-classifier.test.ts` — +220 строк (+22 теста в 3 новых describe блоках).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — документация актуализирована.
- **Тесты:** 1522/1522 (+22 vs iter 105). TSC: 0 errors. ESLint: **0 errors + 0 warnings**. ETL: 11 fresh, 0 stale. Никаких изменений в `public/generated/*.json`, ETL, runtime functional-classifier, схеме.
- **Точка остановки:** iter 106 done. P4 (tier-aware sort toggle) закрыт. В iter 107+ можно:
  1. **Опционально: `sortKey?: number`** в `FamilyGroup` + ETL заполнение для «по популярности внутри категории» — third sort mode (alpha / tier-first / popularity).
  2. **Опционально (low-priority): Waystone neutral-generic (6 groups)**: 5 desecrated Breach-adjacent mods можно расширить POSITIVE_KEYWORDS, чтобы их поймать. Low-priority.
  3. **Опционально (low-priority): Tablet Разломы vs Бездна**: 2 mods используют «Разлом» вместо «Бездна» и классифицируются как generic. Можно расширить BREACH_KEYWORDS, чтобы их поймать — но это изменило бы type distribution. Low-priority — текущая sub-block classification корректна.
  4. **Возможное расширение P4**: добавить visual indicator (tier-colored left border) для S-tier модов в tier-first mode — улучшит scannability. Опционально.
- **Подсказка следующему агенту:** iter 106 = P4 sort toggle (alpha vs tier-first), runtime functional-classifier / ETL / JSON / схема не тронуты. Baseline: 1522/1522 tests, TSC 0, ESLint **0 problems**. Перед стартом iter 107 прочитай STATUS.md (актуальный статус + Known Issues — только #1 и #2 остаются, оба intentional), worklog.md (iter 106 подробно + предыдущие одной строкой), AGENT_NAVIGATION.md (entry paragraph iter 106, Roadmap iter 106 done). Не создавай новые verify-iter*-*.ts скрипты — покрывай проверки через tests/ (vitest) или inline sanity в worklog.md (правило iter 100). Если добавляешь новый sort mode (e.g. popularity), расширь `SortMode` union + `sortGroupsByMode()` dispatch + `CategoryControlPanel` radio-group + `useCategoryPage` URL-persist pattern.

---

## Предыдущие итерации (кратко)

- **iter 105**: P2 second half — tablet sub-blocks. Новый режим `tablet-type-subblocks` с 19 sub-blocks. 1500/1500 tests.
- **iter 104**: P2 first half — waystone sub-blocks + Known Issue #5 fix. Новый режим `affix-sentiment-subblocks` с 9 sub-blocks. 1472/1472 tests.
- **iter 103**: подавление 2 TanStack library-level ESLint warnings — Known Issue #3 закрыт. 1431/1431 tests.
- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline — 17 тестов в `tests/integration/runtime-classification.test.ts`. 1431/1431 tests.
- **iter 101**: P0-фикс Critical Bug — `GameTokenSchema` без `functionalCategory` → Zod strips → runtime classifier падал в `other`. +3 регрессионных теста. 1414/1414 tests.
- **iter 99**: alphabetical within-block sort. `sortGroupsAlphabetically()` + `withAlphabeticalGroups()` wrapper для всех 9 режимов. +19 unit-тестов. 1411/1411 tests.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий для 25 family-keys). 1392/1392 tests.
- **iter 97**: Аудиторская чистка тестов и исторических скриптов. 16 файлов удалено. 1363/1363 tests.
- **iter 96**: Удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`. 1363/1363 tests.
- **iter 95**: Документационная чистка + deprecation-маркер для regex-паттернов. 1363/1363 tests.
- **iter 94**: AILMENTS tag-priority refactor. 26 модов реклассифицированы damage-type → ailments. 1363/1363 tests.
- **iter 93**: penetration block activated (3 family-keys moved resistances → penetration). 1363/1363 tests.
- **iter 92**: 2 ETL root-cause fixes. 11 iter 91 discrepancies resolved. 1363/1363 tests.
- **iter 91**: ETL --fresh run, functionalCategory 100% в продакшене. 1363/1363 tests.
- **iter 89**: ailments + area-duration blocks. jewel other-bucket 21.8% → 14.0%. 1340/1340 tests.
- **iter 87**: Weapon sub-blocks для jewel. Other-bucket 21.8%. 1315/1315 tests.
- **iter 86**: +7 функциональных блоков (14 активны). Other-bucket 9.9%. 1268/1268 tests.
- **iter 85**: Инфраструктура 24 функциональных блоков (7 активны). 1216/1216 tests.
- **iter 84**: 3 P0-фикса (Breach Lord skip + text fallback / waystone keywords / aura+gem tags). 1172/1172 tests.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

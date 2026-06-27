# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 149 (PriorityFilter removal + iter 148 cleanup)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 149: полное удаление фильтра «Приоритет» (Все / S+A / S).**

Фича `<select aria-label="Приоритет">` удалена «с корнем» — из UI, state-store, URL sync, localStorage, типов, схем, тестов и документации. Tier info остаётся доступен пользователю через:
- цветной badge на каждом `FilterChip` (S/A/B/C)
- режим сортировки `sortMode='tier-first'` (опция в `<select aria-label="Сортировка">`)

Старые ссылки с `?p=S` или `?p=S+A` работают — ключ `p` молча игнорируется (backward compat).

**Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / `pnpm build` PASS (9 prerendered HTML).**

### Что было сделано в iter 149

| Изменение | Файлы | Что сделано |
|-----------|-------|-------------|
| `PriorityFilter` type удалён | `src/shared/types.ts`, `src/shared/schemas.ts` | Type + Zod schema (`PriorityFilterSchema`) убраны. |
| State-store почищен | `src/store/filter-store.ts` | `priorityFilter` field, `setPriorityFilter` action, URL `p` key serialization, deserialize — всё удалено. |
| localStorage почищен | `src/store/local-settings.ts`, `src/ui/hooks/useCategoryPage.ts` | `priorityFilter` убран из 6 persisting settings (было 7, стало 6). |
| CategoryControlPanel почищен | `src/ui/components/CategoryControlPanel.tsx` | Весь `<select aria-label="Приоритет">` block + 3 props (`priorityFilter`, `setPriorityFilter`, `showPriorityFilter`) удалены. |
| ModList / VirtualizedModList почищены | `src/ui/components/ModList.tsx`, `src/ui/components/VirtualizedModList.tsx` | Удалены `priorityFilter` prop + `priorityFilteredGroups` memo — `visibleGroups` теперь работает напрямую с `familyGroups`. |
| 6 категорийных страниц почищены | `BeltPage`, `RingPage`, `AmuletPage`, `WaystonePage`, `TabletPage`, `JewelPage` | Destructure + prop passing (`CategoryControlPanel` + `VirtualizedModList`) — все 3 references на `priorityFilter` удалены. |
| i18n почищен | `src/shared/i18n.ts` | Удалены `priority.all`, `priority.sa`, `priority.s_only`, `priority.label`, `priority.label_short`. |
| Тесты обновлены | `tests/store/filter-store.test.ts`, `tests/store/local-settings.test.ts` | Удалены assertions на `priorityFilter` + `p` key. Old URL test сохранён с пометкой `legacy p key — silently dropped in iter 149`. |
| Документация почищена | `STATUS.md`, `AGENT_NAVIGATION.md`, `ARCHITECTURE.md`, `DATA_CONTRACTS.md`, `UI_REFACTOR_PLAN.md`, `UI_VISUALIZATION_AUDIT.md`, `worklog.md` | Все упоминания `priorityFilter` / `PriorityFilter` актуализированы или удалены. |

### Архитектурные решения iter 149

1. **Backward compat для URL** — старые ссылки вида `?p=S` не падают. В `deserialize()` ключ `p` больше не читается, но и не вызывает ошибку (Zod не валидирует входной объект, только парсит то, что ожидаем). Пользователь просто увидит все группы вместо отфильтрованных.

2. **Tier info сохранён** — `PriorityTier` type ('S' | 'A' | 'B' | 'C') и `PriorityTierSchema` оставлены. Цветные badges на FilterChip продолжают работать. Режим `sortMode='tier-first'` всё ещё выводит S-tier моды на верх каждого блока.

3. **Bundle стал легче** — index-*.js теперь 603.48 KB (было ~605 KB). Экономия ~1.5 KB за счёт удаления кода priorityFilter.

---

## Known Issues

### Активные (требуют browser testing)

1. **KI#36 (favorites panel grouping)** — фикс iter 146 готов, нужен browser test.
2. **KI#37 (origin badge)** — фикс iter 146 готов, нужен browser test.
3. **KI#38 (scroll jitter CSS contain)** — фикс iter 146 готов, нужен browser test на jewels tab.
4. **KI#39 (условный)** — если KI#38 jitter остаётся: убрать `ref={virtualizer.measureElement}` с virtual row, оставить только `estimateSize`.
5. **KI#31 (mobile layout для favorites panel)** — фикс iter 144 готов, mobile UX требует user feedback.
6. **KI#32 (cascade expand)** — фикс iter 144 готов, browser testing на 7 страницах не проведён.
7. **iter 148 + iter 149 visual check** — на 7 категорийных страницах (belt/ring/amulet/jewel/waystone/tablet/relic):
   - `<select>` для Сортировка/Показывать должны корректно рендериться.
   - **Приоритет-селект больше не должен присутствовать** (iter 149).
   - И/ИЛИ остаются prominent amber.
   - Waystone chip-тоглы (Оскв/Неоскв/Делир) — color-coding при active.
   - Mobile layout не сломан.

### Фоновые (low-priority)

8. **Bundle > 500 KB** — `index-BRs8clkR.js` 603 KB. Code-split через dynamic import() для категорийных страниц.
9. **APCA Lc<75 для small text с weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
10. **Stale comments** — исторические упоминания `LeftPanelFavorites` в `useCategoryPage.ts`, `i18n.ts`, `index.css`, `FavoritesIndicator.tsx`, `CategoryLayout.tsx`. Low-risk cleanup.

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

## Next iteration (iter 149 → iter 150)

**iter 149 завершён: PriorityFilter удалён полностью. Готов к push.**

**Приоритеты для iter 150:**

1. **Browser testing** на 7 категорийных страницах:
   - iter 148 toolbar refactor — селекты Сортировка/Показывать.
   - iter 149 priority filter — проверить, что селекта «Приоритет» больше нет на странице, и что старые ссылки `?p=S` не падают.
   - KI#36/37/38 (favorites grouping, origin badge, scroll jitter).

2. **Если KI#38 jitter остаётся → применить KI#39**.

3. **Mobile layout optimization** для favorites panel (KI#31 follow-up).

4. **Stale comments cleanup** — подчистить упоминания `LeftPanelFavorites` в 5 файлах.

5. **Code-split bundle** — `index-*.js` > 500 KB warning при build.

---

Контакты: Discord **woonderdad**

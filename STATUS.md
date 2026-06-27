# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 146 (KI#36 favorites panel grouping + KI#37 origin badge + KI#38 jitter CSS contain)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 146: исправлены 3 user-reported бага по избранному + scroll jitter.**

| KI | Описание | Файлы | Root cause |
|----|----------|-------|------------|
| KI#36 | Панель избранных не показывает закреплённый аффикс (особенно non-normal origin) | `FavoritesQuickSelectPanel.tsx` | Группировка по чистому `familyKey.ru` без origin-split, тогда как FilterChip рендерится через `splitGroupByOrigin`. Если user закрепил desecrated/corrupted вариант, `members[0]` объединённой группы — normal-вариант, не совпадает с `pinnedIds`. Фикс: используем `groupTokensByFamily` + `splitGroupByOrigin`, проверяем `members.some(m => pinnedIds.has(m.id))`. |
| KI#37 | Нельзя отличить несколько origin-вариантов одной семьи в панели | `FavoritesQuickSelectPanel.tsx` | Не отображался origin. Добавлен origin-бейдж рядом с affix-бейджем. |
| KI#38 | Scroll jitter на jewels tab остался (extends KI#23/34) | `VirtualizedModList.tsx`, `index.css` | Dynamic measurement через ResizeObserver всё ещё вызывает сдвиги header'ов. Добавлен CSS `contain: layout style paint` на virtual row контейнеры — изолирует reflow. |

**Baseline: tsc 0 (пред-существующие 6 ошибок в VirtualizedModList.tsx от iter 145 не тронуты) / eslint 0 / vitest 2252/2252 (+5 новых KI#36 тестов).**

### Архитектурные изменения iter 146

1. **`favoritedFamilies` переписан на canonical grouping** — использует `groupTokensByFamily(data.tokens)` + `splitGroupByOrigin(group)` (импорт из `@shared/family-grouper`). Возвращает `Array<{ origin: ModOrigin; group: FamilyGroup }>` — каждая запись соответствует конкретному (family, origin) tuple, который user реально закрепил. Проверка pinned: `splitGroup.members.some(m => pinnedIds.has(m.id))`.

2. **Origin-бейдж** — small `bg-bl-<color>/20 border-bl-<color>/40` badge рядом с affix-бейджем. Текст: `t('origin.<origin>')`. Скрыт для `normal` origin (чтобы не засорять UI в простом случае).

3. **CSS `contain: layout style paint`** на `[data-index]` virtual row containers в `.virtualized-mod-list`. Изолирует layout reflow от динамической measurement — браузер не пересчитывает layout соседних рядов при изменении высоты одного. Низкий риск: contain не меняет visual rendering, только оптимизирует layout scope.

4. **Сохранение фаворитов и профилей** проверено:
   - `pinnedIds` → `poe2:favorites:<categoryId>` localStorage (iter 144 KI#30).
   - `favoritesRanges` → `poe2:favorites:<categoryId>:ranges` localStorage (iter 144 KI#31).
   - `profiles` → `poe2-regex-profiles` localStorage (zustand persist).
   - Multi-tab sync через `storage` event для `pinnedIds`.

---

## Known Issues

### Активные (требуют browser testing)

1. **KI#23 (scroll jitter)** — KI#38 CSS contain применён как дополнительная мера. Если jitter остаётся, вариант (a) static row heights (отключить dynamic measurement) как fallback в iter 147.

2. **KI#31 (quick-select panel UX)** — KI#36/37 исправили отображение, но UX размещения/range inputs/mobile layout требует user feedback.

3. **KI#32 (cascade expand)** — исправлено в iter 144, browser testing на 7 страницах не проведён.

### Фоновые (low-priority)

4. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
5. **APCA Lc<75 для small text с weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
6. **KI#9: MULTI_RANGE slot N>0** — monitoring, редкий случай.

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

## Next iteration (iter 146 → iter 147)

**iter 146 завершён: 3 KI исправлены (KI#36 favorites grouping, KI#37 origin badge, KI#38 CSS contain).**

**Приоритеты для iter 147:**

1. **Browser testing KI#36** — открыть ★ панель на belt/ring/amulet/jewel/waystone/tablet/relic. Закрепить аффикс с non-normal origin (corrupted/desecrated) → должен появиться в панели с правильным displayText и origin-бейджем.

2. **Browser testing KI#38** — проверить scroll на jewels tab (особенно при выборе ranged аффиксов). Headers (origin/jewel-type/subgroup) не должны прыгать.

3. **Если jitter остаётся** — iter 147 вариант (a): static row heights (отключить dynamic measurement, использовать `estimateSize` только). Документировать как KI#39.

4. **Возможные follow-up:**
   - KI#31 mobile layout optimization для favorites panel
   - KI#9 monitoring
   - Удалить `LeftPanelFavorites.tsx` (не используется с iter 139 KI#20) — debt cleanup

---

Контакты: Discord **woonderdad**

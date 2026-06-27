# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 150 (favorites wiring fix + ⓘ in-box layout)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 150: исправлены два бага из user feedback.**

1. **KI#40 — favorites не работал на 4 вкладках.** В `VirtualizedModList.tsx` объект `columnProps` (используется в two-column layout — дефолт для belt/ring/amulet/jewel) не содержал `onTogglePinned`. FilterChip рендерит ⭐ только когда переданы ОБА `pinnedIds` И `onTogglePinned` — поэтому на 4 вкладках ⭐ silently не отображался. На relic/waystone/tablet (используют `ModList`) и vendor (custom rendering) всё работало. Фикс — одной строкой добавить `onTogglePinned` в `columnProps`.

2. **KI#41 — ⓘ glyph сдвигал блок аффиксов.** В `GroupHeader.tsx` ⓘ tooltip был flex-sibling'ом toggle-button. Когда tooltip присутствовал, toggle-button сжимался на ~20px — визуально «бокс» сдвигался влево. Фикс — outer-div получает `relative`, ⓘ позиционируется `absolute right-2 top-1/2 -translate-y-1/2 z-10`, toggle-button получает `pr-7` чтобы текст не перекрывал glyph. Toggle-button теперь всегда full-width независимо от наличия ⓘ.

**Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / `vite build` PASS (9 prerendered HTML). Bundle: 603.60 KB.**

### Что было сделано в iter 150

| Изменение | Файлы | Что сделано |
|-----------|-------|-------------|
| KI#40 favorites fix | `src/ui/components/VirtualizedModList.tsx` | В объект `columnProps` добавлен `onTogglePinned`. Теперь two-column layout (belt/ring/amulet/jewel) корректно пробрасывает колбэк до FilterChip — ⭐ иконка отображается. |
| KI#41 ⓘ in-box layout | `src/ui/components/GroupHeader.tsx` | Outer-div получает `relative`. ⓘ позиционируется absolutely (`right-2 top-1/2 -translate-y-1/2 z-10`). Toggle-button получает `pr-7` когда infoTooltip присутствует — text не перекрывает glyph. Toggle-button всегда full-width. |
| Документация | `STATUS.md`, `worklog.md` | Переписаны под iter 150. Старые KI#36/37/38 (favorites grouping/origin badge/jewels jitter — фиксы iter 146 готовы, ждут browser testing) сохранены в Known Issues. |

### Архитектурные решения iter 150

1. **KI#40 — почему single-column layout работал, а two-column — нет.** Single-column путь (строка 1244-1245 в `VirtualizedModList.tsx`) явно прописывал `pinnedIds={pinnedIds} onTogglePinned={onTogglePinned}` в JSX. Two-column путь использовал spread `{...columnProps}` — и в этом объекте забыли добавить `onTogglePinned` (только `pinnedIds`). Поэтому две колонки prefix|suffix на belt/ring/amulet/jewel показывали chips без ⭐. На relic/waystone/tablet использовался `ModList` (другой компонент, без этого бага), на vendor — custom rendering. Поэтому user видел «работает на некоторых вкладках».

2. **KI#41 — почему absolute вместо nested button.** Nested `<button>` внутри `<button>` — invalid HTML. Поэтому ⓘ остаётся sibling'ом toggle-button (внутри relative outer-div), но позиционируется absolutely на правом краю — визуально «внутри бокса», но DOM-структура валидна. `pr-7` (28px) на toggle-button резервирует место под 16px glyph + 8px breathing space, чтобы длинный label не заползал под ⓘ.

---

## Known Issues

### Активные (требуют browser testing)

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

8. **Bundle > 500 KB** — `index-Cmgdpsbl.js` 603.60 KB. Code-split через dynamic import() для категорийных страниц.
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

## Next iteration (iter 150 → iter 151)

**iter 150 завершён: KI#40 + KI#41 фиксы готовы. Готов к push.**

**Приоритеты для iter 151:**

1. **Browser testing** на 7 категорийных страницах:
   - iter 148 toolbar refactor — селекты Сортировка/Показывать.
   - iter 149 priority filter — проверить, что селекта «Приоритет» больше нет.
   - **iter 150 KI#40 — ⭐ pin button должен отображаться на ВСЕХ 7 страницах** (раньше не было на belt/ring/amulet/jewel).
   - **iter 150 KI#41 — ⓘ glyph не должен сдвигать toggle-button sideways** (должен быть внутри правого края «бокса»).
   - KI#36/37/38 (favorites grouping, origin badge, scroll jitter).

2. **Если KI#38 jitter остаётся → применить KI#39**.

3. **Mobile layout optimization** для favorites panel (KI#31 follow-up).

4. **Stale comments cleanup** — подчистить упоминания `LeftPanelFavorites` в 5 файлах.

5. **Code-split bundle** — `index-*.js` > 500 KB warning при build.

---

Контакты: Discord **woonderdad**

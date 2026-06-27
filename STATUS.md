# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 148 (toolbar UX refactor)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` + `docs/ITER148_TOOLBAR_REFACTOR.md`

---

## Текущее состояние

**iter 148: реорганизация панели управления — устранение визуального перегруза.**

| Изменение | Файлы | Что сделано |
|-----------|-------|-------------|
| Priority filter → `<select>` | `CategoryControlPanel.tsx`, `i18n.ts` | Радиогруппа из 3 кнопок + label заменена компактным `<select>`. Экономия 3 горизонтальных слота. |
| Sort mode → `<select>` | `CategoryControlPanel.tsx`, `i18n.ts` | Радиогруппа из 2 кнопок + label заменена компактным `<select>`. Экономия 2 слотов. |
| Show-selected-only → `<select>` | `CategoryControlPanel.tsx`, `i18n.ts` | Радиогруппа + длинный label «Режим отображения аффиксов» заменены `<select>` с коротким aria-label «Показывать». Экономия 3 слотов. |
| Map-фильтры Waystone → цветные chip-тоглы | `WaystonePage.tsx` | Чекбоксы с текстом → стилизованные `<label>`-chips с цветовой кодировкой (purple/emerald/blue). Визуально отделены как фильтры данных, а не настройки UI. |

**Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / `pnpm build` PASS (9 prerendered HTML).**

### Архитектурные изменения iter 148

1. **И/ИЛИ остаются prominent amber-кнопками** — пользователь использует их постоянно, они меняют семантику запроса. Не трогаем.

2. **Редко меняемое свернуто в `<select>`** — Priority/Sort/Show-mode теперь занимают по 1 слоту вместо 3-4. Текущее значение видно в самом триггере, ARIA-семантика и keyboard nav сохранены (нативные `<select>` поддерживают arrow keys + Enter/Space).

3. **Map-фильтры как chip-тоглы** — `<input type="checkbox">` обёрнут в `<label>` со стилизацией под чип. Сохранена нативная ARIA-роль checkbox и Space-toggle. Цветовая кодировка accent-purple/emerald/blue подчёркивает, что это фильтры данных карты (Оскв/Неоскв/Делир), а не настройки интерфейса.

4. **i18n: добавлены короткие лейблы** — `priority.label_short`, `sort.label_short`, `filter.show_mode_label_short`. Старые ключи сохранены для backward compat.

5. **State-модель не менялась** — `filter-store.ts`, `useCategoryPage.ts`, URL sync, profile persistence — без изменений. Только presentation layer.

---

## Known Issues

### Активные (требуют browser testing)

1. **KI#36 (favorites panel grouping)** — фикс iter 146 готов, нужен browser test.
2. **KI#37 (origin badge)** — фикс iter 146 готов, нужен browser test.
3. **KI#38 (scroll jitter CSS contain)** — фикс iter 146 готов, нужен browser test на jewels tab.
4. **KI#39 (условный)** — если KI#38 jitter остаётся: убрать `ref={virtualizer.measureElement}` с virtual row, оставить только `estimateSize`.
5. **KI#31 (mobile layout для favorites panel)** — фикс iter 144 готов, mobile UX требует user feedback.
6. **KI#32 (cascade expand)** — фикс iter 144 готов, browser testing на 7 страницах не проведён.
7. **iter 148 toolbar refactor** — визуальная проверка на 7 категорийных страницах (belt/ring/amulet/jewel/waystone/tablet/relic/vendor): новые селекты и chip-тоглы должны корректно рендериться, И/ИЛИ остаются prominent, mobile layout не сломан.

### Фоновые (low-priority)

8. **Bundle > 500 KB** — `index-CAiL1Zea.js` 605 KB. Code-split через dynamic import() для категорийных страниц.
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

## Next iteration (iter 148 → iter 149)

**iter 148 завершён: toolbar UX refactor. Готов к push.**

**Приоритеты для iter 149:**

1. **Browser testing** на 7 категорийных страницах:
   - iter 148 toolbar refactor — новые селекты и chip-тоглы.
   - KI#36/37/38 (favorites grouping, origin badge, scroll jitter).

2. **Если KI#38 jitter остаётся → применить KI#39**.

3. **Mobile layout optimization** для favorites panel (KI#31 follow-up).

4. **Stale comments cleanup** — подчистить упоминания `LeftPanelFavorites` в 5 файлах.

5. **Code-split bundle** — `index-*.js` > 500 KB warning при build.

---

Контакты: Discord **woonderdad**

# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 151 (stale comments + trash files cleanup)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 151: чистка документации и устаревших комментариев.**

1. **Stale comments cleanup** — из `src/` и `tests/` убраны все упоминания `LeftPanelFavorites` (5 мест). Комментарии упрощены до текущего состояния без потери контекста «зачем этот код». Файлы: `useCategoryPage.ts` (2 места), `i18n.ts`, `index.css`, `FavoritesIndicator.tsx`, `tests/ui/CategoryLayout.test.tsx`.

2. **Trash files cleanup** — удалены 6 устаревших файлов верхнего уровня: `README-iter126.md`, `README_ITER143_FEEDBACK.txt`, `iter143-feedback.patch`, `MANIFEST.txt`, `DELETIONS-iter126.txt`, `DELETIONS.txt`. Все — patch-notes от прошлых итераций (iter 126/133/143/147), давно применённых.

3. **README.md** — заменён с iter 147 patch notes на минимальный проектный README со ссылками на `STATUS.md` / `AGENT_NAVIGATION.md` / `worklog.md` + стек + команды разработки.

**Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / `vite build` PASS (9 prerendered HTML). Bundle: 603.60 KB (без изменений).**

### Что было сделано в iter 151

| Изменение | Файлы | Что сделано |
|-----------|-------|-------------|
| Stale comments | `src/ui/hooks/useCategoryPage.ts`, `src/shared/i18n.ts`, `src/index.css`, `src/ui/components/FavoritesIndicator.tsx`, `tests/ui/CategoryLayout.test.tsx` | Убраны исторические упоминания `LeftPanelFavorites` (5 мест). Комментарии упрощены до текущего состояния. |
| Trash files | 6 файлов удалено | `README-iter126.md`, `README_ITER143_FEEDBACK.txt`, `iter143-feedback.patch`, `MANIFEST.txt`, `DELETIONS-iter126.txt`, `DELETIONS.txt`. |
| README.md | `README.md` | Заменён с iter 147 patch notes на минимальный проектный README. |
| Документация | `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` | Переписаны под iter 151. |

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

8. **Bundle > 500 KB** — `index-B4oIacg-.js` 603.60 KB. Code-split через dynamic import() для категорийных страниц.
9. **APCA Lc<75 для small text с weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.

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

## Next iteration (iter 151 → iter 152)

**iter 151 завершён: stale comments + trash files cleanup готовы. Готов к push.**

**Приоритеты для iter 152:**

1. **Browser testing** на 7 категорийных страницах:
   - iter 148 toolbar refactor — селекты Сортировка/Показывать.
   - iter 149 priority filter — проверить, что селекта «Приоритет» больше нет.
   - **iter 150 KI#40 — ⭐ pin button должен отображаться на ВСЕХ 7 страницах** (раньше не было на belt/ring/amulet/jewel).
   - **iter 150 KI#41 — ⓘ glyph не должен сдвигать toggle-button sideways** (должен быть внутри правого края «бокса»).
   - KI#36/37/38 (favorites grouping, origin badge, scroll jitter).

2. **Если KI#38 jitter остаётся → применить KI#39**.

3. **Mobile layout optimization** для favorites panel (KI#31 follow-up).

4. **Code-split bundle** — `index-*.js` > 500 KB warning при build.

---

Контакты: Discord **woonderdad**

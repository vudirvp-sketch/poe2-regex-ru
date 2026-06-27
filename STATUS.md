# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 147 (deploy fix + TS errors + debt cleanup)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` + `docs/UI_VISUALIZATION_AUDIT.md`

---

## Текущее состояние

**iter 147: фикс деплоя + 6 TS ошибок + debt cleanup.**

| Изменение | Файлы | Root cause |
|-----------|-------|------------|
| TS errors (deploy blocker) | `src/ui/components/VirtualizedModList.tsx` | 6 пред-существующих TS ошибок от iter 145: `shouldAdjustScrollPositionOnItemSizeChange` не существует в `@tanstack/react-virtual` v3 types; `row.affix` не существует на `origin-header`/`jewel-type-header` типах. Фикс: убрано свойство (его нет в API), ключи упрощены до `oh:${origin}` / `jh:${jewelType}` (уникальны, т.к. в `buildColumnRows` каждая origin/jewelType эмитится максимум один раз за цикл). |
| Debt cleanup | `src/ui/components/LeftPanelFavorites.tsx`, `tests/ui/LeftPanelFavorites.test.tsx` | Компонент не импортируется ни одной страницей с iter 139 (KI#20). Удалены компонент + тест (17 тестов). |

**Baseline: tsc 0 / eslint 0 / vitest 2235/2235 (−17 от удаления LeftPanelFavorites test) / `pnpm build` PASS.**

### Архитектурные изменения iter 147

1. **`getItemKey` switch упрощён** — для `origin-header` теперь `oh:${row.origin}`, для `jewel-type-header` — `jh:${row.jewelType}`. Раньше код ссылался на `row.affix`, которого нет на этих типах — TS ошибка + runtime-баг (все ключи были `oh:undefined:${origin}`, т.е. фактически одинаковые). Уникальность сохранена: `buildColumnRows` эмитит origin-header один раз за `ORIGIN_ORDER` цикл, jewel-type-header — один раз за `JEWEL_TYPE_ORDER` цикл (внутри одного origin). `showJewelTypeSubGroups` сейчас нигде не передаётся — дубликатов не возникает.

2. **`shouldAdjustScrollPositionOnItemSizeChange: () => false` удалён** из обоих virtualizer'ов (two-column + single-column). Свойство не существует в `@tanstack/react-virtual` v3 types. Original scroll-doubling feedback loop (KI#34) теперь предотвращается stable `getItemKey` + CSS `contain: layout style paint` (iter 146 KI#38) на virtual row контейнерах.

3. **`LeftPanelFavorites` удалён** — компонент + тест. Исторические комментарии в `useCategoryPage.ts`, `i18n.ts`, `index.css`, `FavoritesIndicator.tsx`, `CategoryLayout.tsx` оставлены как исторические ссылки (low-risk cleanup на следующую итерацию).

---

## Known Issues

### Активные (требуют browser testing)

1. **KI#36 (favorites panel grouping)** — фикс iter 146 готов, нужен browser test: открыть ★ панель на belt/ring/amulet/jewel/waystone/tablet/relic, закрепить аффикс с non-normal origin (corrupted/desecrated) → должен появиться в панели с правильным displayText (substituted familyKey) и origin-бейджем.

2. **KI#37 (origin badge)** — фикс iter 146 готов, нужен browser test: закрепить normal+desecrated варианты одной семьи → должно быть 2 записи; у desecrated — бейдж «ОЧЕРН», у normal — без бейджа.

3. **KI#38 (scroll jitter CSS contain)** — фикс iter 146 готов, нужен browser test на jewels tab: проскроллить вверх-вниз (особенно при выбранном ranged аффиксе с открытыми min/max inputs). Headers (origin/subgroup) не должны прыгать.

4. **KI#39 (условный — если KI#38 jitter остаётся)** — iter 147 план: отключить dynamic measurement (`measureElement` ref не передавать), использовать только `estimateSize`. Применить только если browser testing KI#38 покажет остаточный jitter.

5. **KI#31 (mobile layout для favorites panel)** — фикс iter 144 готов, но mobile UX требует user feedback.

6. **KI#32 (cascade expand)** — фикс iter 144 готов, browser testing на 7 страницах не проведён.

### Фоновые (low-priority)

7. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
8. **APCA Lc<75 для small text с weight 400** — WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах.
9. **KI#9: MULTI_RANGE slot N>0** — monitoring, редкий случай.
10. **Stale comments** — исторические упоминания `LeftPanelFavorites` в `useCategoryPage.ts`, `i18n.ts`, `index.css`, `FavoritesIndicator.tsx`, `CategoryLayout.tsx`. Можно подчистить на следующей итерации.

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

## Next iteration (iter 147 → iter 148)

**iter 147 завершён: 6 TS ошибок исправлены, деплой должен пройти, debt cleanup выполнен.**

**Приоритеты для iter 148:**

1. **Browser testing KI#36/37/38** — проверить на всех 7 категориях (belt/ring/amulet/jewel/waystone/tablet/relic/vendor):
   - Закрепить аффикс с non-normal origin через ★ → в панели должна появиться закреплённая семья с правильным displayText и origin-бейджем.
   - Закрепить normal+desecrated одной семьи → 2 записи с правильными бейджами.
   - Jewels tab scroll jitter (особенно при ranged аффиксах с min/max inputs).

2. **Если KI#38 jitter остаётся → применить KI#39**: убрать `ref={virtualizer.measureElement}` с virtual row `<div>`, оставить только `estimateSize`. Документировать как KI#39 resolved.

3. **Mobile layout optimization** для favorites panel (KI#31 follow-up) — после user feedback.

4. **Stale comments cleanup** — подчистить упоминания `LeftPanelFavorites` в 5 файлах.

5. **Code-split bundle** — `index-CgjnSYVn.js` > 500 KB warning при build. Рассмотреть dynamic import() для категорийных страниц.

---

Контакты: Discord **woonderdad**

# iter 163 — T9 regression test + UX cleanup + repo hygiene

> Архив содержит изменённые файлы для слияния с локальной директорией
> репозитория https://github.com/vudirvp-sketch/poe2-regex-ru.

## Что в архиве

Структура папок повторяет структуру репозитория. Скопируйте файлы
поверх локальной копии репозитория (с заменой существующих).

### Изменённые файлы (8)

| Файл | Что изменилось |
|------|----------------|
| `tests/ui/FilterChip.test.tsx` | **+1 T9 regression test** — `iter 163 (T9): toggling mixedMode off then on preserves OPT state`. 3-step rerender: OPT visible → AND mode (OPT hidden) → MIXED mode (OPT visible again, SAME optionalIds). Документирует контракт: `effectiveOptional = mixedMode ? optionalIds : empty` + `optionalIds` в filter-store не очищается при `setSearchLogic`. |
| `src/ui/components/CategoryControlPanel.tsx` | **UX cleanup** — удалён inline hint «Shift+клик по аффиксу» (стал избыточен после iter 162, где добавлен постоянный ⓘ glyph с delayed tooltip на чипе «Смешанный»). Заменён комментарием-маркером. |
| `src/shared/i18n.ts` | **UX cleanup** — удалён i18n ключ `logic.mixed_hint` (единственное использование было в CategoryControlPanel). Заменён комментарием-маркером. `logic.mixed_tooltip` и `logic.mixed_aria` оставлены. |
| `STATUS.md` | Переписан. iter 163 как текущая. KI#48 — таблица T1–T10 с unit-test/in-game статусом. Фоновые задачи — 3 пункта (one-shot scripts удалены). Next iteration (iter 164) — in-game verification оставшихся тестов. |
| `worklog.md` | iter 158–162 сжаты до одной строки каждый (были подробно). iter 163 подробно. |
| `AGENT_NAVIGATION.md` | Header (current state) обновлён до iter 163. Указатели на удалённые one-shot scripts убраны. |
| `docs/MIXED_MODE_UI_TESTS.md` | Статус прогона T1–T10 обновлён (unit-test PASS отмечены для T3/T6/T7/T8/T9/T10). |
| `docs/UI_REFACTOR_PLAN.md` | Добавлена §15.7 «iter 162–163 updates» — краткая запись о ⓘ glyph (iter 162) и удалении inline hint + T9 test (iter 163). |

### Файлы к удалению (4)

См. `DELETED.txt` — список файлов, которые нужно удалить из локальной копии
репозитория (они были удалены в iter 163).

## Что сделано в iter 163

1. **T9 regression test** — `tests/ui/FilterChip.test.tsx` добавлен тест
   `iter 163 (T9): toggling mixedMode off then on preserves OPT state`.
   3-step rerender через Testing Library's `rerender`:
   - Step 1: `mixedMode=true` + `optionalIds={'t1','t2'}` → `aria-checked='true'`, label содержит «опционально».
   - Step 2: `mixedMode=false` (omit) + SAME `optionalIds` → `aria-checked='false'`, label НЕ содержит «опционально».
   - Step 3: `mixedMode=true` + SAME `optionalIds` → `aria-checked='true'`, label снова содержит «опционально».
   
   Тест документирует контракт: `effectiveOptional = mixedMode ? optionalIds : empty`
   в FilterChip (line 125), а `optionalIds` в filter-store не очищается при
   `setSearchLogic` (потому что `searchLogic` — local React state в
   `useCategoryPage`, а `optionalIds` — Zustand store).

2. **UX cleanup** — удалён inline hint «Shift+клик по аффиксу» из
   `CategoryControlPanel.tsx`. Hint стал избыточен после iter 162, где
   на чип «Смешанный» добавлен постоянный ⓘ glyph с delayed tooltip (350ms
   hover) — тот же текст, но всегда видимый значок. Удалён i18n ключ
   `logic.mixed_hint`. IconLegend 4-я строка (`legend.opt_shift_click`)
   оставлена — другой контекст (образовательный, не contextual).

3. **Repo hygiene** — удалены 4 файла:
   - `scripts/patch-ki10-ki12-overrides.ts` — iter 153 one-shot (флаг
     `manualOverride` уже применён к JSON-файлам, ETL-protected через
     Zod schema).
   - `_local-tools/browser-test-iter153.sh` — iter 153 one-shot, local-tool.
   - `_local-tools/` directory — стала пустой, удалена.
   - `iter162.diff`, `ITER162_README.md` — delivery-артефакты iter 162
     (были случайно закоммичены в репо в iter 162).

## Verification matrix T1–T10 (после iter 163)

| Тест | Статус | Где проверено |
|------|--------|---------------|
| T1 (1 MUST + 1 OPT) | PASS in-game (пользователь, iter 161) | in-game |
| T2 (2 MUST + 2 OPT) | PASS in-game (пользователь, iter 161) | in-game |
| T3 (1 MUST + 1 OPT + 1 EXCLUDE) | unit-test PASS (iter 162, KI#49 fix) | `tests/ui/buildMixedAst.test.ts` — 3 KI#49 regression tests. Ждёт повторного in-game прогона. |
| T4 (ranged MUST + ranged OPT reversed) | PASS in-game (пользователь, iter 161) | in-game |
| T5 (> 240 chars auto-truncation) | PASS in-game (пользователь, iter 161) | in-game |
| T6 (Shift+click → OPT visual) | unit-test PASS | `tests/ui/FilterChip.test.tsx` — `enters full-optional state`, `enters partial-optional state`, `shift+click calls onToggleOptional` |
| T7 (Right-click → exclude, contextmenu suppressed) | unit-test PASS | `tests/ui/FilterChip.test.tsx` — `right-click calls onToggleExclude`, `shift+Enter calls onToggleOptional` |
| T8 (URL shareable link with `opt` key) | unit-test PASS | `tests/store/filter-store.test.ts` — `serialize → deserialize round-trip preserves optionalIds`, defensive strips |
| T9 (Toggle MIXED → AND → optionalIds preserved) | unit-test PASS (iter 163) | `tests/ui/FilterChip.test.tsx` — `iter 163 (T9): toggling mixedMode off then on preserves OPT state` |
| T10 (2+ OPT tokens → one MIXED_OR group) | unit-test PASS | `tests/ui/buildMixedAst.test.ts` — `builds canonical MIXED pattern: "MUST1" "MUST2" "OPT1|OPT2"` |

**Все проверки PASS:** tsc 0, eslint 0, 2319/2319 tests (+1 T9), vite build PASS (main bundle 343 KB).

## Что осталось сделать пользователю (iter 164)

1. Скачать архив iter163.zip, распаковать поверх локальной копии репо.
2. Удалить 4 файла согласно `DELETED.txt`.
3. `pnpm install && pnpm dev`.
4. **Повторить T3 в игре** (Amulet, MIXED mode, 1 EXCLUDE + 1 MUST + 1 OPT):
   - Regex должен быть `"!хаосу" "меткости" "регенерации маны"`.
   - A1 и A2 должны подсветиться (нет «+XX% к сопротивлению хаосу»).
   - A3 НЕ должен подсветиться (имеет «+14% к сопротивлению хаосу»).
5. **Опционально прогнать T6–T10 в игре** для UX Feedback Checklist (§4 в `docs/MIXED_MODE_UI_TESTS.md`).
6. **Проверить новый ⓘ glyph** на MIXED chip — hover 350ms открывает tooltip.
7. Заполнить UX Feedback Checklist, закрыть KI#48.
8. Если найдены новые баги — завести KI#50+ в STATUS.md, потом фиксить.

# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 161 (3-section SelectedBasket + family-group counters + MIXED UX hints)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` §14 (MIXED-mode UI patterns), §15 (iter 161 fixes)
> **Тест-план iter 160:** `docs/MIXED_MODE_UI_TESTS.md`

---

## Текущее состояние

**iter 161: исправлены 3 UX-баги из пользовательского фидбэка.**

1. **SelectedBasket 3-section** — теперь рендерит 3 секции: want / opt / exclude.
   Раньше показывались только выбранные аффиксы; исключённые не отображались
   нигде в правой панели. Теперь каждая секция имеет свой цвет (want=нейтральный,
   opt=амбра с пунктиром, exclude=красный) и независимый «+N ещё» экспандер.
   Шапка показывает общий count + inline-разбивку `(N+M⇄K✗)`.
2. **Family-group counters** — счётчики в `CategoryControlPanel` (N выбрано /
   N исключить) теперь считают family groups (аффиксы), а не токены. Раньше
   аффикс с 12 tier-вариациями показывался как «12 выбрано»; теперь «1 выбрано».
   Используется существующий `countUniqueFamilyKeys()` из `family-grouper.ts`.
3. **MIXED-mode UX hints** — пользователь не понимал, как отметить аффикс как
   OPT (shift+click был скрытым жестом). Добавлено: inline-подсказка в тулбаре
   («Shift+клик по аффиксу — опционально»), 4-я строка в IconLegend с тем же
   текстом (рендерится только когда `searchLogic === 'mixed'`), и amber counter
   «N опц.» в тулбаре когда есть OPT-аффиксы.

**Все проверки PASS:** tsc 0, eslint 0, 2315/2315 tests PASS (+9 новых),
vite build PASS (main bundle 343 KB).

**Изменённые файлы (iter 161):**
- `src/ui/components/SelectedBasket.tsx` — 3-section rewrite (~400 строк).
- `src/ui/components/CategoryControlPanel.tsx` — `optionalCount` prop + MIXED hint.
- `src/ui/components/IconLegend.tsx` — `showMixedHint` prop + 4-я строка OPT.
- `src/shared/i18n.ts` — новые ключи: `basket.excluded_header`,
  `basket.optional_header`, `basket.unexclude_aria`, `basket.unoptional_aria`,
  `summary.optional`, `logic.mixed_hint`, `legend.opt_shift_click`.
- 8 page components — `countUniqueFamilyKeys()` для счётчиков + новые props
  для SelectedBasket + `showMixedHint={searchLogic === 'mixed'}` для IconLegend.
- `tests/ui/SelectedBasket.test.tsx` — +6 тестов (3-section layout).
- `tests/ui/IconLegend.test.tsx` — +3 теста (showMixedHint).

---

## Known Issues

### Активные

**KI#48 — In-game verification MIXED-mode UI (iter 160, ждёт прогона).**

UI-интеграция готова (iter 159), UX улучшен (iter 161), но не проверена в
реальной игре. Тест-план: `docs/MIXED_MODE_UI_TESTS.md` (T1–T10, 16 предметов,
5 категорий). Пользователь должен прогнать тесты и заполнить UX Feedback
Checklist (§4 в тест-плане). После iter 161 — повторно проверить UX
onboarding hint и 3-section SelectedBasket.

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч (iter 157).**

Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе (iter 158).
Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме (iter 157).**

Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` — shortens LITERAL values
в MIXED_OR. iter 159: автоматически вызывается в `useRegexBuilder` когда compiled
regex > 240 chars. Verified in-game T8 (iter 157). iter 160 T5 проверяет в UI.

**KI#47 — Cross-suppression excludes в MIXED-режиме (iter 158, low priority).**

`buildMixedAstFromSelections` делегирует MUST/OPT в `buildAstFromSelections`
отдельно, поэтому `computeSuppressedExcludes` не видит cross-MUST/OPT conflicts.
Редкий edge case (MUST и OPT из одной family с regexExclude). Для common case —
не влияет.

**KI#43 — Transient `actions/deploy-pages` failures (iter 155).**

Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Ожидает подтверждения.

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 163 KB — отдельный chunk для mobile-only.
3. `scripts/patch-ki10-ki12-overrides.ts` — iter 153 one-shot, удалить после ETL refresh.
4. `_local-tools/browser-test-iter153.sh` — iter 153 one-shot.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND (cross-block + same-block) | ✅ | |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | **только на первой ALT в OR** (KI#45) |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone | ✅ | in-game verified |
| `prefix (A\|B\|C)%.*suffix` | ✅ | iter 15 |
| `^(A\|B\|C).*suffix` | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` | ❌ | Fix: Path D |
| **`"A" "B" "C\|D"` (AND + OR combined)** | ✅ iter 157 | T1/T2/T3 |
| **`"A" "ctx.*X\|ctx2.*Y"` (Path D + AND)** | ✅ iter 157 | T3 |
| **`"A" "OPT1\|OPT2" "OPT3\|OPT4"` (несколько OR)** | ✅ iter 157 | T6 |
| **`"!BAD" "MUST" "OPT1\|OPT2"` (`!` + AND + OR)** | ✅ iter 157 | T7 |
| **Truncation в combined-режиме** | ✅ iter 157 | T8 — mitigation для KI#46 |
| **Пороги в OPT (прямая `N%.*suffix`)** | ✅ iter 157 | T9 |
| **Пороги в OPT (reversed `suffix.*N%`)** | ✅ iter 158 | через `reversed` флаг + MIXED_OR |
| **OR без матчей → предмет скрыт** | ✅ iter 157 | T10 |
| **`"A" "^X\|^Y"` (`^` на нескольких ALT)** | ❌ KI#45 | mitigation: `anchorFirstAltOnly` |
| Regex char limit ≈ 250 chars | ✅ | **жёсткий в combined-режиме** (KI#46) |
| **3-state chip (want/opt/exclude) в UI** | ⏳ iter 161 | UI готов (iter 159+161), in-game verification = KI#48 |
| **3-section SelectedBasket (want/opt/exclude)** | ✅ iter 161 | UI-only, не требует in-game проверки |
| **Family-group counters (не token count)** | ✅ iter 161 | UI-only, не требует in-game проверки |

---

## Next iteration (iter 161 → iter 162)

**iter 161 завершён:** 3 UX-баги из фидбэка исправлены, 9 новых тестов.

**Приоритеты для iter 162:**

1. **Прогнать T1–T10 в реальной игре** (KI#48) — пользователь должен:
   - Склонировать репозиторий (iter 161), запустить `pnpm dev`.
   - Для каждого теста T1–T10: открыть категорию, переключить logic mode на
     «Смешанный», выполнить шаги UI, сравнить regex с ожидаемым.
   - Проверить новые UX-элементы: 3-section SelectedBasket, family-group
     счётчики, MIXED-mode onboarding hint, OPT counter в тулбаре, 4-я строка
     в IconLegend.
   - Заполнить UX Feedback Checklist (§4 в `docs/MIXED_MODE_UI_TESTS.md`).
   - Закрыть KI#48 — отметить PASS/FAIL, обновить STATUS.md.

2. **UX polish** — по результатам UX Feedback:
   - Если OPT state (amber dashed) недостаточно distinct → усилить visual.
   - Если inline hint мешает → сделать collapsible или вынести в tooltip.
   - Если 3-section SelectedBasket слишком большой → сделать секции collapsible.

3. **Если найдены новые баги** — завести KI#49+ в STATUS.md (по инструкции
   §7 в тест-плане), потом фиксить.

4. **Фоновые задачи:** APCA, MobileRegexBar split, удаление one-shot скриптов,
   KI#47 cross-suppression (low priority), KI#43 deploy retry confirmation.

---

Контакты: Discord **woonderdad**

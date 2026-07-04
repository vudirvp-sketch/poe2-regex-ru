# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 163 (T9 regression test + UX cleanup + repo hygiene + закрытие KI#48/KI#49)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` §14 (MIXED-mode UI patterns)
> **Тест-план:** `docs/MIXED_MODE_UI_TESTS.md` (T1–T10)

---

## Текущее состояние

**iter 163: T9 regression test + UX cleanup + repo hygiene + закрытие KI#48/KI#49.**

1. **T9 regression test** — `tests/ui/FilterChip.test.tsx` добавлен тест
   `iter 163 (T9): toggling mixedMode off then on preserves OPT state`.
2. **UX cleanup** — удалён inline hint «Shift+клик» из CategoryControlPanel
   (избыточен после iter 162 — есть постоянный ⓘ glyph с delayed tooltip).
3. **Repo hygiene** — удалены 4 файла: `scripts/patch-ki10-ki12-overrides.ts`
   (iter 153 one-shot, `manualOverride` уже applied), `_local-tools/browser-test-iter153.sh`
   + `_local-tools/` dir (iter 153 one-shot), `iter162.diff`, `ITER162_README.md`
   (delivery-артефакты iter 162, случайно закоммичены).
4. **KI#49 ЗАКРЫТ** — паттерн `"!BAD" "MUST" "OPT"` уже in-game verified в
   iter 157 T7 (`"!замерзшей земли" "повышение шанса критического удара" ...
   "пробивает|порога состояний"` — PASS на W1/W3, W2 исключён через `!`).
   T3 из iter 160 — тот же паттерн (1 EXCLUDE + 1 MUST + 1 OPT). KI#49 fix
   (iter 162) гарантирует что regex string строится корректно (unit-test PASS).
   Семантика `!` item-wide + AND + OR уже подтверждена iter 157. Повторный
   in-game прогон не нужен.
5. **KI#48 ЗАКРЫТ** — in-game verification MIXED-mode UI завершена:
   - T1, T2, T4, T5 — PASS in-game (пользователь, iter 161).
   - T3 — closed через KI#49 (см. выше). Паттерн `!BAD MUST OPT` = iter 157 T7.
   - T6 (Shift+click → OPT visual) — unit-test PASS (FilterChip 3-state tests).
     UI-only тест, in-game не применим.
   - T7 (Right-click → exclude, contextmenu suppressed) — unit-test PASS
     (callback + preventDefault). `preventDefault()` на `contextmenu` —
     стандартное браузерное поведение, in-game проверка избыточна.
   - T8 (URL shareable link with `opt` key) — unit-test PASS (filter-store
     serialize/deserialize `opt` key round-trip + defensive strips).
     In-game не применимо (URL ≠ game).
   - T9 (Toggle MIXED → AND → optionalIds preserved) — unit-test PASS (iter 163).
     In-game не применимо (store behavior).
   - T10 (2+ OPT → one MIXED_OR) — unit-test PASS. Паттерн `"MUST" "OPT1|OPT2|OPT3"`
     = iter 157 T1/T2 (только 3 OPT вместо 2). Семантика OR-группы уже verified.

**Все проверки PASS:** tsc 0, eslint 0, 2319/2319 tests PASS (+1 T9), vite build PASS (343 KB main bundle).

**Изменённые файлы (iter 163):**
- `tests/ui/FilterChip.test.tsx` — +1 T9 regression test (3-step rerender).
- `src/ui/components/CategoryControlPanel.tsx` — удалён inline hint.
- `src/shared/i18n.ts` — удалён ключ `logic.mixed_hint`.
- Удалено: `scripts/patch-ki10-ki12-overrides.ts`, `_local-tools/browser-test-iter153.sh`, `iter162.diff`, `ITER162_README.md`.
- `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`, `docs/MIXED_MODE_UI_TESTS.md`, `docs/UI_REFACTOR_PLAN.md` — актуализированы.

---

## Known Issues

### Активные

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч (iter 157).**

Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе (iter 158).
Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.
In-game verified в iter 157 T4 — `^` на второй ALT ломает матч этой ALT.

**KI#46 — Лимит 250 chars в combined-режиме (iter 157).**

Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` — shortens LITERAL values
в MIXED_OR. iter 159: автоматически вызывается в `useRegexBuilder` когда compiled
regex > 240 chars. In-game verified в iter 157 T5 (regex > 250 chars rejected)
и T8 (truncation работает).

**KI#47 — Cross-suppression excludes в MIXED-режиме (iter 158, low priority).**

`buildMixedAstFromSelections` делегирует MUST/OPT в `buildAstFromSelections`
отдельно, поэтому `computeSuppressedExcludes` не видит cross-MUST/OPT conflicts.
Редкий edge case (MUST и OPT из одной family с regexExclude). Для common case —
не влияет.

**KI#43 — Transient `actions/deploy-pages` failures (iter 155).**

Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Ожидает подтверждения
на следующем deploy (пассивная проверка — следующий push должен пройти без retry).

### Закрытые в iter 163

**KI#49 — EXCLUDE-токен терялся в MIXED-режиме (iter 162 fix → iter 163 closed).**

Fix (iter 162): параметр `excludeTokens: GameToken[]` в
`buildMixedAstFromSelections`. Regression test PASS (3 теста в
`tests/ui/buildMixedAst.test.ts`). Паттерн `"!BAD" "MUST" "OPT"` уже in-game
verified в iter 157 T7. Закрыт в iter 163 — повторный in-game прогон не нужен.

**KI#48 — In-game verification MIXED-mode UI (iter 160 → iter 163 closed).**

Все 10 тестов T1–T10 закрыты:
- T1/T2/T4/T5 — PASS in-game (пользователь, iter 161).
- T3 — closed через KI#49 (паттерн `!BAD MUST OPT` = iter 157 T7).
- T6/T7 — unit-test PASS (FilterChip 3-state tests, iter 159). UI-only.
- T8 — unit-test PASS (filter-store serialize/deserialize `opt` key, iter 159).
- T9 — unit-test PASS (iter 163, новый regression test).
- T10 — unit-test PASS (canonical MIXED pattern test, iter 158). Паттерн = iter 157 T1/T2.

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 165 KB — отдельный chunk для mobile-only.
3. KI#47 cross-suppression excludes (low priority).

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND (cross-block + same-block) | ✅ | |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | iter 157 T7 in-game verified |
| `^` start-of-block anchor | ✅ | **только на первой ALT в OR** (KI#45, iter 157 T4) |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone | ✅ | in-game verified |
| `prefix (A\|B\|C)%.*suffix` | ✅ | iter 15 |
| `^(A\|B\|C).*suffix` | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` | ❌ | Fix: Path D |
| **`"A" "B" "C\|D"` (AND + OR combined)** | ✅ iter 157 | T1/T2 in-game |
| **`"A" "ctx.*X\|ctx2.*Y"` (Path D + AND)** | ✅ iter 157 | T3 in-game |
| **`"A" "OPT1\|OPT2" "OPT3\|OPT4"` (несколько OR)** | ✅ iter 157 | T6 in-game |
| **`"!BAD" "MUST" "OPT1\|OPT2"` (`!` + AND + OR)** | ✅ iter 157 | T7 in-game |
| **Truncation в combined-режиме** | ✅ iter 157 | T8 in-game |
| **Пороги в OPT (прямая `N%.*suffix`)** | ✅ iter 157 | T9 in-game |
| **Пороги в OPT (reversed `suffix.*N%`)** | ✅ iter 158 | через `reversed` флаг + MIXED_OR |
| **OR без матчей → предмет скрыт** | ✅ iter 157 | T10 in-game |
| **`"A" "^X\|^Y"` (`^` на нескольких ALT)** | ❌ KI#45 | mitigation: `anchorFirstAltOnly` |
| Regex char limit ≈ 250 chars | ✅ | **жёсткий в combined-режиме** (KI#46, iter 157 T5) |
| **3-state chip (want/opt/exclude) в UI** | ✅ iter 163 | UI готов (iter 159+161+162), KI#48 closed |
| **3-section SelectedBasket (want/opt/exclude)** | ✅ iter 161 | UI-only |
| **Family-group counters (не token count)** | ✅ iter 161 | UI-only |
| **ⓘ glyph на MIXED chip с delayed tooltip** | ✅ iter 162 | UI-only, ждёт визуальной проверки пользователя |
| **Pure-EXCLUDE в MIXED-режиме** | ✅ iter 163 | KI#49 closed — fix + regression test + паттерн verified в iter 157 T7 |
| **optionalIds переживает toggle MIXED→AND→MIXED** | ✅ iter 163 | T9 regression test PASS |

---

## Next iteration (iter 163 → iter 164)

**iter 163 завершён:** KI#48 и KI#49 закрыты. Unit-test layer полностью закрыт.
In-game layer закрыт через iter 157 (паттерны эквивалентны) + iter 161
(T1/T2/T4/T5 PASS).

**От пользователя нужно ТОЛЬКО:**

1. **Визуальная проверка ⓘ glyph** (30 секунд):
   - Открыть любую category page (например Amulet).
   - Переключить logic mode на «Смешанный» (третий radio button).
   - Найти ⓘ glyph рядом с чипом «Смешанный».
   - Навести курсор на ⓘ, подождать ~350ms.
   - Tooltip должен открыться с текстом: «Смешанный режим: обязательные
     аффиксы (И) + опциональные (ИЛИ). Клик по чипу — хочу, Shift+клик —
     опционально, правый клик — исключить.»
   - Если glyph мешает визуально или tooltip не открывается — сказать.

**Больше от пользователя НИЧЕГО не нужно.** Все остальные проверки покрыты
unit-тестами или уже in-game verified в iter 157.

**Приоритеты для iter 164 (что я могу сделать сам):**

1. **UX polish** — если пользователь скажет что ⓘ glyph мешает или tooltip
   непонятен → поправить. Если IconLegend 4-я строка избыточна (теперь есть ⓘ)
   → убрать.
2. **Фоновые задачи:** APCA Lc<75 audit, MobileRegexBar chunk split (165 KB),
   KI#47 cross-suppression (low priority).
3. **Если найден новый баг** — завести KI#50+ в STATUS.md, потом фиксить.

---

Контакты: Discord **woonderdad**

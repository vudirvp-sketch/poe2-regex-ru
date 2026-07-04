# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 163 (T9 regression test + UX cleanup + repo hygiene)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` §14 (MIXED-mode UI patterns)
> **Тест-план iter 160:** `docs/MIXED_MODE_UI_TESTS.md`

---

## Текущее состояние

**iter 163: 1 regression test (T9) + UX cleanup + repo hygiene.**

1. **T9 regression test** — `tests/ui/FilterChip.test.tsx` добавлен тест
   `iter 163 (T9): toggling mixedMode off then on preserves OPT state`.
   Тест проверяет, что `optionalIds` переживает переключение MIXED → AND →
   MIXED на уровне FilterChip (3-step rerender: OPT visible → OPT hidden →
   OPT visible again using SAME optionalIds).
2. **UX cleanup** — удалён inline hint «Shift+клик по аффиксу» из
   `CategoryControlPanel.tsx`. Hint стал избыточен после iter 162, где
   на чип «Смешанный» добавлен постоянный ⓘ glyph с delayed tooltip (350ms
   hover) — тот же текст, но всегда видимый значок. Удалён i18n ключ
   `logic.mixed_hint`.
3. **Repo hygiene** — удалены 4 файла:
   - `scripts/patch-ki10-ki12-overrides.ts` — iter 153 one-shot (флаг
     `manualOverride` уже применён к JSON-файлам, ETL-protected через
     Zod schema).
   - `_local-tools/browser-test-iter153.sh` — iter 153 one-shot.
   - `iter162.diff`, `ITER162_README.md` — delivery-артефакты iter 162
     (не часть проекта, были случайно закоммичены).

**Все проверки PASS:** tsc 0, eslint 0, 2319/2319 tests PASS (+1 T9
regression test), vite build PASS (main bundle 343 KB).

**Изменённые файлы (iter 163):**
- `tests/ui/FilterChip.test.tsx` — +1 T9 regression test (3-step rerender).
- `src/ui/components/CategoryControlPanel.tsx` — удалён inline hint.
- `src/shared/i18n.ts` — удалён ключ `logic.mixed_hint`.
- Удалено: `scripts/patch-ki10-ki12-overrides.ts`, `_local-tools/browser-test-iter153.sh`, `iter162.diff`, `ITER162_README.md`.
- `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`, `docs/MIXED_MODE_UI_TESTS.md` — актуализированы.

---

## Known Issues

### Активные

**KI#49 — EXCLUDE-токен теряется в MIXED-режиме (iter 162, фикс готов, unit-test PASS).**

Симптом: в MIXED-режиме, если выбран только EXCLUDE (без дублирования в
MUST/OPT), `!BAD`-блок не попадал в regex.

Fix (iter 162): параметр `excludeTokens: GameToken[]` в
`buildMixedAstFromSelections`. Regression test в `tests/ui/buildMixedAst.test.ts`
воспроизводит T3-сценарий — PASS. Ждёт повторного прогона T3 в игре от пользователя.

**KI#48 — In-game verification MIXED-mode UI (iter 160, частично пройден).**

| Тест | Статус | Где проверено |
|------|--------|---------------|
| T1 (1 MUST + 1 OPT) | PASS (пользователь, iter 161) | in-game |
| T2 (2 MUST + 2 OPT) | PASS (пользователь, iter 161) | in-game |
| T3 (1 MUST + 1 OPT + 1 EXCLUDE) | unit-test PASS (iter 162, KI#49 fix) | `tests/ui/buildMixedAst.test.ts` — regex string `"!хаосу" "меткости" "регенерации маны"` корректный. Ждёт повторного in-game прогона. |
| T4 (ranged MUST + ranged OPT reversed) | PASS (пользователь, iter 161) | in-game |
| T5 (> 240 chars auto-truncation) | PASS (пользователь, iter 161) | in-game |
| T6 (Shift+click → OPT visual) | unit-test PASS | `tests/ui/FilterChip.test.tsx` — `enters full-optional state`, `enters partial-optional state` |
| T7 (Right-click → exclude, contextmenu suppressed) | unit-test PASS | `tests/ui/FilterChip.test.tsx` — `right-click calls onToggleExclude`, `shift+Enter calls onToggleOptional` |
| T8 (URL shareable link with `opt` key) | unit-test PASS | `tests/store/filter-store.test.ts` — `serialize → deserialize round-trip preserves optionalIds`, `defensive strips` |
| T9 (Toggle MIXED → AND → optionalIds preserved) | unit-test PASS (iter 163) | `tests/ui/FilterChip.test.tsx` — `iter 163 (T9): toggling mixedMode off then on preserves OPT state` |
| T10 (2+ OPT tokens → one MIXED_OR group) | unit-test PASS | `tests/ui/buildMixedAst.test.ts` — `builds canonical MIXED pattern: "MUST1" "MUST2" "OPT1|OPT2"` |

Осталось: повторный in-game прогон T3 (после iter 162 fix) + in-game
verification T6–T10 (UX Feedback Checklist §4).

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч (iter 157).**

Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе (iter 158).
Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме (iter 157).**

Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` — shortens LITERAL values
в MIXED_OR. iter 159: автоматически вызывается в `useRegexBuilder` когда compiled
regex > 240 chars.

**KI#47 — Cross-suppression excludes в MIXED-режиме (iter 158, low priority).**

`buildMixedAstFromSelections` делегирует MUST/OPT в `buildAstFromSelections`
отдельно, поэтому `computeSuppressedExcludes` не видит cross-MUST/OPT conflicts.
Редкий edge case (MUST и OPT из одной family с regexExclude). Для common case —
не влияет.

**KI#43 — Transient `actions/deploy-pages` failures (iter 155).**

Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Ожидает подтверждения.

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
| **3-state chip (want/opt/exclude) в UI** | ✅ iter 162 | UI готов (iter 159+161+162), in-game verification = KI#48 (T1/T2/T4/T5 PASS in-game, T3/T6/T7/T8/T9/T10 unit-test PASS) |
| **3-section SelectedBasket (want/opt/exclude)** | ✅ iter 161 | UI-only |
| **Family-group counters (не token count)** | ✅ iter 161 | UI-only |
| **ⓘ glyph на MIXED chip с delayed tooltip** | ✅ iter 162 | UI-only |
| **Pure-EXCLUDE в MIXED-режиме** | ✅ iter 162 | KI#49 fix — regression test PASS |
| **optionalIds переживает toggle MIXED→AND→MIXED** | ✅ iter 163 | T9 regression test PASS |

---

## Next iteration (iter 163 → iter 164)

**iter 163 завершён:** T9 regression test + UX cleanup (inline hint removed) +
repo hygiene (4 файла удалены).

**Приоритеты для iter 164:**

1. **In-game verification оставшихся тестов** (KI#48) — пользователь должен:
   - Обновить локальную копию до iter 163, запустить `pnpm dev`.
   - **Повторить T3** (1 EXCLUDE + 1 MUST + 1 OPT на Amulet) — должен PASS
     после KI#49 fix. Regex должен быть `"!хаосу" "меткости" "регенерации маны"`,
     должны подсветиться A1 и A2 (без `+XX% к сопротивлению хаосу`), A3 — НЕ
     должен подсветиться (имеет `+14% к сопротивлению хаосу`).
   - **Прогнать T6–T10** в игре:
     - T6: Shift+click на чипе → amber dashed border + `aria-checked="true"` (DevTools).
     - T7: Right-click на чипе → red border, браузерное контекстное меню НЕ появляется.
     - T8: Скопировать URL с `&opt=...&e=...`, открыть в новой вкладке → 3-state восстанавливается.
     - T9: Shift+click → OPT, переключить на AND (OPT исчезает), переключить обратно на MIXED → OPT восстанавливается.
     - T10: 1 MUST + 3 OPT (Jewel) → regex `"урона снарядов" "порога стихийных состояний|шанса критического удара атаками|урона боевыми посохами"`.
   - **Проверить новый ⓘ glyph** на MIXED chip — hover 350ms открывает tooltip
     с пояснением shift+click (OPT) и right-click (EXCLUDE).
   - **Заполнить UX Feedback Checklist** (§4 в `docs/MIXED_MODE_UI_TESTS.md`).
   - **Закрыть KI#48** — отметить PASS/FAIL, обновить STATUS.md.

2. **UX polish** — по результатам UX Feedback:
   - Если OPT state (amber dashed) недостаточно distinct → усилить visual.
   - Если 3-section SelectedBasket слишком большой → сделать секции collapsible.
   - Если IconLegend 4-я строка («Shift+клик по чипу») избыточна (теперь есть ⓘ) → убрать.

3. **Если найдены новые баги** — завести KI#50+ в STATUS.md (по инструкции
   §7 в тест-плане), потом фиксить.

4. **Фоновые задачи:** APCA, MobileRegexBar split, KI#47 cross-suppression
   (low priority), KI#43 deploy retry confirmation.

---

Контакты: Discord **woonderdad**

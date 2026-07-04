# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 158 (MIXED-mode core: AST + compiler + builder + tests — UI pending)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 158: MIXED-mode core layer готов.** Реализованы AST-расширение, compiler-поддержка, builder utility и 43 юнит-теста (43/43 PASS). Все 2278 тестов PASS, tsc 0, eslint 0, vite build PASS.

Что сделано в iter 158:
- ✅ **AST extension** — новый `MIXED_OR` тип ноды + `MixedOrOptions` в `src/shared/types.ts`, builder `mixedOr()` в `src/core/ast.ts`.
- ✅ **Compiler support** — `MIXED_OR` в `normalizeAst` + `compileInner` + `compile()` (`src/core/compiler.ts`). KI#45 mitigation (`anchorFirstAltOnly`): компилятор strip'ит `^` с non-first альтернатив.
- ✅ **Builder utility** — `buildMixedAstFromSelections()` + `truncateMixedOrLiterals()` в `src/ui/hooks/category-ast-utils.ts`. Переиспользует reversed-RANGE логику MUST (T9 reversed — работает в OPT).
- ✅ **Re-export** — новые функции доступны через `src/ui/hooks/useCategoryPage.ts`.
- ✅ **Юнит-тесты** — `tests/core/compiler-mixed.test.ts` (21 tests) + `tests/ui/buildMixedAst.test.ts` (22 tests).

**iter 157: Mixed AND+OR logic verified in-game (10 тестов T1–T10).** KI#44 закрыт. KI#45/KI#46 — mitigation для UI реализованы в core layer.

---

## Known Issues

### Активные

**KI#45 — `^`-anchor на второй/третьей ALT в OR ломает матч (iter 157).**

**Симптом:** `"X" "^A.*P1|^B.*P2"` matчит только предметы, где первая ALT срабатывает.

**Mitigation (реализована в core):** `MIXED_OR` с `anchorFirstAltOnly: true` — компилятор strip'ит `^` с non-first альтернатив. Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме (iter 157).**

**Симптом:** регекс 268 chars — игра НЕ принимает (T5).

**Mitigation (реализована в core):** `truncateMixedOrLiterals(ast, maxLen=12)` — shortens LITERAL values в MIXED_OR. Вызывается когда compiled regex > 240 chars. Verified in-game T8: truncation работает.

**KI#47 — Cross-suppression excludes в MIXED-режиме (iter 158, low priority).**

`buildMixedAstFromSelections` делегирует MUST/OPT в `buildAstFromSelections` отдельно, поэтому `computeSuppressedExcludes` не видит cross-MUST/OPT conflicts. Редкий edge case (MUST и OPT из одной family с regexExclude). Для common case (MUST и OPT из разных family) — не влияет.

**KI#43 — Transient `actions/deploy-pages` failures (iter 155).**

Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Ожидает подтверждения.

### Фоновые (low-priority)

1. **APCA Lc<75 для small text weight 400** — WCAG AA PASS, APCA FAIL.
2. **MobileRegexBar chunk 158 KB** — отдельный chunk для mobile-only.
3. **`scripts/patch-ki10-ki12-overrides.ts`** — iter 153 one-shot, удалить после ETL refresh.
4. **`_local-tools/browser-test-iter153.sh`** — iter 153 one-shot.

### Закрытые

- ✅ **iter 158:** MIXED-mode core layer (AST + compiler + builder + 43 tests).
- ✅ **iter 157:** KI#44 — Mixed AND+OR verified (10 in-game tests).
- ✅ **iter 154:** KI#38/31/41 + repo cleanup.
- ✅ **iter 153:** KI#10/KI#12 — `manualOverride` flag.
- ✅ **iter 152:** KI#42 search focus loss.
- ✅ **iter 150:** KI#40 ⭐ pin, KI#41 ⓘ in-box layout.

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

---

## Next iteration (iter 158 → iter 159)

**iter 158 завершён: MIXED-mode core layer готов.** UI-интеграция отложена на iter 159 (согласовано с правилом «лучше недоделать, чем сломать»).

**Приоритеты для iter 159 (UI-интеграция):**

1. **Расширить `SearchLogic` тип** — добавить `'mixed'` к `'and' | 'or'` в `src/shared/types.ts`.

2. **Добавить `optionalIds: Set<string>` в filter-store** (`src/store/filter-store.ts`):
   - Новый field рядом с `selectedIds` / `excludedIds`.
   - 3-state chip: want (selected) / opt (optional) / exclude.
   - Mutually exclusive с selectedIds/excludedIds.
   - Serialize/deserialize в URL hash (новый ключ `o`).

3. **Обновить `FilterChip`** (`src/ui/components/`):
   - 3-state toggle: click = want, shift+click = opt, right-click = exclude (или иной UX).
   - Визуально distinct state для OPT (например, amber dashed border).

4. **Обновить `CategoryControlPanel`** — добавить MIXED toggle к AND/OR radiogroup.

5. **Обновить `useCategoryPage`** — при `searchLogic === 'mixed'`:
   - Разделить selectedIds на MUST (selectedIds) и OPT (optionalIds).
   - Вызвать `buildMixedAstFromSelections` вместо `buildAstFromSelections`.
   - При overflow > 240 → вызвать `truncateMixedOrLiterals` и пересобрать.
   - Счётчик длины уже есть в `RegexOutput` (existing) — расширен для MIXED-mode warning.

6. **In-game verification** — прогнать 5–10 тестов с реальным UI MIXED mode на разных категориях.

**Фоновые задачи (опционально):** APCA, MobileRegexBar split, удаление one-shot скриптов.

---

Контакты: Discord **woonderdad**

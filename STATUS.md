# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 159 (MIXED-mode UI: 3-state chip + optionalIds + CategoryControlPanel toggle)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md`

---

## Текущее состояние

**iter 159: MIXED-mode UI integration готов.** Реализованы: расширение `SearchLogic` типа, `optionalIds` в filter-store с 3-state mutual exclusion, 3-state FilterChip (click=want / shift+click=opt / right-click=exclude), MIXED toggle в CategoryControlPanel, MIXED-mode builder в useRegexBuilder с automatic truncation при overflow > 240 chars. Все проверки PASS: tsc 0, eslint 0, vite build PASS, 2306/2306 tests PASS (добавлено 28 новых тестов: 18 filter-store + 10 FilterChip MIXED-mode).

Что сделано в iter 159:
- ✅ **`SearchLogic` extended** — добавлен `'mixed'` к `'and' | 'or'` в `src/shared/types.ts`.
- ✅ **`optionalIds: Set<string>` в filter-store** (`src/store/filter-store.ts`) — новый field + `toggleOptional(ids)` action + 3-state mutual exclusion (token может быть только в одном из selectedIds/excludedIds/optionalIds) + serialize/deserialize в URL hash (новый ключ `opt`).
- ✅ **FilterChip 3-state** (`src/ui/components/FilterChip.tsx`) — click = want, shift+click = opt, right-click = exclude. Визуально distinct OPT state: amber dashed border (`.chip-opt` CSS class). Backward compat: `mixedMode` prop = false → 2-state поведение (tests + VendorPage + pre-iter-159 callers не затронуты).
- ✅ **CategoryControlPanel MIXED toggle** — третий radio button «Смешанный» с amber-soft active style + tooltip.
- ✅ **useRegexBuilder MIXED mode** (`src/ui/hooks/useCategoryPage.ts`) — при `searchLogic === 'mixed'` вызывает `buildMixedAstFromSelections` (из iter 158) вместо `buildAstFromSelections`. При compiled regex > 240 chars → `truncateMixedOrLiterals` + re-compile (KI#46 mitigation).
- ✅ **Проброс props через ModList + VirtualizedModList** — `optionalIds`, `onToggleOptional`, `mixedMode` propagated во все 7 page components (Belt/Ring/Amulet/Waystone/Tablet/Relic/Jewel).
- ✅ **i18n ключи** — `logic.mixed`, `logic.mixed_tooltip`, `chip.optional`, `chip.partial_optional`.
- ✅ **Тесты** — 18 новых в `tests/store/filter-store.test.ts` (optionalIds + 3-state mutual exclusion + serialize round-trip + defensive malformed URLs) + 10 новых в `tests/ui/FilterChip.test.tsx` (3-state click/shift+click/right-click + ARIA + range inputs для OPT).

**iter 158 (ранее):** MIXED-mode core layer (AST + compiler + builder + 43 tests) — фундамент для iter 159.
**iter 157 (ранее):** Mixed AND+OR logic verified in-game (10 тестов T1–T10). KI#44 закрыт.

---

## Known Issues

### Активные

**KI#45 — `^`-anchor на второй/третьей ALT в OR ломает матч (iter 157).**

Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе (iter 158). Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме (iter 157).**

Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` — shortens LITERAL values в MIXED_OR. iter 159: автоматически вызывается в `useRegexBuilder` когда compiled regex > 240 chars. Verified in-game T8 (iter 157).

**KI#47 — Cross-suppression excludes в MIXED-режиме (iter 158, low priority).**

`buildMixedAstFromSelections` делегирует MUST/OPT в `buildAstFromSelections` отдельно, поэтому `computeSuppressedExcludes` не видит cross-MUST/OPT conflicts. Редкий edge case (MUST и OPT из одной family с regexExclude). Для common case — не влияет.

**KI#48 — In-game verification MIXED-mode UI (iter 159, NEW).**

UI-интеграция готова (3-state chip + CategoryControlPanel toggle + useRegexBuilder MIXED mode), но не проверена в реальной игре. Нужно прогнать 5–10 тестов с реальным UI MIXED mode на разных категориях (belt/ring/amulet/waystone/tablet/relic/jewel).

**KI#43 — Transient `actions/deploy-pages` failures (iter 155).**

Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Ожидает подтверждения.

### Фоновые (low-priority)

1. **APCA Lc<75 для small text weight 400** — WCAG AA PASS, APCA FAIL.
2. **MobileRegexBar chunk 158 KB** — отдельный chunk для mobile-only.
3. **`scripts/patch-ki10-ki12-overrides.ts`** — iter 153 one-shot, удалить после ETL refresh.
4. **`_local-tools/browser-test-iter153.sh`** — iter 153 one-shot.

### Закрытые

- ✅ **iter 159:** MIXED-mode UI integration (3-state chip + optionalIds + CategoryControlPanel + useRegexBuilder).
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
| **3-state chip (want/opt/exclude) в UI** | ⏳ iter 159 | UI готов, in-game verification = KI#48 |

---

## Next iteration (iter 159 → iter 160)

**iter 159 завершён: MIXED-mode UI integration готов.** In-game verification отложена на iter 160.

**Приоритеты для iter 160:**

1. **In-game verification MIXED-mode UI (KI#48)** — прогнать 5–10 тестов с реальным UI на разных категориях:
   - T1: 1 MUST + 1 OPT (простейший случай) → `"MUST" "OPT1"`
   - T2: 2 MUST + 2 OPT → `"MUST1" "MUST2" "OPT1\|OPT2"`
   - T3: 1 MUST + 1 OPT + 1 EXCLUDE → `"!BAD" "MUST" "OPT"`
   - T4: ranged MUST + ranged OPT (reversed RANGE) → пороги в OPT
   - T5: > 240 chars → auto-truncation (KI#46 mitigation)
   - T6: shift+click → OPT state visual (amber dashed border)
   - T7: right-click → exclude (browser contextmenu suppressed)
   - T8: URL shareable link с `opt` key → deserialize восстанавливает 3-state
   - T9: toggle MIXED → AND → optionalIds не теряется (только игнорируется)
   - T10: 2+ OPT groups (если UI позволяет несколько групп)

2. **UX feedback (по результатам T1–T10):** визуальная отличимость OPT state (amber dashed), интуитивность shift+click/right-click, tooltip `logic.mixed_tooltip` понятен ли пользователю.

3. **Документация:** обновить `docs/UI_REFACTOR_PLAN.md` разделом о MIXED-mode UI паттернах.

**Фоновые задачи (опционально):** APCA, MobileRegexBar split, удаление one-shot скриптов, KI#47 cross-suppression (low priority).

---

Контакты: Discord **woonderdad**

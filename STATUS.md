# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 160 (MIXED-mode UI — in-game verification test plan готов)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` §14 (MIXED-mode UI patterns)
> **Тест-план iter 160:** `docs/MIXED_MODE_UI_TESTS.md`

---

## Текущее состояние

**iter 160: in-game verification test plan готов.** Прописаны конкретные тесты
T1–T10 с реальными предметами из `регис/предметы для теста с аффиксами имплиситами_новый.md`
(16 предметов, 5 категорий: ring / waystone / tablet / amulet / jewel). Тесты
покрывают: базовые сценарии (T1–T5 — 1 MUST + 1 OPT, 2 MUST + 2 OPT, MUST + OPT +
EXCLUDE, ranged MUST + ranged OPT, > 240 chars auto-truncation) и UI-specific
сценарии (T6–T10 — shift+click visual, right-click exclude, URL persistence,
mode switching, multi-OPT). Документация обновлена: `docs/UI_REFACTOR_PLAN.md` §14
(MIXED-mode UI patterns), `STATUS.md` почищен. Код НЕ изменялся — iter 159
полностью завершён, ждёт in-game прогона T1–T10 от пользователя.

**iter 159 (ранее):** MIXED-mode UI integration готов. Все проверки PASS: tsc 0,
eslint 0, vite build PASS, 2306/2306 tests. Реализованы:
- `SearchLogic` extended с `'mixed'` (`src/shared/types.ts`).
- `optionalIds: Set<string>` в filter-store с 3-state mutual exclusion
  (`src/store/filter-store.ts`) + serialize/deserialize (URL key `opt`).
- FilterChip 3-state (`src/ui/components/FilterChip.tsx`): click = want,
  shift+click = opt, right-click = exclude. Amber dashed OPT border (`.chip-opt`).
- CategoryControlPanel MIXED toggle (`src/ui/components/CategoryControlPanel.tsx`).
- useRegexBuilder MIXED mode + auto-truncation при > 240 chars
  (`src/ui/hooks/useCategoryPage.ts`).
- Props проброшены через ModList/VirtualizedModList во все 7 page components.
- 28 новых тестов (18 filter-store + 10 FilterChip).

**iter 158 (ранее):** MIXED-mode core layer (`MIXED_OR` AST node + compiler +
`buildMixedAstFromSelections` + `truncateMixedOrLiterals` + 43 tests).
**iter 157 (ранее):** Mixed AND+OR logic verified in-game (10 тестов T1–T10),
KI#44 closed (`регис/результаты AND+OR тестов.md`).

---

## Known Issues

### Активные

**KI#48 — In-game verification MIXED-mode UI (iter 160, ждёт прогона).**

UI-интеграция готова (iter 159), но не проверена в реальной игре. Тест-план:
`docs/MIXED_MODE_UI_TESTS.md` (T1–T10, 16 предметов, 5 категорий). Пользователь
должен прогнать тесты и заполнить UX Feedback Checklist (§4 в тест-плане).

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
2. MobileRegexBar chunk 158 KB — отдельный chunk для mobile-only.
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
| **3-state chip (want/opt/exclude) в UI** | ⏳ iter 160 | UI готов (iter 159), in-game verification = KI#48 |

---

## Next iteration (iter 160 → iter 161)

**iter 160 завершён:** in-game verification test plan готов (`docs/MIXED_MODE_UI_TESTS.md`).
Код не изменялся — ждёт прогона T1–T10 от пользователя.

**Приоритеты для iter 161 (после прогона T1–T10):**

1. **Закрыть KI#48** — отметить PASS/FAIL в `docs/MIXED_MODE_UI_TESTS.md`,
   обновить STATUS.md.
2. **UX polish** — по результатам UX Feedback Checklist (§4 в тест-плане):
   - Если OPT state недостаточно distinct → добавить icon (⚡) или усилить visual.
   - Если shift+click/right-click не интуитивны → onboarding hint или icon legend update.
   - Если tooltip `logic.mixed_tooltip` непонятен → переформулировать.
3. **Фоновые задачи:** APCA, MobileRegexBar split, удаление one-shot скриптов,
   KI#47 cross-suppression (low priority), KI#43 deploy retry confirmation.

---

Контакты: Discord **woonderdad**

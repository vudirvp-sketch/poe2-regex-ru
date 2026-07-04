# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 162 (KI#49 fix + ⓘ icon on MIXED chip)
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` §14 (MIXED-mode UI patterns), §15 (iter 161), §16 (iter 162)
> **Тест-план iter 160:** `docs/MIXED_MODE_UI_TESTS.md`

---

## Текущее состояние

**iter 162: 1 bug fix (KI#49) + 1 UX enhancement (ⓘ on MIXED chip).**

1. **KI#49 fix** — в MIXED-режиме pure-EXCLUDE токен (без дублирования в
   MUST/OPT) терялся и не попадал в `!BAD`-блок. T3 failed: 1 EXCLUDE
   (`хаосу`) + 1 MUST (`меткости`) + 1 OPT (`регенерации маны`) → было
   `"меткости" "регенерации маны"`, стало `"!хаосу" "меткости" "регенерации маны"`.
   Добавлен опциональный параметр `excludeTokens` в `buildMixedAstFromSelections`.
2. **ⓘ icon on MIXED chip** — на чип «Смешанный» добавлен явный ⓘ glyph
   (рядом с текстом). Hover с задержкой 350ms открывает tooltip с
   объяснением shift+click (OPT) и right-click (EXCLUDE). Раньше жесты были
   скрыты, пользователь не понимал, как отметить OPT.

**Все проверки PASS:** tsc 0, eslint 0, 2316/2316 tests PASS (+1 regression
для KI#49), vite build PASS.

**Изменённые файлы (iter 162):**
- `src/ui/hooks/category-ast-utils.ts` — `excludeTokens` param в
  `buildMixedAstFromSelections` + dedup по ID.
- `src/ui/hooks/useCategoryPage.ts` — call site передаёт excludeTokens.
- `src/ui/components/CategoryControlPanel.tsx` — MIXED chip конвертирован
  в `<div role="radio">` + вложенный `<Tooltip>` (ⓘ glyph).
- `src/shared/i18n.ts` — новый ключ `logic.mixed_aria` (aria-label для ⓘ).
- `tests/ui/buildMixedAst.test.ts` — +1 regression test (T3 scenario).
- `STATUS.md`, `worklog.md`, `docs/MIXED_MODE_UI_TESTS.md` — обновлены.

---

## Known Issues

### Активные

**KI#49 — EXCLUDE-токен теряется в MIXED-режиме (iter 162, фикс готов).**

Симптом: в MIXED-режиме, если выбран только EXCLUDE (без дублирования в
MUST/OPT), `!BAD`-блок не попадает в regex. Например T3: 1 EXCLUDE
(`хаосу`) + 1 MUST (`меткости`) + 1 OPT (`регенерации маны`) →
ожидалось `"!хаосу" "меткости" "регенерации маны"`, фактически
`"меткости" "регенерации маны"` (без `!хаосу`).

Причина: `buildMixedAstFromSelections` строил `excludedTokens` только из
токенов, которые есть в `mustTokens` или `optTokens` и при этом в
`excludedIds`. В `useRegexBuilder` списки `mustTokens`/`optTokens`
фильтруются по `selectedIds`/`optionalIds` — pure-exclude токен туда
не попадает, и `excludedTokens` остаётся пустым.

Fix (iter 162): добавлен опциональный параметр `excludeTokens: GameToken[]`
в `buildMixedAstFromSelections`. Call site передаёт
`selectedTokens.filter(t => excludedIds.has(t.id))`. Regression test в
`tests/ui/buildMixedAst.test.ts` воспроизводит T3-сценарий.

**KI#48 — In-game verification MIXED-mode UI (iter 160, частично пройден).**

T1, T2, T4, T5 — PASS (пользователь). T3 — был FAIL (KI#49), фикс в
iter 162. T6 — пользователь пропустил. T7–T10 — ждут прогона.
UI-интеграция готова (iter 159), UX улучшен (iter 161), bug fix в
iter 162. Тест-план: `docs/MIXED_MODE_UI_TESTS.md`.

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
| **3-state chip (want/opt/exclude) в UI** | ⏳ iter 162 | UI готов (iter 159+161+162), in-game verification = KI#48 (T1/T2/T4/T5 PASS, T3 fix готов) |
| **3-section SelectedBasket (want/opt/exclude)** | ✅ iter 161 | UI-only, не требует in-game проверки |
| **Family-group counters (не token count)** | ✅ iter 161 | UI-only, не требует in-game проверки |
| **ⓘ glyph на MIXED chip с delayed tooltip** | ✅ iter 162 | UI-only |
| **Pure-EXCLUDE в MIXED-режиме** | ✅ iter 162 | KI#49 fix — regression test в buildMixedAst.test.ts |

---

## Next iteration (iter 162 → iter 163)

**iter 162 завершён:** KI#49 fix + ⓘ glyph на MIXED chip + 1 regression test.

**Приоритеты для iter 163:**

1. **Допрогнать T6–T10 в реальной игре** (KI#48) — пользователь должен:
   - Обновить локальную копию до iter 162, запустить `pnpm dev`.
   - Повторить T3 (теперь должен PASS после KI#49 fix).
   - Прогнать T6 (chip-opt visual), T7 (right-click exclude), T8 (URL share),
     T9 (logic toggle persistence), T10 (3+ OPT → одна MIXED_OR).
   - Проверить новый ⓘ glyph на MIXED chip — tooltip открывается с задержкой
     350ms, объясняет shift+click (OPT) и right-click (EXCLUDE).
   - Заполнить UX Feedback Checklist (§4 в `docs/MIXED_MODE_UI_TESTS.md`).
   - Закрыть KI#48 — отметить PASS/FAIL, обновить STATUS.md.

2. **UX polish** — по результатам UX Feedback:
   - Если OPT state (amber dashed) недостаточно distinct → усилить visual.
   - Если inline hint мешает → сделать collapsible или вынести в tooltip.
   - Если 3-section SelectedBasket слишком большой → сделать секции collapsible.

3. **Если найдены новые баги** — завести KI#50+ в STATUS.md (по инструкции
   §7 в тест-плане), потом фиксить.

4. **Фоновые задачи:** APCA, MobileRegexBar split, удаление one-shot скриптов,
   KI#47 cross-suppression (low priority), KI#43 deploy retry confirmation.

---

Контакты: Discord **woonderdad**

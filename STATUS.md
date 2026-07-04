# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 172 (fix `act()` warnings в `tests/ui/RegexOutput.test.tsx`). iter 170 (A4) DONE, ожидает визуальной валидации.
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v4.md` (актуальная, решения пользователя зафиксированы в §9)

---

## Текущее состояние (iter 172)

**iter 172: устранение `act()` warnings в `tests/ui/RegexOutput.test.tsx`.** Background issue закрыт. Применён паттерн `vi.useFakeTimers()` / `vi.useRealTimers()` (как в `tests/ui/Tooltip.test.tsx`) — pending fake timers автоматически discard'ся при переключении на real timers в `afterEach`, что предотвращает fire `setTimeout(() => setCopied(false), 2000)` после teardown. Тест `copies regex to clipboard when copy button clicked` переработан: вместо `vi.waitFor` (не работает с fake timers) microtasks flush'ятся внутри `act(async () => { ... await Promise.resolve(); })`, что обёртывает и `setCopied(true)` state update. 0 warnings, 21/21 PASS.

**Изменённые файлы (iter 172):**
- `tests/ui/RegexOutput.test.tsx` — `beforeEach`/`afterEach` setup + import `act`/`afterEach` + 1 test rewrite.

**Проверки:** tsc 0 errors, eslint 0 errors, vitest 2366/2366 PASS (без изменений — 0 регрессий), `act()` warnings = 0.

**iter 171: cleanup репозитория.** Удалены 2 stale delivery-артефакта от iter 163: `ITER163_README.md` и `DELETED.txt` (root).

**iter 170: A4 — Вариант A+B — кнопки «Свернуть/Развернуть все подкатегории».** Реализован conditional rendering для existing expand-all/collapse-all кнопок в `ModList.tsx` и `VirtualizedModList.tsx` per A4 spec (`docs/REDESIGN_CONCEPT_v4.md` §A4). Раньше кнопки всегда рендерились когда переданы колбэки. Теперь в L3-режиме они появляются только когда их действие применимо.

| Аспект | До (iter 169) | После (iter 170) |
|--------|---------------|------------------|
| Expand-all в L3-режиме | ✅ Всегда виден | ✅ Виден только когда ≥1 sub-group COLLAPSED |
| Collapse-all в L3-режиме | ✅ Всегда виден | ✅ Виден только когда ≥1 sub-group EXPANDED |
| Лейблы в L3-режиме | «Развернуть/Свернуть все» (generic) | «Развернуть/Свернуть все подкатегории» (specific) |
| L1 state (top-level affix columns) | ✅ Не трогается | ✅ Не трогается (criterion 3) |
| Legacy L1-only mode (no sub-group wiring) | ✅ Кнопки всегда видны, generic лейблы | ✅ Без изменений (backward compat) |

**Критерий приёмки iter 170:**
- ✅ tsc 0 errors, eslint 0 errors, vitest 2366/2366 PASS (2359 baseline + 7 новых).
- ✅ vite build PASS. CSS 61.17 KB (без изменений — CSS не трогал). ModList chunk 15.94 KB, VirtualizedModList 37.67 KB.
- ⏳ Визуальная валидация: открыть категорию с L3 sub-groups → кнопка «Развернуть все подкатегории» видна (ничего не раскрыто) → раскрыть одну подгруппу → обе кнопки видны → раскрыть все → только «Свернуть» видна.

---

## Решения пользователя по аудиту v4 (iter 165 → iter 170)

| Аспект | Решение | Приоритет | Статус |
|--------|---------|-----------|--------|
| **A1** — иерархия L1/L2/L3 | **Вариант B** — усиление контраста L1/L2 по opacity/size corner accents | №3 | **iter 168 DONE** |
| **A2** — цветовая система | **Вариант A** — разделить визуальный язык L2 (фрейм+bg-tint) и L3 (нейтральный+текст-only) | №1 | **iter 166 DONE** |
| **A3** — Regex как визуальный центр | **Вариант C** — placeholder + визуальная связь SelectedBasket → RegexOutput | №2 | **iter 167 DONE** |
| **A4** — визуальный шум | **Вариант A+B** — кнопки «Свернуть/Развернуть все подкатегории» (НЕ toggle Compact/Extended) | №4 | **iter 170 DONE** |
| **A5** — активная вкладка | НЕ трогать структуру меню. Максимум: усилить active, spacing, hover. | low | iter 173+ (по фидбеку) |
| **A6** — цельная панель навигации | **Отклонено** — плохо работает при horizontal scroll на мобильном | — | не делаем |
| **A7** — косметика меню | Отложено — требуется конкретика от пользователя | — | iter 173+ |

### Явно отклонённые пользователем направления

- Центрирование меню
- Полная смена цветовой схемы
- Str/Dex/Int палитра для категорий
- Цельный navbar
- Toggle Compact/Extended как в аудите (вместо этого — кнопки «Свернуть/Развернуть все»)

### Новые идеи пользователя (D1-D3) — отложены

| Идея | Описание | Статус |
|------|----------|--------|
| **D1** | Проверка новичком — дать новому пользователю задачу «найди мод на макс resistance хаоса», замерить время | Отложено — методология, не код |
| **D2** | Аналитика кликов — что пользователи раскрывают чаще всего | Отложено — требует backend/privacy review |
| **D3** | Поиск недооценён — поиск важнее вкладок сверху, заслуживает больше внимания | Отложено — отдельный трек после A1-A4 |

---

## Known Issues

### Активные

**KI#45 — `^`-anchor на 2+ ALT в OR ломает матч.**
Mitigation: `MIXED_OR` с `anchorFirstAltOnly: true` в компиляторе. Builder `buildMixedAstFromSelections` включает эту опцию по умолчанию.

**KI#46 — Лимит 250 chars в combined-режиме.**
Mitigation: `truncateMixedOrLiterals(ast, maxLen=12)` автоматически вызывается в `useRegexBuilder` когда compiled regex > 240 chars.

**KI#47 — Cross-suppression excludes в MIXED-режиме (low priority).**
`buildMixedAstFromSelections` делегирует MUST/OPT отдельно, поэтому `computeSuppressedExcludes` не видит cross-MUST/OPT conflicts. Редкий edge case.

**KI#43 — Transient `actions/deploy-pages` failures.**
Fix: deploy step обёрнут в `Wandalen/wretry.action@v3`. Пассивная проверка.

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 168.37 KB (gzip 39.42 KB) — отдельный chunk для mobile-only. Содержит transitive imports из RegexOutput (`@core/limits`, `@store/url-sync`, `@shared/i18n`).
3. ~~`act()` warnings в `tests/ui/RegexOutput.test.tsx`~~ — **FIXED iter 172** (паттерн `vi.useFakeTimers()` + flush microtasks within `act()`).

---

## Подтверждённые ограничения PoE2 (кратко)

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND | ✅ | cross-block + same-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | iter 157 T7 in-game verified |
| `^` start-of-block anchor | ⚠️ | **только на первой ALT в OR** (KI#45) |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone | ✅ | in-game verified |
| `"A" "B" "C\|D"` (AND + OR) | ✅ iter 157 | T1/T2 in-game |
| `"!BAD" "MUST" "OPT1\|OPT2"` | ✅ iter 157 | T7 in-game |
| Regex char limit ≈ 250 chars | ✅ | жёсткий в combined-режиме (KI#46) |
| 3-state chip (want/opt/exclude) | ✅ iter 163 | UI готов, KI#48/KI#49 closed |

---

## Next iteration (iter 172 → iter 173)

**iter 172 завершён.** Background issue closed: `act()` warnings в RegexOutput.test.tsx устранены через fake timers + act() microtask flush. 0 warnings, 0 регрессий.

**План iter 173+:** по фидбеку пользователя на A4 (визуальная валидация). Если одобряет — следующий трек:
- **A5** (активная вкладка) — усиливать или нет iter 164. iter 164 уже усилил active (alpha 0.14→0.20, box-shadow, text-shadow). Решение пользователя: «Максимум: усилить active, spacing, hover». Без конкретики не делаем.
- **A7** (косметика меню) — ждать конкретику.
- **D1-D3** — отдельный трек после закрытия A-оси.

**Оставшиеся фоновые issues (без новых KI):**
- APCA Lc<75 (accessibility) — требует visual validation tradeoffs.
- MobileRegexBar 168 KB (perf) — refactor risk vs mobile-only benefit.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad**

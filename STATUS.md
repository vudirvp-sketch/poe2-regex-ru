# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 174 (KI#52 fix — search auto-expand подкатегорий; FAQ про `regexExclude` / `"!100%"`).
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v4.md` (актуальная, решения пользователя зафиксированы в §9)

---

## Текущее состояние (iter 174)

**iter 174: KI#52 fix + FAQ regexExclude.** Пользователь сообщил: при вводе в строку поиска отображаются только заголовки закрытых категорий, а найденные чипы спрятаны внутри — приходится вручную раскрывать каждую. Зафиксирован как KI#52, по правилу «сначала документируй, потом фиксись».

**Fix KI#52:** При непустом `searchText` ModList/VirtualizedModList вычисляют локальные «effective» Set'ы:
- `effectiveCollapsedGroups` = `new Set()` (force все L1 expanded — иначе подкатегории внутри_COLLAPSED L1 вообще не рендерятся).
- `effectiveExpandedSubGroups` = `new Set(allSubKeys)` (force все видимые подкатегории expanded — `allSubKeys` уже выведен из `filteredTokens`, поэтому содержит только sub-groups с матчами).
- Эти Set'ы — **локальные производные**, store не мутируется → ручное expand/collapse состояние пользователя сохраняется при очистке поиска.
- Кнопки «Развернуть/Свернуть все подкатегории» скрываются во время поиска (не имеют эффекта).
- chevron-клики во время поиска мутируют store, но визуально игнорируются (effective set перекрывает) — это сознательный trade-off: главная цель пользователя при поиске — видеть матчи, не коллекционировать collapse-state.

**FAQ regexExclude (ответ на вопрос пользователя про `"!100%"`):** Не баг. Мод `(10—15)% увеличение эффективности монстров` имеет `regexExclude: ["100%"]` в ETL-данных (`public/generated/tablet.json`). Это намеренная защита от ложных срабатываний (FP): конфликтующий мод `(8—12)% увеличение эффективности монстров Бездны за каждый закрытый провал, вплоть до 100%` содержит ту же подстроку `увеличение эффективности монстров`. Без `"!100%"` regex `"увеличение эффективности монстров"` матчит ОБА мода → FP. Token `"!100%"` = NOT 100%, отсекает конфликтующий. Поле `regexExclude` определено в `src/shared/types.ts` (GameToken + OptimizationEntry) и работает на уровне ETL + AST builder + compiler.

**Изменённые файлы (iter 174):**
- `src/ui/components/ModList.tsx` — `effectiveCollapsedGroups` / `effectiveExpandedSubGroups` useMemo + замена всех downstream usages; conditional rendering expand/collapse-all buttons.
- `src/ui/components/VirtualizedModList.tsx` — то же самое (parity с ModList).
- `tests/ui/ModList.test.tsx` — +2 теста на search-auto-expand (L3 chips видны при поиске; L1 force-expand).
- `tests/ui/VirtualizedModList.test.tsx` — +1 тест на search-auto-expand.

**Проверки:** tsc 0 errors, eslint 0 errors, vitest 2366+3/2366+3 PASS (0 регрессий). vite build PASS.

---

## История (iter 173 — одной строкой)

**iter 173:** KI#51 fix (scroll-aware fade indicators для `.topnav-tabs` + GitHub link в TopNav feedback area). A5 CLOSED (iter 164 sufficient). 2366/2366 PASS.

---

## Решения пользователя по аудиту v4 (iter 165 → iter 173)

| Аспект | Решение | Приоритет | Статус |
|--------|---------|-----------|--------|
| **A1** — иерархия L1/L2/L3 | **Вариант B** — усиление контраста L1/L2 по opacity/size corner accents | №3 | **iter 168 DONE** ✅ валидировано |
| **A2** — цветовая система | **Вариант A** — разделить визуальный язык L2 (фрейм+bg-tint) и L3 (нейтральный+текст-only) | №1 | **iter 166 DONE** ✅ валидировано |
| **A3** — Regex как визуальный центр | **Вариант C** — placeholder + визуальная связь SelectedBasket → RegexOutput | №2 | **iter 167 DONE** ✅ валидировано |
| **A4** — визуальный шум | **Вариант A+B** — кнопки «Свернуть/Развернуть все подкатегории» (НЕ toggle Compact/Extended) | №4 | **iter 170 DONE** ✅ валидировано |
| **A5** — активная вкладка | iter 164 уже достаточен — не усиливать дальше | low | **CLOSED iter 173** (по фидбеку: «вариант a5-1 короче» = оставить как есть) |
| **A6** — цельная панель навигации | **Отклонено** — плохо работает при horizontal scroll на мобильном | — | не делаем |
| **A7** — косметика меню | Частично закрыт KI#51 (scroll affordance). Остальное — по конкретике. | — | partial iter 173 |

### Явно отклонённые пользователем направления

- Центрирование меню
- Полная смена цветовой схемы
- Str/Dex/Int палитра для категорий
- Цельный navbar
- Toggle Compact/Extended как в аудите (вместо этого — кнопки «Свернуть/Развернуть все»)
- Дальнейшее усиление active tab (A5 — iter 164 достаточно)

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

### Недавно закрытые

**KI#52 — Search не авто-раскрывает подкатегории (FIXED iter 174).**
При непустом `searchText` ModList/VirtualizedModList вычисляют локальные effective Set'ы: `effectiveCollapsedGroups = new Set()` (force L1 expanded), `effectiveExpandedSubGroups = new Set(allSubKeys)` (force L3 expanded). Store не мутируется → ручное состояние сохраняется при очистке поиска.

**KI#51 — Hidden categories on narrow viewports (FIXED iter 173).**
`.topnav-tabs-wrap` (relative, `flex:1`, `overflow:hidden`) вокруг `.topnav-tabs` с `::before`/`::after` fade-градиентами. JS scroll-position tracking через `useRef`/`useEffect`/`useState` toggles `--can-left`/`--can-right` классы.

### Фоновые (low-priority)

1. APCA Lc<75 для small text weight 400 — WCAG AA PASS, APCA FAIL.
2. MobileRegexBar chunk 168.37 KB (gzip 39.42 KB) — отдельный chunk для mobile-only. Содержит transitive imports из RegexOutput (`@core/limits`, `@store/url-sync`, `@shared/i18n`).

---

## FAQ (частые вопросы)

**Q: Почему в регексе появился `"!100%"` (или другой `"!..."` токен)? Это баг?**
A: Не баг. Это **намеренная защита от ложных срабатываний (FP)** через поле `regexExclude` в ETL-данных (`public/generated/*.json`). Когда два мода разделяют общую подстроку (например, `(10—15)% увеличение эффективности монстров` и `(8—12)% увеличение эффективности монстров Бездны за каждый закрытый провал, вплоть до 100%`), простое `"увеличение эффективности монстров"` матчит оба. ETL добавляет `regexExclude: ["100%"]` к простому моду → компилятор генерирует `"suffix" !"100%"`, что отсекает конфликтующий мод. Поле определено в `src/shared/types.ts` (GameToken + OptimizationEntry). ETL-логика — в `scripts/etl/`. AST-потребление — в `src/ui/hooks/category-ast-utils.ts` (function `pushLiteralsWithFamilyLogic`) и `src/core/optimization-strategies.ts`.

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

## Next iteration (iter 174 → iter 175)

**iter 174 завершён.** KI#52 (search auto-expand) — fix применён + 3 новых теста. FAQ regexExclude задокументирован.

**Ожидается от пользователя:**
1. Визуальная валидация KI#52 fix: ввести аффикс в поиск на любой странице категории → чипы с матчами видны сразу, без ручного раскрытия категорий. После очистки поиска — ручное expand/collapse состояние сохраняется.
2. Визуальная валидация iter 173 (если ещё не сделана): сжать окно → fade-индикаторы на табах; GitHub link в TopNav.
3. Конкретика по A7 — что ещё в меню требует косметики.
4. Понял ли пользователь объяснение про `"!100%"` (FAQ regexExclude)? Если нужны дополнительные пояснения — задать вопросы.

**План iter 175+:** по фидбеку пользователя. Активные KI без изменений: KI#45, KI#46, KI#47, KI#43. Оставшиеся фоновые issues: APCA Lc<75, MobileRegexBar 168 KB.

**Правило:** если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

Контакты: Discord **woonderdad** · GitHub: https://github.com/vudirvp-sketch/poe2-regex-ru

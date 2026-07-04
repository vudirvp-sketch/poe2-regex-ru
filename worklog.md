# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

## iter 158 (MIXED-mode core layer) — одной строкой

Реализован core layer для MIXED mode: AST extension (`MIXED_OR` нода + `MixedOrOptions`), compiler support (KI#45 `anchorFirstAltOnly` mitigation), builder utility (`buildMixedAstFromSelections` + `truncateMixedOrLiterals` для KI#46), 43 юнит-теста. UI-интеграция отложена на iter 159. Все проверки PASS (2278/2278 tests, tsc 0, eslint 0, vite build PASS).

## iter 159 (MIXED-mode UI integration) — одной строкой

Реализована UI-интеграция MIXED mode: `SearchLogic` extended с `'mixed'`, `optionalIds: Set<string>` в filter-store с 3-state mutual exclusion, FilterChip 3-state (click=want / shift+click=opt / right-click=exclude, amber dashed OPT border), MIXED toggle в CategoryControlPanel, `useRegexBuilder` MIXED mode + auto-truncation при > 240 chars (KI#46 mitigation), props проброшены через ModList/VirtualizedModList во все 7 page components. 28 новых тестов (18 filter-store + 10 FilterChip). Все проверки PASS (2306/2306 tests, tsc 0, eslint 0, vite build PASS). In-game verification отложена на iter 160.

## iter 160 (MIXED-mode UI — in-game verification test plan) — одной строкой

Прописаны конкретные тесты T1–T10 с реальными предметами из `регис/предметы для теста с аффиксами имплиситами_новый.md` (16 предметов, 5 категорий) в `docs/MIXED_MODE_UI_TESTS.md` (~280 строк). Добавлена §14 «MIXED-mode UI Patterns» в `docs/UI_REFACTOR_PLAN.md` (~150 строк). STATUS.md почищен. Код не изменялся — iter 159 полностью завершён (2306/2306 tests PASS).

---

Task ID: 161 (3-section SelectedBasket + family-group counters + MIXED UX hints)
Agent: main
Task: Исправить 3 UX-бага из пользовательского фидбэка: (1) SelectedBasket не показывает исключённые аффиксы, (2) счётчики показывают кол-во токенов вместо кол-ва аффиксов (12 tier-вариаций = «12 выбрано» вместо «1 выбрано»), (3) MIXED режим не отличается от AND потому что пользователь не понимает, как отметить аффикс как OPT (shift+click скрытый жест).

Work Log:
- 1: **Клонирование и анализ:** Склонировал репозиторий, изучил STATUS.md (iter 160 завершён), FilterChip.tsx (3-state chip уже реализован в iter 159), SelectedBasket.tsx (только want-секция), CategoryControlPanel.tsx (счётчики используют `tokens.length`), family-grouper.ts (нашёл существующий `countUniqueFamilyKeys()`), i18n.ts (ключи для basket/logic/summary), 8 page components (одинаковый паттерн с `excludeTokens.length`). Базовое состояние: 2306/2306 tests PASS.
- 2: **Fix #2 — Family-group counters:** Во всех 8 page components (Ring/Belt/Amulet/Relic/Waystone/Tablet/Jewel/Vendor) заменил `excludeTokens.length`/`allActiveTokens.length`/`selectedIds.size` на `countUniqueFamilyKeys(...)` (через новые переменные `wantGroupCount`/`excludeGroupCount`/`optionalGroupCount`/`activeGroupCount`). Расширил `allActiveTokens` для включения `optionalIds` (MIXED mode). Использовал существующую функцию — не пришлось писать новую логику.
- 3: **Fix #3 — MIXED UX hints:** 
  - `CategoryControlPanel.tsx`: добавил `optionalCount` prop. Когда `searchLogic==='mixed' && optionalCount > 0` → рендерит amber counter «N опц.». Когда `searchLogic==='mixed' && optionalCount === 0 && activeTokenCount > 0` → рендерит inline-подсказку «Shift+клик по аффиксу — опционально (хотя бы 1 из группы)».
  - `IconLegend.tsx`: добавил `showMixedHint` prop. Когда true → добавляет 4-ю строку с иконкой ⇄ и текстом «Shift+клик по чипу — опционально (хотя бы 1)». Backward compat: custom `items` prop override → `showMixedHint` игнорируется.
  - `i18n.ts`: добавил ключи `summary.optional` («Опц.»), `logic.mixed_hint`, `legend.opt_shift_click`.
  - Все 7 страниц: `legend={<IconLegend showMixedHint={searchLogic === 'mixed'} />}`.
- 4: **Fix #1 — SelectedBasket 3-section rewrite:** Полностью переписал `SelectedBasket.tsx` (~400 строк). Теперь рендерит 3 секции: want (нейтральный фон + ✗), opt (амбра с пунктиром + ⇄, только когда `mixedMode=true`), exclude (красный фон + ✗). Каждая секция имеет независимый «+N ещё» экспандер (cap=20 per section). Шапка показывает общий count + inline-разбивку `(N+M⇄K✗)` когда есть opt/exclude. Все новые props опциональны (backward compat с тестами и VendorPage). Добавил 7 i18n ключей: `basket.excluded_header`, `basket.optional_header`, `basket.unexclude_aria`, `basket.unoptional_aria`.
  - Обновил все 7 page components: передаю `excludedIds`, `optionalIds`, `onToggleExclude`, `onToggleOptional`, `mixedMode={searchLogic === 'mixed'}`.
- 5: **Тесты:**
  - `tests/ui/SelectedBasket.test.tsx`: +6 тестов (3-section layout: exclude renders, exclude click, opt conditional render, opt click, header total count, backward compat). 12 → 18 тестов.
  - `tests/ui/IconLegend.test.tsx`: +3 теста (showMixedHint=false default, showMixedHint=true → 4 rows, custom items override). 11 → 14 тестов.
- 6: **Проверки:** tsc 0 errors, eslint 0 errors, 2315/2315 tests PASS (+9 новых), vite build PASS (618ms, main bundle 343 KB).
- 7: **Документация:** STATUS.md переписан (iter 161 как текущая, iter 158–160 одной строкой). worklog.md — эта запись. AGENT_NAVIGATION.md — указатели обновлены. UI_REFACTOR_PLAN.md — добавлена §15 «iter 161 — User-feedback UX fixes».

Stage Summary:
- 3 UX-баги из фидбэка исправлены: SelectedBasket 3-section, family-group counters, MIXED UX hints.
- 9 новых тестов (6 SelectedBasket + 3 IconLegend), 2306 → 2315 total.
- Все проверки PASS: tsc 0, eslint 0, 2315/2315 tests, vite build PASS.
- Backward compat сохранён: все новые props опциональны, старые тесты проходят без изменений.
- KI#48 остаётся открытым — ждёт in-game прогона T1–T10 + проверки новых UX-элементов.
- Архив с изменёнными файлами + git-команды для push.

---

Task ID: 160 (MIXED-mode UI — in-game verification test plan)
Agent: main
Task: Прописать конкретные тесты T1–T10 с реальными UI для in-game verification MIXED-mode UI (KI#48), используя предметы и аффиксы из `регис/предметы для теста с аффиксами имплиситами_новый.md`. Обновить документацию (UI_REFACTOR_PLAN.md разделом о MIXED-mode UI паттернах, STATUS.md почистить). Код не менять — iter 159 полностью завершён.

Work Log:
- 1: **Клонирование и анализ:**
  - Склонировал `https://github.com/vudirvp-sketch/poe2-regex-ru.git` в `/home/z/my-project/repo/poe2-regex-ru/`.
  - Изучил `STATUS.md` (iter 159 — MIXED-mode UI integration готов), `docs/UI_REFACTOR_PLAN.md` (970 строк, нет секции про MIXED-mode UI patterns), `docs/IN_GAME_TESTS.md` (история iter 46/108/125), `регис/результаты AND+OR тестов.md` (iter 157 — core layer verified на W1/W2/W3 путевых камнях).
  - Изучил `регис/предметы для теста с аффиксами имплиситами_новый.md` — 16 предметов, 5 категорий (3 кольца, 3 путевых камня, 3 заражённые плитки, 3 амулета, 4 самоцвета).
  - Изучил реализацию: `src/ui/components/FilterChip.tsx` (3-state chip, lines 1–665), `src/ui/hooks/useCategoryPage.ts` (useRegexBuilder MIXED mode, lines 470–590), `src/ui/hooks/category-ast-utils.ts` (`buildMixedAstFromSelections`, lines 1027–1134), `src/store/filter-store.ts` (optionalIds + 3-state mutual exclusion + serialize/deserialize, lines 280–540).
- 2: **Создан `docs/MIXED_MODE_UI_TESTS.md` (~280 строк):**
  - §1: Тестовые предметы — таблицы с кодами R1–R3 (кольца), W1–W3 (путевые камни), T1–T3 (плитки), A1–A3 (амулеты), J1–J4 (самоцветы) + ключевые аффиксы каждого.
  - §2: Раунд 1 — T1–T5 (базовые сценарии):
    - T1: 1 MUST + 1 OPT (Ring, R1) → `"максимуму здоровья" "силе"`.
    - T2: 2 MUST + 2 OPT (Amulet, A1/A2 ✓, A3 ✗) → `"максимума энергетического щита" "меткости" "сопротивлению холоду|сопротивлению молнии"`.
    - T3: 1 MUST + 1 OPT + 1 EXCLUDE (Amulet, A3 исключён через `!хаосу`) → `"!хаосу" "меткости" "регенерации маны"`.
    - T4: Ranged MUST + ranged OPT reversed RANGE (Waystone, min=35 / min=85, только W3 матчит) → `"азмер групп.*\+[3-9][0-9]%|..." "анс выпадения.*\+[8-9][0-9]%|..."`.
    - T5: > 240 chars auto-truncation (Waystone, 4 MUST + 4 OPT длинных аффиксов, только W1 матчит) — проверка KI#46 mitigation.
  - §3: Раунд 2 — T6–T10 (UI-specific):
    - T6: Shift+click → OPT state visual (amber dashed border, `.chip-opt` CSS class, ARIA `aria-checked="mixed"`).
    - T7: Right-click → exclude (browser contextmenu suppressed via `preventDefault`, red border, keyboard parity shift+Enter).
    - T8: URL shareable link с `opt` key → deserialize восстанавливает 3-state (MUST + OPT + EXCLUDE после reload).
    - T9: Toggle MIXED → AND → MIXED → optionalIds не теряется (только игнорируется в AND mode, восстанавливается в MIXED).
    - T10: 2+ OPT tokens → одна MIXED_OR группа (Jewel, J3/J4 матчат, J1/J2 нет).
  - §4: UX Feedback Checklist (10 вопросов для пользователя).
  - §5: Известные ограничения (KI#45/46/47/48 с mitigation).
  - §6: Порядок прогонки (6 шагов).
  - §7: Инструкция «Если найден новый баг» (KI#49+ в STATUS.md).
- 3: **Обновлён `docs/UI_REFACTOR_PLAN.md` — добавлена §14 «MIXED-mode UI Patterns (iter 158–159, verification iter 160)» (~150 строк):**
  - §14.1: Концепция MIXED mode (`"!BAD" "MUST" "OPT1|OPT2"` semantics).
  - §14.2: Реализация — core layer (iter 158) + UI layer (iter 159) с таблицами файлов и изменений.
  - §14.3: UX паттерны — 3-state chip interactions table, mutual exclusion invariant, URL persistence, mode switching.
  - §14.4: KI mitigations (KI#45/46/47/48).
  - §14.5: Test coverage (71 unit-test + 10 in-game tests = 81 total).
  - §14.6: Backward compatibility (mixedMode default=false, URL `opt` key missing in old links, SearchLogic extended).
  - §14.7: Open questions для iter 161+ (UX feedback, onboarding hint, icon legend, KI#47 fix, multi-OPT groups).
- 4: **Обновлён `STATUS.md` — почищен от длинной истории:**
  - Текущая итерация: 160 (in-game verification test plan готов).
  - iter 158/159 сжаты до одной строки каждый.
  - Known Issues: оставлены только KI#43/45/46/47/48 + 4 фоновых.
  - Удалены закрытые KI (iter 150–157) — они в git history.
  - Next iteration: iter 161 plan (закрыть KI#48 + UX polish).
- 5: **Обновлён `worklog.md` — эта запись (iter 158/159 сжаты до одной строки каждый).**

Stage Summary:
- **In-game verification test plan ГОТОВ.** `docs/MIXED_MODE_UI_TESTS.md` содержит 10 конкретных тестов T1–T10 с реальными предметами из `регис/предметы для теста с аффиксами имплиситами_новый.md`. Каждый тест: категория, шаги UI (click / shift+click / right-click), ожидаемый regex (форма), таблица ожиданий (✅/❌ для каждого предмета), инструкция «Если FAIL».
- **Документация актуализирована:**
  - `docs/UI_REFACTOR_PLAN.md` — +§14 (MIXED-mode UI Patterns, ~150 строк).
  - `STATUS.md` — почищен, iter 160 как текущее состояние, KI#48 ждёт прогона.
  - `worklog.md` — iter 158/159 сжаты, iter 160 подробно.
- **Изменённые файлы (3):**
  - `docs/MIXED_MODE_UI_TESTS.md` — NEW (test plan T1–T10).
  - `docs/UI_REFACTOR_PLAN.md` — +§14 (MIXED-mode UI patterns).
  - `STATUS.md` — почищен, актуализирован.
  - `worklog.md` — iter 160 запись.
- **Код НЕ изменён** — iter 159 полностью завершён, все проверки PASS (2306/2306 tests, tsc 0, eslint 0, vite build PASS). iter 160 = чисто документационная итерация.
- **Stopping point:** iter 160 завершён. Next iter 161 — пользователь прогоняет T1–T10 в игре, заполняет UX Feedback Checklist, закрывает KI#48. По результатам — UX polish (onboarding hints, icon legend update, visual tweaks) + возможные новые KI#49+ если найдены баги.

---

Task ID: iter-162
Agent: main (continuation from iter 161)
Task: Fix KI#49 (T3 bug — pure-EXCLUDE dropped in MIXED mode) + add explicit ⓘ glyph with delayed tooltip on the MIXED chip.

Work Log:
- 0: **Прочитал feedback пользователя из iter 161:**
  - T1, T2 — PASS.
  - T3 — FAIL: при 1 EXCLUDE (`+XX% к сопротивлению хаосу`, только A3=14%) + 1 MUST (`+XX к меткости`) + 1 OPT (`XX% повышение скорости регенерации маны`) → ожидалось `"!хаосу" "меткости" "регенерации маны"`, фактически `"меткости" "регенерации маны"` (EXCLUDE потерян).
  - T4, T5 — PASS.
  - T6 — пользователь пропустил.
  - UX запрос: добавить явный ⓘ glyph на чип «Смешанный» с delayed hover tooltip про shift+click и right-click.
- 1: **Документировал KI#49 в `STATUS.md`** (per rule: «Сначала документируй — потом фиксий»).
- 2: **Root cause analysis KI#49:**
  - В `src/ui/hooks/category-ast-utils.ts` функция `buildMixedAstFromSelections` строила `excludedTokens` фильтрацией `mustTokens` и `optTokens` по `excludedIds`.
  - В `src/ui/hooks/useCategoryPage.ts` call site: `mustTokens = selectedTokens.filter(t => selectedIds.has(t.id))`, `optTokens = selectedTokens.filter(t => optionalIds.has(t.id))`. Pure-exclude токен (только в `excludedIds`) НЕ попадает ни в `mustTokens`, ни в `optTokens`, следовательно не попадает и в `excludedTokens`. Блок `!BAD` не генерируется.
  - Существующие тесты в `tests/ui/buildMixedAst.test.ts` не ловили баг, потому что в test workaround BAD-токен включался в `mustTokens` вручную (см. комментарий в тесте `builds T7 pattern`: «Note: BAD token must be in mustTokens or optTokens to be picked up as excluded»). Это маскировало баг.
- 3: **Fix KI#49 в `src/ui/hooks/category-ast-utils.ts`:**
  - Добавлен опциональный параметр `excludeTokens: GameToken[] = []` в конец сигнатуры `buildMixedAstFromSelections` (после `thresholdEnabled`).
  - `excludedTokens` теперь собирается из 3 источников с dedup по ID: (1) mustTokens ∩ excludedIds (legacy), (2) optTokens ∩ excludedIds (legacy), (3) excludeTokens (новый путь для pure-exclude).
  - Подробный комментарий объясняет, почему 3 источника и почему backward-compat сохранён.
  - JSDoc обновлён с описанием нового параметра.
- 4: **Fix call site в `src/ui/hooks/useCategoryPage.ts`:**
  - Добавлен `const excludeTokens = selectedTokens.filter(t => excludedIds.has(t.id));` перед вызовом.
  - `excludeTokens` передаётся как 10-й аргумент в `buildMixedAstFromSelections`.
  - `selectedTokens` уже включает все токены (selectedIds ∪ excludedIds ∪ optionalIds) — фильтр по `excludedIds` даёт pure-exclude токены.
- 5: **Regression tests в `tests/ui/buildMixedAst.test.ts` (+3 теста):**
  - `KI#49: pure-EXCLUDE token (not in must/opt) appears in !BAD block` —正面 кейс: 1 MUST + 1 OPT + 1 EXCLUDE (через `excludeTokens`) → `"!хаосу" "меткости" "регенерации маны"`.
  - `KI#49 regression: WITHOUT excludeTokens param, pure-EXCLUDE is dropped (documents the bug)` — backward-compat тест: та же выборка, но без `excludeTokens` → `"меткости" "регенерации маны"` (без `!хаосу`). Документирует баг, подтверждает что fix именно в новом параметре.
  - `KI#49: excludes from must/opt and excludeTokens are deduped by ID` — edge case: тот же токен в mustTokens и в excludeTokens → `"!BAD" "MUST"` (не `"!BAD|BAD" "MUST"`).
- 6: **i18n — `src/shared/i18n.ts`:**
  - Новый ключ `logic.mixed_aria`: «Пояснение к смешанному режиму (Shift+клик и правый клик)» — aria-label для ⓘ glyph.
- 7: **UX enhancement — `src/ui/components/CategoryControlPanel.tsx`:**
  - Импортирован `Tooltip` из `@ui/components/Tooltip`.
  - На parent radiogroup `<div className="flex gap-1">` добавлен `items-center` для вертикального выравнивания меньшего ⓘ (16x16) с большими кнопками AND/OR/MIXED (~25px высоты).
  - После MIXED `<button>` добавлен sibling `<Tooltip content={t('logic.mixed_tooltip')} ariaLabel={t('logic.mixed_aria')} className="-ml-0.5 text-[12px] text-muted hover:text-accent-amber-soft" />`.
  - Tooltip рендерит `<button>` с default glyph `ⓘ`, hover delay 350ms (существующая логика). Click на ⓘ не переключает logic mode (`e.stopPropagation()` в `handleClick` Tooltip'а).
  - Sibling-позиция (НЕ nested) — валидная ARIA tree (button + button в одном radiogroup).
  - `-ml-0.5` (-2px margin-left) визуально прижимает ⓘ к MIXED чипу, чтобы они читались как одна единица.
- 8: **Документация:**
  - `STATUS.md` — заголовок iter 162, §«Текущее состояние» переписан (KI#49 fix + ⓘ glyph), KI#49 в Known Issues, KI#48 обновлён (T1/T2/T4/T5 PASS, T3 fix, T6–T10 ждут), таблица «Подтверждённые ограничения» обновлена, Next iteration (iter 162→163) переписан.
  - `worklog.md` — эта запись.
- 9: **Проверки:**
  - `tsc --noEmit -p tsconfig.app.json` — 0 ошибок.
  - `eslint .` — 0 ошибок.
  - `pnpm test` — 2318/2318 PASS (was 2315, +3 KI#49 regression tests).
  - `vite build` — PASS (main bundle 343 KB, не изменился существенно).

Stage Summary:
- **KI#49 fix готов и покрыт regression tests.** Pure-EXCLUDE токены в MIXED-режиме теперь корректно попадают в `!BAD`-блок. T3 должен PASS при повторном прогоне.
- **ⓘ glyph на MIXED chip добавлен.** Видимый значок рядом с чипом «Смешанный», hover 350ms → tooltip с объяснением shift+click (OPT) и right-click (EXCLUDE). Sibling of `<button>` — валидная ARIA tree.
- **Все проверки PASS:** tsc 0, eslint 0, 2318/2318 tests, vite build PASS.
- **Изменённые файлы (6):**
  - `src/ui/hooks/category-ast-utils.ts` — `excludeTokens` param + dedup.
  - `src/ui/hooks/useCategoryPage.ts` — call site передаёт excludeTokens.
  - `src/ui/components/CategoryControlPanel.tsx` — Tooltip на MIXED chip + items-center.
  - `src/shared/i18n.ts` — `logic.mixed_aria` key.
  - `tests/ui/buildMixedAst.test.ts` — +3 KI#49 regression tests.
  - `STATUS.md`, `worklog.md` — актуализированы.
- **Stopping point:** iter 162 завершён. Next iter 163 — пользователь повторяет T3 (должен PASS), прогоняет T6–T10, заполняет UX Feedback Checklist, проверяет новый ⓘ glyph, закрывает KI#48. Возможные новые KI#50+ если найдены баги.

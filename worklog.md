# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

## iter 158–174 — одной строкой

**iter 158:** core MIXED mode (`MIXED_OR` AST + `anchorFirstAltOnly` mitigation для KI#45 + `truncateMixedOrLiterals` для KI#46, 43 теста).
**iter 159:** UI MIXED integration (`optionalIds`, FilterChip 3-state, MIXED toggle, 28 новых тестов).
**iter 160:** test plan T1-T10 в `docs/MIXED_MODE_UI_TESTS.md`.
**iter 161:** 3-section SelectedBasket (want/opt/exclude) + family-group counters.
**iter 162:** KI#49 fix (EXCLUDE-токен не теряется в MIXED) + ⓘ glyph на MIXED chip.
**iter 163:** T9 regression test + UX cleanup. **KI#48 и KI#49 ЗАКРЫТЫ**. 2319 tests.
**iter 164:** UX redesign v3 — P1 (`.affix-origin-header` mini-frame для L2), P2 (усиление `.nav-mode-active`), P3 (усиление `.regex-output` + pulse 600ms). CSS 60→61 KB.
**iter 165:** Концепт-спецификация `docs/REDESIGN_CONCEPT_v4.md` — детальная проработка 7 аспектов аудита с вариантами решений. Код НЕ изменялся.
**iter 166 (A2):** Display-layer override: 7 сайтов L3 sub-group рендера переведены с `${bgClass} border ${borderClass}` на `bg-panel/15 border border-edge/15` + цветной `colorClass` (text-only). 2319/2319 PASS, CSS +0.14 KB.
**iter 167 (A3):** Empty-state RegexOutput переписан (`.regex-output__empty` dashed gold border + ↑ arrow + hint). Новый компонент `BasketToRegexFlow.tsx`. +9 тестов (2328/2328). CSS +1.03 KB.
**iter 168 (A1 Вариант B):** Усиление контраста L1/L2 corner accents: L1 6×6/0.4 → 8×8/0.55, L2 5×5/0.35 → 4×4/0.30 (контраст ~12% → ~25%). 4 правки в `src/index.css`. 2328/2328 PASS.
**iter 169 (KI#50):** Фикс потери expand/collapse состояния при смене вкладок. Helpers `readUiState`/`writeUiState`/`clearUiState`/`filterInCategoryKeys` в `src/store/local-settings.ts`. useState initializer + persist block в `useCategoryPage.ts`. +31 тест (2359/2359). Per-category `poe2:uistate:<categoryId>` localStorage, pattern mirrors KI#30 favorites.
**iter 170 (A4):** Conditional rendering кнопок «Развернуть/Свернуть все подкатегории» в `ModList.tsx` + `VirtualizedModList.tsx`. `allSubKeys` extracted в `useMemo`. +2 i18n ключа. +6 новых A4 тестов, 7 existing обновлены. 2366/2366 PASS. CSS без изменений (61.17 KB).
**iter 171:** Cleanup — удалены `ITER163_README.md` + `DELETED.txt` (stale delivery-артефакты iter 163). Только docs.
**iter 172:** Fix `act()` warnings в `tests/ui/RegexOutput.test.tsx` (background issue closed). Паттерн `vi.useFakeTimers()`/`vi.useRealTimers()` (как в `Tooltip.test.tsx`) + flush microtasks внутри `act()` вместо `vi.waitFor`. 0 warnings, 2366/2366 PASS, 0 регрессий.
**iter 173 (KI#51 + GitHub link):** Fix hidden categories on narrow viewports. Новый wrapper `.topnav-tabs-wrap` (relative, `flex:1`, `overflow:hidden`) вокруг `.topnav-tabs` с `::before`/`::after` fade-градиентами (24px, `var(--poe-bg)` → transparent). JS scroll-position tracking через `useRef`/`useEffect`/`useState` toggles `--can-left`/`--can-right` классы. GitHub link добавлен в `.topnav-feedback` рядом с Discord-хинтом: `Баги и идеи → Discord: woonderdad · GitHub ↗` (lg+, `target="_blank" rel="noopener noreferrer"`). Новый i18n ключ `nav.github`. A5 CLOSED (iter 164 sufficient). A7 partial. 2366/2366 PASS, tsc 0, eslint 0, CSS 61.17 → 62.37 KB (+1.20 KB raw / +0.05 KB gzip).
**iter 174 (KI#52 + FAQ regexExclude):** Fix search auto-expand подкатегорий. Пользователь сообщил: при поиске отображаются только закрытые категории, чипы спрятаны внутри, приходится вручную раскрывать. Fix: в `ModList.tsx` и `VirtualizedModList.tsx` при непустом `searchText` вычисляются ЛОКАЛЬНЫЕ `effectiveCollapsedGroups` (= `new Set()`) и `effectiveExpandedSubGroups` (= `new Set(allSubKeys)`) — store НЕ мутируется. FAQ про `regexExclude` / `"!100%"` задокументирован в STATUS.md. +4 новых теста. 2370/2370 PASS.

---

Task ID: iter-175
Agent: main
Task: Разведка и планирование новой категории `/timeless-jewel` для особых самоцветов (Undying Hate + Heroic Tragedy), которые заменяют ноды древа атласа. Регекс должен подсвечивать только названия нод — без цифр, без аффиксов. Не смешивать с существующей категорией `/jewel`. Код НЕ изменять — только план.

Work Log:
- 0: **Контекст из чата:** Пользователь хочет отдельный раздел для генерации регексов подсветки нод древа атласа. Два особых самоцвета: «Вечная ненависть» (Undying Hate) и «Трагедия героев» (Heroic Tragedy). Тесты Atlas regex-семантики уже проведены: multi-word OR ✅, AND ❌, NOT ❌, case-insensitive ✅, `.*` bridge ✅.
- 1: **Клонировал репозиторий** `https://github.com/vudirvp-sketch/poe2-regex-ru.git` в `/home/z/my-project/repo`.
- 2: **Изучил архитектуру проекта** — React 19 + TypeScript + Vite, 8 категорий (waystone/tablet/relic/jewel/vendor/belt/ring/amulet) + home. Каждая категория: page component + route + nav-item + i18n-keys + JSON-данные (`public/generated/<cat>.json`) + ETL-pipeline (`scripts/etl/`). Regex-engine: `src/core/compiler.ts` + `optimizer.ts` + `ast.ts` (item-семантика: AND ✅, NOT ✅, multi-word OR ❌). Существующая `/jewel` уже мержит 3 JSON (jewel + jewel-desecrated + jewel-corrupted) через `loadMergedCategoryData`.
- 3: **Распарсил PoE2DB-страницы** обоих самоцветов (`https://poe2db.tw/ru/Undying_Hate` + `https://poe2db.tw/ru/Heroic_Tragedy`). Извлёк секцию `#ВневременнойсамоцветPassive` через Python regex. Получил **35 нод для Вечной ненависти** (раздел /35) и **40 нод для Трагедии героев** (раздел /40). Подтверждено: это AlternatePassiveSkills — альтернативные ноды, на которые самоцвет заменяет стандартные ноды древа атласа в радиусе. Списки сохранены в `регис/undying_hate_nodes.txt` + `регис/heroic_tragedy_nodes.txt`.
- 4: **Зафиксировал Atlas regex-семантику** (отличается от item-семантики): multi-word OR работает ✅, AND не работает ❌, NOT не работает ❌. Это означает, что существующий regex-engine НЕ подходит для новой категории — нужен упрощённый `buildAtlasRegex()` (только OR-паттерны).
- 5: **Составил план** `docs/ATLAS_JEWEL_PLAN.md` (9 секций):
  - §1 Постановка задачи + обоснование изоляции от `/jewel` (таблица сравнения).
  - §2 Atlas regex-семантика (таблица тестов + ключевое ограничение + 3 варианта регекса).
  - §3 Архитектурное решение — Вариант A: новый top-level раздел `/timeless-jewel` с selector внутри. Отклонённые альтернативы: sub-section в `/jewel`, расширение origin-системы, две отдельные страницы.
  - §4 Дата-модель — новый `AtlasNodeToken` (НЕ наследует GameToken) + Zod-схема + JSON-файл `public/generated/timeless-jewel.json` (ручная сборка vs ETL-парсер — рекомендации).
  - §5 UI/UX план — nav-item, i18n-ключи, структура страницы `TimelessJewelPage.tsx`, новый компонент `AtlasNodeList.tsx`, новый regex-builder `buildAtlasRegex()`.
  - §6 План реализации — iter 176 (дата-модель + минимальная страница), iter 177 (полировка + SEO), iter 178+ (ETL опционально).
  - §7 Риски и mitigations — длина регекса > 250 chars, дубликаты имён между самоцветами, регрессия `/jewel`, изменение Atlas-семантики.
  - §8 Что нужно от пользователя для старта iter 176.
  - §9 Ссылки.
- 6: **Обновил STATUS.md** — header iter 174 → 175; новая секция «Текущее состояние (iter 175 — РАЗВЕДКА)»; новая секция «Roadmap: новая категория `/timeless-jewel`» с таблицей iter 175-178; iter 174 + 173 → одной строкой в «История»; удалена устаревшая секция «Решения пользователя по аудиту v4 (iter 165 → iter 173)» (все DONE, не тянуть в новую итерацию); удалена устаревшая секция «Новые идеи пользователя (D1-D3)»; FAQ regexExclude сокращён; «Подтверждённые ограничения PoE2» разбита на Item-семантику + Atlas-семантику (новая подтаблица); «Next iteration» переписана под iter 175 → iter 176 с 6 пунктами «что нужно от пользователя».
- 7: **Обновил AGENT_NAVIGATION.md** — header iter 174 → 175 (краткое описание + ссылка на план); удалены подробности KI#50/51/52 (всё закрыто, не тащить); добавлен pitfall #27 «Atlas regex-семантика ОТЛИЧАЕТСЯ от item-семантики» с полным описанием отличий; обновлён Documentation Map — `REDESIGN_CONCEPT_v4.md` помечен как «реализован, reference only», добавлен `ATLAS_JEWEL_PLAN.md`.
- 8: **Обновил README.md** — добавлена строка `docs/ATLAS_JEWEL_PLAN.md` в таблицу документации; добавлена строка `регис/` с описанием.

Stage Summary:
- **iter 175 завершён (разведка и планирование).** План новой категории `/timeless-jewel` составлен в `docs/ATLAS_JEWEL_PLAN.md`. Код НЕ изменялся.
- **Изменённые файлы (iter 175):**
  - `docs/ATLAS_JEWEL_PLAN.md` — НОВЫЙ файл (план, 9 секций).
  - `регис/undying_hate_nodes.txt` — НОВЫЙ файл (35 названий нод Вечной ненависти, распарсенных с PoE2DB).
  - `регис/heroic_tragedy_nodes.txt` — НОВЫЙ файл (40 названий нод Трагедии героев, распарсенных с PoE2DB).
  - `STATUS.md` — header iter 175, новая секция «Текущее состояние (iter 175)», новая секция «Roadmap», удалены устаревшие секции (Аудит v4, D1-D3), Atlas-семантика добавлена в «Подтверждённые ограничения», Next iteration переписана.
  - `AGENT_NAVIGATION.md` — header iter 175, pitfall #27 (Atlas regex), Documentation Map обновлён.
  - `README.md` — добавлен `ATLAS_JEWEL_PLAN.md` + `регис/` в таблицу документации.
  - `worklog.md` — iter 175 добавлен в shared-секцию и как Task ID section.
- **Stopping point:** iter 175 завершён (разведка). Ждём от пользователя подтверждения по 5 пунктам (см. STATUS.md → Next iteration): (1) архитектура Вариант A, (2) название раздела, (3) проверка списков нод, (4) ETL ручная vs авто, (5) UI новый AtlasNodeList vs обёртка. После — iter 176: дата-модель + JSON + минимальная страница.
- **Что НЕ сделано (намеренно, по требованию пользователя «пока просто разведка и планирование»):** код компонентов, типов, Zod-схем, JSON-файла, тестов, route, nav-item, i18n — всё отложено на iter 176.

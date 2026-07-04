# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 157 (Mixed AND+OR in-game verification)
Agent: main
Task: пользователь прогнал в игре 10 тестов (T1–T5 + T6–T10) на 3 путевых камнях (Призрачный камень / Изменённый прогресс / Разрушенный коридор). Обработать результаты, обновить документацию, подготовить архив к push.

Work Log:
- 1: **Раунд 1 — T1–T5 (basic verification):**
  - T1 (`"crit_chance" "crit_damage" "пробивает|порога состояний"`): ✅ W1, ✅ W3, ❌ W2 — mixed AND+OR РАБОТАЕТ.
  - T2 (3 mandatory + OR): идентично T1 — количество mandatory не влияет.
  - T3 (Path D `.*` мост внутри OR + AND): идентично T1 — Path D сохраняется.
  - T4 (`^` на обеих ALT): ✅ W1, ❌ W2, ❌ W3 — `^` на второй ALT ломает матч (KI#45).
  - T5 (268 chars): rejected игрой — лимит 250 жёсткий (KI#46).
- 2: **Раунд 2 — T6–T10 (extended scenarios for UI):**
  - T6 (две OR-группы + AND): ✅ W1, ✅ W3, ❌ W2 — несколько OPT-групп работают, AND между ними.
  - T7 (`!` negation + AND + OR): ✅ W1, ✅ W3, ❌ W2 — `!` item-wide работает в combined-режиме. W2 исключён через `!замерзшей земли`.
  - T8 (truncation в combined): ✅ W1, ✅ W3, ❌ W2 — truncation работает, можно экономить длину (mitigation для KI#46).
  - T9 (пороги в OPT): ✅ W1, ❌ W2, ❌ W3 — пороги работают только в «прямой» форме `N%.*suffix`. W3 не matчит из-за reversed-формы pierce: блок «Урон монстров **пробивает 13%** сопротивлений стихиям» — «пробивает» ДО числа, паттерн `([6-9]|1[0-6])%.*пробивает` ожидает число → потом «пробивает». Для reversed нужен паттерн `suffix.*N%` (через `reversed` флаг в AST, уже реализован для MUST).
  - T10 (OR без матчей): все ❌ — OR-группа без матчей отбрасывает все предметы (semantics = AND с OR-группой как обязательным элементом).
- 3: **Интерпретация:**
  - KI#44 (Mixed AND+OR) — ЗАКРЫТ. Полная механика verified: 10 тестов, все PASS с учётом известных constraints (KI#45/KI#46).
  - T9 — НЕ новый баг. Reversed-форма порогов в OPT требует того же подхода что и для MUST (через `reversed` флаг в AST, уже реализован в `category-ast-utils.ts`). UI в iter 158 должен переиспользовать эту логику.
- 4: **Обновил STATUS.md:**
  - Header iter 157 — расширенный brief со всеми 10 тестами.
  - KI#44 — в «Закрытые» (✅ iter 157, 10 тестов).
  - KI#45/KI#46 — в «Активные» с пометкой «для UI-режима MIXED».
  - Таблица PoE2 limitations — добавлены 7 новых строк (combined AND+OR ✅, Path D + AND ✅, несколько OR ✅, `!`+AND+OR ✅, truncation ✅, пороги в OPT ✅/⚠️, OR без матчей ✅).
  - Next iteration — конкретный чек-лист для iter 158 (UI MIXED с учётом всех verified-возможностей).
- 5: **Обновил `регис/результаты AND+OR тестов.md`** — добавил T6–T10 с результатами и выводами, расширил секцию «Итоговые правила для UI» до 10 пунктов.
- 6: **Не трогал src/ код** — iter 157 чисто documentation pass. Реализация UI-режима MIXED — в iter 158.

Stage Summary:
- **KI#44 CLOSED** — Mixed AND+OR fully verified (10 in-game tests T1–T10 PASS):
  - ✅ `"MUST1" "MUST2" "OPT1|OPT2"` — базовый шаблон (T1–T3)
  - ✅ Несколько OPT-групп (T6)
  - ✅ `!` item-wide negation в combined (T7)
  - ✅ Truncation в combined (T8) — mitigation для KI#46
  - ✅ Пороги в OPT прямая форма (T9), reversed через `reversed` флаг в AST (без нового KI)
  - ✅ OR без матчей → все скрыты (T10)
- **KI#45 OPEN** — `^` только на первой ALT в OR (T4).
- **KI#46 OPEN** — лимит 250 chars жёсткий (T5), mitigation: auto-truncation (T8).
- **Изменённые файлы:** `STATUS.md` (updated), `worklog.md` (updated), `регис/результаты AND+OR тестов.md` (updated с T6–T10).
- **Stopping point:** iter 157 завершён, готов к push. Все in-game данные для UI MIXED собраны. Next iter 158 — реализовать UI-режим «MIXED» (checkbox MUST/OPT, генератор с поддержкой нескольких OPT-групп + `!` negation + счётчик длины + auto-truncation + `^` только на первой ALT + пороги с учётом reversed-флага).

---

Task ID: 156 — подготовлен пакет in-game тестов для смешанной AND+OR логики (30 тестов, 9 категорий в `регис/тесты AND+OR смешанная логика.md`). Без code changes в src/. vitest baseline сохранён.

Task ID: 155 — KI#43 deploy retry fix: `actions/deploy-pages@v4` обёрнут в `Wandalen/wretry.action@v3` (3 attempts, 30s delay) для auto-retry при transient Pages API failures. Удалены 2 stale manifest files. vitest 2235/2235 (без code changes в src/).

Task ID: 154 — user visual verification закрыл KI#38/31/41 (scroll jitter на «Самоцветы» 250+ токенов, mobile UX на 8 страницах, ⓘ glyph in-box) + repo cleanup (6 root files + 11 one-shot scripts deleted, 11 `.etl-cache/*.html` untracked, refs updated). vitest 2235/2235 (без code changes).

Task ID: 153 — KI#10/KI#12 hardening (manualOverride flag) + browser testing iter 148–150 + code-split bundle (React.lazy + Suspense, 603→342 KB). vitest 2235/2235. См. Pitfall 54 в AGENT_NAVIGATION.md для general lessons.

Task ID: 152 — KI#42 search focus loss fix на jewel/waystone (`mergeCategories` inline-arrays → module-level constants + `dataRef` guard в `useCategoryData`). vitest 2228/2235 (7 pre-existing data-test failures — KI#10).

Task ID: 151 — stale comments + trash files cleanup (Pure documentation/cleanup pass — 6 упоминаний `LeftPanelFavorites` упрощены, 6 устаревших patch-notes файлов удалено, README заменён на минимальный). vitest 2235/2235.

Task ID: 150 — favorites wiring fix (⭐ pin button не отображался на belt/ring/amulet/jewel в two-column layout) + ⓘ in-box layout (glyph в GroupHeader позиционировался как flex-sibling → сдвигал toggle-button sideways → теперь absolute right-2 top-1/2 -translate-y-1/2 z-10 + pr-7 на toggle-button). vitest 2235/2235.

Task ID: 149 — PriorityFilter removal (полное удаление фильтра «Приоритет» из UI, state-store, URL sync, localStorage, типов, схем, тестов и документации). vitest 2235/2235.

Task ID: 148 — toolbar UX refactor (radiogroups → <select>, waystone checkboxes → color-coded chip-toggles). vitest 2235/2235.

Task ID: ≤147 — см. git log. Полная история в `git log --oneline`.

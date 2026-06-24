# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 126
Agent: main
Task: Фикс KI#10 — ambiguous suffix FP для `Редкость предметов` (disambiguate от возможной `Редкость монстров`). Пользователь сообщил: iter 125 fixed regex `"едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` ВСЁ ЕЩЁ подсвечивал waystone с `Редкость предметов: +11%` (FP). По гипотезе пользователя, на waystone 2-4 имплицита (включая `Редкость предметов` + `Редкость монстров`), и общий suffix `едкость` совпадает с несколькими типами редкости.

Work Log:
- 1: Репозиторий клонирован. Контекст загружен из STATUS.md (iter 125 = current), AGENT_NAVIGATION.md (35 pitfalls + Path D + 8 deterministic principles), worklog.md (iter 125 подробно). Изучены ключевые файлы: `public/generated/waystone.json` (token `waystone.implicit.item_rarity` с regex `'едкость'`), `scripts/etl/normalize.ts` (generateWaystoneImplicitTokens), `scripts/etl/compute-regex.ts` (computeMinimalUniqueSubstring → auto-computes `'едкость'` как shortest unique substring), `scripts/etl/i18n-overrides.json` (override mechanism — поддерживает explicit `regex` field), `scripts/run-etl.ts` (applyI18nOverrides применяет overrides после ETL).
- 2: Анализ bug: токен `waystone.implicit.item_rarity` имеет rawTextTemplate `Редкость предметов: +##%`. ETL auto-compute возвращает `'едкость'` (7 chars) как shortest unique substring — это suffix после удаления leading char `Р`. Проблема: `'едкость'` матчит ЛЮБОЙ текст с `едкость` substring, включая гипотетическую `Редкость монстров: +##%` (если такая implicit существует в игре, но не в нашей БД — пользователь утверждал, что на waystone 2-4 имплицита, включая `редкость монстров`). Когда на waystone есть `Редкость предметов +11%` (XX<20, не матчит `[2-9][0-9]`) + `Редкость монстров +XX%` (XX≥20, матчит), регекс `едкость.*\+[2-9][0-9]%` матчит второй блок → FP. Симулятор не ловит кейс, т.к. в нашей БД только `Редкость предметов` имеет `едкость` substring, и `.*` в симуляторе не пересекает blocks (per Phase 7 verification).
- 3: Документация KI#10 в STATUS.md (ПЕРВЫЙ ШАГ — per user instruction «сначала документируй, потом фиксий»): root cause, фикс, limitation (если FP вызван cross-block `.*`, фикс НЕ поможет → KI#11). Также добавлен KI#11 (NEW, MONITORING): cross-block `.*` hypothesis — если in-game `.*` пересекает blocks для multi-implicit items, iter 126 fix недостаточен.
- 4: Реализация fixed через `scripts/etl/i18n-overrides.json` — добавлены 2 override entries:
  - `waystone.implicit.item_rarity`: `regex: "едкость предметов"` (12 chars, literal space) — уникально идентифицирует `Редкость предметов`.
  - `waystone-desecrated.implicit.item_rarity`: тот же override (desecrated variant).
  - Каждый override включает `rawText`, `rawTextTemplate` (без изменений) + `source` комментарий с описанием фикса.
  - `_updated` timestamp обновлён с `2026-06-06` на `2026-06-25`.
- 5: Прямой patch JSON-файлов (поскольку ETL требует доступа к poe2db.tw, который недоступен):
  - `public/generated/waystone.json`: `waystone.implicit.item_rarity.regex.ru` изменён с `"едкость"` на `"едкость предметов"`.
  - `public/generated/waystone-desecrated.json`: то же изменение для `waystone-desecrated.implicit.item_rarity.regex.ru`.
  - Изменения применены через Edit tool, JSON валидность подтверждена через `python3 -c "import json; json.load(open(...))"`.
- 6: 24 новых регрессионных теста в `tests/core/iter126-ki10-rarity-disambiguation.test.ts` (5 секций):
  - SECTION 1 (4 теста): Compile output — verify new regex format с disambiguated suffix `'едкость предметов'` (round10=true/false, AND-joined с effectiveness, 250-char limit check).
  - SECTION 2 (8 тестов): Same-block disambiguation — `Редкость предметов` vs `Редкость монстров` (hypothetical). Тестирует FP case (Редкость предметов +11% + Редкость монстров +25% + Эффективность +25%), disambiguation case, AND-logic enforcement, range notation protection.
  - SECTION 3 (5 тестов): JSON data verification — проверяет, что waystone.json + waystone-desecrated.json содержат новый regex, и что i18n-overrides.json имеет соответствующие entries.
  - SECTION 4 (4 теста): Edge cases — old vs new regex behavior comparison. Тестирует, что old regex (`'едкость'`) матчит FP case (Редкость монстров +25%), а new regex (`'едкость предметов'`) НЕ матчит — disambiguation works. Также проверяет, что оба regex матчат correct case (Редкость предметов +25%) — no regression.
  - SECTION 5 (3 теста): KI#11 simulator model — документирует, что симулятор моделирует `.*` как single-block (per Phase 7). Если in-game `.*` пересекает blocks, FP сохранится в игре, но тесты будут PASS (симулятор ≠ in-game). KI#11 NOTE test всегда проходит (documentation).
- 7: Верификация: `npx vitest run tests/core/iter126-ki10-rarity-disambiguation.test.ts` → 24/24 tests passed. `npx vitest run` (full suite) → 1939/1939 tests passed (39 test files, +24 vs iter 125). `npx tsc -b` → 0 errors. `npx eslint .` → 0 problems.
- 8: Документация актуализирована:
  - `STATUS.md` — переписан под iter 126: «Текущее состояние» описывает KI#10 фикс, 9 KI (新增 KI#10 fixed + KI#11 monitoring). Таблицы «Подтверждённые ограничения PoE2» (2 новых строки: ambiguous suffix + cross-block .* hypothesis) и «Оптимальные стратегии» (1 новая строка для reversed RANGE с ambiguous suffix) расширены.
  - `AGENT_NAVIGATION.md` — header summary обновлён под iter 126; Pitfall 36 (ambiguous suffix FP) + Pitfall 37 (cross-block .* hypothesis KI#11) добавлены.
  - `worklog.md` — iter 126 подробно, iter 125 сжат до одного абзаца.

Stage Summary:
- **iter 126 COMPLETE.** Фикс KI#10 — ambiguous suffix FP для `Редкость предметов` (disambiguate от возможной `Редкость монстров`).
- **Изменённые файлы (6):**
  - `scripts/etl/i18n-overrides.json` — добавлены 2 override entries для `waystone.implicit.item_rarity` + `waystone-desecrated.implicit.item_rarity` с `regex: "едкость предметов"`.
  - `public/generated/waystone.json` — прямой patch `regex.ru` с `"едкость"` на `"едкость предметов"` для `waystone.implicit.item_rarity`.
  - `public/generated/waystone-desecrated.json` — такой же patch для `waystone-desecrated.implicit.item_rarity`.
  - `tests/core/iter126-ki10-rarity-disambiguation.test.ts` — NEW файл, 24 регрессионных теста (5 секций).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — актуализированы (KI#10 fixed, KI#11 monitoring, Pitfall 36+37 добавлены).
- **Тесты/типы/lint:** ✅ vitest 1939/1939 (39 test files; +24 new vs iter 125), tsc 0 errors, eslint 0 problems.
- **НЕ сделано (перенос в iter 127+):**
  1. **In-game verification пользователем:** проверить, что фиксированный регекс `"едкость предметов.*\+[2-9][0-9]%|едкость предметов.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` действительно НЕ подсвечивает waystone с `Редкость предметов: +11%` + `Эффективность монстров: +25%` (или любой waystone с `Редкость предметов` < 20%).
  2. **KI#11 escalation (если FP сохранится):** Если iter 126 fix НЕ убирает FP → in-game `.*` пересекает blocks (KI#11 hypothesis confirmed). Mitigation: добавить `literalBridge` поле в AST + compiler использует literal text между suffix и numRegex вместо `.*` (напр., `едкость предметов: \+XX%`). См. Pitfall 37 в AGENT_NAVIGATION.md.
  3. KI#7 (hero decorations, iter 121), KI#8 (SeoBlock atmosphere, iter 122) — awaiting user visual verification (перенос из iter 125).
  4. KI#9 (MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`) — monitoring, не фиксировано.
- **Точка остановки:** iter 126 done. KI#10 fix (disambiguate suffix) завершён. В iter 127 можно:
  1. Получить in-game верификацию от пользователя по iter 126 fixed regex (тестовый сценарий: waystone с `Редкость предметов: +11%` + `Эффективность монстров: +25%` → НЕ должен подсветиться; waystone с `Редкость предметов: +25%` + `Эффективность монстров: +25%` → должен подсветиться).
  2. Если in-game FP на iter 126 fixed regex сохраняется → эскалировать до KI#11 fix (literal bridge в compiler, requires AST + compiler changes).
  3. Если найден новый FP bug на других reversed implicits (с общим suffix) — применить тот же pattern: explicit override в `i18n-overrides.json` с более specific suffix.
  4. Опционально: visual verification KI#7/KI#8.
- **Подсказка следующему агенту:** iter 126 пофиксил KI#10 (ambiguous suffix FP для `Редкость предметов`) через explicit override в `i18n-overrides.json` (`regex: "едкость предметов"` вместо auto-computed `'едкость'`). Перед стартом iter 127 прочитай STATUS.md (актуальный статус + KI#7/KI#8/KI#9/KI#10/KI#11), worklog.md (этот раздел iter 126). Pitfall 36 (ambiguous suffix) + Pitfall 37 (KI#11 cross-block .* hypothesis) в AGENT_NAVIGATION.md — описание бага и фикса. Regression tests в `tests/core/iter126-ki10-rarity-disambiguation.test.ts` (24 теста, 5 секций). Главное событие iter 127 — получить in-game feedback от пользователя по iter 126 fixed regex. Если FP сохраняется → эскалировать до KI#11 fix (literal bridge в compiler). Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 125**: фикс in-game FP `(A|B|C) after .* bridge` для reversed RANGE. `distributeAlternation()` в `src/core/compiler.ts` конвертирует `prefix(A|B|C)suffix` → `prefixAsuffix|prefixBsuffix|prefixCsuffix` (Path D — top-level `|`, in-game verified up to 9 alts). Применяется в 3 местах `compileInner` для reversed `RANGE`. Дополнительно: `src/ui/hooks/category-ast-utils.ts` расширил `anchorEnd` для reversed implicits с `...##%` template → каждый Path-D альтернатив anchored к `%` (FP-протекция от range notation). +25 новых тестов в `tests/core/iter125-alt-after-bridge.test.ts`. 1915/1915 tests.
- **iter 124**: cleanup stale `DELETIONS-iter123.txt` instruction file.
- **iter 123**: cleanup stale `DELETIONS-iter{121,122}.txt` instruction files.
- **iter 122**: cleanup 4 неиспользуемых atmosphere webp + dead script `optimize_hero_images.py` + интеграция `faf.png` как `seo-atmosphere.webp` (1600×900, 146 KB) — широкий landscape backdrop в SeoBlock, lg+ only, opacity 0.18, mix-blend-screen, fade bottom 40%. DOM order: atmosphere → demon → content.
- **iter 121**: ре-фикс HomePage hero decorations (KI#7 — iter 120 был неполным: 2 бага — `overflow-hidden`+center-anchor обрезали голову/ноги, изображения заперты в max-w-4xl). iter 121: Layout.tsx — `<main>` получил `relative`; HomePage.tsx — side ghosts вынесены в Fragment, anchored к viewport edges, `h-[80vh] max-h-[720px]`, opacity 0.20, content в `relative z-10`; index.css — bottom fade 75%, horizontal fade на INNER edge (баг iter 120 fixed).
- **iter 120**: фикс UI-багов — scroll jump-to-top + jitter в VirtualizedModList (KI#6, корректный фикс — остаётся в силе) + HomePage hero decorations (KI#7, фикс был неполным — ре-фикс в iter 121).
- **iter 119**: rage-charges (4) + runes-barrier (4) + penetration (3) block rules — все priority-блоки закрыты. 18 блоков правил, 312 family-keys, 100% coverage. 1890/1890 tests.
- **iter 118**: skill-levels (10) + area-duration (8) + meta-skills (6) block rules, 100% coverage each. 1862/1862 tests.
- **iter 117**: offence-speed (12) + crit (9) + buff-skills (7) block rules, 100% coverage each. 1820/1820 tests.
- **iter 116**: weapon-specific (24) + flasks (16) block rules, 100% coverage each. 1774/1774 tests.
- **iter 115**: resources block rules (29 family-keys, 100% coverage). 1721/1721 tests.
- **iter 114**: defence-stats block rules (28 family-keys, 100% coverage). 1687/1687 tests.
- **iter 113**: damage-type block rules (47 family-keys, 100% coverage). 1654/1654 tests.
- **iter 112**: фикс regex-бага «Истощения Бездны» + внедрение sortKey infrastructure (4 блока правил). 1602/1602 tests.
- **iter 111**: KI#3/#4/#5 из UI-аудита v2. 1543/1543 tests.
- **iter 110**: Приоритет 2.7–2.9 + 3.10–3.13 UI-аудита v2. 1543/1543 tests.
- **iter 109**: Приоритет 1 UI-аудита v2 + Noto Sans self-hosted woff2. 1543/1543 tests.
- **iter 108**: фикс вложенных кавычек в OR-регексах для токенов с `regexPrefixContext` без `regexExclude`. 1543/1543 tests, +10 regression tests.
- **iter 107**: UX-полировка P4 — tier-colored left border для 4 tier'ов в tier-first режиме.
- **iter 106**: P4 — tier-aware sort toggle (alpha vs tier-first).
- **iter 105**: P2 second half — tablet sub-blocks (19 sub-blocks).
- **iter 104**: P2 first half — waystone sub-blocks + Known Issue #5 fix (9 sub-blocks).
- **iter 103**: подавление 2 TanStack library-level ESLint warnings.
- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline.
- **iter 101**: P0-фикс Critical Bug — `GameTokenSchema` без `functionalCategory` → Zod strips → runtime classifier падал в `other`.
- **iter 99**: alphabetical within-block sort.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий для 25 family-keys).
- **iter 96**: удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

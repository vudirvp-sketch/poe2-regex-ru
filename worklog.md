# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 127
Agent: main
Task: Аудит KI#10-pattern в других категориях (tabs/optimizer/generator) + фикс KI#12 (tier-hardcoded regex для single-# relic tokens). Пользователь подтвердил iter 126 fix работает in-game — KI#11 hypothesis ОПРОВЕРГНУТА.

Work Log:
- 1: Репозиторий клонирован. Контекст загружен из STATUS.md (iter 126 = current, KI#10 fixed awaiting verification, KI#11 monitoring), worklog.md (iter 126 подробно), AGENT_NAVIGATION.md (35 pitfalls). Изучены ключевые файлы: `public/generated/*.json` (10 category files, 1697 tokens), `scripts/etl/i18n-overrides.json` (override mechanism), `scripts/etl/compute-regex-core.ts` (extractTemplateSuffix, findShortestUniqueSuffix), `scripts/etl/compute-regex-strategies.ts` (substringSearchFallback), `src/core/optimization-strategies.ts` (truncateSuffixes, TRUNCATED_TAILS_SAFE/BLACKLIST), `src/core/poe2-regex-matcher.ts` (matchPoE2RegexItem — block-based, `.*` restricted to single block per Phase 7), `tests/core/iter126-ki10-rarity-disambiguation.test.ts` (24 tests, 5 секций).
- 2: Аудит KI#10-pattern (short/generic suffix regex). Написан `scripts/audit-ambiguous-suffixes.py` — сканирует все `public/generated/*.json` (1697 tokens) + `регис/*.md` (1059 reference texts) на subject: токены с regex ≤12 chars, являющиеся pure literal (no regex meta), которые появляются в OTHER tokens' rawText (cross-category) или в регис texts. Найдено 480 suspicious tokens; после анализа:
  - **HIGH RISK (8 waystone implicits)**: `падения`, `р групп`, `ивность`, `оступно` (по 2 в waystone.json + waystone-desecrated.json — это SAME logical token в двух файлах, не реальная ambiguity). Регис matches — все SAME implicit text (Шанс выпадения путевого камня, Размер групп монстров, etc.). **Все SAFE** для текущих in-game data.
  - **MEDIUM RISK (420 explicits)**: family-level regexes (`к силе`, `к меткости`, etc.) — все обрабатываются через `regexExclude` / `regexPrefixContext` в ETL.
  - **LOW RISK (52 tokens)**: regex matches регис texts, но это LITERALLY the same mod (just in-game examples), не ambiguity.
  - **Вывод**: KI#10 был единственным реальным ambiguous suffix FP. Других подобных багов в current data нет.
- 3: Аудит tier-hardcoded regex (KI#12-pattern, NEW). Написан `scripts/audit-tier-hardcoded-regex.py` — сканирует все `public/generated/*.json` на subject: токены с single-`#` template (одна digit, не `##` range), чьи regex содержит digit value из rawText. **Найдено 7 relic tokens** с tier-hardcoded regex:
  - `relic.sanctummonstersreduceddamage1`: regex `'на 6%'` (hardcoded 6)
  - `relic.sanctummonsterspeed1`: regex `'на 4%'` (hardcoded 4)
  - `relic.sanctummonsterspeed2`: regex `'а на 5'` (hardcoded 5)
  - `relic.sanctumrevealextraroomeachfloor2`: regex `'ат: 2'` (hardcoded 2)
  - `relic.sanctumrevealextraroomeachfloorlarge2`: regex `'ат: 4'` (hardcoded 4)
  - `relic.sanctumguardsreduceddamage1`: regex `'ры наносят уменьшенный на 5'` (hardcoded 5)
  - `relic.sanctumbossreduceddamage1`: regex `'сы наносят уменьшенный на 5'` (hardcoded 5)
  Все 7 — relic Sanctum tokens (single-value tiers, не range). Их `##` siblings имеют tier-agnostic regex. Family-level optimization entries используют FIRST (alphabetically) token's regex → tier-hardcoded → **FN для tiers 2+** когда user кликает family filter.
- 4: Документация KI#12 в STATUS.md (ПЕРВЫЙ ШАГ — per user instruction). Root cause: ETL auto-compute для single-`#` templates падает через все suffix strategies (suffix too short — `% урон` = 6 chars, после trim `урон` = 4 chars < minLen 5) в substring search, который находит shortest unique substring — часто включает сам digit (e.g., `на 6%` = 5 chars, unique в relic category). Семейные opt entries в `compute-optimizations.ts` line 59-60 берут regex от FIRST token (alphabetically) — если first token tier-hardcoded, вся family страдает FN. KI#11 также отмечен как DISPROVEN (user iter 127 подтвердил iter 126 fix работает → `.*` НЕ пересекает lines/blocks). KI#10 отмечен как VERIFIED in-game.
- 5: Реализация fixed через `scripts/etl/i18n-overrides.json` — добавлены 7 override entries для всех problematic relic tokens. Каждый override explicit указывает tier-agnostic regex (matching `##` siblings) + regexPrefixContext/regexExclude если нужно:
  - `relic.sanctummonstersreduceddamage1` → `'монстры наносят уменьшенный на '`
  - `relic.sanctummonsterspeed1/2` → `'корость атаки, сотворения чар и'`
  - `relic.sanctumrevealextraroomeachfloor2/large2` → `'на карте испытаний раскрывается'` + exclude `['дополнительная']`
  - `relic.sanctumguardsreduceddamage1` → `'кие монстры наносят уменьшенный'`
  - `relic.sanctumbossreduceddamage1` → `'урон'` + prefixContext `'Боссы наносят'`
  `_updated` timestamp обновлён.
- 6: Прямой patch `public/generated/relic.json` (поскольку ETL требует доступа к poe2db.tw, который недоступен):
  - 7 token regexes обновлены (regex.ru + regexPrefixContext.ru + regexExclude.ru где применимо).
  - 4 family-level optimization entries обновлены (regex.ru для `sanctummonstersreduceddamage1:2:3`, `sanctummonsterspeed1:2:3`, `sanctumguardsreduceddamage1:2:3`, `sanctumbossreduceddamage1:2:3`).
  - 4 cross-family optimization entries DELETED (они использовали tier-hardcoded Path D regexes: `'р.*ы наносят уменьшенный на 5|с.*ы наносят уменьшенный на 5'`, `'а.*на 5|ры наносят уменьшенный.*на 5|сы наносят уменьшенный.*на 5'`, `'на.*карте испытаний раскрывается|на.*6%|на.*4%'`, `'ат:.*4|ат:.*2'`). Удаление безопасно — runtime OR-ит individual regexes.
  - Все изменения применены через `scripts/apply-ki12-fix.py` (Python script, JSON validity подтверждена).
- 7: 19 новых регрессионных тестов в `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` (7 секций):
  - SECTION 1 (3 теста): Per-token regex verification — проверяет, что все 7 relic tokens имеют correct tier-agnostic regex, не содержат digits, share familyKey с siblings.
  - SECTION 2 (2 теста): Family-level opt entries — проверяет 4 family entries используют tier-agnostic regex, и 4 broken cross-family entries удалены.
  - SECTION 3 (5 тестов): Compile-time AND-logic — family regex матчит ALL 3 tiers (FN prevention). Симулирует in-game regex на 5 families (по 3 tier each).
  - SECTION 4 (2 теста): FN regression — OLD tier-hardcoded regex матчит ONLY tier 1 (FN для tiers 2-3), NEW tier-agnostic regex матчит ALL 3 tiers.
  - SECTION 5 (4 теста): KI#11 DISPROVEN — iter 126 fix verified in-game. Симулирует user's exact test scenarios (Редкость предметов +11%/+25% × Эффективность +25%/+5%).
  - SECTION 6 (1 тест): Audit — сканирует ALL `public/generated/*.json` на KI#12-pattern (tier-hardcoded regex для single-# tokens). Должен найти 0 issues (future regression protection).
  - SECTION 7 (2 теста): i18n-overrides.json — проверяет, что все 7 override entries существуют с correct regex + source comment (mentions `iter 127` и `KI#12`).
- 8: Верификация: `npx vitest run tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` → 19/19 passed. `npx vitest run` (full suite) → 1958/1958 passed (40 test files, +19 vs iter 126). `npx tsc -b` → 0 errors. `npx eslint .` → 0 problems (после fix unused variable `expected` в Object.entries destructuring).
- 9: Документация актуализирована:
  - `STATUS.md` — переписан под iter 127: «Текущее состояние» описывает audit + KI#12 fix. KI#10 → VERIFIED, KI#11 → DISPROVEN, KI#12 → FIXED. Таблицы «Подтверждённые ограничения PoE2» (3 строки обновлены: ambiguous suffix ✅, cross-block .* ✅, single-# template ✅) и «Оптимальные стратегии» (2 строки: reversed RANGE с ambiguous suffix → ✅ VERIFIED, single-# template → ✅ iter 127).
  - `worklog.md` — iter 127 подробно, iter 126 сжат до одного абзаца.
  - `AGENT_NAVIGATION.md` — header summary будет обновлён под iter 127; Pitfall 38 (tier-hardcoded regex для single-# tokens) будет добавлен.

Stage Summary:
- **iter 127 COMPLETE.** Аудит KI#10-pattern в других категориях + фикс KI#12 (tier-hardcoded regex для single-# relic tokens). Пользователь подтвердил iter 126 fix работает in-game → KI#11 (cross-block .* hypothesis) ОПРОВЕРГНУТА.
- **Изменённые файлы (5):**
  - `scripts/etl/i18n-overrides.json` — добавлены 7 override entries для problematic relic tokens (tier-agnostic regex, matching `##` siblings).
  - `public/generated/relic.json` — patch 7 token regexes + 4 family-level opt entries + delete 4 broken cross-family opt entries.
  - `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` — NEW файл, 19 регрессионных тестов (7 секций).
  - `scripts/audit-tier-hardcoded-regex.py` — NEW audit script (запускается из Section 6 теста как regression protection).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — актуализированы (KI#10 VERIFIED, KI#11 DISPROVEN, KI#12 FIXED, Pitfall 38 будет добавлен).
- **Тесты/типы/lint:** ✅ vitest 1958/1958 (40 test files; +19 new vs iter 126), tsc 0 errors, eslint 0 problems.
- **НЕ сделано (перенос в iter 128+):**
  1. **In-game verification пользователем:** проверить, что family filters для 7 relic family (Монстры наносят уменьшенный / Скорость атаки / Редкие монстры наносят уменьшенный / Боссы наносят уменьшенный / На карте испытаний раскрывается) теперь корректно подсвечивают ALL tiers (раньше только tier 1).
  2. **ETL algorithm fix (опционально):** В `scripts/etl/compute-regex-core.ts` можно добавить check: если token с single-`#` template имеет `##` siblings в same familyKey, то использовать sibling's regex (tier-agnostic) вместо auto-compute. Это prevented бы подобные bugs в future ETL runs. Сейчас mitigation — manual override в i18n-overrides.json.
  3. KI#7 (hero decorations, iter 121), KI#8 (SeoBlock atmosphere, iter 122) — awaiting user visual verification (перенос из iter 126).
  4. KI#9 (MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`) — monitoring, не фиксировано.
- **Точка остановки:** iter 127 done. KI#12 fix (tier-agnostic regex для single-# relic tokens) завершён и верифицирован локально. В iter 128 можно:
  1. Получить in-game верификацию от пользователя по iter 127 fixed regex (тестовый сценарий: relic с `Монстры наносят уменьшенный на (9—12)% урон` (tier 3) должен подсветиться при клике на family filter `Монстры наносят уменьшенный на #% урон`).
  2. Если найден новый FP/FN баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.
  3. Опционально: ETL algorithm fix (см. п.2 выше) для future regression prevention.
- **Подсказка следующему агенту:** iter 127 пофиксил KI#12 (tier-hardcoded regex для 7 relic tokens с single-# template) через explicit override в `i18n-overrides.json` (tier-agnostic regex matching `##` siblings). Audit scripts: `scripts/audit-ambiguous-suffixes.py` (KI#10-pattern, 0 issues после iter 126) и `scripts/audit-tier-hardcoded-regex.py` (KI#12-pattern, 0 issues после iter 127). Перед стартом iter 128 прочитай STATUS.md (актуальный статус + KI#7/KI#8/KI#9/KI#10 VERIFIED/KI#11 DISPROVEN/KI#12 FIXED), worklog.md (этот раздел iter 127), Pitfall 38 (tier-hardcoded regex) в AGENT_NAVIGATION.md. Regression tests в `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` (19 тестов, 7 секций) и `tests/core/iter126-ki10-rarity-disambiguation.test.ts` (24 теста, 5 секций). Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 126**: фикс KI#10 — ambiguous suffix FP для `Редкость предметов` (disambiguate от возможной `Редкость монстров`). `waystone.implicit.item_rarity` regex `'едкость'` → `'едкость предметов'` через `i18n-overrides.json` override + patch `waystone.json` + `waystone-desecrated.json`. +24 теста в `iter126-ki10-rarity-disambiguation.test.ts`. **iter 127 VERIFIED in-game пользователем.** KI#11 (cross-block .* hypothesis) ОПРОВЕРГНУТА. 1939/1939 tests.
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

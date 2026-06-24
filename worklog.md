# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 125
Agent: main
Task: фикс in-game FP `(A|B|C) after .* bridge`. Пользователь сообщил: при выборе «И» имплисетов путеводных камней `Редкость предметов: +(0—999)%` и `Эффективность монстров: +(0—999)% ×2` с min=25, генератор выдавал регекс `"едкость.*\+(2[5-9]|[3-9][0-9]|\d{3,})" "ивность.*\+(2[5-9]|[3-9][0-9]|\d{3,})"`, который в игре подсвечивал карты с `+15%` и `+11%` (значения < 25, FP). Нужен глубокий анализ: если генератор следует директивам, составить пул тестов (3-5 шт.) для понимания проблемы и корректировки алгоритмов.

Work Log:
- 1: Репозиторий клонирован с GitHub. Контекст загружен из STATUS.md (iter 124 = current), AGENT_NAVIGATION.md (33 pitfall + Path D + 8 deterministic principles), IN_GAME_TESTS.md (verified patterns), README.md. Изучены ключевые файлы: `src/core/number-regex.ts` (generateNumberRegex, generateMaxNumberRegex, generateEnumeratedRangeRegex), `src/core/compiler.ts` (compileInner для RANGE), `src/ui/hooks/category-ast-utils.ts` (buildAstFromSelections — как AST строится из выбранных range), `src/core/poe2-regex-matcher.ts` (simulator), `src/core/regex-oracle.ts` (validator).
- 2: Анализ bug: изучен токен `waystone.implicit.item_rarity` — `rawTextTemplate: "Редкость предметов: +##%"`, `regex: "едкость"`, `ranges: [[0, 999]]`, `affix: "implicit"`, нет `regexPrefixContext`/`regexExclude`. Аналогично `waystone.implicit.monster_effectiveness`. Симулятор в `poe2-regex-matcher.ts` парсит `(A|B|C)` корректно (через `groupOpen`/`groupClose` токены + `alternation` AST node), но **PoE2 in-game engine игнорирует содержимое `()`, когда `()` стоит ПОСЛЕ `.*` bridge + literal prefix** — движок матчит prefix broadly. Юнит-тесты пропускали кейс (симулятор ≠ in-game).
- 3: Воспроизведение bug-сценария скриптом `scripts/repro-bug-after-fix-v2.ts` (после разработки фикса — удалил). Симулятор PASSED на user-reported FP case (15%/11% → false match) — то есть симулятор не ловил FP. In-game, однако, матчило.
- 4: Документация Known Issue в STATUS.md: `(A|B|C) after .* bridge` — root cause, фикс, KI#9 (MULTI_RANGE slot N>0 — та же проблема, не фиксировано).
- 5: Реализация fixed в `src/core/compiler.ts`:
  - Added `distributeAlternation(prefix, numRegex, endAnchor)` helper: конвертирует `prefix(A|B|C)suffix` → `prefixAsuffix|prefixBsuffix|prefixCsuffix` (Path D — top-level `|`, in-game verified up to 9 alts).
  - Helper использует paren-depth walk для: (a) проверки outer parens wrap entire expression, (b) split inner по top-level `|`.
  - No-op для numRegex без outer parens (например, `\d{3,}` для ≥100) или single alternative.
  - Applied в 3 местах `compileInner` для reversed `RANGE` (single-placeholder case): `isEnumerated`, `≥min`, `≤max`.
- 6: Расширение `anchorEnd` в `src/ui/hooks/category-ast-utils.ts`:
  - Добавлена `numberEndsWithPercent` проверка: `/[+-]?##%\s*$/` (шаблон заканчивается на `+##%`).
  - `anchorEndValue` теперь вычисляется как `'%'` если `(!numberAtStart && (numberFollowedByPercent || (isReversed && numberEndsWithPercent)))`.
  - Это добавляет `%` endAnchor для reversed implicits с шаблоном `Редкость предметов: +##%` → каждый Path-D альтернатив anchored к `%` (FP-протекция от range notation `(15-25)`).
- 7: 4 существующих теста обновлены под новый Path-D формат (старый формат был баговым — теперь они проверяют корректное поведение):
  - `tests/core/compiler.test.ts`: `RANGE with threshold=true and reversed`, `RANGE with signPrefix="+" and reversed adds \\+ before number at end`.
  - `tests/ui/vendor-regex-equivalence.test.ts`: `item level ≥50`, `char level ≥30` — оба теперь проверяют Path-D distribution (top-level `|`, `%` anchor, NO `(` after `.*`).
- 8: 25 новых регрессионных тестов в `tests/core/iter125-alt-after-bridge.test.ts`:
  - SECTION 1 (8 тестов): User's exact scenario — Редкость + Эффективность implicits (AND, min=25) — FP case, edge cases, range notation protection, AND-logic enforcement.
  - SECTION 2 (10 тестов): distributeAlternation behavior — distributes reversed ≥min/≤max/enumerated with `%`/no-`%`/`-`/colon anchors; no-op для non-reversed / `\d{3,}` без parens / single char class.
  - SECTION 3 (4 теста): edge cases — preserves `%` anchor in each distributed alt, handles colonAnchor reversed, wide ranges (≥1000), multi-digit (≥150).
  - SECTION 4 (3 теста): compile output snapshots для документирования формата.
- 9: Верификация: `npx vitest run` → 1915/1915 tests passed (38 test files, +25 vs iter 124). `npx tsc --noEmit` → 0 errors. `npx eslint .` → 0 problems.
- 10: Документация актуализирована:
  - `STATUS.md` — переписан под iter 125: «Текущее состояние» описывает фикс, 7 KI (新增 KI#7 hero, KI#8 SeoBlock, KI#9 MULTI_RANGE slot N>0 not yet fixed), таблица «Подтверждённые ограничения PoE2» расширена (5 новых строк про `(A|B|C)` patterns), таблица «Оптимальные стратегии» расширена (новая строка для reversed RANGE Path D distribution). Старая длинная история iter 119–124 удалена.
  - `AGENT_NAVIGATION.md` — header summary обновлён под iter 125; Section 6 (PoE2 Regex Dialect) таблица расширена (новая строка для `"prefix.*literal(A|B|C)"` — in-game BROKEN, fixed iter 125); Pitfall 35 добавлен (новая ловушка для будущих агентов).
  - `worklog.md` — iter 125 подробно, iter 124 сжат до одной строки.

Stage Summary:
- **iter 125 COMPLETE.** Фикс in-game FP `(A|B|C) after .* bridge`. Пользовательский FP (+15%/+11% подсвечивались при min=25) исправлен.
- **Изменённые файлы (7):**
  - `src/core/compiler.ts` — added `distributeAlternation()` + applied в 3 местах `compileInner` для reversed `RANGE`.
  - `src/ui/hooks/category-ast-utils.ts` — расширен `anchorEnd` для reversed implicits с `...##%` template.
  - `tests/core/compiler.test.ts` — 2 теста обновлены под Path-D формат.
  - `tests/ui/vendor-regex-equivalence.test.ts` — 2 теста обновлены под Path-D формат.
  - `tests/core/iter125-alt-after-bridge.test.ts` — новый файл, 25 регрессионных тестов.
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — актуализированы.
- **Тесты/типы/lint:** ✅ vitest 1915/1915 (37 test files; +25 new vs iter 124), tsc 0 errors, eslint 0 problems.
- **НЕ сделано (перенос в iter 126+):**
  1. **KI#9: MULTI_RANGE slot N>0** — та же проблема `(A|B|C) after .* bridge`, но для multi-placeholder токенов (например, «Добавляет от X до Y урона») с двумя+ filtered slots. На практике такие токены используют простые char-class numRegexes (`[4-9][0-9]`, `[1-5][0-9]`), `()` встречается редко. Если возникнет FP — нужно расширить `distributeAlternation` до MULTI_RANGE (combinatorial: distribute ВСЕ слоты с `()` — до 3×3=9 альтернатив).
  2. **In-game verification пользователем:** проверить, что фиксированный регекс `"едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` действительно НЕ подсвечивает +15%/+11% в игре, и подсвечивает ≥25% (с round10 от 25 — это ≥20%).
  3. KI#7 (hero decorations, iter 121), KI#8 (SeoBlock atmosphere, iter 122) — awaiting user visual verification (перенос из iter 124).
- **Точка остановки:** iter 125 done. Фикс `(A|B|C) after .* bridge` завершён для reversed `RANGE` (covers user-reported bug). В iter 126 можно:
  1. Получить in-game верификацию от пользователя по iter 125 fixed regex (тестовый сценарий: waystone с Редкость +15% → НЕ должен подсветиться; waystone с Редкость +25% и Эффективность +25% → должен подсветиться).
  2. Если in-game FP на MULTI_RANGE (dual-number mods с `()` в slot N>0) — расширить `distributeAlternation` до MULTI_RANGE (KI#9).
  3. Опционально: visual verification KI#7/KI#8.
- **Подсказка следующему агенту:** iter 125 пофиксил FP `(A|B|C) after .* bridge` для reversed `RANGE` (covers waystone implicits, vendor properties, any reversed implicit). Перед стартом iter 126 прочитай STATUS.md (актуальный статус + KI#7/KI#8/KI#9), worklog.md (этот раздел iter 125). Pitfall 35 в AGENT_NAVIGATION.md — описание бага и фикса. Regression tests в `tests/core/iter125-alt-after-bridge.test.ts` (25 тестов, 4 секции). Главное событие iter 126 — получить in-game feedback от пользователя по iter 125 fixed regex и решить KI#9 (если проявится FP на MULTI_RANGE). Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

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

# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 128
Agent: main
Task: Фикс KI#13 — пропущен implicit `Редкость монстров: +##%` + BTS-статы в waystone-аффиксах. Пользователь сообщил: "в суффиксах и префиксах там каша, в аффиксы попало то, что не должно было туда попасть".

Work Log:
- 1: Репозиторий клонирован. Контекст загружен из STATUS.md (iter 127 = current, KI#12 FIXED), worklog.md (iter 127 подробно), AGENT_NAVIGATION.md. Изучены ключевые файлы: `scripts/etl/normalize.ts` (`WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` = 4 ключа + `generateWaystoneImplicitTokens` = 5 implicits), `public/generated/waystone.json` (156 tokens: 5 implicits + 151 affixes включая BTS), `public/generated/waystone-desecrated.json` (32 tokens: 5 implicits + 27 affixes), `регис/Путевые камни моды.md` (эталонный список модов от пользователя), `scripts/etl/i18n-overrides.json` (override mechanism).
- 2: Парсинг актуальной страницы poe2db.tw/ru/Waystones. Написан `scripts/parse_waystone_page.py` (BeautifulSoup, парсит tab `ПутевыекамниMods` + `DesecratedWaystoneMods`, разбивает `<br>`-сегменты, строит template с `#`/`##`). Анализ показал: 106 rows normal + 17 rows desecrated, каждый row имеет 3-4 `<br>`-сегмента (первый — main effect, остальные — BTS). Составлен полный список BTS-паттернов (10 ключей: 4 существующих + 6 новых).
- 3: Документация KI#13 в STATUS.md как Known Issue (ПЕРВЫЙ ШАГ per user instruction). Описаны: симптом, root cause (2 части: (a) missing implicit + (b) неполный BTS-фильтр), логика PoE2 (BTS плюсуются за кулисами к имплиситам), план фикса.
- 4: Реализация фикса в `scripts/etl/normalize.ts`:
  - `generateWaystoneImplicitTokens()`: добавлен 6-й implicit `Редкость монстров: +##%` (id=`{category}.implicit.monster_rarity`, range=[0,999], regex будет установлен через override).
  - `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS`: расширена с 4 до 10 ключей. Добавлены: `На #% больше волшебных и редких монстров`, `На #% больше шанса появления свойств у редких монстров`, `На #% больше эффективности монстров`, `#% увеличение количества редких монстров`, `#% увеличение количества волшебных монстров`, `#% увеличение количества путевых камней, находимых в области`. Комментарий обновлён с описанием логики (iter 128 KI#13).
- 5: Override в `scripts/etl/i18n-overrides.json` для нового implicit: `waystone.implicit.monster_rarity` и `waystone-desecrated.implicit.monster_rarity`. Regex: `'едкость монстров'` (15 chars, literal space) — disambiguate от `'едкость предметов'` (iter 126). Source-comment упоминает iter 128 + KI#13.
- 6: Patch `public/generated/waystone.json` + `waystone-desecrated.json` через `scripts/apply-ki13-fix.py`:
  - waystone.json: 156 → 110 tokens (удалено 47 BTS, +1 implicit monster_rarity). BTS tokens: 16× `На #% больше волшебных и редких монстров`, 16× `На #% больше шанса появления свойств у редких монстров`, 13× `На #% больше эффективности монстров`, 1× `#% увеличение количества редких монстров`, 1× `#% увеличение количества путевых камней, находимых в области`.
  - waystone-desecrated.json: 32 → 28 tokens (удалено 5 BTS, +1 implicit). BTS tokens: 1× `#% увеличение количества волшебных монстров`, 4× `#% увеличение количества редких монстров`.
  - Скрипт идемпотентен (проверяет наличие monster_rarity перед вставкой), обновляет `version` timestamp, валидирует JSON после записи.
- 7: Регрессионные тесты в `tests/core/iter128-ki13-monster-rarity.test.ts` (34 теста, 7 секций):
  - SECTION 1 (5): new implicit `Редкость монстров: +##%` существует в обоих JSON, regex=`'едкость монстров'`, ровно 6 implicits в каждом файле.
  - SECTION 2 (4): BTS-токены удалены (no familyKey matches + no rawText matches по regex-паттернам).
  - SECTION 3 (8): `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` содержит все 6 новых ключей + 4 оригинальных, всего ≥10.
  - SECTION 4 (4): `generateWaystoneImplicitTokens()` возвращает 6 tokens, monster_rarity имеет range=[0,999], работает для waystone-desecrated.
  - SECTION 5 (8): compile + matcher — disambiguation FP prevention. monster_rarity regex матчит `Редкость монстров: +25%` (TP), НЕ матчит `Редкость предметов: +25%` (FP prevention). Bidirectional: item_rarity regex НЕ матчит `Редкость монстров: +25%`. AND-joined 3 implicits all satisfied. AND-logic partial satisfaction → no match. Range notation FP prevention.
  - SECTION 6 (3): i18n-overrides.json содержит оба override-entries, source упоминает iter 128 + KI#13.
  - SECTION 7 (2): audit — no BTS family keys in any waystone JSON (future regression guard).
- 8: Обновлены существующие тесты:
  - `tests/etl/normalize.test.ts`: "KI-2 every WAYSTONE key matches source HTML" — теперь проверяет combined normal+desecrated source HTML (некоторые BTS-ключи есть только в desecrated). "KI-2 waystone-desecrated source HTML has no BTS tokens" — REMOVED (premise больше не верна: desecrated source HTML теперь СОДЕРЖИТ BTS). Вместо него: "KI-2 waystone-desecrated.json does NOT contain BTS familyKeys (filter removed them)".
  - `tests/etl/cross-validation.test.ts`: диапазон waystone token count 140-200 → 100-200 (после BTS removal: 110). Диапазон waystone-desecrated 27-40 → 25-40 (после BTS removal: 28).
- 9: Верификация: `npx vitest run` → 1992/1992 passed (41 test files, +34 vs iter 127). `npx tsc -b` → 0 errors. `npx eslint .` → 0 problems (изначально 16 `any`-errors в новом тесте, исправлены через добавление `TokenLike`/`CategoryData` interfaces).
- 10: Документация актуализирована:
  - `STATUS.md` — переписан под iter 128: «Текущее состояние» описывает KI#13 fix. KI#13 → FIXED. Старые iter 126/127 детали сжаты в "Закрытые KI". Таблицы «Подтверждённые ограничения PoE2» (+1 строка: BTS-статы ✅ iter 128) и «Оптимальные стратегии» (+1 строка: BTS-фильтр + новый implicit ✅ iter 128).
  - `worklog.md` — iter 128 подробно, iter 127 сжат до одной строки (перенесён в "Предыдущие итерации").
  - `AGENT_NAVIGATION.md` — header summary обновлён под iter 128; Pitfall 39 (BTS-фильтр + missing implicit) добавлен.

Stage Summary:
- **iter 128 COMPLETE.** Фикс KI#13 — пропущен implicit `Редкость монстров: +##%` + BTS-статы в waystone-аффиксах. Пользователь сообщил: в суффиксах/префиксах "каша", попали "за кулисами"-статы, которые плюсуются к имплиситам и не должны быть searchable.
- **Изменённые файлы (8):**
  - `scripts/etl/normalize.ts` — добавлен implicit `monster_rarity` + расширён `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` (+6 ключей, итого 10).
  - `scripts/etl/i18n-overrides.json` — добавлены 2 override entries (`waystone.implicit.monster_rarity`, `waystone-desecrated.implicit.monster_rarity`) с regex `'едкость монстров'`.
  - `public/generated/waystone.json` — patch: 156 → 110 tokens (-47 BTS, +1 implicit).
  - `public/generated/waystone-desecrated.json` — patch: 32 → 28 tokens (-5 BTS, +1 implicit).
  - `tests/core/iter128-ki13-monster-rarity.test.ts` — NEW файл, 34 регрессионных теста (7 секций).
  - `tests/etl/normalize.test.ts` — обновлён KI-2 блок (combined source HTML + desecrated filter test).
  - `tests/etl/cross-validation.test.ts` — расширены диапазоны token count.
  - `scripts/apply-ki13-fix.py` — NEW patch script (идемпотентный, с верификацией).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — актуализированы.
- **Тесты/типы/lint:** ✅ vitest 1992/1992 (41 test files; +34 vs iter 127), tsc 0 errors, eslint 0 problems.
- **НЕ сделано (перенос в iter 129+):**
  1. **In-game verification пользователем:** проверить, что (a) фильтр `Редкость монстров ≥ +25%` подсвечивает путевые камни с `Редкость монстров: +25%` в имплиситах; (b) фильтры для аффиксов, имевших BTS-сегменты (например `Монстры получают (26—30)% уменьшение дополнительного урона от критических ударов`), продолжают работать — игрок увидит только main effect, BTS плюсуется к имплиситам.
  2. **Cleanup dead patterns в `src/shared/mod-classifier.ts`:** после iter 128 patterns `больше.*волшебн.*редк.*монстр`, `шанса появления свойств.*редк.*монстр`, `больше.*эффективн.*монстр` в POSITIVE/NEGATIVE_KEYWORDS — теперь dead (BTS-токены удалены из данных). Можно удалить для чистоты, но не критично (patterns просто не матчат ничего).
  3. KI#7 (hero decorations, iter 121), KI#8 (SeoBlock atmosphere, iter 122) — awaiting user visual verification (перенос из iter 127).
  4. KI#9 (MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`) — monitoring, не фиксировано.
- **Точка остановки:** iter 128 done. KI#13 fix (новый implicit `Редкость монстров` + расширение BTS-фильтра + удаление 52 BTS-токенов) завершён и верифицирован локально (1992/1992 tests). В iter 129 можно:
  1. Получить in-game верификацию от пользователя (тестовый сценарий: путевой камень с аффиксом `Монстры получают (26—30)% уменьшение дополнительного урона от критических ударов` — игрок видит только этот аффикс, BTS-бонусы плюсуются к `Редкость монстров`, `Редкость предметов`, `Шанс выпадения` имплиситам).
  2. Если найден новый FP/FN баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.
  3. Опционально: cleanup dead patterns в mod-classifier.ts.
- **Подсказка следующему агенту:** iter 128 пофиксил KI#13 (добавлен implicit `Редкость монстров: +##%` с regex `'едкость монстров'`, расширён `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` +6 ключей, удалено 52 BTS-токена из waystone.json + waystone-desecrated.json). Patch script: `scripts/apply-ki13-fix.py` (идемпотентный). Перед стартом iter 129 прочитай STATUS.md (актуальный статус + KI#7/KI#8/KI#9 + KI#10-KI#13 закрыты), worklog.md (этот раздел iter 128), Pitfall 39 (BTS-фильтр + missing implicit) в AGENT_NAVIGATION.md. Regression tests в `tests/core/iter128-ki13-monster-rarity.test.ts` (34 теста, 7 секций). Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 127**: аудит KI#10-pattern в других категориях + фикс KI#12 (tier-hardcoded regex для 7 single-# relic tokens) через explicit override в `i18n-overrides.json`. KI#11 (cross-block .* hypothesis) ОПРОВЕРГНУТА. 1958/1958 tests.
- **iter 126**: фикс KI#10 — ambiguous suffix FP для `Редкость предметов` (`'едкость'` → `'едкость предметов'`). VERIFIED in-game iter 127. 1939/1939 tests.
- **iter 125**: фикс in-game FP `(A|B|C) after .* bridge` для reversed RANGE через `distributeAlternation()` (Path D). 1915/1915 tests.
- **iter 124**: cleanup stale `DELETIONS-iter123.txt`.
- **iter 123**: cleanup stale `DELETIONS-iter{121,122}.txt`.
- **iter 122**: cleanup atmosphere webp + `seo-atmosphere.webp` integration (KI#8).
- **iter 121**: ре-фикс HomePage hero decorations (KI#7 — iter 120 был неполным).
- **iter 120**: фикс scroll jump-to-top + jitter в VirtualizedModList (KI#6) + HomePage hero (KI#7, неполный → ре-фикс iter 121).
- **iter 119**: rage-charges + runes-barrier + penetration block rules. 18 блоков правил, 100% coverage.
- **iter 118**: skill-levels + area-duration + meta-skills block rules.
- **iter 117**: offence-speed + crit + buff-skills block rules.
- **iter 116**: weapon-specific + flasks block rules.
- **iter 115**: resources block rules (29 family-keys).
- **iter 114**: defence-stats block rules (28 family-keys).
- **iter 113**: damage-type block rules (47 family-keys).
- **iter 112**: фикс «Истощения Бездны» regex-баг + sortKey infrastructure (4 блока правил).
- **iter 111**: KI#3/#4/#5 из UI-аудита v2.
- **iter 110**: Приоритет 2.7–2.9 + 3.10–3.13 UI-аудита v2.
- **iter 109**: Приоритет 1 UI-аудита v2 + Noto Sans self-hosted woff2.
- **iter 108**: фикс вложенных кавычек в OR-регексах для `regexPrefixContext` без `regexExclude`.
- **iter 107**: P4 — tier-colored left border.
- **iter 106**: P4 — tier-aware sort toggle.
- **iter 105**: P2 second half — tablet sub-blocks (19 sub-blocks).
- **iter 104**: P2 first half — waystone sub-blocks + Known Issue #5 fix.
- **iter 103**: подавление 2 TanStack library-level ESLint warnings.
- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline.
- **iter 101**: P0-фикс Critical Bug — `GameTokenSchema` без `functionalCategory`.
- **iter 99**: alphabetical within-block sort.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий).
- **iter 96**: удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

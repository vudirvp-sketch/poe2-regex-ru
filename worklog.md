# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 83
Agent: main
Task: Верификация iter 82 анализа (OP-1) на реальных JSON-данных. Найти и задокументировать новые баги, исправить неточности. Без реализации.

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`.
- 2: Прочитаны iter 82 доки: `docs/AFFIXES_GROUPING_ANALYSIS.md`, `STATUS.md`, `AGENT_NAVIGATION.md` (314 строк), `worklog.md`. Прочитаны ключевые файлы: `src/shared/mod-classifier.ts` (1096 строк), `src/shared/family-grouper.ts` (316 строк), `src/ui/components/ModList.tsx` (662 строки, первые 200 строк).
- 3: Написан `/home/z/my-project/scripts/verify-analysis.ts` — симуляция всех 4 классификаторов (`classifyByTags`, `classifyByText`, `classifyWaystoneSentiment`, `classifyTabletType`) на реальных JSON-данных (1608 токенов, 634 family-groups, 7 категорий).
- 4: Получены точные counts neutral-корзины: ring 13/94=13.8%, amulet 20/105=19.0%, belt 18/85=21.2%, jewel 39/193=20.2%, waystone 7/50=14% (4 mis), tablet 32/82=39%, relic 25/25=100%.
- 5: Написан `/home/z/my-project/scripts/verify-extras.ts` — проверка Spirit classification, Breach Lord-тегов, `Знак повелителя Бездны` count, relic tags, новых PoE2 механик (Archon/Sealed/Wisps/Offerings/Runic Barrier/Charms/Meta/Heralds/Banners/Warcries/Marks).
- 6: Запущены тесты — 1158/1158 passing.
- 7: **Исправления к iter 82 (4):**
  - `+# к духу` НЕ в neutral — он в defensive через `/дух/i` regex. Actual S-tier в neutral: `+# к уровню всех камней умений` (generic), MF, `+#% к качеству всех умений`, `+#% к максимальному качеству`, `+# к максимуму рунического барьера`.
  - `Знак повелителя Бездны` — 6 family-groups (ring+amulet+belt × prefix+suffix), не 2.
  - Weapon-specific family-keys в jewel — 24, не 23 (добавился `#% повышение скорости атаки без оружия`).
  - Точные counts neutral: ring 13.8% (не 15%), amulet 19.0% (не 21%), belt 21.2% (не 25%), jewel 20.2% (не 24%), tablet 39.0% (не 38%).
- 8: **Найдены 3 НОВЫХ бага:**
  - Bug #7: Breach Lord-теги `kurgal_mod`/`amanamu_mod`/`ulaman_mod` — **73 токена** (26+25+22) в neutral. Теги не входят ни в OFFENSIVE/DEFENSIVE/ATTRIBUTE buckets. Моды имеют явную семантику (attribute/defensive/offensive/charm/flask), но теряются в neutral.
  - Bug #8: Relic использует `affix-only` mode → 100% в одной корзине (25 groups, 0 тегов). Не баг, а архитектурное решение — стоит пересмотреть через `relic-semantic` mode.
  - Bug #9: Мета-механики PoE2 (Вестники/Знамёна/Кличи/Метки/Обереги/Запечатанные/Архонт/Мета-умения/Сгустки/Подношения/Рунический барьер) размазаны по offensive/defensive/neutral без подкатегорий. У каждой отдельная «семантическая зона».
- 9: **Расширена схема функциональных блоков с 22 до 24** (добавлены `РУНИЧЕСКИЙ БАРЬЕР` и `СГРУСТКИ (Wisps)`). Уточнены подблоки: `Ауры-Вестники-Метки-Знаки-Кличи-Знамёна-Обереги` (вместо узкого `Ауры-Вестники-Метки`), `Приспешники-Компаньоны-Подношения` (Offerings теперь здесь), `Архонт-Запечатанные-Мета` (новый блок).
- 10: **Обновлены документы (4 файла):**
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — переписан: исправлены counts, исправлен bug #1 (Spirit), добавлены bug #7-9, расширена схема с 22 до 24 блоков, добавлен §7 "Что нового в iter 83", обновлён §5 priorities.
  - `STATUS.md` — переписан: iter 82→83, bug count 6→9, точные counts, обновлён P0 (добавлен пункт про Breach Lord-теги 73 токена).
  - `AGENT_NAVIGATION.md` — header iter 82→83 (analysis + verification), Pitfall 34 обновлён, §14 OP-1 синхронизирован с STATUS.md.
  - `worklog.md` — добавлен Task ID 83 section.
- 11: Никаких изменений в `public/generated/*.json`, ETL, исходном коде. Тесты 1158/1158.

Stage Summary:
- **iter 83 COMPLETE (analysis verification).** Верификация iter 82 анализа выполнена. 3 новых бага найдено (Breach Lord-теги 73 токена, relic 100% neutral, мета-механики PoE2 размазаны). 4 неточности iter 82 исправлены. Схема расширена с 22 до 24 функциональных блоков.
- **Изменённые файлы (4, только документация):**
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — переписан (увеличен с 302 до ~390 строк)
  - `STATUS.md` — переписан (iter 83, 9 багов вместо 6)
  - `AGENT_NAVIGATION.md` — header iter 83, Pitfall 34 + §14 обновлены
  - `worklog.md` — добавлен Task ID 83
- **Точка остановки:** iter 83 (verification) done. Реализация OP-1 не начата — ждёт решения по приоритетам (P0-P3 в `docs/AFFIXES_GROUPING_ANALYSIS.md` §5). В следующей итерации: (1) выбрать приоритет P0-P3; (2) составить детальный план реализации; (3) реализовать итеративно с сохранением качества.

---

Task ID: 82
Agent: main
Task: Анализ группировки/сортировки/вывода аффиксов в poe2-regex-ru. Без реализации — только анализ, документирование, Open Proposal OP-1.

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`.
- 2: Полностью прочитаны ключевые файлы: `src/shared/family-grouper.ts` (316 строк), `src/shared/mod-classifier.ts` (1095 строк), `src/ui/components/ModList.tsx` (662 строки), `src/ui/layout/nav-items.ts`, `scripts/etl/generate-dictionary.ts` (102 строки), `tests/shared/mod-classifier.test.ts` (504 строки), `tests/shared/family-grouper.test.ts` (398 строк).
- 3: Прочитана документация: `STATUS.md` (73 строки), `AGENT_NAVIGATION.md` (314 строк).
- 4: Просимулированы все 4 классификатора (`classifyByTags`, `classifyByText`, `classifyWaystoneSentiment`, `classifyTabletType`) на реальных JSON-данных (1697 токенов, 10 файлов). Получены точные размеры «нейтральных» корзин: ring 15%, amulet 21%, belt 25%, jewel 24%, waystone 14% (4 из 7 mis-классификации), tablet generic 38%.
- 5: Идентифицированы 6 НОВЫХ багов классификации: (1) S-tier моды (`+# к духу`, `+#% к уровню всех камней умений`, MF, качество) в neutral; (2) 4 waystone mis-классификации; (3) tablet generic 38% включая S-tier; (4) тег `aura` не учтён; (5) тег `gem` не учтён; (6) `Знак повелителя Бездны` без тегов.
- 6: Уточнены 3 пункта первого ответа: (1) L2 Origin — НЕ опциональный, а дефолтный для 5 категорий через `showOriginSubSections={true}`; (2) `classifyByTags` — «first matching tag per member, then majority voting», не pure «first match wins»; (3) «Прочие» корзина — 15-25%, не <5%.
- 7: Проверены все 23 weapon-specific family-key в `jewel.json` — все имеют корректные теги (`['damage','attack']` или `['attack','speed']` или `['attack','critical']`), правильно классифицируются как offensive, но размазаны по блоку. Оружие: мечами, кинжалами, топорами, булавами, луками, самострелами, копьями, боевыми посохами, кистенями.
- 8: Сформулированы 4 НОВЫХ предложения: (1) ETL-tagged `functionalCategory` по образцу `jewelType`; (2) tier-aware сортировка внутри блоков; (3) hideLabel для блоков с 1 чипом (расширение iter 62); (4) URL-персистентность для `groupingMode` toggle.
- 9: Сформулирована полная схема 22 функциональных блоков для jewellery + 6 weapon sub-blocks для jewel + sub-blocks внутри waystone sentiment и tablet type.
- 10: **Создан `docs/AFFIXES_GROUPING_ANALYSIS.md`** (301 строка) — полный анализ с §1-§6.
- 11: **STATUS.md переписан** — добавлен Open Proposal OP-1, удалена устаревшая история закрытых багов (Bug #13/16/17, KI-1/2/3, useUrlSync-extract — всё в git).
- 12: **AGENT_NAVIGATION.md почищен** — header iter 81 → iter 82 (analysis-only), Pitfalls 30-34 сжаты с 8717 до ~2500 chars (сохранены только actionable правила, удалена long history закрытых KI/багов). Добавлена секция 14 "Open Proposals" с OP-1. Добавлен Pitfall 34 (L4 architecture для affixes). Сохранено 6344 chars.
- 13: Никаких изменений в `public/generated/*.json`, ETL, исходном коде.

Stage Summary:
- **iter 82 COMPLETE (analysis-only).** Анализ группировки аффиксов выполнен, 6 новых багов классификации задокументированы, OP-1 открыт, документация почищена.
- **Изменённые файлы (3, только документация):**
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — новый файл, полный анализ (301 строка)
  - `STATUS.md` — переписан: добавлен OP-1, удалена устаревшая история (73 → 77 строк)
  - `AGENT_NAVIGATION.md` — почищен: Pitfalls 30-34 сжаты, добавлена секция 14 (314 → 320 строк, -6344 chars)
  - `worklog.md` — iter 82 section
- **Точка остановки:** iter 82 (analysis) done. Реализация OP-1 не начата — ждёт решения по приоритетам (P0-P3 в `docs/AFFIXES_GROUPING_ANALYSIS.md` §5). В следующей итерации: (1) выбрать приоритет P0-P3; (2) составить детальный план реализации; (3) реализовать итеративно с сохранением качества.

---

## Предыдущие итерации (кратко)

- **iter 81**: Bug #16/17 + useUrlSync-extract (won't fix). README переписан под SEO. Удалены устаревшие patch-archive файлы.
- **iter 80**: Bug #13 closed — removed dead skip `.*[0-9][1-9]` из iterative-optimizer.ts ×2, run-etl.ts, analyze-fn.ts. ETL output идентичен. 1157/1157.
- **iter 79**: Bug #8 Phase 2 — split useCategoryPage на 3 sub-hooks (useFilterStore/useCategoryData/useRegexBuilder) + fix 3 setState-in-effect errors. Lint 5→2. 1157/1157.
- **iter 78**: Bug #8 Phase 1 — pure AST helpers extracted в category-ast-utils.ts (890 строк); useCategoryPage.ts 1325→486. 1157/1157.
- **iter 77**: Lint cleanup 44→7 problems (37 fixed in 14 files). useCategoryPage.ts:793 regex escape fix.
- **iter 76**: KI-3 resolved (poe2db.tw OLD forms stable >1 year) + KI-2 data-level (ETL rerun с original OLD-form keys).
- **iter 73-75**: KI-1 закрыт (`?` tokenizer mismatch). KI-2 code-fixed. KI-3 обнаружен.
- **iter 72**: Дедупликация ETL-утилит, удаление dead code.
- **iter 64-71**: UI redesign — TopNav, атмосферная стилизация PoE2, HomePage hero decorations, CSS-примитивы.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

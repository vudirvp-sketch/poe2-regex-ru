# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

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

# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 85
Agent: main
Task: Реализовать инфраструктуру 24 функциональных блоков для jewellery (вместо 4 корзин offensive/defensive/attribute/neutral). Начать с 5-7 блоков высшего приоритета (Дух / Уровень умений / Атрибуты / Сопротивления / MF / Рунический барьер / Бездна), добавить тесты. Не сломать production.

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Прочитаны: `STATUS.md`, `docs/AFFIXES_GROUPING_ANALYSIS.md` (463 строки), `worklog.md` (iter 84), `src/shared/mod-classifier.ts` (1145 строк), `src/shared/types.ts` (151 строка), `src/shared/family-grouper.ts` (315 строк), `src/shared/i18n.ts` (154 строки), `src/ui/components/ModList.tsx` (661 строка), `src/ui/components/VirtualizedModList.tsx` (811 строк — именно он используется в ring/amulet/belt pages), `src/ui/pages/{ring,amulet,belt}/*.tsx`, `tests/shared/mod-classifier.test.ts` (624 строки).
- 2: Установлены зависимости через `pnpm install`. Базовый прогон: **1172/1172 тестов зелёные, lint 0 errors (2 pre-existing warnings), tsc 0 errors**.
- 3: Написан `/home/z/my-project/scripts/simulate-iter85.ts` — анализ neutral-корзин jewellery (mirror классификаторов на реальных JSON). Получены counts: ring 13/94=13.8%, amulet 18/105=17.1%, belt 17/85=20.0%, jewel 45/193=23.3%. Полный список neutral-family-keys с тегами собран для всех 4 категорий.
- 4: Спроектирована архитектура 24-блочной системы (см. `docs/AFFIXES_GROUPING_ANALYSIS.md` §4.1). Решено: НЕ переключать production в iter 85 — только инфраструктура + тесты. Production переключится в iter 86 после добавления ещё 5-7 блоков.
- 5: В `src/shared/mod-classifier.ts` добавлен:
  - `FunctionalBlock` type (24 значения: spirit/skill-levels/attributes/resources/runes-barrier/resistances/magic-find/defence-stats/offence-speed/crit/damage-type/penetration/ailments/area-duration/wisps/buff-skills/minions/meta-skills/weapon-specific/flasks/conversion/rage-charges/breach/other).
  - `FUNCTIONAL_BLOCK_LABELS: Record<FunctionalBlock, CategoryLabel>` (24 entries — display-конфиг для всех блоков, готов для iter 86+).
  - `FUNCTIONAL_BLOCK_ORDER: FunctionalBlock[]` (порядок рендера — игрок-сценарий: Spirit → Skill levels → Attributes → Resources → Runes barrier → Resistances → Defence stats → Offence speed → Crit → Damage type → Penetration → Ailments → Area/Duration → Wisps → Buff skills → Minions → Meta-skills → Weapon-specific → Flasks → MF → Conversion → Rage/Charges → Breach → Other).
  - 7 паттернов (const RegExp): SPIRIT_PATTERN, SKILL_LEVELS_PATTERN, ATTRIBUTES_PATTERN, RESISTANCES_PATTERN, RUNES_BARRIER_PATTERN, MAGIC_FIND_PATTERN, BREACH_PATTERN.
  - `classifyFunctionalBlock(group): FunctionalBlock` — функция-классификатор. Match priority: spirit → runes-barrier → breach → magic-find → skill-levels → attributes → resistances → other.
  - Расширение `ModGroupMode` новым значением `'affix-functional'`.
  - Обработка `affix-functional` режима в `classifyGroups()` — возвращает sub-groups по функциональному блоку, упорядоченные по FUNCTIONAL_BLOCK_ORDER.
- 6: В `tests/shared/mod-classifier.test.ts` добавлены **44 новых теста**:
  - 7 блоков: 2 (spirit) + 5 (skill-levels) + 8 (attributes) + 4 (resistances) + 4 (runes-barrier) + 3 (magic-find) + 2 (breach) + 4 (other fallback) = 32 теста.
  - Match priority: 4 теста (spirit vs skill-levels, runes vs resists, breach vs attributes, attributes vs resists).
  - FUNCTIONAL_BLOCK_LABELS contract: 3 теста (24 entries, non-empty labels, all FunctionalBlock keys present).
  - classifyGroups integration: 5 тестов (empty input, mixed classification, label propagation, group merging, reference preservation).
- 7: Запущены тесты — **1172 базовых + 44 новых = 1216 passing**. Первые прогоны выявили 2 бага: (a) FUNCTIONAL_BLOCK_LABELS имел 23 entries вместо 24 (забыт блок `resources`); (b) `+#% к максимальному качеству` не матчилось паттерном SKILL_LEVELS_PATTERN (`максимум` не substring `максимальному` — adjective dative). Оба исправлены.
- 8: `pnpm lint`: 0 errors, 2 pre-existing warnings (TanStack virtual memoization).
- 9: `npx tsc -b`: 0 errors.
- 10: Написан `/home/z/my-project/scripts/simulate-iter85-impact.ts` — mirror classifyFunctionalBlock на реальных JSON (ring/amulet/belt). Получено: ring 27/94=28.7% caught, amulet 36/105=34.3%, belt 19/85=22.4%. **Other bucket: 200/284=70.4%** — это ХУЖЕ текущего neutral (17.7%). Подтверждено решение НЕ включать production.
- 11: Кратко протестировано переключение ring/amulet/belt pages на `affix-functional` (3 Edit'а), затем **ОТМЕНЕНО** (`groupMode` обратно на `affix-semantic`). Причина: other-bucket 70% — регрессия. iter 86 добавит ещё 5-7 блоков (defence-stats, offence-speed, crit, damage-type, flasks, resources, minions), что опустит other-bucket ниже 30% и позволит переключить страницы.
- 12: В header docstrings RingPage/AmuletPage/BeltPage добавлены комментарии про iter 85 (groupMode остался `affix-semantic`, но инфраструктура готова).
- 13: Обновлены документы:
  - `STATUS.md` — переписан под iter 85 (infrastructure готова, production НЕ переключён, план iter 86).
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — §5 приоритезация обновлена (P0 ⏳ infrastructure done, P0 ⏳ next ждёт iter 86), §7 iter 85 добавлен с симуляцией, §8 статус обновлён.
  - `worklog.md` — iter 85 section, iter 84 сжат до одной строки (был полным).

Stage Summary:
- **iter 85 COMPLETE (infrastructure).** Реализована инфраструктура 24-блочной системы: FunctionalBlock type + FUNCTIONAL_BLOCK_LABELS (24 entries) + FUNCTIONAL_BLOCK_ORDER + 7 активных паттернов (spirit/skill-levels/attributes/resistances/runes-barrier/magic-find/breach) + classifyFunctionalBlock() + `affix-functional` mode в classifyGroups().
- **Изменённые файлы (5):**
  - `src/shared/mod-classifier.ts` — +200 строк (FunctionalBlock type + FUNCTIONAL_BLOCK_LABELS + FUNCTIONAL_BLOCK_ORDER + 7 паттернов + classifyFunctionalBlock + affix-functional mode).
  - `tests/shared/mod-classifier.test.ts` — +330 строк (+44 теста: 7 блоков + match priority + FUNCTIONAL_BLOCK_LABELS contract + classifyGroups integration).
  - `src/ui/pages/{ring,amulet,belt}/*.tsx` — только комментарии в header docstring (groupMode остался `affix-semantic`).
  - `STATUS.md` — переписан под iter 85.
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — §5/§7/§8 обновлены.
- **Тесты:** 1216/1216 passing (1172 базовых + 44 новых). Lint: 0 errors. TSC: 0 errors.
- **Решение НЕ включать production:** Симуляция показала, что с 7 блоками other-bucket = 70.4% — это регрессия относительно текущего neutral (17.7%). iter 86 добавит 5-7 блоков (defence-stats, offence-speed, crit, damage-type, flasks, resources, minions) — после этого other-bucket опустится ниже 30% и можно переключить страницы на `affix-functional`.
- **Точка остановки:** iter 85 (infrastructure) done. В iter 86: (1) реализовать 5-7 функциональных блоков через tags + text patterns (defence-stats через теги armour/evasion/energy_shield/charm, offence-speed через тег speed, crit через тег critical, damage-type через теги damage/physical/elemental/cold/fire/lightning/chaos, flasks через текст «флакон», resources через теги life/mana, minions через тег minion); (2) после этого — переключить RingPage/AmuletPage/BeltPage на `affix-functional`. В iter 87: weapon sub-blocks для jewel (6 подблоков для 24 family-key).

---

## Предыдущие итерации (кратко)

- **iter 84**: 3 P0-фикса (Breach Lord skip + text fallback / waystone keywords / aura+gem tags). 1172/1172 tests. -18 neutral groups.
- **iter 83**: Верификация iter 82 на реальных JSON. 3 новых бага (Breach Lord 73 токена, relic 100% neutral, мета-механики PoE2 размазаны). 4 неточности iter 82 исправлены. Схема расширена 22→24 блока. 1158/1158 tests.
- **iter 82**: Анализ группировки аффиксов (OP-1). 6 багов, 22 функциональных блока. Без реализации.
- **iter 81**: Bug #16/17 + useUrlSync-extract (won't fix). README переписан под SEO.
- **iter 80**: Bug #13 closed — removed dead skip `.*[0-9][1-9]` из iterative-optimizer.ts ×2.
- **iter 79**: Bug #8 Phase 2 — split useCategoryPage на 3 sub-hooks.
- **iter 78**: Bug #8 Phase 1 — pure AST helpers extracted в category-ast-utils.ts.
- **iter 77**: Lint cleanup 44→7 problems.
- **iter 76**: KI-3 resolved + KI-2 data-level fix.
- **iter 73-75**: KI-1 закрыт (`?` tokenizer mismatch). KI-2 code-fixed. KI-3 обнаружен.
- **iter 72**: Дедупликация ETL-утилит, удаление dead code.
- **iter 64-71**: UI redesign — TopNav, атмосферная стилизация PoE2.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

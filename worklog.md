# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 86
Agent: main
Task: Реализовать 5-7 новых функциональных блоков через tags + text patterns (defence-stats, offence-speed, crit, damage-type, flasks, resources, minions) поверх 7 блоков iter 85. После этого — переключить RingPage/AmuletPage/BeltPage на `affix-functional` (цель: other-bucket < 30%).

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Прочитаны: `STATUS.md` (iter 85), `worklog.md` (iter 85), `src/shared/mod-classifier.ts` (1373 строки), `tests/shared/mod-classifier.test.ts` (947 строк), `src/ui/pages/{ring,amulet,belt}/*.tsx`.
- 2: Установлены зависимости через `npx pnpm@11.5.2 install`. Базовый прогон: **1216/1216 тестов зелёные, lint 0 errors (2 pre-existing warnings), tsc 0 errors**.
- 3: Инспектированы `public/generated/{ring,amulet,belt}.json` — собраны все family-groups с тегами. 284 family-groups (94 ring + 105 amulet + 85 belt). Видны приоритеты тегов: minion бьёт life/mana/critical/damage/speed/resistance; resistance бьёт fire/cold/lightning/chaos/elemental; critical бьёт damage.
- 4: Написан `/home/z/my-project/work/poe2-regex-ru/scripts/simulate-iter86-impact.ts` — mirror `classifyFunctionalBlock()` на реальных jewellery JSON. Базовый прогон (с 7 блоками iter 85): other-bucket = 70.4% (200/284). Прогон с 14 блоками (iter 86 план): **other-bucket = 9.9% (28/284)** — подтверждена достижимость цели <30%.
- 5: Спроектирован match priority с tags + text:
  1. spirit (text) → 2. runes-barrier (text) → 3. breach (text) → 4. magic-find (text) → 5. skill-levels (text) → 6. flasks (text «флакон») → 7. minions (tag minion + text «приспешник»/«подношен») → 8. attributes (text + tag attribute) → 9. resistances (tag resistance + text «сопротивлен») → 10. resources (tags life/mana + text ES max/leech/regen) → 11. defence-stats (tags armour/evasion/energy_shield/charm + text «брон»/«уклонен»/«блок»/«порог оглушен») → 12. crit (tag critical + text «крит») → 13. damage-type (tags damage/physical/elemental/cold/fire/lightning/chaos + text «урон») → 14. offence-speed (tag speed + text «скорость атаки/сотворения/передвижения/снарядов») → 15. other.
- 6: В `src/shared/mod-classifier.ts` реализовано:
  - 7 новых паттернов: FLASKS_PATTERN, MINIONS_PATTERN, RESOURCES_PATTERN, DEFENCE_STATS_PATTERN, CRIT_PATTERN, DAMAGE_TYPE_PATTERN, OFFENCE_SPEED_PATTERN (каждый с подробным JSDoc с примерами и приоритетами).
  - `classifyFunctionalBlock(group)` переписана: добавлен сбор тегов из `group.members` (с пропуском Breach Lord source tags), 15-шаговый match priority с tags + text.
  - Обновлены комментарии: FunctionalBlock type (⏳ iter 86 → iter 86 / ⏳ iter 87+), FUNCTIONAL_BLOCK_LABELS (7→14 active), FUNCTIONAL_BLOCK_ORDER (7→14 implemented), ModGroupMode (7→14 active), classifyGroups (7→14 active).
- 7: В `tests/shared/mod-classifier.test.ts` добавлено **52 новых теста**:
  - flasks: 7 тестов (text «флакон», flask-conditional mods с priority over damage/speed/resources, обереги → defence-stats NOT flasks).
  - minions: 9 тестов (minion+resist/critical/life/damage — minion wins; text «подношен»; +level minion mods → skill-levels; minion+speed — minion wins).
  - resources: 9 тестов (life/mana tags; ES max text BEFORE defence-stats; MoM; leech; regen; on-kill).
  - defence-stats: 9 тестов (armour/evasion/energy_shield/charm tags; обереги via charm; порог оглушения text; ES recharge → defence-stats NOT resources).
  - crit: 5 тестов (critical tag; critical+damage — crit wins; caster+critical+elemental+fire — crit wins).
  - damage-type: 8 тестов (damage tag; fire/cold/lightning/chaos/physical; resist NOT damage-type; crit NOT damage-type).
  - offence-speed: 5 тестов (speed tag; skill-levels wins for "перезарядка умений"; minions wins for minion-speed; buff-skills deferred).
  - Обновлён 1 тест: "Подношений" → minions (был other в iter 85).
  - Обновлены 4 теста: "deferred to iter 86" → "deferred to iter 87+".
- 8: Запущены тесты — **1216 базовых + 52 новых = 1268 passing**. `npx tsc -b`: 0 errors. `npx eslint .`: 0 errors (2 pre-existing warnings).
- 9: Запущена симуляция — **other-bucket = 9.9% (28/284)**: ring 9/94=9.6%, amulet 12/105=11.4%, belt 7/85=8.2%. Цель <30% достигнута.
- 10: Переключены 3 production-страницы на `affix-functional`:
  - `src/ui/pages/ring/RingPage.tsx`: `groupMode="affix-semantic"` → `groupMode="affix-functional"`, header docstring обновлён.
  - `src/ui/pages/amulet/AmuletPage.tsx`: то же.
  - `src/ui/pages/belt/BeltPage.tsx`: то же.
- 11: Повторный прогон тестов после переключения — **1268/1268 passing**. `tsc -b`: 0 errors. `eslint`: 0 errors.
- 12: Обновлены документы:
  - `STATUS.md` — переписан под iter 86 (14 блоков, production ENABLED, other-bucket 9.9%, план iter 87).
  - `worklog.md` — iter 86 section, iter 85 сжат до одной строки.
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — §5/§7/§8 обновлены.

Stage Summary:
- **iter 86 COMPLETE (production switch).** Реализованы 7 новых функциональных блоков через tags + text patterns (defence-stats / offence-speed / crit / damage-type / flasks / resources / minions). Production-страницы RingPage/AmuletPage/BeltPage переключены на `affix-functional`.
- **Изменённые файлы (8):**
  - `src/shared/mod-classifier.ts` — +200 строк (7 новых паттернов + tag-based классификация в `classifyFunctionalBlock()`, обновлены комментарии).
  - `tests/shared/mod-classifier.test.ts` — +400 строк (+52 теста: 7 блоков + edge cases + match priority).
  - `src/ui/pages/ring/RingPage.tsx` — `groupMode="affix-functional"` + header docstring.
  - `src/ui/pages/amulet/AmuletPage.tsx` — то же.
  - `src/ui/pages/belt/BeltPage.tsx` — то же.
  - `scripts/simulate-iter86-impact.ts` — новый скрипт (mirror классификатора на реальных JSON).
  - `STATUS.md` — переписан под iter 86.
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — §5/§7/§8 обновлены.
- **Тесты:** 1268/1268 passing (1216 базовых + 52 новых). Lint: 0 errors. TSC: 0 errors.
- **Симуляция:** other-bucket = 9.9% (28/284) — цель <30% достигнута с запасом.
- **Production switch:** 3 страницы (ring/amulet/belt) теперь используют `affix-functional` mode. UI показывает 14 функциональных блоков вместо 4 корзин offensive/defensive/attribute/neutral.
- **Точка остановки:** iter 86 done. В iter 87: (1) weapon sub-blocks для jewel (6 подблоков для 24 family-key — отдельная задача, требует подуровня внутри offensive bucket); (2) опционально — добавить ещё 2-3 блока (penetration/ailments/area-duration) для снижения other-bucket ниже 5%.

---

## Предыдущие итерации (кратко)

- **iter 85**: Инфраструктура 24 функциональных блоков (7 активны: spirit/skill-levels/attributes/resistances/runes-barrier/magic-find/breach). Production НЕ переключён (other-bucket 70.4%). 1216/1216 tests.
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

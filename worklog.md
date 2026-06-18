# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 81
Agent: main
Task: Bug #16 + Bug #17 + useUrlSync-extract (последние низкоприоритетные долги). README переписан под SEO и презентацию проекта. Удалены устаревшие patch-archive файлы (ITER65_README.md, DELETED-FILES.txt).

Work Log:
- 1: Клон репо. `npm install`. Baseline: `tsc -b` чистый, `vitest run` — 1157 passed.
- 2: **Bug #17 fix** — заменил `{from: -1, to: -1}` sentinel в `src/core/poe2-regex-matcher.ts` на явное поле `negated: boolean` в типах `Token` (line 61) и `PoE2Regex` (line 223). Tokenizer (line 149) теперь `tokens.push({ type: 'charClass', ranges, negated })` без ветвления. Parser (line 297) propagates флаг. Matcher (lines 351-359) упрощён до `regex.negated ? !inRange : inRange`.
- 3: Добавлен тест `tests/core/poe2-regex-matcher.test.ts:175-182` — `[^0-9]`, `[^а-я]`, `Делири[^уф]` patterns. Тесты: 119/119 matcher tests passed (118 + 1 new). Полный набор: 1158/1158 passed (1157 + 1 new). `tsc -b --force` чистый.
- 4: **Bug #16 fix** — `scripts/etl/normalize.ts:449`: `IMPLICIT_RANGE_UNRESTRICTED = [0, 350]` → `[0, 999]`. Обновлён комментарий с объяснением (top-tier waystones могут роллить implicits >350 через implicit-set bonus stacking; 999 — safe 3-digit ceiling).
- 5: ETL rerun (`npm run etl`) — успешно, 1697 tokens, FN=0, FP=9463 (идентично baseline).
- 6: Diff `public/generated/*.json` vs baseline (ignoring version): только waystone.json (4 changes `350` → `999`) и waystone-desecrated.json (4 changes `350` → `999`). Остальные 8 JSON идентичны.
- 7: **useUrlSync-extract** — закрыт как won't fix. Обновлён комментарий в `src/ui/hooks/useCategoryPage.ts:517-523`: URL-sync effect tightly coupled к 13 значениям (6 useState + 7 store-side), extract не упростит lint и не уменьшит coupling.
- 8: **README переписан** — преобразован из iter-72-patch-archive-описания в презентацию проекта для GitHub + SEO. Содержит: hero, возможности (10 пунктов), как работает (высокоуровнево), PoE2 regex-диалект (поддерживается/не поддерживается), технологии, структура проекта, локальный запуск, ссылки на документацию, контакты.
- 9: **Удалены устаревшие файлы:** `ITER65_README.md` (stale iter 65 patch archive), `DELETED-FILES.txt` (stale iter 64 patch archive).
- 10: **STATUS.md** — iter 80 → 81, секция "Открытые долги" теперь пустая ("iter 81 закрыл последние три низкоприоритетных бага"), добавлены 3 новых записи в "История закрытых багов" (Bug #16, Bug #17, useUrlSync-extract).
- 11: **AGENT_NAVIGATION.md** — header iter 80 → 81, сжат (старое содержимое про iter 79/78 избыточно), добавлен Pitfall 34 (charClass negated field), обновлён Pitfall 31 (Bug #16 closed), обновлён Pitfall 33 (useUrlSync-extract closed).
- 12: Финальная верификация: `tsc -b` чистый, `vitest run` — 1158/1158 passed.

Stage Summary:
- **iter 81 COMPLETE.** Все три низкоприоритетных долга закрыты. README переписан под SEO/презентацию. Удалены 2 устаревших patch-archive файла.
- **Изменённые файлы (10):**
  - `src/core/poe2-regex-matcher.ts` — Bug #17 fix (charClass `negated: boolean` field)
  - `tests/core/poe2-regex-matcher.test.ts` — добавлен тест на `[^...]` patterns
  - `scripts/etl/normalize.ts` — Bug #16 fix (`IMPLICIT_RANGE_UNRESTRICTED = [0, 999]`)
  - `public/generated/waystone.json` — ETL rerun (4 implicit ranges `350` → `999` + version)
  - `public/generated/waystone-desecrated.json` — ETL rerun (4 implicit ranges `350` → `999` + version)
  - `src/ui/hooks/useCategoryPage.ts` — комментарий useUrlSync-extract обновлён (won't fix)
  - `README.md` — переписан под SEO и презентацию проекта
  - `STATUS.md` — iter 81, все долги закрыты
  - `AGENT_NAVIGATION.md` — header iter 81 + Pitfall 34 + Pitfall 31/33 updates
  - `worklog.md` — iter 81 section + предыдущие сжаты
- **Удалённые файлы (2):**
  - `ITER65_README.md` (stale iter 65 patch archive)
  - `DELETED-FILES.txt` (stale iter 64 patch archive)
- **Метрики:** 1158/1158 passed. `tsc -b` чистый. ETL: 1697 tokens, FN=0, FP=9463 (идентично baseline).
- **Точка остановки:** iter 81 done. Все известные долги закрыты. Следующая итерация: нет открытых задач — проект в maintenance mode. Возможные future work: Bug #8 (useCategoryPage.ts 638 строк — was 1325 в iter 78, was 486 в iter 79, теперь 638 — рефакторинг ещё возможен); lint cleanup (2 unfixable warnings от TanStack Virtual); SEO-верификация в GSC/Яндекс/Bing (ручная).

---

## Предыдущие итерации (кратко)

- **iter 80**: Bug #13 closed — removed dead skip `.*[0-9][1-9]` из iterative-optimizer.ts (×2), run-etl.ts, analyze-fn.ts. ETL output идентичен. 1157/1157.
- **iter 79**: Bug #8 Phase 2 — split useCategoryPage на 3 sub-hooks (useFilterStore/useCategoryData/useRegexBuilder) + fix 3 setState-in-effect errors. Lint 5→2. 1157/1157.
- **iter 78**: Bug #8 Phase 1 — pure AST helpers extracted в category-ast-utils.ts (890 строк); useCategoryPage.ts 1325→486. 1157/1157.
- **iter 77**: Lint cleanup 44→7 problems (37 fixed in 14 files). useCategoryPage.ts:793 regex escape fix.
- **iter 76**: KI-3 resolved (poe2db.tw OLD forms stable >1 year) + KI-2 data-level (ETL rerun с original OLD-form keys).
- **iter 73-75**: KI-1 закрыт (`?` tokenizer mismatch). KI-2 code-fixed. KI-3 обнаружен.
- **iter 72**: Дедупликация ETL-утилит, удаление dead code.
- **iter 64-71**: UI redesign — TopNav, атмосферная стилизация PoE2, HomePage hero decorations, CSS-примитивы.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

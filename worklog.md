# Worklog

---
Task ID: 41
Agent: main
Task: D5 — In-game верификация Path D на production ETL output. 5 функциональных тестов (D5-1..D5-5) на 16 предметах из тестового файла. Анализ результатов, обновление документации.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: STATUS.md (iter 40, D2+D4 DONE), worklog Task ID 40 (Path D в ETL + runtime), docs/IN_GAME_TESTS.md (v10)
- 2: Составлены 5 функциональных in-game тестов D5-1..D5-5, покрывающих все risk-зоны:
  - D5-1: Scalability 6+ alts + truncated stems
  - D5-2: AND + Path D runtime combination (prefix_ctx)
  - D5-3: Clean TP/TN with FP control
  - D5-4: Multi-item TP + cross-category FP
  - D5-5: Truncated stems + broad `.*`
- 3: Пользователь провёл первую серию — D5-1 v1 (262 chars) и D5-2 v1 (327 chars) НЕ ПОМЕСТИЛИСЬ в лимит PoE2 ≈250 chars; D5-3, D5-4, D5-5 PASS
- 4: Перепроектированы D5-1 v2 (98 chars, 6 alts + split-word `.*`) и D5-2 v2 (125 chars, 4 alts + prefix_ctx `имеют`) — обе ≤250 chars
- 5: Пользователь провёл вторую серию — D5-1 v2 PASS (jewel 2 only), D5-2 v2 PASS (jewel 2 + all 3 waystones, **same-block AND confirmed**)
- 6: Анализ результатов — все 5/5 PASS. Выводы:
  - Path D работает на 6-9 alts в production
  - Same-block AND confirmed: `"X" "Y"` matches when both in ONE block
  - Cross-category FP (D5-4, D5-5) — expected behavior, не баг
  - PoE2 regex char limit ≈250 chars — NEW finding для ETL
  - No code changes needed — ETL + runtime корректны
- 7: Обновлена документация (чисто, без мусора):
  - STATUS.md → iter 41, Path D COMPLETE (D1+D2+D4+D5+D6 DONE), 5/5 D5 tests PASS, ключевые выводы, NEW constraint char limit
  - docs/IN_GAME_TESTS.md → v11, добавлена секция "Iteration 41 — D5 VERIFIED" с детальными результатами 5 тестов; убраны устаревшие iter 36/40 секции; сжаты iter 38/39 в краткие summary
  - AGENT_NAVIGATION.md → v28, §5 RESOLVED+PRODUCTION-VERIFIED, §9 добавлены same-block AND + char limit строки, Pitfall 14 обновлён (RESOLVED iter 40 + VERIFIED iter 41), добавлены Pitfall 18 (char limit) + Pitfall 19 (same-block AND semantics), §12 Principle 8 обновлён (production-verified)
  - worklog.md → Task ID 41 (этот)

Stage Summary:
- **Код НЕ изменён** (только документация)
- **D5 VERIFIED** — Path D production-verified на 5 категориях (jewel, amulet, ring, waystone, tablet), 5/5 in-game тестов PASS
- **Ключевые выводы:**
  1. Same-block AND confirmed в PoE2 (`"X" "Y"` matches when both in ONE block) — `optimization-strategies.ts` корректен, никаких изменений не нужно
  2. Path D работает на 6-9 alts в production (11+ alts не тестировались напрямую из-за 250-char limit, но 9-alt PASS даёт высокую уверенность)
  3. Cross-category FP (D5-4, D5-5) — expected behavior (opt-table regexes category-agnostic по дизайну), не требует D3 fix
  4. PoE2 regex char limit ≈250 chars — NEW finding для ETL (entries >250 chars нельзя использовать в игре)
  5. No code changes needed — ETL pipeline + runtime optimization корректны
- **D6 = effectively DONE** — ETL применяет Path D ко всем 7 категориям; in-game verified на 5 (jewel, amulet, ring, waystone, tablet); belts/relics используют тот же pipeline
- **Path D = COMPLETE** (D1+D2+D4+D5+D6 all DONE)
- **Точка остановки:** Path D work полностью завершён. Возможные следующие шаги (опциональные, не блокирующие):
  1. **D3** — regexExclude с усечёнными основами (отдельная задача, не связана с Path D)
  2. **ETL constraint** — добавить проверку ≤250 chars в `path-d-transform.ts` или `compute-optimizations.ts` Phase D (предупреждать если Path D entry >250 chars)
  3. **Финальная полировка** — UI/UX, edge cases, документация

---

Task ID: 40
Agent: main
Task: D2+D4 — реализовать Path D в ETL compute-optimizations.ts + iterative-optimizer.ts; проверить runtime совместимость с optimization-strategies.ts

Work Log:
- Создан `scripts/etl/path-d-transform.ts` (172 строки) — функция `pathDTransform()` рекурсивно преобразует `prefix(A|B|C)` → `prefix.*A|prefix.*B|prefix.*C`
- Добавлен Phase D в `compute-optimizations.ts` (после Phase C)
- Обновлён `iterative-optimizer.ts` `reoptimizeTable()` — Path D применяется всегда, broken `()`-with-`|` заменяются даже если Path D длиннее
- Обновлён `optimization-strategies.ts` `applyOptimizationTable()` — Path D entries применяются ВСЕГДА при `matchedIds.size >= 2`, даже с negative savings
- 35 unit-тестов для `path-d-transform.ts` + 3 D4 runtime-теста — все 1084 тестов проходят
- ETL перегенерировал все 10 JSON — 303/481 Path D entries, 0 broken `()`-with-`|` remain

Stage Summary:
- **D2+D4 DONE** — Path D реализован в ETL + runtime
- 303/481 opt-table entries в Path D формате, 0 broken
- Все 1084 тестов проходят
- Files: NEW `scripts/etl/path-d-transform.ts` + `tests/etl/path-d-transform.test.ts`; MODIFIED `compute-optimizations.ts`, `iterative-optimizer.ts`, `optimization-strategies.ts`, `tests/core/optimizer.test.ts`, `tests/etl/compute-optimizations.test.ts`; REGENERATED all 10 `public/generated/*.json`

---

Task ID: 39
Agent: main
Task: D1 — In-game тест Path D на 3+ альтернативах + AND combination

Work Log:
- Составлены 3 функциональных теста на 16 предметах (3 кольца + 3 путевых камня + 3 плиты + 3 амулета + 4 самоцвета)
- Пользователь провёл тесты — все 3 PASS ровно по предсказанию

Stage Summary:
- **D1 VERIFIED** — Path D работает на 2/3/4 альтернативах + AND-комбинация
- Код не изменён (только документация)

---

Task ID: 38
Agent: main
Task: Зафиксировать выводы iter 37 — B0 RESOLVED, D7-3 CONFIRMED WORKING, Path D как новая стратегия

Stage Summary:
- **B0 CONFIRMED BROKEN** — `"X"|"Y"` (OR между quoted groups) даёт ZERO matches в игре. Path A невозможен.
- **D7-3 CONFIRMED WORKING** — `"X.*A|X.*B"` (top-level `|` в одном quoted group с `.*`) работает. Game patched со времён iter 15-17.
- **Path D — новая стратегия** для same-family OR

---

Task ID: 37
Agent: main
Task: Тесты 4 самоцветов + детерминированная стратегия регексов (8 принципов, без изменения кода)

Stage Summary:
- Сформулирована детерминированная стратегия — 8 принципов для всех категорий
- 60 unit-тестов для 4 самоцветов, все проходят
- 3 B0-теста PENDING для in-game verification

---

## Older iterations (36 and before)

Iterations 15-36 covered: legacy in-game tests (Tests 15-17 BROKEN behavior), hypothesis pattern verification, FP prevention anchors (5 levels), 9 pattern types, truncated word tails. Results are consolidated in `docs/IN_GAME_TESTS.md` reference tables. See git history for detailed work logs of these iterations.

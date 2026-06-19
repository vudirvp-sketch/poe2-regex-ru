# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 101
Agent: main
Task: P0-фикс Critical Bug, обнаруженного пользователем на production: на страницах jewel / amulet / ring / belt ВСЕ аффиксы отображаются в одной functional-категории «Прочее» (пользователь конкретно указал «Прочее (18)» — это ring или amulet страница). Требование: «лучше недоделать, чем сломать» → минимальный,_backward-compatible фикс.

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Чтение STATUS.md (iter 100 — cleanup устаревших iter*-скриптов), worklog.md (iter 100 подробно), AGENT_NAVIGATION.md (структура + Roadmap).
- 2: Анализ бага. Пользователь сообщил про «Прочее (18)» — предположительно ring или amulet. Curl `https://vudirvp-sketch.github.io/poe2-regex-ru/{jewel,belt,ring,amulet}/` → grep `Прочее \(\d+\)`:
  - jewel: `Прочее (10/110/3/33/83)` — ВСЕ affixes в `other`.
  - belt: `Прочее (6/7/8/10/11/12/14/17)` — ВСЕ affixes в `other`.
  - ring: `Прочее (7/8/12/13/14/15/17/18)` — ВСЕ affixes в `other`.
  - amulet: `Прочее (7/8/11/12/14/18/19/21)` — ВСЕ affixes в `other`.
  - Вывод: баг подтверждён, runtime классификация полностью сломана — все токены падают в `other`.
- 3: Python-анализ `public/generated/{jewel,amulet,ring,belt}.json` — `functionalCategory` поле присутствует на всех токенах (ETL работает корректно). Метрики ETL: jewel 16/193 other, amulet 7/105, ring 3/94, belt 4/85 — соответствует STATUS.md. Значит баг НЕ в ETL, а в runtime.
- 4: Чтение `src/shared/mod-classifier.ts:1268-1309` — `classifyFunctionalBlock()`:
  - Strategy 0: `if (group.members[0].functionalCategory)` → majority voting. Если поле отсутствует → fallback `return 'other';`.
  - Гипотеза: `functionalCategory` отсутствует на runtime-токенах, хотя присутствует в JSON.
- 5: Чтение `src/data/loader.ts:24` — `const data = CategoryDataSchema.parse(raw) as CategoryData;`. Zod по умолчанию **strips** неизвестные поля.
- 6: Чтение `src/shared/schemas.ts:55-77` — `GameTokenSchema` НЕ содержит `functionalCategory`. Сравнение с `src/shared/types.ts:21-71` (`GameToken` interface) — `functionalCategory?: string` есть в типе (line 61), но отсутствует в схеме.
- 7: Git history: `git log -S "functionalCategory" -- src/shared/types.ts` → iter 90 (commit `009b00d`) добавил поле в тип. `git log -S "functionalCategory" -- src/shared/schemas.ts` → пусто. Поле НИКОГДА не было в схеме. Баг существует с iter 90 (3+ итераций «улучшений классификации», не замеченных из-за того что unit-тесты и cross-validation тесты обходят Zod-парсинг).
- 8: Создание `scripts/verify-bug-functionalCategory.ts` для подтверждения гипотезы — `npx tsx` run: «Stripped tokens: 298/298» (100% tokens потеряли functionalCategory). Баг подтверждён.
- 9: Документирование бага в `STATUS.md` как Known Issue #4 (правило пользователя: «Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись»). Параллельно — реструктуризация STATUS.md: iter 101 как текущая итерация, iter 100 перенесён в архив одной строкой (был избыточен), удалена секция «История sort-логики» (iter 100 расследование, не актуально после фикса).
- 10: **Фикс** `src/shared/schemas.ts`: добавлено `functionalCategory: z.string().optional()` в `GameTokenSchema` (1 строка + 4 строки комментария с ссылками на Known Issue #4). Backward-compatible: опциональное поле, старый JSON без поля тоже валиден.
- 11: Регрессионные тесты `tests/etl/etl-schemas.test.ts` — добавлен `describe('CategoryDataSchema — functionalCategory preservation (iter 101 regression)')` с 3 тестами:
  - `preserves functionalCategory field from real belt.json` — load actual JSON через `CategoryDataSchema.parse()`, verify `functionalCategory` сохраняется на ≥1 токене, parsedCount === rawCount.
  - `preserves functionalCategory across all jewellery categories` — то же для jewel/amulet/ring/belt.
  - `rejects invalid functionalCategory type (non-string)` — `functionalCategory: 42` → safeParse fails (z.string() type safety).
- 12: Sanity check `scripts/_sanity-iter101-fix.ts` (временный, удалён после): load JSON через schema → `groupTokensByFamily` → `classifyGroups(_, 'affix-functional')` → проверить, что non-`other` блоки присутствуют. Результат:
  - jewel: 17 blocks (16 non-`other` + 1 `other` с 16 family-groups) — было 1 блок `other` со всеми 193 family-groups.
  - amulet: 19 blocks (18 + 1 other с 7) — было 1 other со 105.
  - ring: 17 blocks (16 + 1 other с 3) — было 1 other с 94.
  - belt: 14 blocks (13 + 1 other с 4) — было 1 other с 85.
  - Размеры `other` блоков (16/7/3/4) СОВПАДАЮТ с ETL-метриками в STATUS.md → runtime классификация теперь соответствует ETL классификации.
- 13: Удаление временных скриптов `scripts/verify-bug-functionalCategory.ts` и `scripts/_sanity-iter101-fix.ts` (правило AGENT_NAVIGATION: «Не добавлять новые verify-iter*-*.ts — покрывай проверки через tests/ (vitest) или inline sanity в worklog.md»).
- 14: Верификация:
  - `npx vitest run` → 1414/1414 passing (1411 baseline + 3 новых регрессионных).
  - `npx tsc -b` → 0 errors.
  - `npx eslint .` → 2 problems (0 errors, 2 warnings — TanStack library-level, без изменений vs iter 100).
- 15: Документация:
  - `STATUS.md` — iter 101 как текущая; iter 100 перенесён в архив; добавлен Known Issue #4 с пометкой ✅ FIXED iter 101; удалена секция «История sort-логики» (расследование iter 100, не актуально после фикса).
  - `worklog.md` — iter 100 сжат до одной строки, iter 101 добавлен подробно.
  - `AGENT_NAVIGATION.md` — `scripts/` секция без изменений (новых iter*-скриптов не добавлено); Pitfall #34 обновлён: добавлена заметка «iter 101: functionalCategory теперь реально доходит до runtime (Zod-схема пропускает поле)»; Roadmap updated: iter 101 done.

Stage Summary:
- **iter 101 COMPLETE.** Critical Bug fixed: `GameTokenSchema` в `src/shared/schemas.ts` не содержал `functionalCategory` → Zod удалял это поле при парсинге → `classifyFunctionalBlock()` падал в `other` fallback → ВСЕ affixes отображались как «Прочее» в production (с iter 90). Фикс: 1 строка + 4 комментария. +3 регрессионных теста в `tests/etl/etl-schemas.test.ts`.
- **Изменённые файлы (4):**
  - `src/shared/schemas.ts` — добавлено `functionalCategory: z.string().optional()` в `GameTokenSchema`.
  - `tests/etl/etl-schemas.test.ts` — +3 регрессионных теста (preserves functionalCategory / across all jewellery / rejects invalid type).
  - `STATUS.md` — iter 101 как текущая, iter 100 архив, Known Issue #4 добавлен и помечен FIXED.
  - `worklog.md` — iter 101 подробно, iter 100 одной строкой.
  - `AGENT_NAVIGATION.md` — Pitfall #34 + Roadmap iter 101.
- **Тесты:** 1414/1414 passing (+3 vs iter 100). TSC: 0 errors. ESLint: 0 errors, 2 warnings (library-level, без изменений). ETL: 11 fresh, 0 stale. Никаких изменений в `public/generated/*.json`.
- **Production-эффект после деплоя:** на страницах jewel/amulet/ring/belt вместо одного «Прочее (N)» появятся 14-19 функциональных блоков (Дух / Атрибуты / Сопротивления / Урон / Крит / Состояния / ...). Размер `other` блока совпадёт с ETL-метриками (jewel 16, amulet 7, ring 3, belt 4 family-groups).
- **Точка остановки:** iter 101 done. В iter 102+ можно:
  1. **P2 — waystone/tablet sub-blocks**: sub-группировка внутри sentiment (positive/negative/neutral) по gameplay mechanic — для waystone: loot/danger/splinters; для tablet: ritual/breach/delirium уже есть как type, нужен второй уровень внутри type.
  2. **P4 — tier-aware sort toggle**: UI-тумблер «режим сортировки» (alpha vs tier-first) в `CategoryControlPanel`. iter 99 сделал tier вторичным, но toggle не добавлен.
  3. **Опционально: подавить 2 TanStack warnings** в `VirtualizedModList.tsx` через `// eslint-disable-next-line react-hooks/incompatible-library` (довести ESLint до 0 problems).
  4. **Опционально: расширить e2e-тестирование**: добавить `tests/integration/` с тестами «load JSON → classify → verify не-`other` блоки» для всех 4 категорий (покрыть production path полностью, чтобы подобный regression не повторился).

---

## Предыдущие итерации (кратко)

- **iter 100**: cleanup 17 устаревших iter*-скриптов. ESLint 0 errors (15 → 0). Констатация: «удаления группировки» в iter 96/97 не было — была замена pure-alpha → tier-first в Session 70, исправленная в iter 99. 1411/1411 tests.
- **iter 99**: alphabetical within-block sort. `sortGroupsAlphabetically()` + `withAlphabeticalGroups()` wrapper для всех 9 режимов `classifyGroups()`. +19 unit-тестов. 1411/1411 tests.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий для 25 family-keys). 1392/1392 tests.
- **iter 97**: Аудиторская чистка тестов и исторических скриптов. 16 файлов удалено. 1363/1363 tests.
- **iter 96**: Удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`. 1363/1363 tests.
- **iter 95**: Документационная чистка + deprecation-маркер для regex-паттернов. 1363/1363 tests.
- **iter 94**: AILMENTS tag-priority refactor. 26 модов реклассифицированы damage-type → ailments. 1363/1363 tests.
- **iter 93**: penetration block activated (3 family-keys moved resistances → penetration). 1363/1363 tests.
- **iter 92**: 2 ETL root-cause fixes. 11 iter 91 discrepancies resolved. 1363/1363 tests.
- **iter 91**: ETL --fresh run, functionalCategory 100% в продакшене. 1363/1363 tests.
- **iter 89**: ailments + area-duration blocks. jewel other-bucket 21.8% → 14.0%. 1340/1340 tests.
- **iter 87**: Weapon sub-blocks для jewel. Other-bucket 21.8%. 1315/1315 tests.
- **iter 86**: +7 функциональных блоков (14 активны). Other-bucket 9.9%. 1268/1268 tests.
- **iter 85**: Инфраструктура 24 функциональных блоков (7 активны). 1216/1216 tests.
- **iter 84**: 3 P0-фикса (Breach Lord skip + text fallback / waystone keywords / aura+gem tags). 1172/1172 tests.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

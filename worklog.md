# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 107
Agent: main
Task: UX-полировка P4 — tier-colored left border для всех 4 tier'ов в tier-first режиме. iter 106 добавил UI-тумблер alpha vs tier-first, но визуально в tier-first режиме пользователь видел только S-tier (amber-soft) и «всё остальное» (affix color). iter 107 закрывает UX-долг: distinct tier color для каждого tier в tier-first режиме. Чисто UI/CSS изменение — 0 риска для данных/логики/ETL/JSON/схемы. Минимальный scope: новый опциональный prop `sortMode` в FilterChip (default 'alpha' — backward compat со всеми существующими tests), threading через ModList/VirtualizedModList, 1 новый CSS-токен `--bl-amber-dim` для B-tier, 11 новых unit-тестов.

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 106 — P4 sort toggle, 1522/1522), worklog.md (iter 106 подробно), AGENT_NAVIGATION.md (entry iter 106 + Roadmap + Pitfall #28/34). Подтверждение baseline: `npx vitest run` → 1522/1522; `npx tsc -b` → 0 errors; `npx eslint .` → 0 problems. Выбор scope: только UX-полировка P4 (tier-colored left border в tier-first). Опциональные пункты (sortKey/popularity, waystone neutral-generic, tablet Разломы) отложены — первые два требуют ETL/classifier изменений (риск), третий уже корректно классифицируется в generic.
- 2: Анализ существующего кода. `FilterChip.tsx` уже имеет S-tier amber-soft border (always-on indicator, lines 100-104), но A/B/C используют `affixColor` (blue/orange/amber). В tier-first режиме пользователь хочет сканировать tiers — нужны distinct colors. Дизайн: S=amber-soft (brightest, amber-400 — уже есть), A=amber (medium, amber-500 — уже есть как `--bl-amber`), B=amber-dim (deeper bronze, amber-700 — НОВЫЙ токен), C=gray (neutral low-priority — уже есть как `--bl-gray`). Иерархия зеркалит priorityFilter кнопки (Pitfall 28: S=amber-500, S+A=amber-700). Affix color suppressed в tier-first режиме — affix info уже виден через column header / origin-section структуру.
- 3: CSS tokens. `src/index.css`:
  - Добавлен `--bl-amber-dim: #b45309` (amber-700, bronze) в `:root` блоке.
  - Добавлен `--color-bl-amber-dim: var(--bl-amber-dim)` mapping в `@theme` блоке — создаёт Tailwind utility `border-l-bl-amber-dim` автоматически.
  - JSDoc-комментарий объясняет иерархию (S/A/B/C → brightest/medium/bronze/neutral).
- 4: FilterChip logic. `src/ui/components/FilterChip.tsx`:
  - Import `SortMode` из `@shared/types`.
  - `interface FilterChipProps` += опциональный `sortMode?: SortMode` с JSDoc (iter 107 reference, two-mode policy explanation, backward compat note).
  - Destructuring `sortMode = 'alpha'` default.
  - `effectiveBorderClass` refactor: 2-branch conditional. Tier-first mode: 4-way switch on `group.priorityTier` (S→amber-soft, A→amber, B→amber-dim, C→gray, default→gray для unknown). Alpha mode: pre-iter-107 behaviour (S→amber-soft, else→affixColor).
  - Старый `tierBorderClass` (3-way: S→amber-soft, A→affixColor, else→empty) удалён — заменён unified conditional.
- 5: ModList threading. `src/ui/components/ModList.tsx`:
  - `ModSubGroupSection` interface += опциональный `sortMode?: SortMode` с JSDoc; destructuring += `sortMode`; `<FilterChip>` call внутри += `sortMode={sortMode}`.
  - `AffixColumn` interface += опциональный `sortMode?: SortMode` с JSDoc; destructuring += `sortMode`.
  - Все 2 `<ModSubGroupSection>` call sites внутри `AffixColumn` (origin-mode + non-origin-mode) += `sortMode={sortMode}`.
  - Все 6 `<AffixColumn>` call sites (implicit x2, prefix+suffix two-col, prefix+suffix single-col) += `sortMode={sortMode}`.
  - Все 3 inline `<FilterChip>` call sites (renderJewelTypeSubGroups, originPrefix, originSuffix) += `sortMode={sortMode}`.
- 6: VirtualizedModList threading. `src/ui/components/VirtualizedModList.tsx`:
  - `VirtualRowContent` interface += опциональный `sortMode?: SortMode` с JSDoc; destructuring += `sortMode`; `<FilterChip>` call внутри += `sortMode={sortMode}`.
  - `VirtualizedColumnProps` interface += опциональное поле `sortMode?: SortMode` с JSDoc.
  - `VirtualizedColumn` destructuring += `sortMode`.
  - `columnProps` object (используется для spread в 3 `<VirtualizedColumn>` call sites) += `sortMode` field — auto-threading.
  - Оба `<VirtualRowContent>` call sites (two-column mode line 448, single-column mode line 814) += `sortMode={sortMode}`.
- 7: Tests. `tests/ui/FilterChip.test.tsx`:
  - Helper `renderChipAndGetClass({ priorityTier, affix, sortMode })` — render chip и return outer container className (где живёт `effectiveBorderClass`).
  - +11 новых тестов в новом `describe('tier-aware left border (iter 107)')` блоке:
    - alpha mode (4 теста): S→amber-soft, A→affix color (suffix→orange), B→affix color (prefix→blue), C→affix color (implicit→amber). Проверяют что `border-l-bl-amber-soft` присутствует только для S-tier.
    - omitted sortMode backward compat (1 тест): A-tier без `sortMode` prop → affix color (suffix→orange). Доказывает что default `'alpha'` сохраняет pre-iter-107 поведение.
    - tier-first mode (4 теста): S→amber-soft (suppressed orange), A→amber (regex `/border-l-bl-amber(?!-)/` чтобы не матчить `-soft`/`-dim`), B→amber-dim (suppressed blue), C→gray (suppressed amber).
    - visual hierarchy regression (2 теста): 4 distinct border classes across S/A/B/C (Set size === 4); affix color suppression across all 3 affix types (prefix/suffix/implicit — все получают одинаковый tier border без affix color leak).
- 8: Верификация. `npx vitest run` → **1533/1533** (было 1522, +11). `npx tsc -b` → 0 errors. `npx eslint .` → 0 problems. ETL не запускался — `public/generated/*.json` не тронуты (verified via `git status public/generated/`). ETL --check-stale: 11 fresh, 0 stale.
- 9: Документация:
  - `STATUS.md` — iter 107 как текущая; «Что сделано» (детальный список 5 затронутых файлов + 11 тестов); «Метрики» (1533/1533, +11); Known Issues без изменений (только #1 и #2); «Открытые долги» — visual indicator closed, sortKey + waystone neutral-generic + tablet Разломы vs Бездна остаются; runtime-метрики таблица без изменений.
  - `worklog.md` — iter 106 сжат до одной строки, iter 107 добавлен подробно.
  - `AGENT_NAVIGATION.md` — entry paragraph bumped до iter 107 (UX-полировка P4); Roadmap iter 107 done + обновлён optional-список (visual indicator closed).

Stage Summary:
- **iter 107 COMPLETE.** UX-полировка P4 — tier-colored left border реализован. В tier-first режиме FilterChip показывает distinct colored border для каждого tier: S=amber-soft (brightest), A=amber, B=amber-dim (bronze), C=gray. В alpha режиме поведение не изменилось (S→amber-soft always-on, A/B/C→affix color). Default `'alpha'` — backward compat со всеми 1522 существующими тестами.
- **Изменённые файлы (5):**
  - `src/index.css` — +5 строк (1 new color token + 1 @theme mapping + JSDoc).
  - `src/ui/components/FilterChip.tsx` — +20 строк (SortMode import + optional prop + 2-branch effectiveBorderClass logic; -7 строк old tierBorderClass removed).
  - `src/ui/components/ModList.tsx` — +12 строк (sortMode prop на ModSubGroupSection + AffixColumn + threading во все 11 call sites: 6 AffixColumn + 3 inline FilterChip + 2 ModSubGroupSection).
  - `src/ui/components/VirtualizedModList.tsx` — +10 строк (sortMode prop на VirtualRowContent + VirtualizedColumnProps + columnProps auto-threading + 2 VirtualRowContent call sites).
  - `tests/ui/FilterChip.test.tsx` — +120 строк (+11 тестов в новом describe блоке + helper function).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — документация актуализирована.
- **Тесты:** 1533/1533 (+11 vs iter 106). TSC: 0 errors. ESLint: **0 errors + 0 warnings**. ETL: 11 fresh, 0 stale. Никаких изменений в `public/generated/*.json`, ETL, runtime functional-classifier, схеме.
- **Точка остановки:** iter 107 done. UX-полировка P4 (tier-colored left border в tier-first mode) закрыта. В iter 108+ можно:
  1. **Опционально: `sortKey?: number`** в `FamilyGroup` + ETL заполнение для «по популярности внутри категории» — third sort mode (alpha / tier-first / popularity). Требует ETL-расширения — отдельная задача.
  2. **Опционально (low-priority): Waystone neutral-generic (6 groups)**: 5 desecrated Breach-adjacent mods можно расширить POSITIVE_KEYWORDS, чтобы их поймать.
  3. **Опционально (low-priority): Tablet Разломы vs Бездна**: 2 mods используют «Разлом» вместо «Бездна». Можно расширить BREACH_KEYWORDS, но это изменило бы type distribution.
- **Подсказка следующему агенту:** iter 107 = UX-полировка P4 (tier-colored left border в tier-first mode), runtime functional-classifier / ETL / JSON / схема не тронуты. Baseline: 1533/1533 tests, TSC 0, ESLint **0 problems**. Перед стартом iter 108 прочитай STATUS.md (актуальный статус + Known Issues — только #1 и #2 остаются, оба intentional), worklog.md (iter 107 подробно + предыдущие одной строкой), AGENT_NAVIGATION.md (entry paragraph iter 107, Roadmap iter 107 done). Не создавай новые verify-iter*-*.ts скрипты — покрывай проверки через tests/ (vitest) или inline sanity в worklog.md (правило iter 100). Если добавляешь новый sort mode (e.g. popularity), расширь `SortMode` union + `sortGroupsByMode()` dispatch + `CategoryControlPanel` radio-group + `useCategoryPage` URL-persist pattern + `FilterChip` effectiveBorderClass dispatch (если新模式 требует new border policy).

---

## Предыдущие итерации (кратко)

- **iter 106**: P4 — tier-aware sort toggle (alpha vs tier-first). `SortMode` type + `sortGroupsByTierFirst()` + UI-toggle в `CategoryControlPanel`. 1522/1522 tests.
- **iter 105**: P2 second half — tablet sub-blocks. Новый режим `tablet-type-subblocks` с 19 sub-blocks. 1500/1500 tests.
- **iter 104**: P2 first half — waystone sub-blocks + Known Issue #5 fix. Новый режим `affix-sentiment-subblocks` с 9 sub-blocks. 1472/1472 tests.
- **iter 103**: подавление 2 TanStack library-level ESLint warnings — Known Issue #3 закрыт. 1431/1431 tests.
- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline — 17 тестов в `tests/integration/runtime-classification.test.ts`. 1431/1431 tests.
- **iter 101**: P0-фикс Critical Bug — `GameTokenSchema` без `functionalCategory` → Zod strips → runtime classifier падал в `other`. +3 регрессионных теста. 1414/1414 tests.
- **iter 99**: alphabetical within-block sort. `sortGroupsAlphabetically()` + `withAlphabeticalGroups()` wrapper для всех 9 режимов. +19 unit-тестов. 1411/1411 tests.
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

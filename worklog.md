# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 74
Agent: main
Task: iter 74 — Pre-existing lint cleanup в тестах (11 ошибок в 5 файлах) + Bug #15 (unit-test для WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).

Work Log:
- 1: Клон репо через `git init + git fetch origin --depth=1` (обычный `git clone` отваливался по timeout — репозиторий крупный, fetch шёл медленно; в итоге стянул ZIP-архив через `codeload.github.com`).
- 2: `npm install`, baseline `npx vitest run` — 1152/1152 зелёные. `tsc -b` чистый. `eslint .` — 55 проблем (51 error + 4 warning). Из 51 error: 11 в 5 тест-файлах (unused vars, explicit any), ~28 в scripts/ (в основном explicit any), ~12 в src/ (4 set-state-in-effect в UI pages, 4 no-useless-assignment в core, остальное mechanical).
- 3: Анализ Bug #15 — `scripts/etl/normalize.ts:380-390` `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` (4 ключа) и `TABLET_IMPLICIT_SET_FAMILY_KEYS` (1 ключ). Загрузил `waystone.json` / `waystone-desecrated.json` / `tablet.json`, построил set всех `familyKey.ru` с нормализацией `## → # + collapse whitespace + trim` (как в `isImplicitSetBonus`).
- 4: **Bug #15 — РЕАЛЬНЫЙ баг.** Все 5 хардкод-ключей имеют 0 совпадений с актуальными `familyKey.ru` в JSON. poe2db переформулировал тексты (пример: было `#% увеличение эффективности монстров` → стало `На #% больше эффективности монстров`). Фильтр `isImplicitSetBonus()` молча no-op'ит. → Документировано как **KI-2** в STATUS.md.
- 5: Lint cleanup тестов — 11 ошибок в 5 файлах:
  - `tests/core/colon-anchor-verification.test.ts:21` — `import { range, and, literal }` → `import { range }` (and/literal не использовались, только range с 23 упоминаниями).
  - `tests/core/hypothesis-patterns.test.ts:242` — удалён `const amulet2: GameItemText = {...}` целиком (включая JSDoc + `@ts-expect-error` directive). amulet2 нигде не использовался, @ts-expect-error был мёртвым (тип GameItemText принимает все поля объекта без ошибок).
  - `tests/core/optimizer.test.ts:671,695,722,755` — 4 `(c as any).value` заменены на proper TypeScript narrowing: `c.type === 'LITERAL' ? c.value : ''` для map, `if (n.type === 'LITERAL') expect(n.value)` для прямых assertion. Дискриминированное объединение ASTNode (см. `src/shared/types.ts:124-130`) сужается корректно.
  - `tests/etl/cross-validation.test.ts:139,156` — `(t: any) => t.regex?.ru` заменены на `(t: { regex?: { ru?: string } })`. Структурная типизация без any.
  - `tests/etl/etl-schemas.test.ts:56,157` — `const { modCode, ...withoutCode } = validTier` → добавлен `// eslint-disable-next-line @typescript-eslint/no-unused-vars` перед деструктуризацией (intentional omit pattern, без disable-коммента правила typescript-eslint v10 default не позволяют `_`-prefix).
- 6: Bug #15 → KI-2 тесты. В `tests/etl/normalize.test.ts` добавлен describe-блок "WAYSTONE_IMPLICIT_SET_FAMILY_KEYS / TABLET_IMPLICIT_SET_FAMILY_KEYS (Bug #15 / KI-2)" с 3 `it.fails` тестами:
  - Каждый тест загружает соответствующий JSON (`waystone.json` / `waystone-desecrated.json` / `tablet.json`), строит set из `familyKey.ru` (с нормализацией `## → # + \s+ → ' ' + trim`), и утверждает, что все хардкод-ключи присутствуют.
  - `it.fails` (vitest API) — тест ожидаемо FAIL на текущих данных, `it.fails` инвертирует → suite остаётся зелёной. Когда KI-2 будет пофикшен (ключи обновлены), тесты начнут проходить, `it.fails` сообщит об ошибке — это сигнал конвертировать обратно в `it`.
  - Добавлены импорты `readFileSync`, `join`, `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS`, `TABLET_IMPLICIT_SET_FAMILY_KEYS`.
- 7: Верификация:
  - `tsc -b` — 0 ошибок.
  - `vitest run` — **1152 passed | 3 expected fail (1155)**. Все 3 expected-fail — мои новые KI-2 тесты.
  - `eslint .` — **44 проблемы (40 errors, 4 warnings)**, было 55 (51+4). Снижение на 11 ошибок — ровно те, что в тестах. Остальные 40 errors в scripts/ (28) и src/ (12) не тронуты (отдельная итерация).
- 8: Документация:
  - `STATUS.md` — добавлен KI-2 как open Known Issue с симптомом / root cause / тестами / планом фикса. KI-1 перенесён в "История закрытых KI" (1 строка). Iter → 74.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 74 + KI-2 + Pitfall 31 (новый): "Stale hardcoded implicit-set family keys — KI-2 (open, iter 74)" с описанием бага, тестов, плана фикса, и предупреждением не путать с Bug #16 (`IMPLICIT_RANGE_UNRESTRICTED`).
  - `worklog.md` — iter 74 запись (этот блок), iter 73 сжат до 1 строки.

Stage Summary:
- **iter 74 COMPLETE.** Сделано ровно столько, сколько было запрошено: lint cleanup тестов (11 ошибок → 0) + Bug #15 unit-test (3 `it.fails` для KI-2). Никаких лишних изменений.
- **Bug #15 оказался реальным багом → KI-2.** Все 5 хардкод-ключей в `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` / `TABLET_IMPLICIT_SET_FAMILY_KEYS` устарели. `isImplicitSetBonus()` молча no-op'ит. Implicit-set bonus токены НЕ выфильтровываются из mod-списков. Это документировано, тесты добавлены. Фикс — отдельная итерация (требует обновления ключей + запуска ETL, что меняет generated JSON).
- **Изменённые файлы (8):**
  - `tests/core/colon-anchor-verification.test.ts` (1 строка: import narrowed)
  - `tests/core/hypothesis-patterns.test.ts` (-15 строк: удалён мёртвый amulet2)
  - `tests/core/optimizer.test.ts` (4 `any` → narrowing, +6/-4 строки)
  - `tests/etl/cross-validation.test.ts` (2 `any` → structural type, +2/-2 строки)
  - `tests/etl/etl-schemas.test.ts` (2 `// eslint-disable-next-line` комментарии, +2 строки)
  - `tests/etl/normalize.test.ts` (+60 строк: новый describe-блок с 3 `it.fails` тестами + import)
  - `STATUS.md` (KI-2 добавлен, KI-1 сжат в историю, iter → 74)
  - `AGENT_NAVIGATION.md` (header → iter 74 + KI-2, добавлен Pitfall 31)
- **Метрики:** 1152 baseline тестов + 3 expected-fail = 1155 total, всё зелёное. `tsc -b` чистый. Lint: 55 → 44 (11 ошибок почищено в тестах, остальные 40 — отдельная итерация).
- **Точка остановки:** iter 74 done. KI-2 открыт, но документирован и покрыт тестами. Открытые архитектурные долги: Bug #8 (`useCategoryPage` 1325 строк, рефакторинг), Bug #13 (iterative-optimizer skip ranged regexes), Bug #16 (`IMPLICIT_RANGE_UNRESTRICTED = [0, 350]` magic number), Bug #17 (`poe2-regex-matcher.ts:141` negated char class `from: -1, to: -1` хак → `negated: boolean` flag), KI-2 (фикс stale ключей + ETL rerun), 40 lint-ошибок в scripts/+src/. Любой пункт — отдельная итерация.
- **Не сделано (намеренно, чтобы не сломать):**
  - Lint cleanup в `scripts/` (28 ошибок, в основном explicit any — требует понимания shape данных).
  - Lint cleanup в `src/` (12 ошибок: 4 set-state-in-effect в UI pages — pre-existing архитектурный паттерн sync-from-store-on-mount, 4 no-useless-assignment в core — требуют logic-flow анализа).
  - Фикс KI-2 (требует обновить хардкод + запустить ETL, что меняет generated JSON).
  - `public/generated/*.json` — НЕ модифицировались, ETL НЕ запускался.

---

## Предыдущие итерации (кратко)

- **iter 73**: Закрыт KI-1 (`?` tokenizer mismatch) через detector + warn + Oracle reject + ETL reject. 8 новых тестов. Подчищены 3 unused-vars в `iterative-optimizer.ts`. 1152/1152 зелёные.
- **iter 72**: Дедупликация ETL-утилит (`normalizeTemplate`, `extractTemplateSuffix`), удаление dead code (`longestCommonSubstring`), документирование Bug #1 как KI-1.
- **iter 71** (Phase 16): Интеграция 3 leftover atmospheric WebP (`hero-demon-blue`, `early-access-banner`, `news-bg-center`).
- **iter 70** (Phase 15): Visual review lg+/xl+; filter contrast fix; `bg-forest.webp` deleted.
- **iter 69** (Phase 14): HomePage hero decorations — bas-relief backdrop + 2 side ghosts.
- **iter 68** (Phase 13): `.poe-panel-header--inline` в JSX на 8 category pages; TopNav tab font 14px.
- **iter 65-67** (Phase 11-12): Атмосферная стилизация PoE2 — `.poe-panel-header`, `.poe-divider`, `.btn-cta`, фон `bg.webp` + vignette.
- **iter 64** (Phase 10): Sidebar + Header + MobileNavTabs → TopNav.
- **iter 62-63**: Features в `<details>`; palette consistency; README rewrite.
- **iter ≤61**: MobileRegexBar; StatusPanel; HomePage compaction; nav «режимы»; CSS tokens + CategoryLayout + RegexOutput.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

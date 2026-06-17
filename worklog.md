# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 75
Agent: main
Task: iter 75 — KI-2 fix (update WAYSTONE_IMPLICIT_SET_FAMILY_KEYS / TABLET_IMPLICIT_SET_FAMILY_KEYS, convert it.fails → it). Blocked: KI-3 discovered (poe2db.tw text revert).

Work Log:
- 1: Клон репо `git clone https://github.com/vudirvp-sketch/poe2-regex-ru.git`. `pnpm install` (4.8s). Baseline верификация: `tsc -b` чистый, `vitest run` — 1152 passed + 3 expected fail (1155 total), `eslint .` — 44 problems (40 errors + 4 warnings). Совпадает с iter 74 worklog.
- 2: Анализ KI-2. Прочитал `scripts/etl/normalize.ts:366-417` (isImplicitSetBonus, filterImplicitSetBonuses, IMPLICIT_SET_FAMILY_KEYS_BY_CATEGORY). Прочитал `tests/etl/normalize.test.ts:149-204` (3 it.fails теста). Загрузил `waystone.json` / `waystone-desecrated.json` / `tablet.json`, построил set всех `familyKey.ru` с нормализацией `## → # + collapse whitespace + trim`.
- 3: Анализ совпадений hardcoded keys vs actual familyKey.ru:
  - **Waystone (4 hardcoded keys → 0 matches):**
    - `На #% больше находимых в области путевых камней` → 0 matches (no such mod-form token in current JSON)
    - `#% увеличение эффективности монстров` → 0 matches (reworded by poe2db)
    - `На #% больше редкости находимых в этой области предметов` → 0 matches (no mod-form token)
    - `На #% больше размера групп монстров` → 0 matches (no mod-form token)
  - **Actual mod-form implicit-set bonus tokens in waystone.json:**
    - `#% увеличение количества путевых камней, находимых в области` (1 token, suffix) — соответствует implicit `Шанс выпадения путевого камня: +##%`
    - `На #% больше эффективности монстров` (14 tokens, prefix+suffix) — соответствует implicit `Эффективность монстров: +##%`
  - **Tablet (1 hardcoded key → 0 matches):**
    - `% увеличение количества находимых на карте путевых камней` → 0 matches (TYPO: missing `#` before `%`)
    - Actual: `#% увеличение количества находимых на карте путевых камней` (1 token, suffix)
  - **waystone-desecrated.json:** 0 mod-form implicit-set bonus tokens (only implicit tokens + Abyss-themed mods). Filter is no-op for this category.
- 4: Обновил `scripts/etl/normalize.ts:368-396`:
  - WAYSTONE_IMPLICIT_SET_FAMILY_KEYS: 4 → 2 ключа (`#% увеличение количества путевых камней, находимых в области` + `На #% больше эффективности монстров`). Удалены 2 ключа без совпадений (rarity/pack-size — нет mod-form токенов в current JSON).
  - TABLET_IMPLICIT_SET_FAMILY_KEYS: 1 ключ, typo fix (`%` → `#%`).
  - Обновлён JSDoc-коммент: добавлено требование "Keys MUST match `familyKey.ru` in generated JSON", ссылка на тесты, описание iter 75 изменений.
- 5: Обновил `scripts/run-etl.ts:698-702` — комментарий про implicit-set bonus tokens: old form example → new form example + ссылка на константы в normalize.ts.
- 6: Обновил `tests/etl/normalize.test.ts:149-204`:
  - Конвертировал 3 `it.fails` → `it`.
  - Waystone тест: "every WAYSTONE_IMPLICIT_SET_FAMILY_KEYS entry exists in waystone.json familyKey set" — проверяет, что все 2 ключа присутствуют в waystone.json.
  - Waystone-desecrated тест реструктурирован: "waystone-desecrated.json has no mod-form implicit-set bonus tokens (filter is no-op)" — проверяет, что НИ ОДИН waystone ключ не присутствует в waystone-desecrated.json (filter no-op для этой категории).
  - Tablet тест: "every TABLET_IMPLICIT_SET_FAMILY_KEYS entry exists in tablet.json familyKey set" — проверяет, что 1 ключ присутствует в tablet.json.
  - Обновлён блок-коммент: "KI-2 (open, iter 74)" → "KI-2 (fixed iter 75)".
- 7: Верификация до ETL: `vitest run tests/etl/normalize.test.ts` — 21/21 passed (было 18+3 expected fail). Ключи матчат current JSON.
- 8: Backup `public/generated/*.json` → `/tmp/generated-backup/`. Запустил `npx tsx scripts/run-etl.ts` (с cached HTML). ETL завершился успешно, но waystone.json: 156 → 302 токенов (!), tablet.json: 84 → 86. Старые JSON имели `sourceHash: "no-cache"` (fresh fetch от 16 июня), новый JSON `sourceHash: "2c0eaf3e1c37ddd0"` (cache от 17 июня).
- 9: Анализ расхождения. Проверил cached HTML `.etl-cache/poe2db_tw_ru_Waystones.html`: содержит OLD-формы (`На X% больше находимых в области путевых камней`, 106 matches). Current JSON (от 16 июня) содержит NEW-формы (`#% увеличение количества путевых камней, находимых в области`). Fresh fetch `curl https://poe2db.tw/ru/Waystones` подтвердил: poe2db.tw СЕЙЧАС имеет OLD-формы (0 matches для "увеличение количества путевых").
- 10: **Открыт KI-3** — poe2db.tw откатил тексты модов к OLD-формам между 16 и 17 июня. ETL rerun BLOCKED: перегенерация JSON с OLD-формами сломает ~40 тестов (cross-validation thresholds 150-200 для waystone, regex content matching). Решение: восстановить JSON из backup, не запускать ETL, документировать KI-3.
- 11: Восстановил `public/generated/*.json` из `/tmp/generated-backup/`. Верификация: `vitest run` — 1155/1155 passed (1152 baseline + 3 KI-2 теста теперь проходят как `it`). `tsc -b` чистый. `eslint .` — 44 problems (без изменений).
- 12: Документация:
  - `STATUS.md` — KI-3 добавлен как open Known Issue (poe2db.tw revert). KI-2 переведён из "open" в "code-fixed" (ключи обновлены, тесты конвертированы, data-level фикс blocked by KI-3). Iter → 75. KI-1 + KI-2 в истории закрытых.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 75 + KI-3 + KI-2 code-fixed. Pitfall 31 обновлён (code-fixed iter 75, data-blocked by KI-3). Добавлен Pitfall 32 (KI-3: poe2db.tw text form revert).
  - `worklog.md` — iter 75 запись (этот блок), iter 74 сжат до 1 строки.

Stage Summary:
- **iter 75 PARTIAL COMPLETE.** KI-2 code-fixed: hardcoded keys обновлены (4→2 waystone, 1 tablet typo fix), тесты конвертированы `it.fails` → `it`. Все 1155 тестов зелёные. KI-3 обнаружен и документирован (poe2db.tw text revert) — блокирует data-level фикс KI-2 (ETL rerun).
- **Изменённые файлы (6):**
  - `scripts/etl/normalize.ts` (WAYSTONE 4→2 ключа, TABLET typo fix, JSDoc обновлён)
  - `scripts/run-etl.ts` (коммент old → new form example)
  - `tests/etl/normalize.test.ts` (3 `it.fails` → `it`, waystone-desecrated тест реструктурирован)
  - `STATUS.md` (KI-3 добавлен, KI-2 → code-fixed, iter → 75)
  - `AGENT_NAVIGATION.md` (header → iter 75, Pitfall 31 обновлён, Pitfall 32 добавлен)
  - `worklog.md` (iter 75 запись, iter 74 сжат)
- **Метрики:** 1155/1155 passed (1152 baseline + 3 KI-2 теперь `it`). `tsc -b` чистый. Lint: 44 problems (без изменений — не трогал scripts/+src/ lint debt).
- **Не сделано (намеренно, blocked by KI-3):**
  - ETL rerun — заблокирован. poe2db.tw имеет OLD-формы, ETL перегенерирует JSON с 302 waystone токенами (vs 156), сломает ~40 тестов.
  - Data-level KI-2 фикс (удаление 15 waystone + 1 tablet implicit-set bonus токенов из JSON) — отложен до решения KI-3.
  - `public/generated/*.json` — НЕ модифицировались (восстановлены из backup).
- **Точка остановки:** iter 75 done (code-level). Открытые долги: KI-3 (poe2db.tw revert — требует решения: OLD или NEW формы), KI-2 data-level (ETL rerun после KI-3), Bug #8 (useCategoryPage 1325 строк), Bug #13 (iterative-optimizer skip ranged), Bug #16 (IMPLICIT_RANGE_UNRESTRICTED magic number), Bug #17 (poe2-regex-matcher negated char class хак), 40 lint-ошибок в scripts/+src/.

---

## Предыдущие итерации (кратко)

- **iter 74**: Lint cleanup тестов (11 ошибок в 5 файлах) + Bug #15 → KI-2 документирован (3 `it.fails` теста). 1152+3=1155 зелёных.
- **iter 73**: Закрыт KI-1 (`?` tokenizer mismatch) через detector + warn + Oracle reject + ETL reject. 8 новых тестов. 1152/1152 зелёные.
- **iter 72**: Дедупликация ETL-утилит, удаление dead code, документирование Bug #1 как KI-1.
- **iter 71** (Phase 16): Интеграция 3 leftover atmospheric WebP.
- **iter 70** (Phase 15): Visual review lg+/xl+; filter contrast fix; `bg-forest.webp` deleted.
- **iter 69** (Phase 14): HomePage hero decorations.
- **iter 68** (Phase 13): `.poe-panel-header--inline` в JSX; TopNav tab font 14px.
- **iter 65-67** (Phase 11-12): Атмосферная стилизация PoE2.
- **iter 64** (Phase 10): Sidebar + Header + MobileNavTabs → TopNav.
- **iter ≤63**: MobileRegexBar; StatusPanel; HomePage compaction; CSS tokens + CategoryLayout + RegexOutput.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

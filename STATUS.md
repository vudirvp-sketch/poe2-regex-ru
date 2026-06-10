# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 758 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- **Iterative optimizer интегрирован в ETL pipeline** (Step 10): автоматический запуск после генерации JSON
- **Oracle validation после каждой итерации**: изменения с cross-family FP/FN автоматически откатываются
- **Suffix shortening стратегия**: синхронизирована с MIN_REGEX_LEN_DEFAULT=5 (вместо старого 3)
- **Short-regex context**: для токенов с regex < MIN_REGEX_LEN (напр. "огня" = 4 chars) автоматически добавляется regexPrefixContext
- **250-char budget awareness**: `estimateMultiModLength()` и `wouldExceedBudget()` для оценки бюджета
- Block model B1-B2 VERIFIED: `.*` НЕ пересекает границы аффикс-блоков
- Waystone/Tablet implicit reversed regex VERIFIED в игре
- Colon anchor VERIFIED в игре
- ETL pipeline: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash

---

## Per-mod want/exclude toggle

Заменён глобальный переключатель «Хочу / Не хочу» на per-mod toggle:
- Каждый FilterChip имеет кнопку ✗/✓ для переключения мода в режим «не хочу»
- Выбранные моды (selectedIds) и исключённые (excludedIds) — взаимоисключающие множества
- AST строится как `AND(want_nodes, EXCLUDE(OR(exclude_nodes)))`
- Компилируется в `"want1|want2" !"dontwant1|dontwant2"`
- URL-сериализация: ключ `e` содержит массив excludedIds
- Визуальные стили: excluded = красный фон + красная левая граница

**Изменённые файлы:**
- `src/store/filter-store.ts` — excludedIds Set, toggleExclude(), serialize/deserialize (`e:` key)
- `src/ui/hooks/useCategoryPage.ts` — buildAstFromSelections(excludedIds), CategoryPageState
- `src/ui/components/FilterChip.tsx` — excludedIds, onToggleExclude, ✗/✓ button, 5 selection states
- `src/ui/components/CategoryControlPanel.tsx` — убран глобальный переключатель, добавлен excludedCount
- `src/ui/components/ModList.tsx` — пропуск excludedIds/onToggleExclude
- `src/ui/components/VirtualizedModList.tsx` — аналогично
- `src/shared/i18n.ts` — chip.excluded, chip.partial_excluded, chip.exclude_tooltip и др.
- Все page components (Ring, Belt, Amulet, Waystone, Tablet, Relic, Jewel, Vendor)

---

## Budget-aware UI feedback

При выборе 6+ модов и приближении к лимиту 250 символов (>180 chars):
- RegexOutput показывает amber-предупреждение: «Осталось N символов из 250 при M модах»
- Health bar визуально показывает заполненность (green ≤200, yellow ≤240, red ≤250, pulse >250)
- CategoryControlPanel передаёт `activeTokenCount` в RegexOutput для бюджетного индикатора

---

## Известные ограничения

Нет активных.

---

## ETL Commands

| Команда | Описание |
|---------|----------|
| `pnpm etl` | ETL pipeline + итеративный оптимизатор (Step 10) |
| `pnpm etl:fresh` | Очистка кеша + полный re-fetch + оптимизатор |
| `pnpm etl:check-stale` | Проверка устаревания кеша |
| `pnpm etl:no-optimize` | ETL без оптимизатора (Step 10 пропускается) |
| `pnpm optimize` | Отдельный запуск оптимизатора |
| `pnpm optimize:dry` | Dry-run оптимизатора (без записи) |
| `pnpm optimize:no-oracle` | Оптимизатор без Oracle-валидации |

---

## ETL Pipeline Steps

| Step | Описание |
|------|----------|
| 1 | Fetch HTML from poe2db.tw |
| 2 | Parse + normalize mods |
| 3 | Compute regex substrings |
| 4 | Compute optimizations (DP + dialect) |
| 5 | Generate JSON files |
| 6 | Build jewel type map |
| 7 | Apply i18n overrides + repair cross-family FP |
| 8 | Flat-text Oracle validation (`--validate`) |
| 9 | Block-based Oracle validation (`--validate-item`) |
| **10** | **Iterative optimizer + Oracle validation** |

---

## ETL Results

| Категория | Токенов | Cross-family FP |
|-----------|---------|-----------------|
| amulet | 428 | 0 |
| belt | 298 | 0 |
| jewel | 193 | 0 |
| jewel-corrupted | 10 | 0 |
| jewel-desecrated | 47 | 0 |
| relic | 58 | 0 |
| ring | 369 | 0 |
| tablet | 84 | 0 |
| waystone | 156 | 0 |
| waystone-desecrated | 32 | 0 |
| **Итого** | **1675** | **0** |

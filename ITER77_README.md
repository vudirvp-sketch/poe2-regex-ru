# iter 77 — Lint Cleanup (44 → 7 problems)

## Сводка

- **Итерация:** 77 (18 июня 2026)
- **Задача:** Lint cleanup как лёгкая разминка перед Bug #8
- **Результат:** 44 problems → 7 problems (37 fixed: 33 errors + 4 warnings)
- **Тесты:** 1157/1157 passed (без изменений от baseline)
- **TypeScript:** `tsc -b` чистый
- **Риск:** нулевой — все fixы либо safe deletions, либо type-only changes

## Структура архива

Архив содержит 17 изменённых файлов (14 source + 3 docs) с сохранённой структурой папок. Распаковать в корень репозитория:

```bash
unzip iter77-lint-cleanup.zip -d /path/to/poe2-regex-ru/
```

## Категории фиксов

| Категория | Кол-во | Риск | Файлы |
|-----------|--------|------|-------|
| Unused imports | 4 | 0 | compute-regex-strategies, compute-regex, prerender, verify-iter49 |
| `let`→`const` | 3 | 0 | compute-regex-strategies, parse-tables, filter-store |
| Unnecessary regex escapes | 3 | 0 | parse-modifiers-calc, run-etl, useCategoryPage |
| Unused eslint-disable | 1 | 0 | parse-modifiers-calc |
| `no-useless-assignment` (dead code) | 4 | 0 | compiler, dp-factorizer, trie-factorizer ×2 |
| `any`→proper types (cheerio) | 7 | 0 | parse-tables |
| `any`→proper types (Playwright) | 6 | 0 | prerender-full |
| `any`→proper types (CategoryData) | 7 | 0 | run-etl |
| `_` ignore pattern (eslint config) | 2 | 0 | eslint.config, filter-store |
| Docs updates | — | 0 | STATUS, AGENT_NAVIGATION, worklog |

## Что НЕ сделано (намеренно, отдельные итерации)

7 remaining problems:

1. **4 `react-hooks/set-state-in-effect` errors** (WaystonePage:66, JewelPage:99, TabletPage:101, useCategoryPage:1100) — tied to Bug #8 (useCategoryPage refactor)
2. **2 `react-hooks/incompatible-library` warnings** (VirtualizedModList.tsx:307, 593) — `useVirtualizer()` returns non-memoizable functions; cannot fix without changing the library
3. **1 `react-hooks/exhaustive-deps` warning** (useCategoryPage.ts:1022) — tied to Bug #8

## Открытые долги (для следующих итераций)

| Приоритет | Что | Сложность | Риск |
|-----------|-----|-----------|------|
| 🔴 высокий | Bug #8 — `useCategoryPage.ts` 1325 строк → 4 hooks | высокая | высокий |
| 🟢 низкий | Bug #13 — `iterative-optimizer.ts:488` skip `.*[0-9][1-9]` | низкая | низкий |
| 🟢 низкий | Bug #16 — `IMPLICIT_RANGE_UNRESTRICTED = [0, 350]` magic number | низкая | средний |
| 🟢 низкий | Bug #17 — `poe2-regex-matcher.ts:141` negated char class хак | низкая | низкий |
| 🟢 низкий | Lint cleanup остаток (7 problems) — embedded in Bug #8 + library | средняя | низкий-средний |

## Git commands

```bash
git add eslint.config.js \
  scripts/etl/compute-regex-strategies.ts \
  scripts/etl/compute-regex.ts \
  scripts/etl/parse-modifiers-calc.ts \
  scripts/etl/parse-tables.ts \
  scripts/prerender-full.ts \
  scripts/prerender.ts \
  scripts/run-etl.ts \
  scripts/verify-iter49.ts \
  src/core/compiler.ts \
  src/core/dp-factorizer.ts \
  src/core/trie-factorizer.ts \
  src/store/filter-store.ts \
  src/ui/hooks/useCategoryPage.ts \
  STATUS.md AGENT_NAVIGATION.md worklog.md

git commit -m "iter 77: Lint cleanup 44→7 problems (37 fixed: 33 errors + 4 warnings)

- Unused imports removed (4): compute-regex-strategies extractTemplateSuffix,
  compute-regex isSuffixUniqueInCategory, prerender dirname, verify-iter49 matchPoE2RegexItem
- let→const (3): yoficatedCandidate (compute-regex-strategies), modCode (parse-tables,
  moved decl to point of assignment), perTokenRanges (filter-store)
- Unnecessary regex escapes (3): parse-modifiers-calc \\/, run-etl \\-, useCategoryPage \\+
- Unused eslint-disable removed (1): parse-modifiers-calc:65 (before interface ModsViewData)
- no-useless-assignment dead code (4): compiler excludeValues init [],
  dp-factorizer + trie-factorizer dead placed=true before break
- any→cheerio.Cheerio<unknown> (7): parse-tables (6 fn sigs + getCell return type)
- any→Playwright types (6): prerender-full (BrowserType, Browser|undefined,
  catch err:unknown with type guards ×4)
- any→CategoryData/GameToken/OptimizationEntry (7): run-etl (3 JSON.parse casts,
  3 token map types, 1 optTable entry cast)
- eslint.config.js: added no-unused-vars argsIgnorePattern/varsIgnorePattern/
  caughtErrorsIgnorePattern/destructuredArrayIgnorePattern = '^_' (for \`_\` in
  destructure-to-remove-key idiom in filter-store)
- Docs: STATUS.md iter→77 + opened debts block; AGENT_NAVIGATION.md header→iter 77;
  worklog iter 77 added, iter 76 compressed to 1 line

Verification: tsc -b clean, 1157/1157 tests pass, eslint . 7 problems (4 errors + 3 warnings)
Remaining 7 problems: 4 setState-in-effect + 1 exhaustive-deps (tied to Bug #8),
2 react-hooks/incompatible-library warnings (unfixable without library change)"

git push origin main
```

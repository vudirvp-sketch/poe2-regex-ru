# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 77
Agent: main
Task: iter 77 — Lint cleanup (44→7 problems). Исправлено 37 lint issues (33 errors + 4 warnings) в 14 файлах. Все 1157 тестов зелёные. `tsc -b` чистый. Осталось 7 problems (4 setState-in-effect tied to Bug #8, 2 library warnings, 1 exhaustive-deps tied to Bug #8).

Work Log:
- 1: Клон репо `git clone https://github.com/vudirvp-sketch/poe2-regex-ru.git`. `npm install` (артeфакт — `package-lock.json` будет revert в конце). Ручные symlinks для `node_modules/.bin/{tsc,vitest,eslint,tsx,vite}` (npm install не создал их автоматически в этом окружении). Baseline: `tsc -b` чистый, `vitest run` — 1157 passed, `eslint .` — 44 problems (40 errors + 4 warnings). Совпадает с iter 76 worklog.
- 2: Анализ 44 problems по категориям риска:
  - SAFE (zero behavior change): unused imports, `let`→`const`, unnecessary escapes, unused eslint-disable, `no-useless-assignment` dead code, `cheerio.Cheerio<unknown>`, Playwright proper types, `catch (err: unknown)` type guards, `CategoryData`/`GameToken`/`OptimizationEntry` casts в run-etl.
  - RISKY (tied to Bug #8): `setState-in-effect` (4 errors in JewelPage/TabletPage/WaystonePage/useCategoryPage) — skip.
  - UNFIXABLE (library): `react-hooks/incompatible-library` warnings (2 in VirtualizedModList.tsx) — skip.
  - RISKY (tied to Bug #8): `react-hooks/exhaustive-deps` warning (1 in useCategoryPage.ts) — skip.
- 3: Phase 1 — Unused imports (5 fixes):
  - `scripts/etl/compute-regex-strategies.ts:14` — remove `extractTemplateSuffix` from import (used only in compute-regex.ts, not strategies).
  - `scripts/etl/compute-regex.ts:40` — remove `isSuffixUniqueInCategory` from import (used only in strategies, not core).
  - `scripts/prerender.ts:18` — remove `dirname` from `path` import (never used).
  - `scripts/verify-iter49.ts:12` — remove `matchPoE2RegexItem` from import (only `matchPoE2Regex` used).
- 4: Phase 2 — `let`→`const` (3 fixes):
  - `scripts/etl/compute-regex-strategies.ts:386` — `yoficatedCandidate` never reassigned.
  - `scripts/etl/parse-tables.ts:253+340` — `modCode` declared early, assigned at line 340. Moved declaration to point of assignment: `const modCode = extractModCode($, row);` at line 340 (after early-return guards).
  - `src/store/filter-store.ts:272` — `perTokenRanges` mutated but never reassigned.
- 5: Phase 3 — Unnecessary regex escapes (3 fixes):
  - `scripts/etl/parse-modifiers-calc.ts:190` — `/Mods[\/\\]/` → `/Mods[/\\]/` (slash doesn't need escaping in char class).
  - `scripts/run-etl.ts:395` — `/[—–\-]/` → `/[—–-]/` (hyphen at end of char class is literal).
  - `src/ui/hooks/useCategoryPage.ts:793` — `/^[\+]?##%/` → `/^[+]?##%/` (plus doesn't need escaping in char class).
- 6: Phase 4 — Unused eslint-disable (1 fix):
  - `scripts/etl/parse-modifiers-calc.ts:65` — remove `// eslint-disable-next-line @typescript-eslint/no-explicit-any` before `interface ModsViewData {` (the next line is `gen: Record<...>` which doesn't trigger `any` rule — disable was a leftover).
- 7: Phase 5 — `no-useless-assignment` в core (4 fixes):
  - `src/core/compiler.ts:142` — `let excludeValues: string[] = []` → `let excludeValues: string[]` (initial `[]` never read; all branches reassign or return early; TS control flow handles definite-assignment).
  - `src/core/dp-factorizer.ts:667` — remove dead `placed = true;` before `break;` (value never read after `break` exits inner loop; outer loop resets `placed = false` at top of iteration). The `placed = true` at line 657 IS still needed (read by `if (placed) break;` at line 661).
  - `src/core/trie-factorizer.ts:524` — same pattern: `placed = true` before `break` (exits inner loop), value never read.
  - `src/core/trie-factorizer.ts:542` — same pattern. The `placed = true` at line 532 IS still needed (read by `if (placed) break;` at line 536).
- 8: Phase 6 — `any`→proper types в scripts/ (20 fixes):
  - `scripts/etl/parse-tables.ts` (7 errors): `cheerio.Cheerio<any>` → `cheerio.Cheerio<unknown>` in 4 function signatures (`detectColumnLayout`, `parseAffixType`, `extractTags`, `extractModCode`, `extractRow` row+table params). `getCell` helper return type: `any` → `cheerio.Cheerio<unknown> | null`. No behavior change — `Cheerio<unknown>` works identically to `Cheerio<any>` for all cheerio API calls.
  - `scripts/prerender-full.ts` (6 errors): Added `import type { Browser, BrowserType } from 'playwright'`. `let chromium: any` → `let chromium: BrowserType`. `let browser: any` → `let browser: Browser | undefined` (changed to `undefined` for the not-yet-launched case). 4 `catch (err: any)` → `catch (err: unknown)` with `const message = err instanceof Error ? err.message : String(err)` type guard.
  - `scripts/run-etl.ts` (7 errors): Added `CategoryData, GameToken, OptimizationEntry` to existing `import type { ModOrigin, JewelType } from '../src/shared/types.js'`. 3 `JSON.parse(readFileSync(...))` → cast `as CategoryData` (data is ETL-generated and matches schema). `(t: any) => t.rawText.ru` → `(t: GameToken)` (3 places). `new Map<string, any>()` → `new Map<string, GameToken>()`. `Object.entries(optTable) as [string, any][]` → `as [string, OptimizationEntry][]`.
- 9: Phase 7 — `_` unused in destructure (2 fixes in `src/store/filter-store.ts:118, 209`):
  - Pattern: `const { [id]: _, ...rest } = state.perTokenRanges` — `_` is intentionally unused (destructure-to-remove-key idiom).
  - Fix: Update `eslint.config.js` to add `@typescript-eslint/no-unused-vars` rule with `argsIgnorePattern: '^_'`, `varsIgnorePattern: '^_'`, `caughtErrorsIgnorePattern: '^_'`, `destructuredArrayIgnorePattern: '^_'`. Standard convention — many TS projects use this.
- 10: Revert `package-lock.json` artifact (npm install updated it because project uses pnpm — but `playwright` was in devDeps without lock entry). `git checkout -- package-lock.json`.
- 11: Verification:
  - `tsc -b` чистый.
  - `vitest run` — 1157/1157 passed (без изменений от baseline).
  - `eslint .` — **7 problems (4 errors + 3 warnings)**:
    - 4 errors `react-hooks/set-state-in-effect` (WaystonePage:66, JewelPage:99, TabletPage:101, useCategoryPage:1100) — tied to Bug #8 (useCategoryPage refactor), deferred.
    - 2 warnings `react-hooks/incompatible-library` (VirtualizedModList.tsx:307, 593) — `useVirtualizer()` returns non-memoizable functions; cannot fix without changing the library.
    - 1 warning `react-hooks/exhaustive-deps` (useCategoryPage.ts:1022) — `useMemo` has unnecessary `categoryId` dependency; tied to Bug #8.
- 12: Документация:
  - `STATUS.md` — обновлён: iter → 77, добавлен "Открытые долги" блок с Bug #8/#13/#16/#17 + Lint cleanup остаток.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 77, описан Lint cleanup (44→7, 37 fixes, 14 files), перечислены 7 remaining problems. iter 76 сжат до 1 строки в header.
  - `worklog.md` — iter 77 запись (этот блок), iter 76 сжат до 1 строки.

Stage Summary:
- **iter 77 COMPLETE.** Lint cleanup: 44 problems → 7 problems (37 fixed: 33 errors + 4 warnings). Zero behavior change — all 1157 tests green, `tsc -b` clean.
- **Изменённые файлы (15):**
  - `eslint.config.js` (added `no-unused-vars` ignore pattern `^_`)
  - `scripts/etl/compute-regex-strategies.ts` (remove unused import, `let`→`const`)
  - `scripts/etl/compute-regex.ts` (remove unused import)
  - `scripts/etl/parse-modifiers-calc.ts` (remove unused eslint-disable, regex escape)
  - `scripts/etl/parse-tables.ts` (`Cheerio<any>`→`Cheerio<unknown>` × 6, `let`→`const` move)
  - `scripts/prerender-full.ts` (Playwright types + `catch (err: unknown)` × 4)
  - `scripts/prerender.ts` (remove unused `dirname`)
  - `scripts/run-etl.ts` (`any`→`CategoryData`/`GameToken`/`OptimizationEntry` × 7, regex escape)
  - `scripts/verify-iter49.ts` (remove unused `matchPoE2RegexItem`)
  - `src/core/compiler.ts` (`excludeValues` init removed)
  - `src/core/dp-factorizer.ts` (dead `placed = true` removed)
  - `src/core/trie-factorizer.ts` (dead `placed = true` removed × 2)
  - `src/store/filter-store.ts` (`let`→`const` for `perTokenRanges`)
  - `src/ui/hooks/useCategoryPage.ts` (regex escape)
  - `STATUS.md` + `AGENT_NAVIGATION.md` + `worklog.md` (docs)
- **Метрики:** 1157/1157 passed (без изменений). `tsc -b` чистый. Lint: 7 problems (4 errors + 3 warnings, down from 44).
- **Не сделано (намеренно, отдельные итерации):**
  - Bug #8 (useCategoryPage 1325 строк → split на 4 hooks) — следующая итерация, high priority
  - Bug #13 (iterative-optimizer.ts skip `.*[0-9][1-9]`) — низкий приоритет
  - Bug #16 (IMPLICIT_RANGE_UNRESTRICTED magic number) — низкий приоритет
  - Bug #17 (negated char class from/to -1 хак) — низкий приоритет
  - Lint cleanup остаток (7 problems): 4 setState-in-effect + 1 exhaustive-deps (tied to Bug #8), 2 library warnings (unfixable)
- **Точка остановки:** iter 77 done. Lint cleanup Phase 1 complete (44→7). Все remaining problems либо tied to Bug #8 (для следующей итерации), либо unfixable (library compat).

---

## Предыдущие итерации (кратко)

- **iter 76**: KI-3 resolved (poe2db.tw OLD forms stable >1 year) + KI-2 data-level (ETL rerun с original OLD-form keys: waystone 302→156, tablet 86→84). 1157/1157 зелёных.
- **iter 75**: KI-2 code-fixed (NEW-form hardcoded keys, 3 `it.fails` → `it`). KI-3 обнаружен (poe2db.tw OLD-form revert). ETL rerun заблокирован. 1155/1155 зелёных.
- **iter 74**: Lint cleanup тестов (11 ошибок в 5 файлах) + Bug #15 → KI-2 документирован.
- **iter 73**: Закрыт KI-1 (`?` tokenizer mismatch) через detector + warn + Oracle reject + ETL reject.
- **iter 72**: Дедупликация ETL-утилит, удаление dead code.
- **iter 71** (Phase 16): Интеграция 3 leftover atmospheric WebP.
- **iter 70** (Phase 15): Visual review lg+/xl+; filter contrast fix; `bg-forest.webp` deleted.
- **iter 69** (Phase 14): HomePage hero decorations.
- **iter 68** (Phase 13): `.poe-panel-header--inline` в JSX; TopNav tab font 14px.
- **iter 65-67** (Phase 11-12): Атмосферная стилизация PoE2.
- **iter 64** (Phase 10): Sidebar + Header + MobileNavTabs → TopNav.
- **iter ≤63**: MobileRegexBar; StatusPanel; HomePage compaction; CSS tokens + CategoryLayout + RegexOutput.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

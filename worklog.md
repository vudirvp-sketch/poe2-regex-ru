# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 153 (KI#10/KI#12 hardening + browser testing iter 148–150 + code-split bundle)
Agent: main
Task: Продолжить с iter 152 — приоритеты: browser testing на 7 категорийных страницах (iter 148/149/150 visual checks + KI#36/37/38), фикс KI#10 (7 pre-existing data-test failures), code-split bundle (>500 KB warning), KI#39 conditional. Сделать по максимуму самостоятельно, без user-проверок если возможно.

Work Log:
- 1: **Baseline verification** — `pnpm install` + `pnpm exec tsc -b` (0 errors) + `pnpm exec eslint .` (0 warnings) + `pnpm test` (2228/2235 — 7 pre-existing data-test failures в iter126 + iter127) + `pnpm exec vite build` (PASS, index-*.js 603.71 KB > 500 KB warning).
- 2: **Root cause analysis for KI#10/KI#12 regression** — `iter126-ki10-rarity-disambiguation.test.ts` ожидает `waystone.implicit.item_rarity` regex = `едкость предметов`, actual = `предметов`. `iter127-ki12-tier-hardcoded-regex.test.ts` ожидает `relic.sanctummonstersreduceddamage1` regex = `монстры наносят уменьшенный на ` (no digit), actual = `уменьшенный на 6` (tier-hardcoded, KI#12 regression). Проверил `i18n-overrides.json` — override entries присутствуют с правильными regex-значениями. Проверил `applyI18nOverrides()` в `scripts/run-etl.ts` — функция применяет override.regex корректно (lines 290-299). Проверил `iterative-optimizer.ts` — Strategy 4 `trySuffixShortening` (lines 613-646) укорачивает regex, отбрасывая слова слева: `едкость предметов` → `предметов` (если no FP). Strategy 1 `tryFixFN` (lines 250-295) ищет кратчайший substring rawText, который match'ит через PoE2 engine — для `монстры наносят уменьшенный на ` (с trailing space) matchQuotedGroup мог вернуть false → fallback на Strategy 2 (substring search) → возвращает `уменьшенный на 6` (включая digit из rawText). Вывод: iterative-optimizer запускается ПОСЛЕ applyI18nOverrides и затирает override-regexes своими «оптимизациями».
- 3: **Document root cause** — добавил подробный комментарий в `applyI18nOverrides` и `iterative-optimizer.ts` (skip block).
- 4: **Fix 1 — Type + Schema** — добавил `manualOverride?: boolean` в `GameToken` interface (`src/shared/types.ts`) и в `GameTokenSchema` (`src/shared/schemas.ts`). Поле optional — backward compat с existing JSON-файлами.
- 5: **Fix 2 — applyI18nOverrides** — в `scripts/run-etl.ts` добавил `token.manualOverride = true` когда `override.regex` указан явно. Это защищает future ETL runs от regression.
- 6: **Fix 3 — iterative-optimizer skip** — в `scripts/etl/iterative-optimizer.ts` добавил check `if (token.manualOverride) { totalRegexLen += regex.length; continue; }` в начале loop'а по токенам (после `if (!regex || !rawText) continue;`). Skip применяется ко всем 5 стратегиям (FN-repair, dialect, FP-reduce, suffix-shorten, short-regex-context).
- 7: **One-shot patch script** — создал `scripts/patch-ki10-ki12-overrides.ts` который: (a) re-applies explicit-regex overrides из i18n-overrides.json к существующим JSON-файлам (13 токенов), (b) восстанавливает regexPrefixContext/regexExclude на 7 KI#12 relic tokens, (c) восстанавливает 4 family-level opt entries в relic.json, (d) удаляет 4 broken cross-family opt entries в relic.json. Скрипт использует `fileURLToPath(import.meta.url)` для определения ROOT (ESM-совместимо).
- 8: **Run patch script** — `pnpm exec tsx scripts/patch-ki10-ki12-overrides.ts` → 13 tokens patched, 4 opt entries patched, 4 opt entries deleted. Изменённые файлы: `relic.json` (7 tokens + 4 opt + 4 deletions), `waystone.json` (2 tokens), `waystone-desecrated.json` (2 tokens), `tablet.json` (2 tokens — `manualOverride` flag only, regex не изменился).
- 9: **Verify KI#10/KI#12 fix** — `pnpm test` → 2235/2235 PASS (было 2228/2235). Все 7 previously-failing tests теперь PASS. `pnpm exec tsc -b` 0 errors, `pnpm exec eslint .` 0 warnings.
- 10: **Validate Zod schema** — `pnpm exec tsx` script проверил все 10 JSON-файлов через `CategoryDataSchema.safeParse` → все OK. manualOverride count: relic 7, tablet 2, waystone 2, waystone-desecrated 2 (всего 13).
- 11: **Browser testing setup** — `pnpm exec vite preview --port 4173 --host 0.0.0.0` в background. `agent-browser` (CLI) для snapshot/click/fill/eval. Использовал `curl http://127.0.0.1:4173/poe2-regex-ru/` для проверки сервера.
- 12: **Browser test script** — создал `/home/z/my-project/scripts/browser-test-iter153.sh` (вне repo, локальный инструмент). Скрипт прогоняет 7 страниц × 6 проверок: iter 148 (Сортировка/Показывать selects), iter 149 (Priority removed), iter 150 KI#40 (⭐ pin button via aria-label "Добавить семейство в избранное"), iter 150 KI#41 (ⓘ tooltip button "Показать пояснение"), KI#37 (origin text на jewel/waystone), KI#42 (search focus retention via `document.activeElement.tagName`).
- 13: **Browser test execution** — все 7 страниц, 42 проверки. **Все PASS.** Детали: belt/ring/amulet/jewel/waystone/tablet — Сортировка + Показывать selects present, Priority absent, ⭐ pin button present (1–4 в expanded group), ⓘ tooltip present, KI#42 focus retention (INPUT на каждом step: type "те" → INPUT, type "тест" → INPUT, clear → INPUT). relic — Сортировка отсутствует (by design — нет tier-first sort для relic), все остальные PASS. jewel/waystone — origin text present (KI#37).
- 14: **KI#36 manual verification** — на belt: expanded first group → clicked ⭐ pin button → в header появился `Открыть панель избранных аффиксов (2)` button → click открыл portal-panel со списком 2 favorited families + «Выбрать»/«Убрать» buttons. KI#36 favorites panel работает.
- 15: **Code-split bundle** — `src/App.tsx`: 8 категорийных страниц переведены на `React.lazy(() => import(...))` + `<Suspense fallback={<PageFallback />}>`. HomePage остаётся eager. PageFallback — minimal centered spinner (8×8 div с animate-spin). Первый attempt failed из-за `import { lazy, Suspense } from 'react-router-dom'` (не exported) → fix: `from 'react'`.
- 16: **Build verification** — `pnpm exec vite build` → main bundle 342.11 KB (gzip 104.62 KB) — **43% reduction** (было 603.71 KB). 8 lazy chunks: 3.6–7.5 KB each. 4 shared chunks: IconLegend 14 KB, ModList 15 KB, VirtualizedModList 37 KB, MobileRegexBar 158 KB. **Warning >500 KB убран.**
- 17: **Lazy-load verification** — browser test на всех 8 страницах: title + h2 корректные на каждой (belt→Пояса, ring→Кольца, amulet→Амулеты, jewel→Самоцветы, waystone→Путевые камни, tablet→Башни Предтеч, relic→Реликвии, vendor→Торговец). Все страницы загружаются корректно после lazy-load.
- 18: **Final test suite** — `pnpm test` 2235/2235 PASS, `pnpm exec tsc -b` 0 errors, `pnpm exec eslint .` 0 warnings, `pnpm exec vite build` PASS. Все baseline зелёные.
- 19: **Документация** — STATUS.md переписан под iter 153 (3 секции: KI#10/KI#12 hardening, browser testing, code-split bundle). worklog.md — iter 152 сокращён до одной строки, iter 153 подробно. AGENT_NAVIGATION.md — header updated, Pitfall 54 added.

Stage Summary:
- **KI#10/KI#12 FIXED** — 7 previously-failing tests теперь PASS. `manualOverride` flag в GameToken type + Zod schema + applyI18nOverrides + iterative-optimizer skip. One-shot patch script восстановил 13 override-regexes + 4 family-opt entries + удалил 4 broken opt entries.
- **Browser testing DONE** — 7 страниц × 6 проверок = 42 теста, все PASS. iter 148 (toolbar selects), iter 149 (Priority removed), iter 150 KI#40 (⭐ pin button на ВСЕХ 7 страницах), iter 150 KI#41 (ⓘ tooltip button), KI#37 (origin badge на jewel/waystone), KI#42 (search focus retention). KI#36 (favorites panel) manually verified на belt.
- **Code-split bundle DONE** — main bundle 603.71 KB → 342.11 KB (43% reduction). 8 lazy chunks + 4 shared chunks. Warning >500 KB убран.
- Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / vite build PASS.
- Изменённые файлы: `src/shared/types.ts`, `src/shared/schemas.ts`, `scripts/run-etl.ts`, `scripts/etl/iterative-optimizer.ts`, `scripts/patch-ki10-ki12-overrides.ts` (NEW), `public/generated/{relic,waystone,waystone-desecrated,tablet}.json`, `src/App.tsx`, `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`.
- **Stopping point:** iter 153 завершён, готов к push. Next iter 154 = user visual verification (KI#38 scroll jitter на jewel, KI#31 mobile UX, iter 150 KI#41 ⓘ glyph visual) + bundle further optimization (MobileRegexBar 158 KB) + APCA Lc<75 для small text + новые баги.

---

Task ID: 152 — KI#42 search focus loss fix на jewel/waystone (`mergeCategories` inline-arrays → module-level constants + `dataRef` guard в `useCategoryData`). vitest 2228/2235 (7 pre-existing data-test failures — KI#10).

Task ID: 151 — stale comments + trash files cleanup (Pure documentation/cleanup pass — 6 упоминаний `LeftPanelFavorites` упрощены, 6 устаревших patch-notes файлов удалено, README заменён на минимальный). vitest 2235/2235.

Task ID: 150 — favorites wiring fix (⭐ pin button не отображался на belt/ring/amulet/jewel в two-column layout) + ⓘ in-box layout (glyph в GroupHeader позиционировался как flex-sibling → сдвигал toggle-button sideways → теперь absolute right-2 top-1/2 -translate-y-1/2 z-10 + pr-7 на toggle-button). vitest 2235/2235.

Task ID: 149 — PriorityFilter removal (полное удаление фильтра «Приоритет» из UI, state-store, URL sync, localStorage, типов, схем, тестов и документации). vitest 2235/2235.

Task ID: 148 — toolbar UX refactor (radiogroups → <select>, waystone checkboxes → color-coded chip-toggles). vitest 2235/2235.

Task ID: ≤147 — см. git log. Полная история в `git log --oneline`.

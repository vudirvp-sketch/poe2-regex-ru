# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 147 (deploy fix + TS errors + debt cleanup)
Agent: main
Task: iter 147 — фикс провала деплоя (Actions run 28289025974): 6 пред-существующих TS ошибок в `VirtualizedModList.tsx` блокировали `tsc -b` в `pnpm build:full`. Параллельно — debt cleanup: удалить неиспользуемый `LeftPanelFavorites.tsx` (не импортируется с iter 139 / KI#20). Baseline: vitest 2252/2252. Result: vitest 2235/2235 (−17 после удаления LeftPanelFavorites test).

Work Log:
- 1: **Диагностика деплоя** — клонировал репозиторий, проверил `.github/workflows/deploy.yml`: build job = `pnpm install` → `playwright install` → `pnpm test` → `pnpm build:full` (= `tsc -b && vite build && tsx scripts/prerender.ts && tsx scripts/prerender-full.ts`). Stash существующих pending changes → запустил `tsc -b` → 6 ошибок:
  - `VirtualizedModList.tsx(686,48): Property 'affix' does not exist on type '{ type: "origin-header"; origin: ModOrigin; ... }'`
  - `VirtualizedModList.tsx(687,52): Property 'affix' does not exist on type '{ type: "jewel-type-header"; jewelType: JewelType; ... }'`
  - `VirtualizedModList.tsx(693,5): Object literal may only specify known properties, and 'shouldAdjustScrollPositionOnItemSizeChange' does not exist in type 'PartialKeys<ReactVirtualizerOptions<...>>'`
  - И симметричные 3 ошибки для single-column virtualizer (строки 981/982/988).
- 2: **TS fix** — в `getItemKey` switch:
  - `case 'origin-header': return `oh:${row.origin}`;` (убран `row.affix:` — он всегда был `undefined`, ключ был `oh:undefined:${origin}`).
  - `case 'jewel-type-header': return `jh:${row.jewelType}`;` (аналогично).
  - Удалён `shouldAdjustScrollPositionOnItemSizeChange: () => false` из обоих virtualizer'ов. Свойство не существует в `@tanstack/react-virtual` v3 API.
  - **Уникальность ключей сохранена:** `buildColumnRows` эмитит origin-header один раз за `ORIGIN_ORDER` цикл (по `byOrigin` Map), jewel-type-header — один раз за `JEWEL_TYPE_ORDER` цикл внутри одного origin. `showJewelTypeSubGroups` сейчас нигде не передаётся → дубликатов `jh:${jewelType}` не возникает.
  - Комментарии обновлены: упомянут iter 147 TS fix + объяснено, что feedback loop KI#34 теперь предотвращается stable keys + CSS `contain` (iter 146 KI#38).
- 3: **Debt cleanup** — удалил `src/ui/components/LeftPanelFavorites.tsx` (240 строк, не импортируется с iter 139) + `tests/ui/LeftPanelFavorites.test.tsx` (483 строки, 17 тестов). Stale comments в `useCategoryPage.ts`, `i18n.ts`, `index.css`, `FavoritesIndicator.tsx`, `CategoryLayout.tsx` оставлены как исторические (low-risk, на следующую итерацию).
- 4: **STATUS.md clean-up** — убрана длинная история iter 146, оставлены только ключевые KI. Документирован iter 147 (TS fix + debt cleanup). KI#39 (условный — отключить dynamic measurement если jitter остаётся) помечен как «применить только если browser testing KI#38 покажет остаточный jitter». Next iter 148 приоритеты: browser testing KI#36/37/38 → если нужно KI#39 → mobile layout → stale comments → code-split bundle.
- 5: **Verification** — `tsc -b` 0 errors / `eslint .` 0 warnings / `vitest` 2235/2235 (55 files, было 56 — удалил LeftPanelFavorites test) / `pnpm build` (= `tsc -b && vite build && tsx scripts/prerender.ts`) succeeds, 9 route HTML files generated. `prerender-full.ts` требует playwright + chromium — в CI ставится через `npx playwright install chromium --with-deps`.

Stage Summary:
- Deploy blocker FIXED: 6 TS ошибок устранены, `tsc -b` проходит, `pnpm build` succeeds. CI должен пройти.
- Debt cleanup DONE: LeftPanelFavorites (component + test, 723 строки) удалены.
- Baseline: tsc 0 / eslint 0 / vitest 2235/2235 / pnpm build PASS.
- Изменённые файлы: `src/ui/components/VirtualizedModList.tsx`, `STATUS.md`, `worklog.md`. Удалённые: `src/ui/components/LeftPanelFavorites.tsx`, `tests/ui/LeftPanelFavorites.test.tsx`.
- **Stopping point:** iter 147 завершён, готов к push. Next iter 148 = browser testing KI#36/37/38 → KI#39 conditional → mobile layout → stale comments cleanup → code-split bundle.

---

Task ID: 146 — KI#36 favorites grouping (canonical groupTokensByFamily + splitGroupByOrigin) + KI#37 origin badge (ОЧЕРН/ОСКВ/СУЩН/РАЗЛ) + KI#38 CSS `contain: layout style paint` на virtual rows. vitest 2252/2252 (+5 new tests).

Task ID: 145 — KI#34 scroll doubling (shouldAdjustScroll=false + stable getItemKey + overscan 5 + items-start) + KI#35 expand/collapse all keys (origin/jewelType в subKey). Файлы: VirtualizedModList.tsx, ModList.tsx, STATUS.md. vitest 2247/2247.

Task ID: 144 — 5 KI: KI#32 cascade expand fix, KI#30 per-category localStorage favorites, KI#31 variant (d) quick-select panel, KI#33 VendorPage favorites, KI#23 variant (b) scroll jitter estimate. vitest 2247/2247 (+57 new tests).

Task ID: ≤143 — см. git log. Полная история в `git log --oneline`.

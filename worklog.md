# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 74 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run` passes (576/576 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Fix: inline-block мешанина** — All Level 1/2/3 headers changed from `inline-block` to `block` to prevent text concatenation ("Очернённые (33)Рубин (10)" → each header on its own line). Fixed in both `VirtualizedModList.tsx` and `ModList.tsx`.
2. **Visual hierarchy sizes increased** — Level 1 (Префикс/Суффикс): `text-xs` → `text-sm` (14px). Level 2 (Origin): `text-[11px]` → `text-xs` (12px). Level 3 unchanged `text-[10px]`. Level 1 affix headers inside origin mode: `text-[10px]` → `text-xs`.
3. **Origin color palette v4** — Updated `ORIGIN_SECTION_LABELS` in `mod-classifier.ts`:
   - Очернённые: purple → emerald (dark-green)
   - Осквернённые: orange → red (crimson)
   - Сущность: yellow → amber (noble gold)
   - Разлом: cyan → violet (purple)
4. **Light theme CSS** — Added overrides for new origin colors (emerald, violet, amber, red backgrounds/borders) in `index.css`.
5. **Documentation** — Updated `AGENT_NAVIGATION.md` (v74), `новый_план.md` (v15), `worklog.md`.

**Files changed this session:**
- `src/shared/mod-classifier.ts` — Updated `ORIGIN_SECTION_LABELS` color palette
- `src/ui/components/VirtualizedModList.tsx` — Fixed inline-block→block, text-sm for column headers
- `src/ui/components/ModList.tsx` — Fixed inline-block→block, text-sm for affix headers, text-xs for origin mode affix headers
- `src/index.css` — Added light theme overrides for emerald/violet/amber/red origin colors
- `AGENT_NAVIGATION.md` — v74, added Section 18 (Visual Hierarchy), updated origin color mapping
- `новый_план.md` — v15, added Session 74 status
- `worklog.md` — Updated

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing — verify new origin colors, visual hierarchy, block-level headers across all tabs
- ⬜ Priority tier filter testing — S/A/S+A toggle on ring/amulet/belt/waystone/tablet
- ⬜ Mobile testing — touch targets, scroll behavior
- ⬜ Origin icons — User preparing icons for очернение/разлом/сущность/осквернение
- ⬜ Textured frames for Level 1 (Префикс/Суффикс) categories
- ⬜ Validate priority tier classifications against live trade data

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`##` from template in regex:** Template placeholders MUST NOT appear in final regexes.
3. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
4. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block.
5. **`()` in regex = PoE2 grouping:** `containsPoE2Grouping()` filters at generation time.
6. **Negate syntax `"!X"` only:** `!"X"` does NOT work — `!` must be inside quotes.
7. **Word truncation = trailing substring only:** Mid-word extraction does NOT work.
8. **i18n overrides cause cross-family FP:** `repairCrossFamilyFP()` + `regexPrefixContext` fix this.
9. **regexExclude format must be locale-object:** Always `{ru: [...]}` not plain array.
10. **regexPrefixContext format must be locale-object:** Always `{ru: "..."}` not plain string.
11. **Multi-line sub-lines may share text with standalone mods:** Use `—` exclude/context to disambiguate.
12. **OR-suffix RANGE must wrap `|` in `()`:** Without this, `".*огню|холоду"` parses wrong.
13. **VendorProperty interface is ONLY in `@data/vendor-properties`:** Never create local duplicates.
14. **ARIA: interactive elements must not be children of role="switch":** Use sibling pattern.
15. **ProfilePanel: confirm button must use onMouseDown, not onClick:** onClick fires AFTER onBlur.
16. **All number inputs must have step={1}:** PoE2 mod values are always integers; fractional input produces invalid regex.
17. **Russian е/ё dialect in classifier patterns:** Always use `[её]` in regex patterns for words that can be spelled with ё.
18. **dp-factorizer/trie-factorizer are ETL-only:** Not imported by runtime code, but essential for ETL scripts. Do NOT delete.
19. **CategoryControlPanel priorityFilter/setPriorityFilter are optional:** Pages without priority tiers (jewel/relic/vendor) must NOT pass these props. Show toggle only when `showPriorityFilter` is set.
20. **ModSubGroup.borderLClass is required:** All `classifyGroups()` branches must populate `borderLClass`. Level 2 (origin) uses `ORIGIN_SECTION_LABELS[origin].borderLClass`; Level 3 (semantic/sentiment/tablet/jewel-type) uses `''`.
21. **Level headers MUST be `block`, never `inline-block`:** Using `inline-block` causes headers to concatenate on the same line (e.g., "Очернённые (33)Рубин (10)"), creating visual mush. All Level 1/2/3 headers must use `block` display.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (576)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```

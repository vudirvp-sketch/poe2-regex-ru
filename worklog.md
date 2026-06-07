# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 65 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (495/495 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**

**Key Changes This Session:**

1. **JewelPage: hidden mods indicator (MEDIUM → FIXED)** — When `jewelTypeFilter` hides tokens that are in `selectedIds`, they still affect the regex but were invisible. Added visual warning banner "N скрытых модов влияют на regex, но не видны" with "Снять скрытые" button that deselects hidden tokens. New i18n keys: `jewel.hidden_mods`, `jewel.deselect_hidden`.

2. **Fractional number input prevention (MEDIUM → FIXED)** — All `<input type="number">` across the app now have `step={1}` attribute, preventing fractional input. PoE2 mod values are always integers. Applied to: FilterChip (6 inputs), CategoryControlPanel (2 inputs), VendorChip (1 input), TabletPage (1 input). New rule documented in AGENT_NAVIGATION.md §16.

3. **RegexOutput: copy failure feedback (LOW → FIXED)** — Added `copyError` state that shows red button + "Ошибка!" text for 3 seconds when clipboard write fails. Previously only `console.error` was called with no user-visible feedback. New i18n key: `regex.copy_error`.

4. **Documentation cleanup** — Rewrote AGENT_NAVIGATION.md (v65.0): moved resolved items out of Known Issues, added §16 Numeric Input Rules, documented Waystone corrupted+delirious as intentional. Rewrote новый_план.md (v8.0): updated status to Session 65, added bug profile section, cleaned up. Worklog trimmed.

**Files changed this session:**
- `src/ui/pages/jewel/JewelPage.tsx` — Hidden mods indicator + deselectHidden callback + useCallback import
- `src/ui/components/FilterChip.tsx` — `step={1}` on 6 number inputs
- `src/ui/components/CategoryControlPanel.tsx` — `step="1"` on 2 number inputs
- `src/ui/components/VendorChip.tsx` — `step={1}` on 1 number input
- `src/ui/pages/tablet/TabletPage.tsx` — `step="1"` on uses input
- `src/ui/components/RegexOutput.tsx` — copyError state + error button style + i18n
- `src/shared/i18n.ts` — New keys: `jewel.hidden_mods`, `jewel.deselect_hidden`, `regex.copy_error`
- `AGENT_NAVIGATION.md` — v65.0 rewrite
- `новый_план.md` — v8.0 rewrite
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers)
- ⬜ FilterChip ARIA restructuring (P2) — range inputs внутри role="switch"
- ⬜ Jewel classification accuracy improvement (~84% → ~92%+)
- ⬜ Mobile-specific testing (touch targets, scroll behavior)

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`##` from template in regex:** Template placeholders MUST NOT appear in final regexes.
3. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
4. **Description text not indexed:** Tooltip text is NOT searchable — verified in-game.
5. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block.
6. **Waystone implicits are NOT affixes:** Base item properties, not from the mod system.
7. **`()` in regex = PoE2 grouping:** `containsPoE2Grouping()` filters at generation time.
8. **Negate syntax `"!X"` only:** `!"X"` does NOT work — `!` must be inside quotes.
9. **Word truncation = trailing substring only:** Mid-word extraction does NOT work.
10. **i18n overrides cause cross-family FP:** `repairCrossFamilyFP()` + `regexPrefixContext` fix this.
11. **regexExclude format must be locale-object:** Always `{ru: [...]}` not plain array.
12. **regexPrefixContext format must be locale-object:** Always `{ru: "..."}` not plain string.
13. **Phase A1 truncation only for entries without context/excludes:** Truncating entries with FP would break patching logic.
14. **Multi-line sub-lines may share text with standalone mods:** Use `—` exclude/context to disambiguate.
15. **OR-suffix RANGE must wrap `|` in `()`:** Without this, `".*огню|холоду"` parses wrong.
16. **VendorProperty interface is ONLY in `@data/vendor-properties`:** Never create local duplicates.
17. **ARIA: interactive elements must not be children of role="switch":** Use sibling pattern.
18. **ProfilePanel: confirm button must use onMouseDown, not onClick:** onClick fires AFTER onBlur.
19. **All number inputs must have step={1}:** PoE2 mod values are always integers; fractional input produces invalid regex.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (495)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```

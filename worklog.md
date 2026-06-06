# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 40 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (437/437 tests)
**Oracle:** FP=3715, FN=0 in generated JSON files. Most FP are family-tier FP (by design).

**Key Changes This Session (Prefix Anchoring Simplification):**

1. **Prefix anchoring simplified** — `extractTemplatePrefix()` in compute-regex.ts now returns empty string for ALL single-number mods. Only dual-number mods (templates with "до" between # placeholders) get a prefix. This is safe because `.*` does NOT cross block boundaries (verified in-game Phase 7), so cross-mod FP is impossible.

2. **run-etl.ts updated** — `extractTemplatePrefixForOverride()` follows the same simplified logic.

3. **Documentation updated:**
   - ARCHITECTURE.md: Section 7 "Prefix anchoring" rewritten
   - DATA_CONTRACTS.md: `regexPrefix` and `prefix` comments updated
   - AGENT_NAVIGATION.md: Removed stale CRITICAL issues (H4, cross-mod FP)
   - новый_план.md: Updated to version 8.0

4. **types.ts & compiler.ts** — Comments updated to reflect prefix is dual-number only

**Impact:** After ETL re-run, `regexPrefix` will be empty for ~95% of tokens, producing shorter RANGE regexes in the compiler. Dual-number mods like "От ## до ## урона" still get "От" as prefix.

**NOT YET DONE:**
- ⬜ Re-run ETL (`pnpm etl`) to regenerate JSON with simplified prefix
- ⬜ Phase 8: Cross-family FP reduction using block-based model
- ⬜ Integrate matchPoE2RegexItem in Oracle
- ⬜ Remove deprecated getItemSearchText(), replace with getItemSearchBlocks()
- ⬜ jewel-corrupted → add to STRICT_CATEGORIES

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`()` in regex = PoE2 grouping:** Regexes MUST NOT contain literal `(...)` — PoE2 interprets as grouping. Unmatched `(` may be literal.
3. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes.
4. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
5. **Description text not indexed:** Tooltip text like "Можно использовать в Машине картоходца" is NOT searchable — verified in-game.
6. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block. Use AND for cross-block search.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (437)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL with Oracle validation
pnpm analyze-fn                  # Analyze FN cases per category
pnpm optimize                    # Run iterative optimizer on generated JSON
pnpm optimize:dry                # Dry-run optimizer with verbose output
pnpm dev                         # Development server
```

# iter 126 — Patch archive

## What's inside
This archive contains the iter 126 changes for the poe2-regex-ru repo.

## Files modified:
- `STATUS.md` — updated to iter 126 (KI#10 fixed, KI#11 monitoring)
- `AGENT_NAVIGATION.md` — header updated, Pitfall 36 + 37 added
- `worklog.md` — iter 126 detailed section, iter 125 compressed
- `public/generated/waystone.json` — waystone.implicit.item_rarity.regex.ru: "едкость" → "едкость предметов"
- `public/generated/waystone-desecrated.json` — same patch for desecrated variant
- `scripts/etl/i18n-overrides.json` — added 2 override entries for waystone.implicit.item_rarity (both normal + desecrated)

## Files added:
- `tests/core/iter126-ki10-rarity-disambiguation.test.ts` — 24 new regression tests (5 sections)

## Files to DELETE (cleanup):
- `DELETIONS-iter124.txt` — stale instruction file from iter 124

## How to apply:
1. Extract this archive at the root of your local poe2-regex-ru checkout (overwrite existing files).
2. Delete `DELETIONS-iter124.txt` manually.
3. Run `pnpm install` (if not already).
4. Run `pnpm test` — should pass 1939/1939.
5. Run `npx tsc -b` — should be 0 errors.
6. Run `npx eslint .` — should be 0 problems.
7. Commit + push (see git commands in chat).

## Summary of fix
**KI#10 (FIXED):** Token `waystone.implicit.item_rarity` used regex `'едкость'` (7 chars) — too generic, matched any text with `едкость` substring including hypothetical `Редкость монстров`. Fixed by replacing with `'едкость предметов'` (12 chars, literal space) — uniquely identifies `Редкость предметов`.

**New compiled regex:** `"едкость предметов.*\+[2-9][0-9]%|едкость предметов.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` (107 chars ≤ 250).

**KI#11 (NEW, MONITORING):** If in-game `.*` crosses block boundaries (contrary to Phase 7 verification), iter 126 fix is insufficient — `.*` between `предметов` and `+XX%` can still cross blocks. Mitigation plan: add `literalBridge` field to AST + use literal text instead of `.*` between suffix and numRegex. See STATUS.md KI#11 + Pitfall 37 in AGENT_NAVIGATION.md.

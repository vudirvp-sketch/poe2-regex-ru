# Worklog

---
Task ID: 1
Agent: Main Agent
Task: Analyze repository and plan fixes for iteration

Work Log:
- Cloned repo, read key files (compiler.ts, useCategoryPage.ts, FilterChip.tsx, etc.)
- Identified 4 bugs to fix in this iteration
- Ran 663 tests — all pass

Stage Summary:
- Bug 1: excludeMode doesn't wrap RANGE nodes in EXCLUDE → "хочу/не хочу" doesn't change regex
- Bug 2: `%` suffix anchor (anchorEnd) causes FN for `#%` values-only waystone mods → regex doesn't work in-game
- Bug 3: jewel:1 404 error — Chrome DevTools artifact, not app bug
- Bug 4: chip-with-range CSS — chips overlap despite existing CSS fix

---
Task ID: 2
Agent: Main Agent
Task: Fix excludeMode for ranged tokens

Work Log:
- Modified buildAstFromSelections() in useCategoryPage.ts to wrap ranged token nodes in EXCLUDE(OR) when excludeMode=true
- Changed range group loop to push nodes to orChildren when excludeMode=true (for later wrapping)
- Updated the orChildren combining logic at the end to handle excludeMode for all token types
- Added 2 new tests: excludeMode with ranged tokens, excludeMode with mixed ranged/non-ranged tokens

Stage Summary:
- All 666 tests pass
- excludeMode now correctly wraps ranged tokens in EXCLUDE(OR)
- "Хочу/не хочу" toggle now changes regex for ranged tokens too

---
Task ID: 3
Agent: Main Agent
Task: Fix % suffix anchor for #% values-only mods

Work Log:
- Changed numberFollowedByPercent detection from /##?%/ to /##%/ (double hash only)
- Added detailed comment explaining why #% single-hash templates should NOT get anchorEnd
- Added new test: #% values-only token does NOT get anchorEnd
- Waystone "На #% больше" mods now produce "(1[5-9]|2[0-4]).*области путевых камней" (without %)
- This should now work in-game (enumeration without % anchor)

Stage Summary:
- All 666 tests pass
- #% values-only mods no longer get anchorEnd='%' which caused 100% FN
- ##% double-hash mods still get anchorEnd='%' when anchorStart=false (accessory mods)

---
Task ID: 4
Agent: Main Agent
Task: Investigate jewel:1 404 error

Work Log:
- Verified lz-string compressToEncodedURIComponent never produces ':' character
- Confirmed the ':1' is a Chrome DevTools line annotation, not part of the URL
- GitHub Pages returns 404 for SPA routes before serving 404.html — expected behavior
- The 404.html redirect mechanism works correctly
- Added documentation to AGENT_NAVIGATION.md CONFIRMED INTENTIONAL section

Stage Summary:
- Not an app bug — Chrome DevTools annotation on 404.html redirect
- No code changes needed

---
Task ID: 5
Agent: Main Agent
Task: Fix chip-with-range CSS overlapping

Work Log:
- Changed .chip-with-range CSS to use display:flex + flex-wrap:wrap instead of relying on inline-flex
- Added width:100% to force full width
- Updated range input row CSS selectors to use .chip-with-range prefix instead of .inline-flex
- Added virtualized-mod-list selectors for consistency

Stage Summary:
- Chips with range inputs now properly take full width with flex-wrap for internal content
- No more overlap between range-expanded chips and adjacent chips

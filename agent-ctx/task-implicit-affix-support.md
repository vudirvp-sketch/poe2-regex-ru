# Task: Update types, mod-classifier, and UI code to support 'implicit' affix type

## Summary

All 9 files were updated to support the `'implicit'` affix type across the codebase. The changes are minimal and focused:

### Files Modified

1. **`src/shared/types.ts`** — Added `'implicit'` to `AffixType` union, added `reversed?: boolean` to RANGE AST node, updated FamilyGroup comment.

2. **`src/shared/mod-classifier.ts`** — Added early-return for `affix === 'implicit'` in `classifyWaystoneSentiment()` (always 'positive') and `classifyTabletType()` (classifies by text keywords).

3. **`src/shared/family-grouper.ts`** — Updated sort order to place implicit groups before prefix groups using `AFFIX_ORDER` map.

4. **`src/shared/i18n.ts`** — Added `'affix.implicit': 'Имплисет'` translation key.

5. **`src/ui/components/ModList.tsx`** — Added `implicitGroups`, `implicitSubGroups`, `implicitOriginSections` memos; added implicit option to affix filter dropdown; added implicit section rendering above prefix/suffix sections with "ИМПЛИСЕТ" header and amber styling; updated AffixColumn to handle 'implicit' affix type with distinct amber color scheme.

6. **`src/ui/components/FilterChip.tsx`** — Updated `affixColor` to handle `'implicit'` with amber border (`border-l-amber-500`).

7. **`src/core/ast.ts`** — Added `reversed` parameter to `range()` builder function.

8. **`src/core/compiler.ts`** — Added support for `reversed` flag in RANGE compilation: when `reversed=true`, produces `suffix.*number%` instead of `number%.*suffix`. Also propagates `reversed` flag through `normalizeAst` when expanding wide ranges. Disables `anchorStart` (^) for reversed ranges since it doesn't apply.

9. **`src/ui/hooks/useCategoryPage.ts`** — Added `isImplicit` detection in `buildAstFromSelections()`: when tokens have `affix === 'implicit'`, the RANGE node is created with `reversed: true` and `anchorStart: false`.

### Key Design Decisions

- **Reversed regex for implicits**: Implicit tokens use a reversed regex pattern where the text suffix comes before the number (e.g., `"suffix.*(min-max)%"` instead of `"(min-max)%.*suffix"`). This is controlled by the `reversed` flag on the RANGE AST node.
- **Implicit always positive**: For waystone sentiment classification, implicit tokens are always classified as 'positive' since they benefit the player.
- **Amber color scheme**: Implicit sections use amber/gold colors (amber-400, amber-500, amber-800) to visually distinguish them from prefix (blue) and suffix (orange) sections.
- **Header text**: Implicit section header displays "ИМПЛИСЕТ" instead of using the i18n key for the affix name.

### Test Results

- All existing compiler tests pass (55/55)
- All shared tests pass (89/89): family-grouper (14), mod-classifier (75)
- All UI tests pass (22/22): buildAstFromSelections
- All core tests pass (529/529)
- TypeScript type check passes for `src/` (no new errors)
- The only failing test is a pre-existing ETL cross-validation issue (waystone token count), unrelated to these changes.

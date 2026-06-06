# Iteration 23 — ETL Re-run + Dual-Number UI + Number Boundary Warning

> Date: 2026-06-06

## Changes

### 1. HIGH — Full ETL re-run (`pnpm etl`)

All generated JSON files in `public/generated/` have been regenerated from scratch. This resolves the long-standing issue where `regexPrefix`, `hasMultiPlaceholder`, and breachborn `familyKey` fields were not populated in the JSON data.

**Results after ETL re-run:**
- `regexPrefix` now populated for 369 tokens across all categories (e.g., "Добавляет от" for dual-number mods, "даруют на" for waystone mods)
- `hasMultiPlaceholder` correctly set for 48 dual-number tokens (36 in ring, 8 in belt, 4 in waystone)
- Fractional ranges now work correctly: "Регенерация (2.1—3) здоровья" → `ranges: [[2.1, 3]]`
- All breachborn tokens now have Russian `familyKey` values (0 English familyKeys remaining — fixed via i18n overrides)
- Strategy 1b (suffix lengthening) verified working — no regex conflicts between different families in any category

### 2. MEDIUM — FilterChip dual-number mod support

**FilterChip** now displays information for dual-number mods (mods with two `##` placeholders like "От ## до ## урона"):

- **"2x" badge**: Amber-colored indicator showing the mod has two number slots
- **Range display**: Shows the filterable slot range first, then the second slot in parentheses (e.g., "2—7 (до 5—13)")
- **"1е:" label**: Appears next to the ≥/≤ inputs for dual-number mods, clarifying that filtering applies to the first number
- **ARIA labels**: Separate `range.min_aria_dual` / `range.max_aria_dual` for screen readers

### 3. MEDIUM — Number boundary warning (≥40 false positives)

**CategoryControlPanel** now shows a "⚠ ≥40" warning (amber) when the global minimum value is ≥40, with a tooltip explaining that PoE2 regex patterns like `[4-9].` can match single-digit numbers in other mods on the same item. This is a fundamental PoE2 search engine limitation.

### 4. i18n keys added

- `chip.dual_number`, `chip.dual_number_tooltip`, `chip.dual_number_filter_note`, `chip.dual_number_slot_label`
- `range.min_aria_dual`, `range.max_aria_dual`
- `range.boundary_warning`

## Files Modified

| File | Change |
|------|--------|
| `public/generated/*.json` (9 files) | Regenerated with regexPrefix, hasMultiPlaceholder, fractional ranges |
| `src/ui/components/FilterChip.tsx` | Dual-number "2x" badge, range slot display, "1е:" filter label |
| `src/ui/components/CategoryControlPanel.tsx` | ≥40 number boundary warning |
| `src/shared/i18n.ts` | 7 new i18n keys |
| `docs/ARCHITECTURE.md` | Version bumped to 23.0 |

## Remaining

1. **Jewel classification accuracy**: ~84% accuracy. Could be improved with static lookup table.
2. **TabletPage PageStateWrapper**: Still has inline loading/error/no-data pattern.
3. **HomePage hardcoded mod counts**: Category cards show stale counts after data updates.
4. **FilterChip prefix display**: ⚓ indicator exists but could be more informative for dual-number mods.
5. **Per-token dual-number RANGE filtering**: The AST RANGE node currently uses the global range (first placeholder). Per-token overrides for the second placeholder are not supported.
6. **Desecrated regex quality**: Dual-stat desecrated mods could benefit from more specific regex extraction.

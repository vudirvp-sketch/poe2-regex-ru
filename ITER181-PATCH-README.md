# iter 181 — UI fixes patch

Apply by extracting this archive at the repository root, replacing existing
files. New file: `tests/ui/CategoryControlPanel.test.tsx` (no overwrite
conflict — it's a new test file).

## Changes summary

- **KI#55 FIX** — `<select aria-label="Показывать">` (show-selected-only
  toggle) never enabled even when favorites/excludes were set. Root cause:
  disable-condition only counted `selectedIds`, ignored `pinnedIds` /
  `excludedIds` / `optionalIds` which the filter actually keeps visible.
  Fix: new `pinnedCount` prop on `CategoryControlPanel`, totalVisibleCount =
  selected + excluded + optional + pinned; disable when 0; counter shows
  total. Label renamed «Выбранные (N)» → «Мои (N)».

- **KI#56 FIX** — Shift+LMB in MIXED mode triggered browser text selection.
  Fix: `onMouseDown` preventDefault when shift pressed (stops selection
  before click event). Added Ctrl+LMB as alternative (no side-effect).
  Added visible ⊕/⊖ button on chip for mobile users (no shift/ctrl on
  touch). New i18n keys: `chip.opt_tooltip`, `chip.unopt_tooltip`,
  `chip.opt_aria`, `chip.unopt_aria`. Updated: `logic.mixed_tooltip`,
  `legend.opt_shift_click`.

- **RENAME** — Category «Башни Предтеч» → «Плитки Предтеч» in i18n,
  SeoBlock, README, prerender.ts, TabletPage JSDoc. In-game item names
  (e.g. «Башня Бездны Предтеч» in tests) NOT changed — those are canonical
  PoE2 ru-client strings used in regex-matching tests.

## Verification

```bash
npx tsc -b       # 0 errors
npx eslint .     # 0 errors
npx vitest run   # 2418 passed | 5 skipped (+13 new tests vs baseline 2405)
npm run build    # 10 prerendered routes
```

## Deferred to iter 182

- **Visual layout density** (4th user feedback point — "too much empty space").
  Deferred per user's explicit request for iterative approach. Fix for KI#55
  already partially helps: user can hide unselected chips via «Мои» toggle.

## Deferred to iter 183

- **state-features for `/timeless-jewel`** (URL-sync, ProfilePanel,
  SelectedBasket). Was iter 181 in old roadmap; shifted because iter 181
  took the slot for UI fixes, and iter 182 is reserved for visual density.

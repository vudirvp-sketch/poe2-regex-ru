export const CATEGORY_IDS = [
  'waystone',
  'waystone-desecrated',
  'tablet',
  'relic',
  'jewel',
  'jewel-desecrated',
  'jewel-corrupted',
  'vendor',
  'belt',
  'ring',
  'amulet',
] as const;

export type CategoryId = typeof CATEGORY_IDS[number];

export const CATEGORY_ROUTES: Record<CategoryId, string> = {
  waystone: '/waystone',
  'waystone-desecrated': '/waystone',
  tablet: '/tablet',
  relic: '/relic',
  jewel: '/jewel',
  'jewel-desecrated': '/jewel',
  'jewel-corrupted': '/jewel',
  vendor: '/vendor',
  belt: '/belt',
  ring: '/ring',
  amulet: '/amulet',
};

/**
 * Phase 2.5 (iter 134) — per-sub-group chip preview count.
 *
 * When a sub-group has MORE than this many chips AND the sub-group key is NOT
 * in `chipExpandState`, the UI shows only the first `CHIP_PREVIEW_COUNT` chips
 * (plus any chips past the preview window whose members are selected, excluded,
 * or pinned) followed by a «+N ещё» button. Clicking the button toggles the
 * sub-group's entry in `chipExpandState` → all chips render + «свернуть» button.
 *
 * Tuned to 3 per `docs/UI_VISUALIZATION_AUDIT.md` §2 (mockup shows ~3 chips
 * + «+10 ещё»). Keep small — the whole point is noise reduction on first
 * screen of an expanded sub-group.
 */
export const CHIP_PREVIEW_COUNT = 3;

/**
 * Phase 3 (iter 135) — SelectedBasket cap.
 *
 * The SelectedBasket component (right aside on category pages) renders one
 * chip per selected family group. When the user has more selections than this
 * cap, only the first `SELECTED_BASKET_CAP` chips render with a «+N ещё»
 * expander at the bottom. Clicking the expander reveals all chips.
 *
 * Tuned to 20 per iter 131 §13.7 correction #3 (was 12 in original plan):
 * «У вас легко собираются regex на 15–30 модов» — user explicitly wants 20-25.
 *
 * See `docs/UI_REFACTOR_PLAN.md` §4 Phase 3 + Risk Register (§11).
 */
export const SELECTED_BASKET_CAP = 20;

/** Mapping of category ID to display name (Russian) */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  waystone: 'Путевые камни',
  'waystone-desecrated': 'Путевые камни (Очернённые)',
  tablet: 'Плитки',
  relic: 'Реликвии',
  jewel: 'Самоцветы',
  'jewel-desecrated': 'Самоцветы (Очернённые)',
  'jewel-corrupted': 'Самоцветы (Осквернённые)',
  vendor: 'Торговец',
  belt: 'Пояса',
  ring: 'Кольца',
  amulet: 'Амулеты',
};

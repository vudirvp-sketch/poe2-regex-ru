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

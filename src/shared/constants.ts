export const MAX_CHARS = 250;

export const CATEGORY_IDS = [
  'waystone',
  'waystone-desecrated',
  'tablet',
  'relic',
  'jewel',
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
  jewel: '/relic', // temporarily, jewel page not yet built
  vendor: '/vendor',
  belt: '/belt',
  ring: '/ring',
  amulet: '/amulet',
};

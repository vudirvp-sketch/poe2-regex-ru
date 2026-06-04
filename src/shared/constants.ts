export const MAX_CHARS = 250;

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

/** Mapping of category ID to display name (Russian) */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  waystone: 'Путевые камни',
  'waystone-desecrated': 'Путевые камни (Осквернённые)',
  tablet: 'Плитки',
  relic: 'Реликвии',
  jewel: 'Самоцветы',
  'jewel-desecrated': 'Самоцветы (Осквернённые)',
  'jewel-corrupted': 'Самоцветы (Осквернено)',
  vendor: 'Торговец',
  belt: 'Ремни',
  ring: 'Кольца',
  amulet: 'Амулеты',
};

/** Mapping of origin to display name (Russian) */
export const ORIGIN_LABELS: Record<string, string> = {
  normal: 'Обычные',
  desecrated: 'Осквернённые',
  corrupted: 'Осквернено',
  essence: 'Сущность',
  breachborn: 'Разлом',
};

/** Mapping of affix type to display name (Russian) */
export const AFFIX_LABELS: Record<string, string> = {
  prefix: 'Префикс',
  suffix: 'Суффикс',
};

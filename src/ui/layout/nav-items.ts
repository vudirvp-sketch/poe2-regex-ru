/**
 * Shared navigation items for Sidebar (desktop) and MobileNavTabs (mobile).
 *
 * iter 56, UI redesign Phase 4: extracted from Sidebar.tsx so both desktop
 * vertical nav and mobile horizontal tabs share the same source of truth.
 * Order is significant — used by both renderers as-is.
 */
export interface NavItem {
  path: string
  label: string
  icon: string
}

export const navItems: readonly NavItem[] = [
  { path: '/', label: 'home.nav_label', icon: 'logo' },
  { path: '/waystone', label: 'waystone.title', icon: 'waystone' },
  { path: '/tablet', label: 'tablet.title', icon: 'tablet' },
  { path: '/relic', label: 'relic.title', icon: 'relic' },
  { path: '/jewel', label: 'jewel.title', icon: 'jewel' },
  // iter 176: Timeless Jewels (Undying Hate + Heroic Tragedy) — separate
  // route because Atlas tree search uses OR-only regex semantics.
  { path: '/timeless-jewel', label: 'timeless_jewel.title', icon: 'jewel' },
  { path: '/vendor', label: 'vendor.title', icon: 'vendor' },
  { path: '/belt', label: 'belt.title', icon: 'belt' },
  { path: '/ring', label: 'ring.title', icon: 'ring' },
  { path: '/amulet', label: 'amulet.title', icon: 'amulet' },
] as const

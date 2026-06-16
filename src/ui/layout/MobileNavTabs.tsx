import { NavLink } from 'react-router-dom'
import { t } from '@shared/i18n'
import { navItems } from './nav-items'

/**
 * MobileNavTabs — mobile-only horizontal scrollable category tabs.
 *
 * iter 56, UI redesign Phase 4: replaces the previous hamburger drawer from
 * `Sidebar.tsx`. Renders as a sticky bar below `<Header>` on screens < md.
 * Hidden on desktop (`md:hidden`) — desktop uses `<Sidebar>` (vertical).
 *
 * Design: chip-style tabs with 24×24 icons + labels. Active tab uses the same
 * `.nav-mode-active` language as desktop (gold border-l + glow + brand-gold
 * text) but in a compact horizontal form — so the active route reads as a
 * "mode" selection rather than a generic highlighted link.
 *
 * a11y:
 * - `role="navigation"` + `aria-label` for screen readers.
 * - Horizontal scroll container has `aria-label` and is keyboard-focusable
 *   via Tab (each NavLink is a focusable anchor).
 * - Scrollbar hidden visually but keyboard/scroll still works.
 */
export function MobileNavTabs() {
  return (
    <nav
      className="md:hidden mobile-nav-tabs"
      role="navigation"
      aria-label={t('nav.categories')}
    >
      <div
        className="mobile-nav-tabs-scroll"
        role="tablist"
        aria-label={t('nav.categories')}
      >
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `mobile-nav-tab flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
                isActive ? 'nav-mode-active' : 'hover:opacity-80'
              }`
            }
            style={({ isActive }) => ({
              color: isActive ? 'var(--poe-gold-bright)' : 'var(--poe-text)',
            })}
            role="tab"
          >
            <img
              src={`${import.meta.env.BASE_URL}icons/${item.icon}.png`}
              alt=""
              width={20}
              height={20}
              className="shrink-0 object-contain"
              style={{ imageRendering: 'auto', maxHeight: '20px', maxWidth: '20px' }}
            />
            <span>{t(item.label)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

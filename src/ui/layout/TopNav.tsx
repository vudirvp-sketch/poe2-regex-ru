import { NavLink, Link } from 'react-router-dom'
import { t } from '@shared/i18n'
import { navItems } from './nav-items'

/**
 * TopNav — unified horizontal top navigation (iter 64, UI Phase 10).
 *
 * Replaces the previous 3-component setup:
 *   - `Sidebar.tsx`   (desktop-only vertical nav, left column, w-56 = 224px)
 *   - `Header.tsx`    (page-title bar above the content area)
 *   - `MobileNavTabs.tsx` (mobile-only horizontal scrollable tabs)
 *
 * Why consolidate:
 *   - Frees ~224px of horizontal space on desktop for the affix list (ModList)
 *     and the right-column RegexOutput/StatusPanel. On 1280-1440px viewports
 *     this is a meaningful UX improvement.
 *   - Unifies nav pattern across breakpoints — one component, one CSS class
 *     family, one active-state language. Previously desktop had vertical
 *     border-l active state, mobile had horizontal scroll — now both share
 *     the horizontal border-b language.
 *   - Eliminates the per-route `<Header>` bar (48px). Page title is already
 *     rendered inside `CategoryLayout`'s `header` slot (icon + title + count)
 *     on every category page, and HomePage renders its own hero `<h1>`.
 *     The standalone `<Header>` was redundant chrome.
 *
 * Layout:
 *   - Single row, `flex items-center`, height 56px (md+) / 52px (< md).
 *   - Left:   logo (32-36px) + "PoE2 Regex" / "Русский клиент" stack.
 *             Brand text hidden on `< sm` to save space for tabs.
 *   - Center: horizontal tabs (icon + label), `flex-1` + `overflow-x-auto`.
 *             On md+ the 9 tabs fit naturally; on < md they scroll.
 *             Scrollbar hidden visually (touch + wheel + keyboard still work).
 *   - Right:  feedback hint (Discord), `hidden lg:block`. Compact on the
 *             right edge so it never pushes tabs off-screen.
 *
 * Active state: `.nav-mode-active` class — `border-bottom: 3px` gold accent
 * via `::after` pseudo-element (overlaps the TopNav's bottom border), plus
 * a subtle gold-tinted gradient bg + brand-gold text. Echoes the Level-1
 * frame pattern (`.regex-output`) so the active route reads as a "mode"
 * rather than a generic highlighted link.
 *
 * a11y:
 *   - `role="banner"` on the header element.
 *   - `role="navigation"` + `aria-label` on the inner `<nav>`.
 *   - Each NavLink is a focusable anchor (keyboard reachable via Tab).
 *   - `aria-current="page"` is applied automatically by React Router's
 *     `<NavLink>` when active.
 */
export function TopNav() {
  return (
    <header
      className="topnav"
      role="banner"
    >
      <div className="topnav-bar">
        {/* Brand: logo + title stack. Title hidden on < sm. */}
        <Link
          to="/"
          className="topnav-brand shrink-0"
          aria-label="PoE2 Regex — Главная"
        >
          <img
            src={`${import.meta.env.BASE_URL}icons/logo.png`}
            alt="PoE2 Regex"
            width={36}
            height={36}
            className="shrink-0 object-contain"
            style={{ imageRendering: 'auto', maxHeight: '36px', maxWidth: '36px' }}
          />
          <span className="topnav-brand-text">
            <span
              className="topnav-brand-title"
              style={{ color: 'var(--poe-gold)' }}
            >
              PoE2 Regex
            </span>
            <span
              className="topnav-brand-subtitle"
              style={{ color: 'var(--poe-text)', opacity: 0.6 }}
            >
              Русский клиент
            </span>
          </span>
        </Link>

        {/* Tabs: horizontal scrollable list of all 9 routes. */}
        <nav
          className="topnav-tabs"
          role="navigation"
          aria-label={t('nav.categories')}
        >
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `topnav-tab flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
                  isActive ? 'nav-mode-active' : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--poe-gold-bright)' : 'var(--poe-text)',
              })}
            >
              <img
                src={`${import.meta.env.BASE_URL}icons/${item.icon}.png`}
                alt=""
                width={22}
                height={22}
                className="shrink-0 object-contain"
                style={{ imageRendering: 'auto', maxHeight: '22px', maxWidth: '22px' }}
              />
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>

        {/* Feedback hint — desktop only (lg+), doesn't push tabs. */}
        <div
          className="topnav-feedback hidden lg:block shrink-0 text-[11px] leading-snug"
          style={{ color: 'var(--poe-text)', opacity: 0.45 }}
        >
          {t('nav.feedback')}
        </div>
      </div>
    </header>
  )
}

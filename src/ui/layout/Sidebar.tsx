import { NavLink } from 'react-router-dom'
import { t } from '@shared/i18n'
import { navItems } from './nav-items'

/**
 * Sidebar — desktop-only vertical navigation (md+).
 *
 * iter 56, UI redesign Phase 4: mobile drawer removed. On mobile, navigation
 * is rendered by `<MobileNavTabs>` (horizontal scrollable chip bar, sticky
 * below Header). Sidebar is `hidden md:flex` — invisible on small screens.
 *
 * Active-state ("mode" pattern): `.nav-mode-active` class adds gold border-l
 * (3px), subtle gold glow (box-shadow), and brand-gold text — visually
 * echoes the Level-1 frame pattern (`.regex-output`, `.affix-header-*`)
 * to mark the active route as a "mode" rather than just a highlighted link.
 */
export function Sidebar() {
  return (
    <aside
      className="sidebar-atmosphere hidden md:flex h-full w-56 flex-col border-r shrink-0"
      style={{ borderColor: 'var(--poe-border)' }}
      role="navigation"
      aria-label="Основная навигация"
    >
      <div className="p-4 text-left" style={{ borderBottom: '1px solid var(--poe-border)' }}>
        <img
          src={`${import.meta.env.BASE_URL}icons/logo.png`}
          alt="PoE2 Regex"
          width={52}
          height={52}
          className="mb-1 object-contain"
        />
        <h1 className="text-xl font-bold" style={{ color: 'var(--poe-gold)' }}>
          PoE2 Regex
        </h1>
        <p className="text-[13px]" style={{ color: 'var(--poe-text)', opacity: 0.6 }}>
          Русский клиент
        </p>
      </div>
      <nav className="flex-1 overflow-auto p-2">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `nav-mode-link flex items-center gap-3 rounded px-3 py-2 text-[15px] transition-colors ${
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
              width={28}
              height={28}
              className="shrink-0 object-contain"
              style={{ imageRendering: 'auto', maxHeight: '28px', maxWidth: '28px' }}
            />
            <span>{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>
      <div
        className="px-4 py-3 text-[11px] leading-snug"
        style={{ borderTop: '1px solid var(--poe-border)', color: 'var(--poe-text)', opacity: 0.45 }}
      >
        {t('sidebar.feedback')}
      </div>
    </aside>
  )
}

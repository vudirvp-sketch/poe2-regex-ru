import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { t } from '@shared/i18n'

const navItems = [
  { path: '/', label: 'home.title', icon: 'logo' },
  { path: '/waystone', label: 'waystone.title', icon: 'waystone' },
  { path: '/tablet', label: 'tablet.title', icon: 'tablet' },
  { path: '/relic', label: 'relic.title', icon: 'relic' },
  { path: '/jewel', label: 'jewel.title', icon: 'jewel' },
  { path: '/vendor', label: 'vendor.title', icon: 'vendor' },
  { path: '/belt', label: 'belt.title', icon: 'belt' },
  { path: '/ring', label: 'ring.title', icon: 'ring' },
  { path: '/amulet', label: 'amulet.title', icon: 'amulet' },
] as const

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger button — visible only on small screens */}
      <button
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded bg-gray-800 border border-gray-700 text-gray-300"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
        aria-expanded={mobileOpen}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>

      {/* Overlay when mobile sidebar is open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible, mobile: slide-in */}
      <aside
        className={`
          z-40 flex h-full w-56 flex-col border-r shrink-0
          transition-transform duration-200
          md:translate-x-0 md:static
          fixed top-0 left-0 bottom-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'var(--poe-bg-secondary)',
          borderColor: 'var(--poe-border)',
        }}
      >
        <div className="p-4 text-center" style={{ borderBottom: '1px solid var(--poe-border)' }}>
          <img
            src={`${import.meta.env.BASE_URL}icons/logo.png`}
            alt="PoE2 Regex"
            width={40}
            height={40}
            className="mx-auto mb-1 object-contain"
          />
          <h1 className="text-lg font-bold" style={{ color: 'var(--poe-gold)' }}>
            PoE2 Regex
          </h1>
          <p className="text-xs" style={{ color: 'var(--poe-text)' }}>
            Русский клиент
          </p>
        </div>
        <nav className="flex-1 overflow-auto p-2">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'font-bold'
                    : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--poe-gold-bright)' : 'var(--poe-text)',
                background: isActive ? 'var(--poe-bg-tertiary)' : 'transparent',
              })}
            >
              <img
                src={`${import.meta.env.BASE_URL}icons/${item.icon}.png`}
                alt=""
                width={20}
                height={20}
                className="shrink-0 object-contain"
                style={{ imageRendering: 'auto' }}
              />
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}

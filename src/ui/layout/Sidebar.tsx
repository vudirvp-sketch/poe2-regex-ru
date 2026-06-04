import { NavLink } from 'react-router-dom'
import { t } from '@shared/i18n'

const navItems = [
  { path: '/', label: 'home.title', icon: '🏠' },
  { path: '/waystone', label: 'waystone.title', icon: '💎' },
  { path: '/tablet', label: 'tablet.title', icon: '🧱' },
  { path: '/relic', label: 'relic.title', icon: '⚡' },
  { path: '/vendor', label: 'vendor.title', icon: '🛒' },
  { path: '/belt', label: 'belt.title', icon: '🎗️' },
  { path: '/ring', label: 'ring.title', icon: '💍' },
  { path: '/amulet', label: 'amulet.title', icon: '📿' },
]

export function Sidebar() {
  return (
    <aside
      className="flex h-full w-56 flex-col border-r"
      style={{
        background: 'var(--poe-bg-secondary)',
        borderColor: 'var(--poe-border)',
      }}
    >
      <div className="p-4 text-center" style={{ borderBottom: '1px solid var(--poe-border)' }}>
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
            <span>{item.icon}</span>
            <span>{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

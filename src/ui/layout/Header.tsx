import { useLocation } from 'react-router-dom'
import { t } from '@shared/i18n'

const routeToTitleKey: Record<string, string> = {
  '/': 'home.title',
  '/waystone': 'waystone.title',
  '/tablet': 'tablet.title',
  '/relic': 'relic.title',
  '/vendor': 'vendor.title',
  '/belt': 'belt.title',
  '/ring': 'ring.title',
  '/amulet': 'amulet.title',
}

export function Header() {
  const location = useLocation()
  const titleKey = routeToTitleKey[location.pathname] ?? 'app.title'

  return (
    <header
      className="flex h-12 items-center border-b px-4"
      style={{
        background: 'var(--poe-bg-secondary)',
        borderColor: 'var(--poe-border)',
      }}
    >
      <h2 className="text-base font-semibold" style={{ color: 'var(--poe-gold)' }}>
        {t(titleKey)}
      </h2>
    </header>
  )
}

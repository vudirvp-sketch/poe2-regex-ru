import { Link } from 'react-router-dom'
import { t } from '@shared/i18n'

const categories = [
  { path: '/waystone', labelKey: 'waystone.title', descKey: 'home.waystone_desc', icon: '💎' },
  { path: '/tablet', labelKey: 'tablet.title', descKey: 'home.tablet_desc', icon: '🧱' },
  { path: '/relic', labelKey: 'relic.title', descKey: 'home.relic_desc', icon: '⚡' },
  { path: '/vendor', labelKey: 'vendor.title', descKey: 'home.vendor_desc', icon: '🛒' },
  { path: '/belt', labelKey: 'belt.title', descKey: 'home.belt_desc', icon: '🎗️' },
  { path: '/ring', labelKey: 'ring.title', descKey: 'home.ring_desc', icon: '💍' },
  { path: '/amulet', labelKey: 'amulet.title', descKey: 'home.amulet_desc', icon: '📿' },
]

export function HomePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold" style={{ color: 'var(--poe-gold)' }}>
          {t('home.title')}
        </h1>
        <p className="text-lg" style={{ color: 'var(--poe-text)' }}>
          {t('home.subtitle')}
        </p>
        <p style={{ color: 'var(--poe-text)' }}>{t('home.description')}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {categories.map(cat => (
          <Link
            key={cat.path}
            to={cat.path}
            className="rounded-lg border p-4 text-center transition-colors hover:opacity-80"
            style={{
              background: 'var(--poe-bg-secondary)',
              borderColor: 'var(--poe-border)',
            }}
          >
            <div className="mb-2 text-3xl">{cat.icon}</div>
            <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--poe-gold)' }}>
              {t(cat.labelKey)}
            </h3>
            <p className="text-xs" style={{ color: 'var(--poe-text)' }}>
              {t(cat.descKey)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { t } from '@shared/i18n'

const categories = [
  { path: '/waystone', labelKey: 'waystone.title', descKey: 'home.waystone_desc', icon: 'waystone', tag: '106 модов' },
  { path: '/tablet', labelKey: 'tablet.title', descKey: 'home.tablet_desc', icon: 'tablet', tag: '78 модов' },
  { path: '/relic', labelKey: 'relic.title', descKey: 'home.relic_desc', icon: 'relic', tag: '56 модов' },
  { path: '/jewel', labelKey: 'jewel.title', descKey: 'home.jewel_desc', icon: 'jewel', tag: '235 модов' },
  { path: '/vendor', labelKey: 'vendor.title', descKey: 'home.vendor_desc', icon: 'vendor', tag: '50+ свойств' },
  { path: '/belt', labelKey: 'belt.title', descKey: 'home.belt_desc', icon: 'belt', tag: '298 модов' },
  { path: '/ring', labelKey: 'ring.title', descKey: 'home.ring_desc', icon: 'ring', tag: '366 модов' },
  { path: '/amulet', labelKey: 'amulet.title', descKey: 'home.amulet_desc', icon: 'amulet', tag: '427 модов' },
]

export function HomePage() {
  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero section */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-3xl font-bold md:text-4xl" style={{ color: 'var(--poe-gold)' }}>
          {t('home.title')}
        </h1>
        <p className="mb-4 text-lg" style={{ color: 'var(--poe-text)' }}>
          {t('home.subtitle')}
        </p>
        <p className="mb-6 text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
          {t('home.description_full')}
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-xs" style={{ color: 'var(--poe-text)', opacity: 0.5 }}>
          <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--poe-border)' }}>1 584 мода</span>
          <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--poe-border)' }}>8 категорий</span>
          <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--poe-border)' }}>Лимит 250 символов</span>
          <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--poe-border)' }}>Оптимизация regex</span>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {categories.map(cat => (
          <Link
            key={cat.path}
            to={cat.path}
            className="group relative rounded-lg border p-4 text-center transition-all hover:scale-[1.02] hover:opacity-90"
            style={{
              background: 'var(--poe-bg-secondary)',
              borderColor: 'var(--poe-border)',
            }}
          >
            <div className="mb-2">
              <img
                src={`${import.meta.env.BASE_URL}icons/${cat.icon}.png`}
                alt=""
                width={48}
                height={48}
                className="mx-auto object-contain"
              />
            </div>
            <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--poe-gold)' }}>
              {t(cat.labelKey)}
            </h3>
            <p className="text-xs" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
              {t(cat.descKey)}
            </p>
            <span className="mt-2 inline-block rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--poe-bg-secondary)', color: 'var(--poe-text)', opacity: 0.5 }}>
              {cat.tag}
            </span>
          </Link>
        ))}
      </div>

      {/* Features section */}
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4" style={{ background: 'var(--poe-bg-secondary)', borderColor: 'var(--poe-border)' }}>
          <div className="mb-2 text-lg font-semibold" style={{ color: 'var(--poe-gold)' }}>
            {t('home.feature_data_title')}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
            {t('home.feature_data_desc')}
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ background: 'var(--poe-bg-secondary)', borderColor: 'var(--poe-border)' }}>
          <div className="mb-2 text-lg font-semibold" style={{ color: 'var(--poe-gold)' }}>
            {t('home.feature_optimize_title')}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
            {t('home.feature_optimize_desc')}
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ background: 'var(--poe-bg-secondary)', borderColor: 'var(--poe-border)' }}>
          <div className="mb-2 text-lg font-semibold" style={{ color: 'var(--poe-gold)' }}>
            {t('home.feature_share_title')}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
            {t('home.feature_share_desc')}
          </p>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-8 text-center text-xs" style={{ color: 'var(--poe-text)', opacity: 0.4 }}>
        <p>{t('home.footer')}</p>
      </div>
    </div>
  )
}

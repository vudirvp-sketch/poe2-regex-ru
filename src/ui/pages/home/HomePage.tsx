import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { t } from '@shared/i18n'
import { loadCategoryData, loadMergedCategoryData } from '@data/loader'
import { VENDOR_PROPERTIES } from '@data/vendor-properties'

/** Category config for the home page — tag is now dynamically computed */
const categories = [
  { path: '/waystone', labelKey: 'waystone.title', descKey: 'home.waystone_desc', icon: 'waystone', jsonId: 'waystone' },
  { path: '/tablet', labelKey: 'tablet.title', descKey: 'home.tablet_desc', icon: 'tablet', jsonId: 'tablet' },
  { path: '/relic', labelKey: 'relic.title', descKey: 'home.relic_desc', icon: 'relic', jsonId: 'relic' },
  { path: '/jewel', labelKey: 'jewel.title', descKey: 'home.jewel_desc', icon: 'jewel', jsonId: 'jewel', mergeIds: ['jewel-desecrated', 'jewel-corrupted'] },
  { path: '/vendor', labelKey: 'vendor.title', descKey: 'home.vendor_desc', icon: 'vendor', jsonId: 'vendor', vendorCount: true },
  { path: '/belt', labelKey: 'belt.title', descKey: 'home.belt_desc', icon: 'belt', jsonId: 'belt' },
  { path: '/ring', labelKey: 'ring.title', descKey: 'home.ring_desc', icon: 'ring', jsonId: 'ring' },
  { path: '/amulet', labelKey: 'amulet.title', descKey: 'home.amulet_desc', icon: 'amulet', jsonId: 'amulet' },
]

/** Format a number with thin space for thousands separator (Russian style) */
function formatCount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009')
}

export function HomePage() {
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    async function loadCounts() {
      const result: Record<string, number> = {}
      await Promise.all(categories.map(async (cat) => {
        try {
          if (cat.vendorCount) {
            // Vendor properties are in @data/vendor-properties, not from JSON
            result[cat.jsonId] = VENDOR_PROPERTIES.length
            return
          }
          let data
          if (cat.mergeIds) {
            data = await loadMergedCategoryData([cat.jsonId, ...cat.mergeIds])
          } else {
            data = await loadCategoryData(cat.jsonId)
          }
          result[cat.jsonId] = data.tokens.length
        } catch {
          // If load fails, don't show count
          result[cat.jsonId] = 0
        }
      }))
      if (!cancelled) setCounts(result)
    }
    loadCounts()
    return () => { cancelled = true }
  }, [])

  const totalMods = Object.values(counts).reduce((a, b) => a + b, 0)
  const loaded = Object.keys(counts).length > 0

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
        <div className="flex flex-wrap justify-center gap-3 text-[13px]" style={{ color: 'var(--poe-text)', opacity: 0.5 }}>
          <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--poe-border)' }}>
            {loaded ? `${formatCount(totalMods)} модов` : '...'}
          </span>
          <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--poe-border)' }}>
            {t('home.category_count')}
          </span>
          <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--poe-border)' }}>{t('home.limit_250')}</span>
          <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--poe-border)' }}>{t('home.regex_optimization')}</span>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {categories.map(cat => {
          const count = counts[cat.jsonId]
          const tagText = cat.vendorCount
            ? (count ? `${count}+ ${t('home.properties')}` : `... ${t('home.properties')}`)
            : (count ? `${formatCount(count)} ${t('home.mods')}` : '')

          return (
            <Link
              key={cat.path}
              to={cat.path}
              className="group relative rounded-lg border p-4 text-center transition-all hover:scale-[1.02] hover:opacity-90"
              style={{
                background: 'var(--poe-bg-secondary)',
                borderColor: 'var(--poe-border)',
              }}
            >
              <div className="mb-2 flex items-center justify-center" style={{ height: 48 }}>
                <img
                  src={`${import.meta.env.BASE_URL}icons/${cat.icon}.png`}
                  alt=""
                  width={44}
                  height={44}
                  className="object-contain"
                  style={{ imageRendering: 'auto', maxHeight: '44px', maxWidth: '44px' }}
                />
              </div>
              <h3 className="mb-1 text-[15px] font-semibold" style={{ color: 'var(--poe-gold)' }}>
                {t(cat.labelKey)}
              </h3>
              <p className="text-[13px]" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
                {t(cat.descKey)}
              </p>
              {tagText && (
                <span className="mt-2 inline-block rounded px-1.5 py-0.5 text-[12px]" style={{ background: 'var(--poe-bg-secondary)', color: 'var(--poe-text)', opacity: 0.5 }}>
                  {tagText}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Features section */}
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4" style={{ background: 'var(--poe-bg-secondary)', borderColor: 'var(--poe-border)' }}>
          <div className="mb-2 text-xl font-semibold" style={{ color: 'var(--poe-gold)' }}>
            {t('home.feature_data_title')}
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
            {t('home.feature_data_desc')}
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ background: 'var(--poe-bg-secondary)', borderColor: 'var(--poe-border)' }}>
          <div className="mb-2 text-xl font-semibold" style={{ color: 'var(--poe-gold)' }}>
            {t('home.feature_optimize_title')}
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
            {t('home.feature_optimize_desc')}
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ background: 'var(--poe-bg-secondary)', borderColor: 'var(--poe-border)' }}>
          <div className="mb-2 text-xl font-semibold" style={{ color: 'var(--poe-gold)' }}>
            {t('home.feature_share_title')}
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
            {t('home.feature_share_desc')}
          </p>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-8 text-center text-[13px]" style={{ color: 'var(--poe-text)', opacity: 0.4 }}>
        <p>{t('home.footer')}</p>
      </div>
    </div>
  )
}

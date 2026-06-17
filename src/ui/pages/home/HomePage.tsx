import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { t } from '@shared/i18n'
import { loadCategoryData, loadMergedCategoryData } from '@data/loader'
import { VENDOR_PROPERTIES } from '@data/vendor-properties'
import { SeoBlock } from './SeoBlock'

/** Category config for the home page — tag is now dynamically computed.
 *  iter 59: removed descKey (verbose category descriptions like "Полное покрытие
 *  префиксов и суффиксов"). Cards now show only icon + name + affix count. */
const categories = [
  { path: '/waystone', labelKey: 'waystone.title', icon: 'waystone', jsonId: 'waystone' },
  { path: '/tablet', labelKey: 'tablet.title', icon: 'tablet', jsonId: 'tablet' },
  { path: '/relic', labelKey: 'relic.title', icon: 'relic', jsonId: 'relic' },
  { path: '/jewel', labelKey: 'jewel.title', icon: 'jewel', jsonId: 'jewel', mergeIds: ['jewel-desecrated', 'jewel-corrupted'] },
  { path: '/vendor', labelKey: 'vendor.title', icon: 'vendor', jsonId: 'vendor', vendorCount: true },
  { path: '/belt', labelKey: 'belt.title', icon: 'belt', jsonId: 'belt' },
  { path: '/ring', labelKey: 'ring.title', icon: 'ring', jsonId: 'ring' },
  { path: '/amulet', labelKey: 'amulet.title', icon: 'amulet', jsonId: 'amulet' },
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
      {/* Hero section — iter 57: tightened (mb-10→mb-6, mb-3→mb-2, mb-4→mb-3, mb-6→mb-4, badges text-[13px]→[12px] + gap-3→gap-2) */}
      <div className="mb-6 text-center">
        <h1 className="mb-2 text-3xl font-bold md:text-4xl" style={{ color: 'var(--poe-gold)' }}>
          {t('home.title')}
        </h1>
        <p className="mb-3 text-lg" style={{ color: 'var(--poe-text)' }}>
          {t('home.subtitle')}
        </p>
        <p className="mb-4 text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
          {t('home.description_full')}
        </p>
        <div className="flex flex-wrap justify-center gap-2 text-[12px]" style={{ color: 'var(--poe-text)', opacity: 0.6 }}>
          <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--poe-border)' }}>
            {loaded ? `${formatCount(totalMods)} ${t('home.mods')}` : '...'}
          </span>
          <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--poe-border)' }}>
            {t('home.category_count')}
          </span>
          <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--poe-border)' }}>{t('home.limit_250')}</span>
          <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--poe-border)' }}>{t('home.regex_optimization')}</span>
        </div>
      </div>

      {/* iter 65: ornate gold filigree divider between the hero block and the
          category cards grid. Mirrors the divider used by CategoryLayout so
          the visual language is consistent across pages. */}
      <hr className="poe-divider--ornate my-2" aria-hidden="true" />

      {/* Category cards — iter 57: tightened (gap-4→gap-3, p-4→p-3, icon 44→40, height 48→40, mb-2→mb-1.5) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {categories.map(cat => {
          const count = counts[cat.jsonId]
          const tagText = cat.vendorCount
            ? (count ? `${count}+ ${t('home.properties')}` : `... ${t('home.properties')}`)
            : (count ? `${formatCount(count)} ${t('home.mods')}` : '')

          return (
            <Link
              key={cat.path}
              to={cat.path}
              className="group relative rounded-lg border p-3 text-center transition-all hover:scale-[1.02] hover:opacity-90"
              style={{
                background: 'var(--poe-bg-secondary)',
                borderColor: 'var(--poe-border)',
              }}
            >
              <div className="mb-1.5 flex items-center justify-center" style={{ height: 40 }}>
                <img
                  src={`${import.meta.env.BASE_URL}icons/${cat.icon}.png`}
                  alt=""
                  width={40}
                  height={40}
                  className="object-contain"
                  style={{ imageRendering: 'auto', maxHeight: '40px', maxWidth: '40px' }}
                />
              </div>
              <h3 className="mb-1.5 text-[15px] font-semibold" style={{ color: 'var(--poe-gold)' }}>
                {t(cat.labelKey)}
              </h3>
              {tagText && (
                <span className="inline-block rounded px-1.5 py-0.5 text-[12px]" style={{ background: 'var(--poe-bg-secondary)', color: 'var(--poe-text)', opacity: 0.5 }}>
                  {tagText}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Features section — iter 62 (Phase 8b): collapsed into <details> like
          SeoBlock. The 3-card grid was visually noisy on a page whose hero
          already lists the same info as stat badges (mods count, categories,
          250-char limit, regex optimization). Content stays in the DOM (Google
          indexes <details>), but visually hidden until user opens it. */}
      <div className="mt-6">
        <details className="home-seo-details">
          <summary className="home-seo-summary">
            <span className="home-seo-summary-text">{t('home.features_summary')}</span>
          </summary>
          <section className="home-seo-content grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3" style={{ background: 'var(--poe-bg-secondary)', borderColor: 'var(--poe-border)' }}>
              <div className="mb-1.5 text-base font-semibold" style={{ color: 'var(--poe-gold)' }}>
                {t('home.feature_data_title')}
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
                {t('home.feature_data_desc')}
              </p>
            </div>
            <div className="rounded-lg border p-3" style={{ background: 'var(--poe-bg-secondary)', borderColor: 'var(--poe-border)' }}>
              <div className="mb-1.5 text-base font-semibold" style={{ color: 'var(--poe-gold)' }}>
                {t('home.feature_optimize_title')}
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
                {t('home.feature_optimize_desc')}
              </p>
            </div>
            <div className="rounded-lg border p-3" style={{ background: 'var(--poe-bg-secondary)', borderColor: 'var(--poe-border)' }}>
              <div className="mb-1.5 text-base font-semibold" style={{ color: 'var(--poe-gold)' }}>
                {t('home.feature_share_title')}
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.7 }}>
                {t('home.feature_share_desc')}
              </p>
            </div>
          </section>
        </details>
      </div>

      {/* SEO text block — wrapped in <details> (iter 57, UI Phase 5): collapsed by default */}
      <div className="mt-6">
        <SeoBlock />
      </div>

      {/* Footer info — iter 57: mt-8→mt-6 */}
      <div className="mt-6 text-center text-[13px]" style={{ color: 'var(--poe-text)', opacity: 0.4 }}>
        <p>{t('home.footer')}</p>
      </div>
    </div>
  )
}

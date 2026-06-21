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
      {/* Hero section — iter 57: tightened (mb-10→mb-6, mb-3→mb-2, mb-4→mb-3, mb-6→mb-4, badges text-[13px]→[12px] + gap-3→gap-2)
          iter 69: 3 atmospheric decorations added on lg+/xl+ only — mobile (<lg)
          stays identical to iter 57. Wrapper uses `isolate` so the backdrop's
          `mix-blend-screen` blends only within this container (not with the body
          bg), and `overflow-hidden` so the side ghosts never cause horizontal
          scroll. All decorations are `aria-hidden` + `pointer-events-none`.
          iter 120: backdrop images (hero-bas-relief lg+, news-bg-center mobile)
          REMOVED — bas-relief visually competed with hero text and was reported
          as "completely hides text"; news-bg-center was too subtle to be visible
          ("don't see it anywhere"). Side ghosts REPLACED with full-body portrait
          images: shaman (left) + ива (right). They use `h-[500px] w-auto` to
          show the full body, with a CSS mask-image gradient for smooth fade-out
          of the legs at the bottom. Opacity 0.22 keeps them as silhouettes. */}
      <div className="relative mb-6 isolate overflow-hidden text-center">
        {/* Side ghost: shaman full-body (iter 120, replaces hero-horned-warrior).
            xl+ only (≥1280px) — below that, the content column has no room for
            side decorations without squeezing the text. Portrait aspect ratio
            (533×800) → at h-[500px], width ≈ 333px. CSS mask-image fades the
            bottom 40% (legs) smoothly into the background. Opacity 0.22 keeps
            the shaman as a ghosted silhouette, not a focal point. */}
        <img
          src={`${import.meta.env.BASE_URL}atmosphere/hero-shaman.webp`}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1/2 hidden h-[500px] w-auto -translate-y-1/2 opacity-[0.22] xl:block hero-side-ghost"
        />
        {/* Side ghost: ива full-body (iter 120, replaces hero-monster-red).
            Mirrors the left shaman. Symmetry is intentional — two flanking
            full-body silhouettes frame the centered hero text. Same h-[500px],
            same mask-image fade, same opacity 0.22. The `--right` modifier
            flips the horizontal mask gradient so the fade is on the inner edge
            (facing the hero text) rather than the outer edge. */}
        <img
          src={`${import.meta.env.BASE_URL}atmosphere/hero-iva.webp`}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-1/2 hidden h-[500px] w-auto -translate-y-1/2 opacity-[0.22] xl:block hero-side-ghost hero-side-ghost--right"
        />

        {/* Original hero text content. `relative` lifts it above the absolutely
            positioned decorations inside this isolated stacking context. */}
        <div className="relative">
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

      {/* iter 71: ornate banner divider between the Features <details> and
          the SeoBlock <details>. Uses `early-access-banner.webp` (1919×177)
          as a wide horizontal section break — taller and more illustrative
          than `.poe-divider--ornate` (8px gold filigree), but still subtle
          (opacity 0.35). Mirrors the divider used between hero and category
          grid so the visual rhythm of the home page stays consistent. */}
      <hr className="poe-divider--banner my-4" aria-hidden="true" />

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

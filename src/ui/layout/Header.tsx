import { useLocation } from 'react-router-dom'
import { t } from '@shared/i18n'
import { useEffect } from 'react'

const routeToTitleKey: Record<string, string> = {
  '/': 'home.header_title',
  '/waystone': 'waystone.title',
  '/tablet': 'tablet.title',
  '/relic': 'relic.title',
  '/jewel': 'jewel.title',
  '/vendor': 'vendor.title',
  '/belt': 'belt.title',
  '/ring': 'ring.title',
  '/amulet': 'amulet.title',
}

export function Header() {
  const location = useLocation()
  const titleKey = routeToTitleKey[location.pathname] ?? 'app.title'

  // iter 51: dark-only — set data-theme="dark" once on mount for explicit declaration.
  // Light theme removed from CSS; no toggle button anymore.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#0D0B09')
    }
  }, [])

  return (
    <header
      className="header-atmosphere flex h-12 items-center border-b px-4"
      style={{
        borderColor: 'var(--poe-border)',
      }}
    >
      <h2 className="text-lg font-semibold flex-1" style={{ color: 'var(--poe-gold)' }}>
        {t(titleKey)}
      </h2>
    </header>
  )
}

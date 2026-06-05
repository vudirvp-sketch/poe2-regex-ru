import { useLocation } from 'react-router-dom'
import { t } from '@shared/i18n'
import { useState, useEffect } from 'react'

const routeToTitleKey: Record<string, string> = {
  '/': 'home.title',
  '/waystone': 'waystone.title',
  '/tablet': 'tablet.title',
  '/relic': 'relic.title',
  '/jewel': 'jewel.title',
  '/vendor': 'vendor.title',
  '/belt': 'belt.title',
  '/ring': 'ring.title',
  '/amulet': 'amulet.title',
}

function getInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('poe2-regex-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore
  }
  return 'dark'
}

export function Header() {
  const location = useLocation()
  const titleKey = routeToTitleKey[location.pathname] ?? 'app.title'
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('poe2-regex-theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <header
      className="flex h-12 items-center border-b px-4 pl-12 md:pl-4"
      style={{
        background: 'var(--poe-bg-secondary)',
        borderColor: 'var(--poe-border)',
      }}
    >
      <h2 className="text-base font-semibold flex-1" style={{ color: 'var(--poe-gold)' }}>
        {t(titleKey)}
      </h2>
      <button
        onClick={toggleTheme}
        className="p-2 rounded text-sm transition-colors hover:opacity-80"
        style={{ color: 'var(--poe-text)' }}
        title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </header>
  )
}

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { TopNav } from './TopNav'

/**
 * Layout — root application shell (iter 64, UI Phase 10).
 *
 * Structure:
 *   <TopNav />  — single horizontal bar at the top (brand + tabs + feedback)
 *   <main>      — scrollable content area, takes the rest of the viewport
 *
 * Previously (iter ≤63): 3-piece chrome — vertical `Sidebar` (desktop only,
 * w-56 = 224px) + `Header` (page-title bar, h-12) + `MobileNavTabs` (mobile
 * only). All three are now consolidated into `TopNav`. This frees ~224px of
 * horizontal space on desktop for the affix list (ModList) and the right
 * column (RegexOutput + StatusPanel + ProfilePanel).
 *
 * Theme: `data-theme="dark"` is set once on mount (dark-only — light theme
 * was removed iter 51). Was in `Header.tsx`, now lives here since `Header`
 * is gone.
 *
 * a11y: skip-link is the first focusable element, lets keyboard / screen
 * reader users jump straight to `#main-content`.
 */
export function Layout() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#0D0B09')
    }
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden layout-shell">
      <a href="#main-content" className="skip-link">Перейти к основному содержимому</a>
      <TopNav />
      <main id="main-content" className="flex-1 overflow-auto p-3 md:p-6" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}

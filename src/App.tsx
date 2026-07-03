import { Routes, Route, Link } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Layout } from './ui/layout/Layout'
import { HomePage } from './ui/pages/home/HomePage'

// iter 153 (code-split bundle): Lazy-load category pages so the initial
// bundle stays under Vite's 500 KB warning threshold. HomePage stays eager
// (landing-page LCP). Each category page becomes its own chunk fetched on
// first navigation. Categories are independent — user typically visits one
// at a time, so this is a clean split.
//
// The fallback <div> is rendered while the chunk loads. Since chunks are
// tiny (~30-80 KB gzipped per page) and the user navigates from the home
// page, the flash is imperceptible. PageStateWrapper inside each page
// handles its own loading state for data fetching.
const WaystonePage = lazy(() =>
  import('./ui/pages/waystone/WaystonePage').then((m) => ({ default: m.WaystonePage })),
)
const TabletPage = lazy(() =>
  import('./ui/pages/tablet/TabletPage').then((m) => ({ default: m.TabletPage })),
)
const RelicPage = lazy(() =>
  import('./ui/pages/relic/RelicPage').then((m) => ({ default: m.RelicPage })),
)
const VendorPage = lazy(() =>
  import('./ui/pages/vendor/VendorPage').then((m) => ({ default: m.VendorPage })),
)
const BeltPage = lazy(() =>
  import('./ui/pages/belt/BeltPage').then((m) => ({ default: m.BeltPage })),
)
const RingPage = lazy(() =>
  import('./ui/pages/ring/RingPage').then((m) => ({ default: m.RingPage })),
)
const AmuletPage = lazy(() =>
  import('./ui/pages/amulet/AmuletPage').then((m) => ({ default: m.AmuletPage })),
)
const JewelPage = lazy(() =>
  import('./ui/pages/jewel/JewelPage').then((m) => ({ default: m.JewelPage })),
)

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--poe-gold)' }}>404</h2>
      <p className="text-muted">Страница не найдена</p>
      <Link to="/" className="text-accent-blue hover:text-blue-300 underline">На главную</Link>
    </div>
  )
}

function PageFallback() {
  // Minimal fallback — styled to match the page chrome so the layout
  // doesn't jump when the chunk loads. Centered spinner is intentionally
  // simple: PageStateWrapper inside each page handles real loading state.
  return (
    <div
      className="flex items-center justify-center py-24"
      role="status"
      aria-label="Загрузка страницы"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/waystone"
          element={
            <Suspense fallback={<PageFallback />}>
              <WaystonePage />
            </Suspense>
          }
        />
        <Route
          path="/tablet"
          element={
            <Suspense fallback={<PageFallback />}>
              <TabletPage />
            </Suspense>
          }
        />
        <Route
          path="/relic"
          element={
            <Suspense fallback={<PageFallback />}>
              <RelicPage />
            </Suspense>
          }
        />
        <Route
          path="/jewel"
          element={
            <Suspense fallback={<PageFallback />}>
              <JewelPage />
            </Suspense>
          }
        />
        <Route
          path="/vendor"
          element={
            <Suspense fallback={<PageFallback />}>
              <VendorPage />
            </Suspense>
          }
        />
        <Route
          path="/belt"
          element={
            <Suspense fallback={<PageFallback />}>
              <BeltPage />
            </Suspense>
          }
        />
        <Route
          path="/ring"
          element={
            <Suspense fallback={<PageFallback />}>
              <RingPage />
            </Suspense>
          }
        />
        <Route
          path="/amulet"
          element={
            <Suspense fallback={<PageFallback />}>
              <AmuletPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

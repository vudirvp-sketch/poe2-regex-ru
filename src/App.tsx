import { Routes, Route, Link } from 'react-router-dom'
import { Layout } from './ui/layout/Layout'
import { HomePage } from './ui/pages/home/HomePage'
import { WaystonePage } from './ui/pages/waystone/WaystonePage'
import { TabletPage } from './ui/pages/tablet/TabletPage'
import { RelicPage } from './ui/pages/relic/RelicPage'
import { VendorPage } from './ui/pages/vendor/VendorPage'
import { BeltPage } from './ui/pages/belt/BeltPage'
import { RingPage } from './ui/pages/ring/RingPage'
import { AmuletPage } from './ui/pages/amulet/AmuletPage'
import { JewelPage } from './ui/pages/jewel/JewelPage'

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--poe-gold)' }}>404</h2>
      <p className="text-gray-400">Страница не найдена</p>
      <Link to="/" className="text-blue-400 hover:text-blue-300 underline">На главную</Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/waystone" element={<WaystonePage />} />
        <Route path="/tablet" element={<TabletPage />} />
        <Route path="/relic" element={<RelicPage />} />
        <Route path="/jewel" element={<JewelPage />} />
        <Route path="/vendor" element={<VendorPage />} />
        <Route path="/belt" element={<BeltPage />} />
        <Route path="/ring" element={<RingPage />} />
        <Route path="/amulet" element={<AmuletPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

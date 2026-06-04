import { Routes, Route } from 'react-router-dom'
import { Layout } from './ui/layout/Layout'
import { HomePage } from './ui/pages/home/HomePage'
import { WaystonePage } from './ui/pages/waystone/WaystonePage'
import { TabletPage } from './ui/pages/tablet/TabletPage'
import { RelicPage } from './ui/pages/relic/RelicPage'
import { VendorPage } from './ui/pages/vendor/VendorPage'
import { BeltPage } from './ui/pages/belt/BeltPage'
import { RingPage } from './ui/pages/ring/RingPage'
import { AmuletPage } from './ui/pages/amulet/AmuletPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/waystone" element={<WaystonePage />} />
        <Route path="/tablet" element={<TabletPage />} />
        <Route path="/relic" element={<RelicPage />} />
        <Route path="/vendor" element={<VendorPage />} />
        <Route path="/belt" element={<BeltPage />} />
        <Route path="/ring" element={<RingPage />} />
        <Route path="/amulet" element={<AmuletPage />} />
      </Route>
    </Routes>
  )
}

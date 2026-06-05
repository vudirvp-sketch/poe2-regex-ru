import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--poe-bg)' }}>
      <a href="#main-content" className="skip-link">Перейти к основному содержимому</a>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main id="main-content" className="flex-1 overflow-auto p-3 md:p-6" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

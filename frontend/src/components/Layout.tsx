import { format } from 'date-fns'
import { Settings } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { BottomNav } from './BottomNav'

export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { status } = useAuth()
  const location = useLocation()
  const onHome = location.pathname === '/'
  const displayName =
    status?.display_name && status.display_name !== 'Owner' ? status.display_name : 'there'

  return (
    <div className="app-shell">
      {onHome && (
        <header className="flex items-start justify-between px-4 pb-4 pt-6">
          <div>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Hi {displayName}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {format(new Date(), 'EEEE d MMMM')}
            </p>
          </div>
          <button className="btn-icon" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            <Settings className="h-5 w-5" />
          </button>
        </header>
      )}

      <div className="app-main">
        <Outlet />
      </div>

      <BottomNav />
    </div>
  )
}

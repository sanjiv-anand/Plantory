import { BarChart3, Home, Leaf, Plus, Settings } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

const TAB_PATHS = ['/', '/plants', '/add', '/overview', '/map', '/scan', '/settings']

export function BottomNav() {
  const location = useLocation()
  const showNav = TAB_PATHS.includes(location.pathname)

  if (!showNav) return null

  return (
    <nav className="nav-bar">
      <div className="flex items-end justify-around">
        <NavLink to="/" className={({ isActive }) => ['nav-item', isActive ? 'nav-item-active' : ''].join(' ')}>
          <Home className="h-5 w-5" />
          <span>Home</span>
        </NavLink>

        <NavLink to="/plants" className={({ isActive }) => ['nav-item', isActive ? 'nav-item-active' : ''].join(' ')}>
          <Leaf className="h-5 w-5" />
          <span>Plants</span>
        </NavLink>

        <NavLink to="/add" className="nav-fab" aria-label="Add plant">
          <Plus className="h-6 w-6" />
        </NavLink>

        <NavLink to="/overview" className={({ isActive }) => ['nav-item', isActive ? 'nav-item-active' : ''].join(' ')}>
          <BarChart3 className="h-5 w-5" />
          <span>Overview</span>
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => ['nav-item', isActive ? 'nav-item-active' : ''].join(' ')}>
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  )
}

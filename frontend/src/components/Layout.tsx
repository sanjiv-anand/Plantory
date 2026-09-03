import { Leaf } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-10 pt-4">
      <header className="mb-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <Leaf className="h-5 w-5 text-emerald-400" />
          LILYLOG
        </Link>
      </header>
      <Outlet />
    </div>
  )
}

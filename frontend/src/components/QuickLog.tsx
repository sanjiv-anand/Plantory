import { Camera } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { Plant } from '../types'

export function QuickLog({ plants }: { plants: Plant[] }) {
  const active = plants.filter((plant) => plant.status === 'ACTIVE')
  if (!active.length) return null

  return (
    <section className="card p-5">
      <p className="label">Quick log</p>
      <h3 className="mt-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Log today in one tap
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {active.slice(0, 4).map((plant) => (
          <Link
            key={plant.id}
            className="card-inner flex items-center gap-2 px-3 py-3 text-sm font-medium"
            to={`/plants/${plant.id}`}
          >
            <Camera className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="truncate" style={{ color: 'var(--text-primary)' }}>
              {plant.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

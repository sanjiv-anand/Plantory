import { format } from 'date-fns'
import { ChevronRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { Plant } from '../types'

export function PlantCard({ plant }: { plant: Plant }) {
  return (
    <Link to={`/plants/${plant.id}`} className="card block p-4 transition active:scale-[0.99]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {plant.name}
          </p>
          <p className="mt-1 truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
            {plant.species}
            {plant.variety ? ` · ${plant.variety}` : ''}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {plant.status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{plant.location_name || 'No location set'}</span>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
      </div>

      {plant.planting_date && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Planted {format(new Date(plant.planting_date), 'PPP')}
        </p>
      )}
    </Link>
  )
}

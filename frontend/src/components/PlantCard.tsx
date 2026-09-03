import { format } from 'date-fns'
import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { Plant } from '../types'

export function PlantCard({ plant }: { plant: Plant }) {
  return (
    <Link to={`/plants/${plant.id}`} className="card block p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{plant.name}</h2>
        <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">{plant.status}</span>
      </div>
      <p className="text-sm text-slate-300">
        {plant.species}
        {plant.variety ? ` · ${plant.variety}` : ''}
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <MapPin className="h-3.5 w-3.5" />
        <span>{plant.location_name || 'No location set'}</span>
      </div>
      {plant.planting_date && <p className="mt-1 text-xs text-slate-400">Planted {format(new Date(plant.planting_date), 'PPP')}</p>}
    </Link>
  )
}

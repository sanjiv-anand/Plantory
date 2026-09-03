import { ExternalLink, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { Plant } from '../types'

export function PlantMap({ plants }: { plants: Plant[] }) {
  const located = plants.filter((plant) => plant.latitude != null && plant.longitude != null)

  if (!located.length) {
    return (
      <section className="card p-5">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Garden map
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Add location coordinates to your plants to see them on the map.
        </p>
      </section>
    )
  }

  const lats = located.map((plant) => Number(plant.latitude))
  const lngs = located.map((plant) => Number(plant.longitude))
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length
  const delta = Math.max(0.01, Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs)) * 1.5

  const bbox = [
    centerLng - delta,
    centerLat - delta,
    centerLng + delta,
    centerLat + delta,
  ].join('%2C')

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${centerLat}%2C${centerLng}`

  return (
    <section className="card overflow-hidden p-0">
      <div className="p-5 pb-3">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Garden map
        </h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {located.length} plant{located.length !== 1 ? 's' : ''} with coordinates
        </p>
      </div>
      <iframe
        title="Garden map"
        className="h-56 w-full border-0"
        src={embedUrl}
        loading="lazy"
      />
      <div className="space-y-2 p-5 pt-3">
        {located.map((plant) => (
          <Link key={plant.id} className="card-inner flex items-center justify-between gap-3 p-3" to={`/plants/${plant.id}`}>
            <div className="flex min-w-0 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {plant.name}
                </p>
                <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                  {plant.location_name ?? `${Number(plant.latitude).toFixed(4)}, ${Number(plant.longitude).toFixed(4)}`}
                </p>
              </div>
            </div>
            <a
              className="btn-ghost shrink-0 px-2 py-1"
              href={`https://www.openstreetmap.org/?mlat=${plant.latitude}&mlon=${plant.longitude}#map=18/${plant.latitude}/${plant.longitude}`}
              onClick={(event) => event.stopPropagation()}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Link>
        ))}
      </div>
    </section>
  )
}

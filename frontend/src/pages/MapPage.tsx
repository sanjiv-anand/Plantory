import { PlantMap } from '../components/PlantMap'
import { usePlants } from '../hooks/useApi'

export function MapPage() {
  const { data: plants = [] } = usePlants()

  return (
    <main className="space-y-4">
      <section className="px-1">
        <p className="label">Map</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          Garden map
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          See where your plants live and open their journals quickly.
        </p>
      </section>
      <PlantMap plants={plants} />
    </main>
  )
}

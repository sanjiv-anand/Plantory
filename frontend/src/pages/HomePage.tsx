import { ArrowRight, Camera, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PlantCard } from '../components/PlantCard'
import { QuickLog } from '../components/QuickLog'
import { StreakWidget } from '../components/StreakWidget'
import { WeatherAlerts } from '../components/WeatherAlerts'
import { WeekCalendar } from '../components/WeekCalendar'
import { useAllEntries, usePlants } from '../hooks/useApi'

export function HomePage() {
  const { data: plants = [] } = usePlants()
  const activePlants = plants.filter((plant) => plant.status === 'ACTIVE')
  const recentPlants = [...plants]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)

  const entryQueries = useAllEntries(plants.map((plant) => plant.id))
  const allEntries = entryQueries.flatMap((query) => query.data ?? [])

  return (
    <main className="space-y-4">
      <WeekCalendar plants={plants} />
      <WeatherAlerts />
      {plants.length > 0 && <StreakWidget entries={allEntries} />}
      {plants.length > 0 && <QuickLog plants={plants} />}

      {!plants.length && (
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Welcome!
            </h2>
          </div>
          <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            Your calm garden dashboard starts here. Add your first plant from the center tab below.
          </p>
          <Link className="btn-primary mt-4 inline-flex w-full justify-center" to="/add">
            Add your first plant
          </Link>
        </section>
      )}

      {plants.length > 0 && (
        <>
          <section className="card p-5">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <Camera className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Capture today&apos;s moment
                </p>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {activePlants.length
                    ? `You have ${activePlants.length} active plant${activePlants.length > 1 ? 's' : ''} ready for a quick photo or note.`
                    : 'Open a plant to log a photo or note when you are ready.'}
                </p>
              </div>
            </div>
            {recentPlants[0] && (
              <Link className="btn-secondary mt-4 inline-flex w-full justify-center" to={`/plants/${recentPlants[0].id}`}>
                Open {recentPlants[0].name}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Your plants
              </h2>
              <Link className="text-sm font-medium" style={{ color: 'var(--accent)' }} to="/plants">
                View all
              </Link>
            </div>
            {recentPlants.map((plant) => (
              <PlantCard key={plant.id} plant={plant} />
            ))}
          </section>
        </>
      )}
    </main>
  )
}

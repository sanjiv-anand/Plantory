import { format, formatDistanceToNow } from 'date-fns'
import { ArrowRight, Leaf, MapPin, Plus, Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PlantCard } from '../components/PlantCard'
import { PlantMap } from '../components/PlantMap'
import { WeatherAlerts } from '../components/WeatherAlerts'
import { usePlants } from '../hooks/useApi'

const GARDEN_TIPS = [
  'Check soil moisture before watering — most plants prefer drying out slightly between drinks.',
  'Morning light is gentler on leaves than harsh afternoon sun.',
  'Rotate pots every week so all sides get equal light.',
  'A quick photo each week makes growth easier to notice over time.',
]

export function OverviewPage() {
  const { data: plants = [], isLoading } = usePlants()
  const activePlants = plants.filter((plant) => plant.status === 'ACTIVE').length
  const dormantPlants = plants.filter((plant) => plant.status === 'DORMANT').length
  const archivedPlants = plants.filter((plant) => plant.status === 'ARCHIVED').length
  const datedPlants = plants.filter((plant) => plant.planting_date).length
  const withLocation = plants.filter((plant) => plant.location_name).length
  const recentPlants = [...plants]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)
  const tip = GARDEN_TIPS[new Date().getDate() % GARDEN_TIPS.length]

  return (
    <main className="space-y-4">
      <section className="px-1">
        <p className="label">Overview</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          Garden overview
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          A quick read on how your collection is doing.
        </p>
      </section>

      <WeatherAlerts />

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            At a glance
          </h2>
          <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
            {activePlants} active
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Plants" value={plants.length} />
            <Stat label="Active" value={activePlants} />
            <Stat label="Dated" value={datedPlants} />
          </div>
        )}
      </section>

      {!isLoading && plants.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Status breakdown
          </h2>
          <div className="space-y-2">
            <StatusRow color="var(--accent)" count={activePlants} label="Active" total={plants.length} />
            <StatusRow color="#f59e0b" count={dormantPlants} label="Dormant" total={plants.length} />
            <StatusRow color="var(--text-muted)" count={archivedPlants} label="Archived" total={plants.length} />
          </div>
        </section>
      )}

      {!isLoading && plants.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Collection details
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <DetailChip icon={Sprout} label="With planting date" value={datedPlants} />
            <DetailChip icon={MapPin} label="With location" value={withLocation} />
          </div>
        </section>
      )}

      {!isLoading && recentPlants.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Recently updated
            </h2>
            <Link className="text-sm font-medium" style={{ color: 'var(--accent)' }} to="/plants">
              See all
            </Link>
          </div>
          {recentPlants.map((plant) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </section>
      )}

      {!isLoading && !plants.length && (
        <section className="card p-5 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Leaf className="h-7 w-7" />
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Your overview will fill in here
          </p>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            Add a plant to start tracking growth, planting dates, and locations.
          </p>
          <Link className="btn-primary mt-4 inline-flex w-full justify-center" to="/add">
            <Plus className="mr-2 h-4 w-4" />
            Add your first plant
          </Link>
        </section>
      )}

      {!isLoading && plants.length > 0 && <PlantMap plants={plants} />}

      <section className="card p-5">
        <p className="label mb-2">Garden tip</p>
        <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          {tip}
        </p>
      </section>

      {!isLoading && plants.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Last activity
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {formatDistanceToNow(new Date(recentPlants[0]?.updated_at ?? plants[0].updated_at), { addSuffix: true })}
              </p>
            </div>
            <Link className="btn-icon" to={`/plants/${recentPlants[0]?.id ?? plants[0].id}`} aria-label="Open latest plant">
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Updated {format(new Date(recentPlants[0]?.updated_at ?? plants[0].updated_at), 'PPP')}
          </p>
        </section>
      )}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-inner px-3 py-3 text-center">
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  )
}

function StatusRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const width = total ? Math.max((count / total) * 100, count ? 8 : 0) : 0

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {count}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg-card-inner)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  )
}

function DetailChip({ icon: Icon, label, value }: { icon: typeof Sprout; label: string; value: number }) {
  return (
    <div className="card-inner flex items-center gap-3 px-3 py-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
      </div>
    </div>
  )
}

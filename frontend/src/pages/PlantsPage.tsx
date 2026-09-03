import { Leaf, Plus, Search, Sprout } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PlantCard } from '../components/PlantCard'
import { usePlants } from '../hooks/useApi'
import type { Plant } from '../types'

type StatusFilter = 'ALL' | Plant['status']

export function PlantsPage() {
  const { data: plants = [], isLoading, error } = usePlants()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return plants.filter((plant) => {
      const matchesStatus = statusFilter === 'ALL' || plant.status === statusFilter
      const matchesQuery =
        !normalized ||
        plant.name.toLowerCase().includes(normalized) ||
        plant.species.toLowerCase().includes(normalized) ||
        (plant.location_name ?? '').toLowerCase().includes(normalized) ||
        (plant.variety ?? '').toLowerCase().includes(normalized)
      return matchesStatus && matchesQuery
    })
  }, [plants, query, statusFilter])

  const activeCount = plants.filter((plant) => plant.status === 'ACTIVE').length

  return (
    <main className="space-y-4">
      <section className="px-1">
        <p className="label">Collection</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          Your plants
        </h1>
        {plants.length > 0 && (
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {plants.length} plant{plants.length !== 1 ? 's' : ''} · {activeCount} active
          </p>
        )}
      </section>

      {plants.length > 0 && (
        <section className="card p-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              className="input pl-10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, species, location..."
              value={query}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'ACTIVE', 'DORMANT', 'ARCHIVED'] as StatusFilter[]).map((value) => (
              <button
                key={value}
                className={['rounded-full px-3 py-1.5 text-xs font-semibold', statusFilter === value ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'card-inner'].join(' ')}
                onClick={() => setStatusFilter(value)}
                type="button"
              >
                {value === 'ALL' ? 'All' : value.charAt(0) + value.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </section>
      )}

      {isLoading && <p className="px-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading plants...</p>}
      {error && <p className="px-1 text-sm text-rose-500">{(error as Error).message}</p>}

      {!plants.length && !isLoading && (
        <section className="card p-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Sprout className="h-8 w-8" />
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>No plants yet</p>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            Start your collection with a name and species. You can add photos, notes, and milestones as you go.
          </p>
          <Link className="btn-primary mt-5 inline-flex w-full justify-center" to="/add">
            <Plus className="mr-2 h-4 w-4" />
            Add your first plant
          </Link>
        </section>
      )}

      {plants.length > 0 && !filtered.length && (
        <section className="card p-5">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No plants match your search. Try a different name, species, or filter.
          </p>
        </section>
      )}

      {plants.length > 0 && (
        <section className="card p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Leaf className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Growing together
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Tap a plant to view its timeline, photos, and events.
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="space-y-3">
        {filtered.map((plant) => (
          <PlantCard key={plant.id} plant={plant} />
        ))}
      </div>
    </main>
  )
}

import { format, isSameDay } from 'date-fns'
import { Droplets, Sparkles, Trash2 } from 'lucide-react'

import { api } from '../lib'
import type { JournalEntry } from '../types'

type Props = {
  entries: JournalEntry[]
  onDelete: (id: number) => void
  filterDate?: Date
}

export function EntryTimeline({ entries, onDelete, filterDate }: Props) {
  const visibleEntries = filterDate
    ? entries.filter((entry) => isSameDay(new Date(entry.captured_at), filterDate))
    : entries

  return (
    <section className="space-y-3">
      {visibleEntries.map((entry) => (
        <article key={entry.id} className="card overflow-hidden">
          <img
            src={`${api.MEDIA_URL}${entry.display_path}`}
            alt={entry.title ?? 'Plant journal entry'}
            className="h-52 w-full object-cover"
          />
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="label">{format(new Date(entry.captured_at), 'EEEE')}</p>
                <p className="mt-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {format(new Date(entry.captured_at), 'd MMMM · p')}
                </p>
              </div>
              <button className="btn-icon shrink-0" onClick={() => onDelete(entry.id)} type="button" aria-label="Delete entry">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {entry.title && (
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {entry.title}
              </p>
            )}
            {entry.memory && (
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                {entry.memory}
              </p>
            )}
            {entry.observation && (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {entry.observation}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {entry.watering_done && (
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <Droplets className="h-3.5 w-3.5" />
                  Watered
                </span>
              )}
              {entry.fertilized && (
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Fertilized
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Metric label="Height" value={entry.height_cm ? `${entry.height_cm} cm` : '—'} />
              <Metric label="Leaves" value={entry.leaf_count ?? '—'} />
              <Metric label="Flowers" value={entry.flower_count ?? '—'} />
              <Metric label="Tags" value={entry.tags?.length ? entry.tags.join(', ') : '—'} />
            </div>

            {entry.weather_snapshot && (
              <div className="card-inner mt-4 p-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {entry.weather_snapshot.temperature ?? '—'}°C · Humidity {entry.weather_snapshot.humidity ?? '—'}% · Wind{' '}
                {entry.weather_snapshot.wind_speed ?? '—'} km/h
              </div>
            )}
          </div>
        </article>
      ))}

      {!visibleEntries.length && (
        <div className="card p-8 text-center">
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            No entries yet
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {filterDate ? 'Nothing logged for this day yet.' : 'Your journal timeline will appear here after the first check-in.'}
          </p>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-inner px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="mt-1 font-medium" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  )
}

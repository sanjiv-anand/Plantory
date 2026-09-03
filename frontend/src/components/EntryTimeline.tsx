import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'

import { api } from '../lib'
import type { JournalEntry } from '../types'

type Props = {
  entries: JournalEntry[]
  onDelete: (id: number) => void
}

export function EntryTimeline({ entries, onDelete }: Props) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Timeline</h3>
      {entries.map((entry) => (
        <article key={entry.id} className="card p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">{format(new Date(entry.captured_at), 'PPP p')}</p>
            <button className="btn-secondary p-2" onClick={() => onDelete(entry.id)} type="button">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <img src={`${api.MEDIA_URL}${entry.display_path}`} alt={entry.title ?? 'Plant journal entry'} className="h-56 w-full rounded-xl object-cover" />
          {entry.title && <p className="mt-2 text-sm font-semibold">{entry.title}</p>}
          {entry.memory && <p className="mt-1 text-sm text-slate-300">{entry.memory}</p>}
          {entry.observation && <p className="mt-1 text-sm text-slate-400">{entry.observation}</p>}
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
            <span>Height: {entry.height_cm ?? '-'} cm</span>
            <span>Leaves: {entry.leaf_count ?? '-'}</span>
            <span>Flowers: {entry.flower_count ?? '-'}</span>
            <span>Watered: {entry.watering_done ? 'Yes' : 'No'}</span>
          </div>
          {entry.weather_snapshot && (
            <div className="mt-3 rounded-xl bg-slate-800/60 p-2 text-xs text-slate-300">
              <p>
                Weather {entry.weather_snapshot.temperature ?? '-'}°C · Humidity {entry.weather_snapshot.humidity ?? '-'}% · Wind{' '}
                {entry.weather_snapshot.wind_speed ?? '-'} km/h
              </p>
            </div>
          )}
        </article>
      ))}
      {!entries.length && <p className="text-sm text-slate-400">No entries yet.</p>}
    </section>
  )
}

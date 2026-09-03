import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

import { AddEntryForm } from '../components/AddEntryForm'
import { CalendarView } from '../components/CalendarView'
import { EntryTimeline } from '../components/EntryTimeline'
import { PhotoCompare } from '../components/PhotoCompare'
import { WeatherTrend } from '../components/WeatherTrend'
import { useDeleteEntry, useEntries, useEvents, usePlant } from '../hooks/useApi'

export function PlantPage() {
  const { plantId = '' } = useParams()
  const { data: plant } = usePlant(plantId)
  const { data: entries = [] } = useEntries(plantId)
  const { data: events = [] } = useEvents(plantId)
  const del = useDeleteEntry(plantId)

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1)),
    [entries],
  )

  if (!plant) return <p className="text-sm text-slate-400">Loading...</p>

  return (
    <main className="space-y-4">
      <section className="card p-4">
        <h1 className="text-xl font-semibold">{plant.name}</h1>
        <p className="mt-1 text-sm text-slate-300">{plant.species}{plant.variety ? ` · ${plant.variety}` : ''}</p>
        <p className="mt-2 text-sm text-slate-400">{plant.description || 'No description yet.'}</p>
      </section>

      <AddEntryForm plantId={plantId} />
      <CalendarView entries={sorted} />
      <PhotoCompare entries={sorted} />
      <WeatherTrend entries={sorted} />

      <section className="card p-4">
        <h3 className="mb-2 text-lg font-semibold">Events</h3>
        <div className="space-y-2 text-sm">
          {events.map((eventItem) => (
            <div key={eventItem.id} className="rounded-xl border border-slate-700 p-2">
              <p className="font-medium">{eventItem.title}</p>
              <p className="text-slate-400">{eventItem.event_type} · {new Date(eventItem.event_date).toLocaleDateString()}</p>
            </div>
          ))}
          {!events.length && <p className="text-slate-400">No events yet.</p>}
        </div>
      </section>

      <EntryTimeline entries={sorted} onDelete={(id) => del.mutate(id)} />
    </main>
  )
}

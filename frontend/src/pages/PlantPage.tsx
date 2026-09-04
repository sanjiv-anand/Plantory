import { format, isSameDay, isToday } from 'date-fns'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AddEntryForm } from '../components/AddEntryForm'
import { AddEventForm } from '../components/AddEventForm'
import { CareReminders } from '../components/CareReminders'
import { EntryTimeline } from '../components/EntryTimeline'
import { GrowthChart } from '../components/GrowthChart'
import { PhotoCompare } from '../components/PhotoCompare'
import { PlantQrShare } from '../components/PlantQrShare'
import { PlantWeekCalendar } from '../components/PlantWeekCalendar'
import { WeatherInsights } from '../components/WeatherInsights'
import { WeatherTrend } from '../components/WeatherTrend'
import { useRegisterAssistantContext } from '../context/AssistantContext'
import { useDeleteEntry, useEntries, useEvents, usePlant } from '../hooks/useApi'

type Tab = 'journal' | 'insights' | 'events' | 'share'

export function PlantPage() {
  const { plantId = '' } = useParams()
  const { data: plant } = usePlant(plantId)
  const { data: entries = [] } = useEntries(plantId)
  const { data: events = [], isLoading: eventsLoading, isError: eventsError, error: eventsFetchError } = useEvents(plantId)
  const del = useDeleteEntry(plantId)
  const [tab, setTab] = useState<Tab>('journal')
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1)),
    [entries],
  )

  const entriesForSelectedDay = sorted.filter((entry) => isSameDay(new Date(entry.captured_at), selectedDate))
  const todayHasEntry = sorted.some((entry) => isToday(new Date(entry.captured_at)))
  const activeJournalEntryId = tab === 'journal' && entriesForSelectedDay.length === 1
    ? entriesForSelectedDay[0].id
    : undefined
  const currentPage = tab === 'journal'
    ? `plant/journal/${format(selectedDate, 'yyyy-MM-dd')}`
    : `plant/${tab}`

  useRegisterAssistantContext(
    plant
      ? {
          plantId: plant.id,
          currentPage,
          journalEntryId: activeJournalEntryId,
          selectedDate: format(selectedDate, 'd MMM yyyy'),
        }
      : null,
  )

  if (!plant) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
  }

  return (
    <main className="plant-page-main space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <Link to="/plants" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
          <ArrowLeft className="h-4 w-4" />
          Plants
        </Link>
        <div className="flex items-center gap-2">
          <Link
            className="btn-ghost px-2 py-2"
            to={`/plants/${plantId}/edit`}
            aria-label="Edit plant"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            {plant.status}
          </span>
        </div>
      </div>

      <section className="px-1">
        <p className="label">{isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE')}</p>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {plant.name}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {plant.species}
          {plant.variety ? ` · ${plant.variety}` : ''}
          {plant.location_name ? ` · ${plant.location_name}` : ''}
        </p>
      </section>

      <PlantWeekCalendar
        entries={sorted}
        events={events}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="segment-tabs">
        <SegmentTab active={tab === 'journal'} label="Journal" onClick={() => setTab('journal')} />
        <SegmentTab active={tab === 'insights'} label="Insights" onClick={() => setTab('insights')} />
        <SegmentTab active={tab === 'events'} count={events.length} label="Events" onClick={() => setTab('events')} />
        <SegmentTab active={tab === 'share'} label="Tag" onClick={() => setTab('share')} />
      </div>

      {tab === 'journal' && (
        <>
          <CareReminders plant={plant} entries={sorted} />

          {isToday(selectedDate) ? (
            <AddEntryForm
              plantId={plantId}
              plantName={plant.name}
              entries={sorted}
              hasCoordinates={plant.latitude != null && plant.longitude != null}
            />
          ) : (
            <section className="card p-5">
              <p className="label">{format(selectedDate, 'EEEE')}</p>
              <h2 className="mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {format(selectedDate, 'd MMMM')}
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {entriesForSelectedDay.length
                  ? `${entriesForSelectedDay.length} entr${entriesForSelectedDay.length > 1 ? 'ies' : 'y'} logged on this day.`
                  : 'No entries for this day. Select today to log a new check-in.'}
              </p>
              {!todayHasEntry && (
                <button className="btn-secondary mt-4 w-full" onClick={() => setSelectedDate(new Date())} type="button">
                  Go to today
                </button>
              )}
            </section>
          )}

          <EntryTimeline entries={sorted} onDelete={(id) => del.mutate(id)} filterDate={selectedDate} />
        </>
      )}

      {tab === 'insights' && (
        <div className="space-y-4">
          <GrowthChart entries={sorted} />
          <WeatherInsights entries={sorted} />
          <WeatherTrend entries={sorted} />
          <PhotoCompare entries={sorted} />
        </div>
      )}

      {tab === 'share' && <PlantQrShare plantId={plant.id} plantName={plant.name} />}

      {tab === 'events' && (
        <div className="space-y-4">
          <AddEventForm plantId={plantId} />

          <section className="card p-5">
            <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Event history
            </h3>

            {eventsLoading && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading events...</p>
            )}

            {eventsError && (
              <p className="text-sm text-rose-500">
                Could not load events: {(eventsFetchError as Error).message}
              </p>
            )}

            {!eventsLoading && !eventsError && (
              <div className="space-y-2 text-sm">
                {events.map((eventItem) => (
                  <div key={eventItem.id} className="card-inner p-4">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {eventItem.title}
                    </p>
                    <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                      {formatEventType(eventItem.event_type)} · {new Date(eventItem.event_date).toLocaleDateString()}
                    </p>
                    {eventItem.description && (
                      <p className="mt-2 leading-6" style={{ color: 'var(--text-secondary)' }}>
                        {eventItem.description}
                      </p>
                    )}
                  </div>
                ))}
                {!events.length && (
                  <p style={{ color: 'var(--text-muted)' }}>
                    No events yet. Use the form above to log repotting, flowering, and other milestones.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

function formatEventType(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function SegmentTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      className={['segment-tab', active ? 'segment-tab-active' : ''].join(' ')}
      onClick={onClick}
      type="button"
    >
      {label}
      {count ? ` (${count})` : ''}
    </button>
  )
}

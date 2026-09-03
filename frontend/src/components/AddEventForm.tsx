import { format } from 'date-fns'
import { CalendarPlus } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { useCreateEvent } from '../hooks/useApi'
import type { PlantEvent } from '../types'

type EventType = PlantEvent['event_type']

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'PLANTED', label: 'Planted' },
  { value: 'SPROUTED', label: 'Sprouted' },
  { value: 'FIRST_LEAF', label: 'First leaf' },
  { value: 'REPOTTED', label: 'Repotted' },
  { value: 'WATERED', label: 'Watered' },
  { value: 'FERTILIZED', label: 'Fertilized' },
  { value: 'BUD_FORMED', label: 'Bud formed' },
  { value: 'FIRST_FLOWER', label: 'First flower' },
  { value: 'FLOWERING', label: 'Flowering' },
  { value: 'DORMANT', label: 'Dormant' },
  { value: 'OTHER', label: 'Other' },
]

type Props = {
  plantId: string
}

export function AddEventForm({ plantId }: Props) {
  const createEvent = useCreateEvent(plantId)
  const [saved, setSaved] = useState(false)
  const [state, setState] = useState({
    event_type: 'REPOTTED' as EventType,
    event_date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const title = state.title.trim()
    if (!title) return

    try {
      await createEvent.mutateAsync({
        event_type: state.event_type,
        event_date: state.event_date,
        title,
        description: state.description.trim() || null,
      })

      setState((current) => ({
        ...current,
        title: '',
        description: '',
      }))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch {
      // Error surfaced via mutation state.
    }
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <CalendarPlus className="h-5 w-5" />
        </div>
        <div>
          <p className="label">Milestone</p>
          <h3 className="mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Log an event
          </h3>
        </div>
      </div>

      <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <div>
          <label className="label mb-2 block" htmlFor="event-type">
            Event type
          </label>
          <select
            className="input"
            id="event-type"
            onChange={(event) => setState((current) => ({ ...current, event_type: event.target.value as EventType }))}
            value={state.event_type}
          >
            {EVENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label mb-2 block" htmlFor="event-date">
            Date
          </label>
          <input
            className="input"
            id="event-date"
            onChange={(event) => setState((current) => ({ ...current, event_date: event.target.value }))}
            type="date"
            value={state.event_date}
          />
        </div>

        <div>
          <label className="label mb-2 block" htmlFor="event-title">
            Title
          </label>
          <input
            required
            className="input"
            id="event-title"
            onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))}
            placeholder="e.g. Repotted into 8″ terracotta"
            value={state.title}
          />
        </div>

        <div>
          <label className="label mb-2 block" htmlFor="event-description">
            Notes <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <textarea
            className="input min-h-[88px] resize-y"
            id="event-description"
            onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
            placeholder="Any extra details worth remembering"
            value={state.description}
          />
        </div>

        {createEvent.isError && (
          <p className="text-sm text-rose-500">{(createEvent.error as Error).message}</p>
        )}

        <button
          className="btn-primary w-full"
          disabled={createEvent.isPending || !state.title.trim()}
          type="submit"
        >
          {createEvent.isPending ? 'Saving...' : saved ? 'Event saved!' : 'Add event'}
        </button>
      </form>
    </section>
  )
}

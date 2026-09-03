import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfWeek,
  subWeeks,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { JournalEntry, PlantEvent } from '../types'

type Props = {
  entries: JournalEntry[]
  events?: PlantEvent[]
  selectedDate?: Date
  onSelectDate?: (date: Date) => void
}

export function PlantWeekCalendar({ entries, events = [], selectedDate, onSelectDate }: Props) {
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekAnchor, { weekStartsOn: 1 })
    const end = endOfWeek(weekAnchor, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [weekAnchor])

  const entryDates = useMemo(
    () => entries.map((entry) => new Date(entry.captured_at)),
    [entries],
  )

  const eventDates = useMemo(
    () => events.map((eventItem) => new Date(eventItem.event_date)),
    [events],
  )

  return (
    <section className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          className="btn-icon"
          onClick={() => setWeekAnchor((current) => subWeeks(current, 1))}
          type="button"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          This week
        </p>
        <button
          className="btn-icon"
          onClick={() => setWeekAnchor((current) => addWeeks(current, 1))}
          type="button"
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : isToday(day)
          const hasEntry = entryDates.some((entryDate) => isSameDay(entryDate, day))
          const hasEvent = eventDates.some((eventDate) => isSameDay(eventDate, day))
          const entryCount = entryDates.filter((entryDate) => isSameDay(entryDate, day)).length

          return (
            <button
              key={day.toISOString()}
              className="flex flex-col items-center gap-1 py-1"
              onClick={() => onSelectDate?.(day)}
              type="button"
            >
              <span className="text-[11px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>
                {format(day, 'EEEEE')}
              </span>
              <div
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition',
                  isSelected ? 'bg-[var(--accent)] text-[var(--accent-text)]' : '',
                ].join(' ')}
                style={isSelected ? undefined : { color: 'var(--text-primary)' }}
              >
                {format(day, 'd')}
              </div>
              <div className="flex h-4 items-center gap-1">
                {hasEntry && (
                  <span
                    className={[
                      'rounded-full px-1.5 text-[10px] font-semibold',
                      isSelected ? 'bg-[var(--accent-text)] text-[var(--accent)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]',
                    ].join(' ')}
                  >
                    {entryCount}
                  </span>
                )}
                {hasEvent && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: isSelected ? 'var(--accent-text)' : '#f59e0b' }}
                    title="Event"
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

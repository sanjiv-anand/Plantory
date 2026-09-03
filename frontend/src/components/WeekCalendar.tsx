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
import { ChevronLeft, ChevronRight, Leaf, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { Plant } from '../types'

type Props = {
  plants: Plant[]
}

export function WeekCalendar({ plants }: Props) {
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const today = new Date()

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekAnchor, { weekStartsOn: 1 })
    const end = endOfWeek(weekAnchor, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [weekAnchor])

  const plantedDates = useMemo(
    () =>
      plants
        .map((plant) => plant.planting_date)
        .filter((value): value is string => Boolean(value))
        .map((value) => new Date(value)),
    [plants],
  )

  const plantsToday = plants.filter((plant) => plant.planting_date && isSameDay(new Date(plant.planting_date), today))
  const activeCount = plants.filter((plant) => plant.status === 'ACTIVE').length

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
          const selected = isToday(day)
          const hasPlanting = plantedDates.some((plantDate) => isSameDay(plantDate, day))

          return (
            <div key={day.toISOString()} className="flex flex-col items-center gap-2 py-1">
              <span className="text-[11px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>
                {format(day, 'EEEEE')}
              </span>
              <div
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold',
                  selected ? 'bg-[var(--accent)] text-[var(--accent-text)]' : '',
                ].join(' ')}
                style={selected ? undefined : { color: 'var(--text-primary)' }}
              >
                {format(day, 'd')}
              </div>
              {hasPlanting && !selected && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
              {hasPlanting && selected && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-text)]" />}
              {!hasPlanting && <span className="h-1.5 w-1.5" />}
            </div>
          )
        })}
      </div>

      <div className="card-inner mt-4 flex items-center gap-3 p-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <Leaf className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="label">Today</p>
          <p className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {plantsToday.length
              ? `${plantsToday.length} planting moment${plantsToday.length > 1 ? 's' : ''}`
              : activeCount
                ? `${activeCount} active plant${activeCount > 1 ? 's' : ''}`
                : 'Quiet garden day'}
          </p>
        </div>
        <Link className="btn-icon shrink-0" to="/add" aria-label="Add plant">
          <Plus className="h-5 w-5" />
        </Link>
      </div>
    </section>
  )
}

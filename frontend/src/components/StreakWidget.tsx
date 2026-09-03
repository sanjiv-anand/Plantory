import { Flame, Target } from 'lucide-react'

import { computeCheckInStreak, countEntriesThisWeek, hasLoggedToday } from '../lib/streaks'
import type { JournalEntry } from '../types'

export function StreakWidget({ entries }: { entries: JournalEntry[] }) {
  const streak = computeCheckInStreak(entries)
  const loggedToday = hasLoggedToday(entries)
  const weekCount = countEntriesThisWeek(entries)

  if (!entries.length && streak === 0) return null

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="label">Check-in streak</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {streak}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              day{streak !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <Flame className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="card-inner px-3 py-3">
          <Target className="mb-1 h-4 w-4" style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {loggedToday ? 'Logged today' : 'Not logged yet'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {loggedToday ? 'Great consistency!' : 'Capture a photo to keep your streak.'}
          </p>
        </div>
        <div className="card-inner px-3 py-3">
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {weekCount}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            entries this week
          </p>
        </div>
      </div>
    </section>
  )
}

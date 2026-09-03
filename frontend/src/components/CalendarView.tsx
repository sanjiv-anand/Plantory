import { format } from 'date-fns'

import type { JournalEntry } from '../types'

export function CalendarView({ entries }: { entries: JournalEntry[] }) {
  const byDate = new Map<string, JournalEntry[]>()
  entries.forEach((entry) => {
    const key = format(new Date(entry.captured_at), 'yyyy-MM-dd')
    byDate.set(key, [...(byDate.get(key) ?? []), entry])
  })

  const rows = [...byDate.entries()].sort((a, b) => (a[0] > b[0] ? -1 : 1))

  return (
    <section className="card p-5">
      <p className="label">Journal</p>
      <h3 className="mt-1 mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Calendar history
      </h3>
      <div className="space-y-2 text-sm">
        {rows.map(([day, dayEntries]) => (
          <div key={day} className="card-inner flex items-center justify-between px-4 py-3">
            <span style={{ color: 'var(--text-primary)' }}>{format(new Date(day), 'PPP')}</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {dayEntries.length} entr{dayEntries.length > 1 ? 'ies' : 'y'}
            </span>
          </div>
        ))}
      </div>
      {!rows.length && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No calendar items yet.</p>}
    </section>
  )
}

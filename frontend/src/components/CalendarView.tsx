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
    <section className="card p-4">
      <h3 className="mb-3 text-lg font-semibold">Calendar history</h3>
      <div className="space-y-2 text-sm">
        {rows.map(([day, dayEntries]) => (
          <div key={day} className="flex items-center justify-between rounded-xl border border-slate-700 px-3 py-2">
            <span>{format(new Date(day), 'PPP')}</span>
            <span className="text-slate-400">{dayEntries.length} entr{dayEntries.length > 1 ? 'ies' : 'y'}</span>
          </div>
        ))}
      </div>
      {!rows.length && <p className="text-sm text-slate-400">No calendar items yet.</p>}
    </section>
  )
}

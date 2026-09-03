import { useState } from 'react'

import { api } from '../lib'
import type { JournalEntry } from '../types'

export function PhotoCompare({ entries }: { entries: JournalEntry[] }) {
  const [a, setA] = useState<number>(0)
  const [b, setB] = useState<number>(Math.min(1, entries.length - 1))

  if (entries.length < 2) {
    return (
      <p className="px-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        Add at least two entries to compare photos.
      </p>
    )
  }

  return (
    <section className="card p-5">
      <h3 className="mb-3 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Compare photos over time
      </h3>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <select className="input" value={a} onChange={(e) => setA(Number(e.target.value))}>
          {entries.map((entry, idx) => (
            <option key={entry.id} value={idx}>
              {new Date(entry.captured_at).toLocaleDateString()}
            </option>
          ))}
        </select>
        <select className="input" value={b} onChange={(e) => setB(Number(e.target.value))}>
          {entries.map((entry, idx) => (
            <option key={entry.id} value={idx}>
              {new Date(entry.captured_at).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <img src={`${api.MEDIA_URL}${entries[a].display_path}`} alt="Earlier photo" className="h-40 w-full rounded-2xl object-cover" />
        <img src={`${api.MEDIA_URL}${entries[b].display_path}`} alt="Later photo" className="h-40 w-full rounded-2xl object-cover" />
      </div>
    </section>
  )
}

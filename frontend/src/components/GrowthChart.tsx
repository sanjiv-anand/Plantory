import { format } from 'date-fns'

import type { JournalEntry } from '../types'

type Metric = 'height_cm' | 'leaf_count' | 'flower_count'

const METRICS: { key: Metric; label: string; unit: string; color: string }[] = [
  { key: 'height_cm', label: 'Height', unit: 'cm', color: 'var(--accent)' },
  { key: 'leaf_count', label: 'Leaves', unit: '', color: '#22c55e' },
  { key: 'flower_count', label: 'Flowers', unit: '', color: '#f59e0b' },
]

export function GrowthChart({ entries }: { entries: JournalEntry[] }) {
  const charts = METRICS.map((metric) => ({
    ...metric,
    points: entries
      .filter((entry) => entry[metric.key] != null)
      .sort((a, b) => (a.captured_at < b.captured_at ? -1 : 1))
      .slice(-12),
  })).filter((chart) => chart.points.length >= 2)

  return (
    <section className="card p-5">
      <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Growth over time
      </h3>
      {!charts.length ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Log height, leaf count, or flower count in journal entries to see growth charts.
        </p>
      ) : (
        <div className="space-y-6">
          {charts.map((chart) => (
            <GrowthLine key={chart.key} label={chart.label} unit={chart.unit} color={chart.color} metric={chart.key} points={chart.points} />
          ))}
        </div>
      )}
    </section>
  )
}

function GrowthLine({
  label,
  unit,
  color,
  metric,
  points,
}: {
  label: string
  unit: string
  color: string
  metric: Metric
  points: JournalEntry[]
}) {
  const values = points.map((point) => Number(point[metric]))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 280
  const height = 80

  const coords = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width
    const y = height - ((value - min) / range) * (height - 8) - 4
    return `${x},${y}`
  })

  const latest = values[values.length - 1]
  const first = values[0]
  const change = latest - first

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {latest}
          {unit} ({change >= 0 ? '+' : ''}
          {change.toFixed(unit ? 1 : 0)}
          {unit})
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-hidden>
        <polyline fill="none" stroke={color} strokeWidth="2.5" points={coords.join(' ')} />
        {coords.map((coord, index) => {
          const [cx, cy] = coord.split(',').map(Number)
          return <circle key={index} cx={cx} cy={cy} r="3.5" fill={color} />
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <span>{format(new Date(points[0].captured_at), 'MMM d')}</span>
        <span>{format(new Date(points[points.length - 1].captured_at), 'MMM d')}</span>
      </div>
    </div>
  )
}

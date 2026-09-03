import { Droplets, Sparkles } from 'lucide-react'

import { isDue, loadReminders } from '../lib/reminders'
import type { JournalEntry, Plant } from '../types'

type Props = {
  plant: Plant
  entries: JournalEntry[]
}

export function CareReminders({ plant, entries }: Props) {
  const settings = loadReminders()
  const lastWatered = entries.find((entry) => entry.watering_done)?.captured_at
  const lastFed = entries.find((entry) => entry.fertilized)?.captured_at
  const wateringDue = settings.enabled && isDue(lastWatered, settings.wateringDays)
  const feedingDue = settings.enabled && isDue(lastFed, settings.fertilizingDays)

  if (!wateringDue && !feedingDue) return null

  return (
    <section className="card p-5">
      <h3 className="mb-3 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Care reminders
      </h3>
      <div className="space-y-2">
        {wateringDue && (
          <ReminderRow icon={Droplets} label="Watering due" detail={plant.watering_notes ?? 'Check soil moisture before watering.'} />
        )}
        {feedingDue && (
          <ReminderRow icon={Sparkles} label="Fertilizing due" detail="Consider feeding during active growth season." />
        )}
      </div>
    </section>
  )
}

function ReminderRow({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Droplets
  label: string
  detail: string
}) {
  return (
    <div className="card-inner flex items-start gap-3 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
          {detail}
        </p>
      </div>
    </div>
  )
}

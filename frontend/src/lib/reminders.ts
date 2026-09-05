export type ReminderSettings = {
  wateringDays: number
  fertilizingDays: number
  dailyCheckInHour: number
  enabled: boolean
}

const STORAGE_KEY = 'plantory-reminders'

export const DEFAULT_REMINDERS: ReminderSettings = {
  wateringDays: 3,
  fertilizingDays: 14,
  dailyCheckInHour: 9,
  enabled: true,
}

export function loadReminders(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_REMINDERS
    return { ...DEFAULT_REMINDERS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_REMINDERS
  }
}

export function saveReminders(settings: ReminderSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function daysSince(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null
  const diff = Date.now() - new Date(dateIso).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function isDue(lastDate: string | null | undefined, intervalDays: number): boolean {
  const elapsed = daysSince(lastDate)
  if (elapsed === null) return true
  return elapsed >= intervalDays
}

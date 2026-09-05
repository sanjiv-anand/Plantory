const STORAGE_KEY = 'plantory-notifications'

export type NotificationSettings = {
  enabled: boolean
  dailyReminderHour: number
}

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: false,
  dailyReminderHour: 9,
}

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_NOTIFICATIONS
    return { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_NOTIFICATIONS
  }
}

export function saveNotificationSettings(settings: NotificationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function showLocalNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/icon-192.png' })
}

let reminderTimer: number | undefined

export function scheduleDailyReminder(hour: number, onFire: () => void) {
  if (reminderTimer) window.clearTimeout(reminderTimer)

  const now = new Date()
  const next = new Date()
  next.setHours(hour, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)

  const delay = next.getTime() - now.getTime()
  reminderTimer = window.setTimeout(() => {
    onFire()
    scheduleDailyReminder(hour, onFire)
  }, delay)
}

export function cancelDailyReminder() {
  if (reminderTimer) {
    window.clearTimeout(reminderTimer)
    reminderTimer = undefined
  }
}

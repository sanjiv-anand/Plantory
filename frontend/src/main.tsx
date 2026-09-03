import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { client } from './lib'
import { loadNotificationSettings, scheduleDailyReminder, showLocalNotification } from './lib/notifications'
import { syncPendingEntries } from './lib/offlineQueue'
import './index.css'

async function syncOfflineEntries() {
  const synced = await syncPendingEntries((plantId, form) =>
    client.postForm(`/plants/${plantId}/entries`, form),
  )
  if (synced > 0) {
    showLocalNotification('LILYLOG', `${synced} offline entr${synced > 1 ? 'ies' : 'y'} synced.`)
  }
}

registerSW({ immediate: true })

window.addEventListener('online', () => {
  void syncOfflineEntries()
})

function NotificationBootstrap() {
  useEffect(() => {
    void syncOfflineEntries()
    const settings = loadNotificationSettings()
    if (settings.enabled) {
      scheduleDailyReminder(settings.dailyReminderHour, () => {
        showLocalNotification('LILYLOG', 'Time for a quick plant check-in and photo.')
      })
    }
  }, [])
  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NotificationBootstrap />
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)

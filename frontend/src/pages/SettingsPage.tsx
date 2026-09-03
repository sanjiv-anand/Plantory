import { Download, Fingerprint, Lock, MapPin, Moon, QrCode, Sun, UserPlus, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { usePlants } from '../hooks/useApi'
import { downloadGardenExport } from '../lib/export'
import {
  cancelDailyReminder,
  loadNotificationSettings,
  requestNotificationPermission,
  saveNotificationSettings,
  scheduleDailyReminder,
  showLocalNotification,
  type NotificationSettings,
} from '../lib/notifications'
import { listPendingEntries } from '../lib/offlineQueue'
import { DEFAULT_REMINDERS, loadReminders, saveReminders, type ReminderSettings } from '../lib/reminders'

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { status, lockApp, updateDisplayName, addHouseholdPasskey, busy } = useAuth()
  const { data: plants = [] } = usePlants()
  const [displayName, setDisplayName] = useState('')
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [passkeyAdded, setPasskeyAdded] = useState(false)
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDERS)
  const [notifications, setNotifications] = useState<NotificationSettings>(loadNotificationSettings())
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (status?.display_name && status.display_name !== 'Owner') {
      setDisplayName(status.display_name)
    }
  }, [status?.display_name])

  useEffect(() => {
    setReminders(loadReminders())
    void listPendingEntries().then((items) => setPendingCount(items.length))
  }, [])

  async function onSaveName() {
    try {
      await updateDisplayName(displayName)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch {
      // Error surfaced via AuthContext.
    }
  }

  async function onExport() {
    setExporting(true)
    try {
      await downloadGardenExport()
    } finally {
      setExporting(false)
    }
  }

  async function onAddPasskey() {
    try {
      await addHouseholdPasskey()
      setPasskeyAdded(true)
      window.setTimeout(() => setPasskeyAdded(false), 2000)
    } catch {
      // Error surfaced via AuthContext.
    }
  }

  function updateReminders(next: Partial<ReminderSettings>) {
    const merged = { ...reminders, ...next }
    setReminders(merged)
    saveReminders(merged)
  }

  async function updateNotifications(next: Partial<NotificationSettings>) {
    const merged = { ...notifications, ...next }
    if (next.enabled) {
      const permission = await requestNotificationPermission()
      if (permission !== 'granted') {
        merged.enabled = false
      }
    }
    setNotifications(merged)
    saveNotificationSettings(merged)
    cancelDailyReminder()
    if (merged.enabled) {
      scheduleDailyReminder(merged.dailyReminderHour, () => {
        showLocalNotification('LILYLOG', 'Time for a quick plant check-in and photo.')
      })
    }
  }

  const activePlants = plants.filter((plant) => plant.status === 'ACTIVE').length

  return (
    <main className="space-y-4">
      <section className="px-1">
        <p className="label">Settings</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          Preferences
        </h1>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Your profile</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>This name appears in your home greeting.</p>
          </div>
        </div>
        <label className="label mb-2 block" htmlFor="settings-name">Display name</label>
        <input className="input" id="settings-name" onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" type="text" value={displayName} />
        <button className="btn-primary mt-3 w-full" disabled={busy || !displayName.trim()} onClick={() => void onSaveName()} type="button">
          {saved ? 'Saved!' : busy ? 'Saving...' : 'Save name'}
        </button>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Appearance</h2>
        <div className="grid grid-cols-2 gap-2">
          <ThemeButton active={theme === 'light'} icon={Sun} label="Light" onClick={() => setTheme('light')} />
          <ThemeButton active={theme === 'dark'} icon={Moon} label="Dark" onClick={() => setTheme('dark')} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Care reminders</h2>
        <label className="mb-3 flex items-center justify-between text-sm">
          <span style={{ color: 'var(--text-secondary)' }}>Enable reminders</span>
          <input checked={reminders.enabled} onChange={(event) => updateReminders({ enabled: event.target.checked })} type="checkbox" />
        </label>
        <label className="label mb-2 block" htmlFor="watering-days">Watering interval (days)</label>
        <input className="input" id="watering-days" min={1} onChange={(event) => updateReminders({ wateringDays: Number(event.target.value) })} type="number" value={reminders.wateringDays} />
        <label className="label mb-2 mt-3 block" htmlFor="feeding-days">Fertilizing interval (days)</label>
        <input className="input" id="feeding-days" min={1} onChange={(event) => updateReminders({ fertilizingDays: Number(event.target.value) })} type="number" value={reminders.fertilizingDays} />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Daily notifications</h2>
        <label className="mb-3 flex items-center justify-between text-sm">
          <span style={{ color: 'var(--text-secondary)' }}>Check-in reminder</span>
          <input checked={notifications.enabled} onChange={(event) => void updateNotifications({ enabled: event.target.checked })} type="checkbox" />
        </label>
        <label className="label mb-2 block" htmlFor="reminder-hour">Reminder hour (24h)</label>
        <input className="input" id="reminder-hour" max={23} min={0} onChange={(event) => void updateNotifications({ dailyReminderHour: Number(event.target.value) })} type="number" value={notifications.dailyReminderHour} />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Garden tools</h2>
        <div className="space-y-2">
          <Link className="btn-secondary flex w-full items-center justify-center" to="/map">
            <MapPin className="mr-2 h-4 w-4" />
            Open garden map
          </Link>
          <Link className="btn-secondary flex w-full items-center justify-center" to="/scan">
            <QrCode className="mr-2 h-4 w-4" />
            Scan plant tag
          </Link>
          <button className="btn-secondary w-full" disabled={exporting} onClick={() => void onExport()} type="button">
            <Download className="mr-2 inline h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export garden JSON'}
          </button>
        </div>
        {pendingCount > 0 && (
          <p className="mt-3 text-sm" style={{ color: 'var(--accent)' }}>
            {pendingCount} entr{pendingCount > 1 ? 'ies' : 'y'} waiting to sync offline.
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Garden snapshot</h2>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Total plants" value={plants.length} />
          <MiniStat label="Active" value={activePlants} />
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Passkey security</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {status?.registered ? 'Passkey is active on this device.' : 'Passkey not set up yet.'}
            </p>
          </div>
        </div>
        <button className="btn-secondary mb-2 w-full" disabled={busy} onClick={() => void onAddPasskey()} type="button">
          <UserPlus className="mr-2 h-4 w-4" />
          {passkeyAdded ? 'Passkey added!' : busy ? 'Waiting...' : 'Add household member passkey'}
        </button>
        <p className="mb-3 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
          Register a passkey on a partner&apos;s phone so they can unlock the same shared garden.
        </p>
        <button className="btn-secondary w-full" onClick={() => void lockApp()} type="button">
          <Lock className="mr-2 h-4 w-4" />
          Lock app now
        </button>
      </section>
    </main>
  )
}

function ThemeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Sun
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={['rounded-2xl px-4 py-4 text-sm font-semibold transition', active ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'card-inner'].join(' ')}
      onClick={onClick}
      type="button"
    >
      <Icon className="mx-auto mb-2 h-5 w-5" />
      {label}
    </button>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-inner px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

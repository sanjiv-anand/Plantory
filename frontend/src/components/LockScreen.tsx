import { useState } from 'react'

import { useAuth } from '../context/AuthContext'

export function LockScreen() {
  const { status, loading, busy, error, registerPasskey, unlockWithPasskey } = useAuth()
  const needsSetup = status && !status.registered
  const [displayName, setDisplayName] = useState('')

  async function onPrimaryAction() {
    try {
      if (needsSetup) {
        const trimmed = displayName.trim()
        if (!trimmed) return
        await registerPasskey(trimmed)
        return
      }
      await unlockWithPasskey()
    } catch {
      // Error is surfaced through AuthContext state.
    }
  }

  const canSubmit = needsSetup ? displayName.trim().length > 0 : true

  return (
    <div className="app-shell">
      <div className="flex flex-1 flex-col justify-center px-6 pb-10 pt-16">
        <div className="card p-6 text-center">
          <img
            alt="LilyLog"
            className="mx-auto mb-5 h-20 w-20 rounded-[22%] shadow-lg"
            height={80}
            src="/logo.png"
            width={80}
          />

          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {needsSetup ? 'Welcome to LilyLog' : 'Unlock LilyLog'}
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            {needsSetup
              ? 'Tell us your name and set up a passkey so only you can open your garden journal.'
              : 'Use your passkey to unlock the app. Your journal stays private on this device.'}
          </p>

          {needsSetup && (
            <div className="mt-5 text-left">
              <label className="label mb-2 block" htmlFor="display-name">
                Your name
              </label>
              <input
                autoComplete="name"
                autoFocus
                className="input"
                id="display-name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="e.g. Lily"
                type="text"
                value={displayName}
              />
            </div>
          )}

          {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}

          <button
            className="btn-primary mt-6 w-full"
            disabled={loading || busy || !canSubmit}
            onClick={() => void onPrimaryAction()}
            type="button"
          >
            {loading ? 'Checking...' : busy ? 'Waiting for passkey...' : needsSetup ? 'Continue with passkey' : 'Unlock with passkey'}
          </button>
        </div>
      </div>
    </div>
  )
}

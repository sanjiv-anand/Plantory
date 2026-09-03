import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { authClient, setUnauthorizedHandler, type AuthStatus } from '../lib'

type AuthContextValue = {
  status: AuthStatus | null
  loading: boolean
  busy: boolean
  error: string | null
  refresh: () => Promise<void>
  registerPasskey: (displayName: string) => Promise<void>
  unlockWithPasskey: () => Promise<void>
  lockApp: () => Promise<void>
  updateDisplayName: (displayName: string) => Promise<void>
  addHouseholdPasskey: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await authClient.status()
    setStatus(next)
  }, [])

  useEffect(() => {
    refresh()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setStatus((current) => (current ? { ...current, authenticated: false } : current))
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const registerPasskey = useCallback(async (displayName: string) => {
    setBusy(true)
    setError(null)
    try {
      const trimmed = displayName.trim()
      if (!trimmed) throw new Error('Please enter your name.')
      const { challengeId, options } = await authClient.registerOptions(trimmed)
      const credential = await startRegistration({ optionsJSON: options })
      const next = await authClient.registerVerify({ challengeId, credential })
      setStatus(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Passkey setup failed'
      setError(message.includes('NotAllowedError') ? 'Passkey setup was cancelled.' : message)
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  const unlockWithPasskey = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const { challengeId, options } = await authClient.loginOptions()
      const credential = await startAuthentication({ optionsJSON: options })
      const next = await authClient.loginVerify({ challengeId, credential })
      setStatus(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unlock failed'
      setError(message.includes('NotAllowedError') ? 'Unlock was cancelled.' : message)
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  const lockApp = useCallback(async () => {
    await authClient.logout()
    setStatus((current) => (current ? { ...current, authenticated: false } : current))
  }, [])

  const updateDisplayName = useCallback(async (displayName: string) => {
    setBusy(true)
    setError(null)
    try {
      const trimmed = displayName.trim()
      if (!trimmed) throw new Error('Please enter your name.')
      const next = await authClient.updateProfile(trimmed)
      setStatus(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update name'
      setError(message)
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  const addHouseholdPasskey = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const { challengeId, options } = await authClient.addPasskeyOptions()
      const credential = await startRegistration({ optionsJSON: options })
      const next = await authClient.addPasskeyVerify({ challengeId, credential })
      setStatus(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add passkey'
      setError(message.includes('NotAllowedError') ? 'Passkey setup was cancelled.' : message)
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  const value = useMemo(
    () => ({
      status,
      loading,
      busy,
      error,
      refresh,
      registerPasskey,
      unlockWithPasskey,
      lockApp,
      updateDisplayName,
      addHouseholdPasskey,
    }),
    [status, loading, busy, error, refresh, registerPasskey, unlockWithPasskey, lockApp, updateDisplayName, addHouseholdPasskey],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

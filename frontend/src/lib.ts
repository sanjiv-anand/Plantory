import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api')
const MEDIA_URL = import.meta.env.VITE_MEDIA_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')

export const api = {
  API_URL,
  MEDIA_URL,
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

function parseJsonBody<T>(body: string): T {
  try {
    return JSON.parse(body) as T
  } catch {
    if (body.trimStart().startsWith('<!')) {
      throw new Error(
        'The app could not reach the API (got HTML instead of JSON). Rebuild with docker compose up -d --build and open the app on the same URL Tailscale serves.',
      )
    }
    throw new Error('Unexpected response from server.')
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
  })
  if (response.status === 401) {
    onUnauthorized?.()
  }
  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.text()
  if (!response.ok) {
    let message = body || `Request failed: ${response.status}`
    try {
      const parsed = parseJsonBody<{ detail?: string | Array<{ msg?: string }> }>(body)
      if (typeof parsed.detail === 'string') {
        message = parsed.detail
      } else if (Array.isArray(parsed.detail) && parsed.detail.length) {
        message = parsed.detail.map((item) => item.msg).filter(Boolean).join('. ')
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('could not reach the API')) {
        throw err
      }
    }
    throw new Error(message)
  }

  return parseJsonBody<T>(body)
}

export const client = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  del: (path: string) =>
    request(path, {
      method: 'DELETE',
    }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, {
      method: 'POST',
      body: form,
    }),
}

export type AuthStatus = {
  registered: boolean
  authenticated: boolean
  display_name?: string | null
}

export const authClient = {
  status: () => client.get<AuthStatus>('/auth/status'),
  registerOptions: (displayName: string) =>
    client.post<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>('/auth/register/options', {
      display_name: displayName,
    }),
  registerVerify: (body: { challengeId: string; credential: unknown }) =>
    client.post<AuthStatus>('/auth/register/verify', body),
  loginOptions: () =>
    client.post<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>('/auth/login/options', {}),
  loginVerify: (body: { challengeId: string; credential: unknown }) =>
    client.post<AuthStatus>('/auth/login/verify', body),
  logout: () => client.post<void>('/auth/logout', {}),
  updateProfile: (displayName: string) =>
    client.patch<AuthStatus>('/auth/profile', { display_name: displayName }),
  addPasskeyOptions: () =>
    client.post<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>(
      '/auth/register/add-passkey/options',
      {},
    ),
  addPasskeyVerify: (body: { challengeId: string; credential: unknown }) =>
    client.post<AuthStatus>('/auth/register/add-passkey/verify', body),
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'
const MEDIA_URL = import.meta.env.VITE_MEDIA_URL ?? 'http://localhost:8000'

export const api = {
  API_URL,
  MEDIA_URL,
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Request failed: ${response.status}`)
  }
  return (await response.json()) as T
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

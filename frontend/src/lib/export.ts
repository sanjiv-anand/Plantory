import { client } from '../lib'

export type GardenExport = {
  version: number
  exported_at: string
  plants: unknown[]
  entries: unknown[]
  events: unknown[]
}

export async function exportGarden(): Promise<GardenExport> {
  return client.get<GardenExport>('/plants/export')
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function downloadGardenExport() {
  const data = await exportGarden()
  const date = new Date().toISOString().slice(0, 10)
  downloadJson(data, `plantory-garden-${date}.json`)
}

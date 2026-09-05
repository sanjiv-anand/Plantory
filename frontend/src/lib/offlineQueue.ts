const DB_NAME = 'plantory-offline'
const STORE = 'pending-entries'
const DB_VERSION = 1

export type PendingEntry = {
  id: string
  plantId: string
  formData: Record<string, string | Blob>
  createdAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function queueEntry(entry: PendingEntry) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function listPendingEntries(): Promise<PendingEntry[]> {
  const db = await openDb()
  const items = await new Promise<PendingEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).getAll()
    request.onsuccess = () => resolve(request.result as PendingEntry[])
    request.onerror = () => reject(request.error)
  })
  db.close()
  return items
}

export async function removePendingEntry(id: string) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export function pendingEntryToFormData(entry: PendingEntry): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(entry.formData)) {
    if (value instanceof Blob) form.set(key, value)
    else form.set(key, value)
  }
  return form
}

export async function syncPendingEntries(
  upload: (plantId: string, form: FormData) => Promise<unknown>,
): Promise<number> {
  const pending = await listPendingEntries()
  let synced = 0
  for (const entry of pending) {
    try {
      await upload(entry.plantId, pendingEntryToFormData(entry))
      await removePendingEntry(entry.id)
      synced += 1
    } catch {
      break
    }
  }
  return synced
}

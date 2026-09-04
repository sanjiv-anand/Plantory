import { Brain, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  useAIMemories,
  useDeleteAIMemory,
  useForgetAIMemories,
  usePlants,
  useRebuildAIMemories,
  useUpdateAIMemory,
  type AIMemory,
} from '../hooks/useApi'

export function AIMemorySettings() {
  const { data: memories = [], isLoading } = useAIMemories()
  const { data: plants = [] } = usePlants()
  const forgetAll = useForgetAIMemories()
  const rebuild = useRebuildAIMemories()
  const updateMemory = useUpdateAIMemory()
  const deleteMemory = useDeleteAIMemory()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirmForget, setConfirmForget] = useState(false)

  const plantNames = useMemo(
    () => Object.fromEntries(plants.map((plant) => [plant.id, plant.name])),
    [plants],
  )

  const grouped = useMemo(() => {
    const plantMemories: AIMemory[] = []
    const globalMemories: AIMemory[] = []
    for (const memory of memories) {
      if (memory.plant_id) plantMemories.push(memory)
      else globalMemories.push(memory)
    }
    return { plantMemories, globalMemories }
  }, [memories])

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2500)
  }

  async function onSaveEdit(memoryId: number) {
    if (!editText.trim()) return
    await updateMemory.mutateAsync({ memoryId, content: editText.trim() })
    setEditingId(null)
    setEditText('')
    showFeedback('Memory updated.')
  }

  async function onForgetAll() {
    if (!confirmForget) {
      setConfirmForget(true)
      return
    }
    const result = await forgetAll.mutateAsync()
    setConfirmForget(false)
    showFeedback(`Forgot ${result.deleted} memor${result.deleted === 1 ? 'y' : 'ies'}.`)
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>AI Memory</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Things LilyLog remembers to personalize your assistant.
          </p>
        </div>
      </div>

      <p className="mb-4 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
        {isLoading ? 'Loading memories...' : `${memories.length} stored memor${memories.length === 1 ? 'y' : 'ies'}. Journal entries remain the source of truth.`}
      </p>

      {grouped.plantMemories.length > 0 && (
        <MemoryGroup
          deleteMemory={deleteMemory}
          editingId={editingId}
          editText={editText}
          label="Plant memories"
          memories={grouped.plantMemories}
          onCancelEdit={() => setEditingId(null)}
          onDelete={(id) => void deleteMemory.mutateAsync(id).then(() => showFeedback('Memory deleted.'))}
          onSaveEdit={(id) => void onSaveEdit(id)}
          onStartEdit={(memory) => {
            setEditingId(memory.id)
            setEditText(memory.content)
          }}
          plantNames={plantNames}
          setEditText={setEditText}
        />
      )}

      {grouped.globalMemories.length > 0 && (
        <MemoryGroup
          deleteMemory={deleteMemory}
          editingId={editingId}
          editText={editText}
          label="Preferences"
          memories={grouped.globalMemories}
          onCancelEdit={() => setEditingId(null)}
          onDelete={(id) => void deleteMemory.mutateAsync(id).then(() => showFeedback('Memory deleted.'))}
          onSaveEdit={(id) => void onSaveEdit(id)}
          onStartEdit={(memory) => {
            setEditingId(memory.id)
            setEditText(memory.content)
          }}
          plantNames={plantNames}
          setEditText={setEditText}
        />
      )}

      {!isLoading && memories.length === 0 && (
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          No memories yet. They are created from plant metadata, milestones, and journal entries.
        </p>
      )}

      <div className="mt-4 grid gap-2">
        <button
          className="btn-secondary w-full"
          disabled={rebuild.isPending}
          onClick={() => void rebuild.mutateAsync(undefined).then((result) => showFeedback(`Rebuilt ${result.created} memories.`))}
          type="button"
        >
          {rebuild.isPending ? 'Rebuilding...' : 'Rebuild AI memories'}
        </button>
        <button
          className="btn-secondary w-full text-red-600 dark:text-red-400"
          disabled={forgetAll.isPending || memories.length === 0}
          onClick={() => void onForgetAll()}
          type="button"
        >
          {confirmForget ? 'Tap again to forget everything' : 'Forget everything'}
        </button>
      </div>

      {feedback && (
        <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{feedback}</p>
      )}
    </section>
  )
}

type MemoryGroupProps = {
  label: string
  memories: AIMemory[]
  plantNames: Record<number, string>
  editingId: number | null
  editText: string
  setEditText: (value: string) => void
  onStartEdit: (memory: AIMemory) => void
  onSaveEdit: (memoryId: number) => void
  onCancelEdit: () => void
  onDelete: (memoryId: number) => void
  deleteMemory: ReturnType<typeof useDeleteAIMemory>
}

function MemoryGroup({
  label,
  memories,
  plantNames,
  editingId,
  editText,
  setEditText,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  deleteMemory,
}: MemoryGroupProps) {
  return (
    <div className="mb-4">
      <p className="label mb-2">{label}</p>
      <ul className="space-y-2">
        {memories.map((memory) => (
          <li key={memory.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {memory.plant_id && (
              <p className="mb-1 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                {plantNames[memory.plant_id] ?? memory.plant_name ?? `Plant #${memory.plant_id}`}
              </p>
            )}
            {editingId === memory.id ? (
              <div className="space-y-2">
                <textarea
                  className="input min-h-[72px] w-full text-sm"
                  onChange={(event) => setEditText(event.target.value)}
                  value={editText}
                />
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 py-2 text-sm" onClick={() => onSaveEdit(memory.id)} type="button">Save</button>
                  <button className="btn-secondary flex-1 py-2 text-sm" onClick={onCancelEdit} type="button">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>{memory.content}</p>
                {memory.source_type === 'JOURNAL_ENTRY' && memory.source_id && memory.plant_id && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Link className="underline" to={`/plants/${memory.plant_id}`}>
                      View source journal
                    </Link>
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    aria-label="Edit memory"
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => onStartEdit(memory)}
                    type="button"
                  >
                    <Pencil className="mr-1 inline h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    aria-label="Delete memory"
                    className="btn-ghost px-2 py-1 text-xs text-red-600 dark:text-red-400"
                    disabled={deleteMemory.isPending}
                    onClick={() => onDelete(memory.id)}
                    type="button"
                  >
                    <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

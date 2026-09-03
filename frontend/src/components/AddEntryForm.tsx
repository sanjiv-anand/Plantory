import { format } from 'date-fns'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import { useCreateEntry } from '../hooks/useApi'

type Props = {
  plantId: string
}

const nowLocal = () => format(new Date(), "yyyy-MM-dd'T'HH:mm")

export function AddEntryForm({ plantId }: Props) {
  const createEntry = useCreateEntry(plantId)
  const [file, setFile] = useState<File>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState({
    captured_local: nowLocal(),
    title: '',
    memory: '',
    observation: '',
    height_cm: '',
    leaf_count: '',
    flower_count: '',
    watering_done: false,
    fertilized: false,
    tags: '',
  })

  const disabled = useMemo(() => createEntry.isPending || !file, [createEntry.isPending, file])

  useEffect(() => {
    if (!file || !canvasRef.current) {
      return
    }
    let isCancelled = false
    createImageBitmap(file)
      .then((bitmap) => {
        if (isCancelled || !canvasRef.current) return
        const canvas = canvasRef.current
        const maxWidth = 900
        const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
        canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
      })
      .catch(() => {
        if (!canvasRef.current) return
        const ctx = canvasRef.current.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      })
    return () => {
      isCancelled = true
    }
  }, [file])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    const form = new FormData()
    form.set('photo', file)
    form.set('captured_at', new Date(state.captured_local).toISOString())
    form.set('title', state.title)
    form.set('memory', state.memory)
    form.set('observation', state.observation)
    form.set('height_cm', state.height_cm)
    form.set('leaf_count', state.leaf_count)
    form.set('flower_count', state.flower_count)
    form.set('watering_done', String(state.watering_done))
    form.set('fertilized', String(state.fertilized))
    form.set('tags', state.tags)

    await createEntry.mutateAsync(form)
    setFile(undefined)
    setState({
      captured_local: nowLocal(),
      title: '',
      memory: '',
      observation: '',
      height_cm: '',
      leaf_count: '',
      flower_count: '',
      watering_done: false,
      fertilized: false,
      tags: '',
    })
  }

  return (
    <section className="card p-4">
      <h3 className="mb-3 text-lg font-semibold">+ Add today&apos;s entry</h3>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          onChange={(event) => {
            const picked = event.target.files?.[0]
            setFile(picked)
          }}
          required
        />
        {file && <canvas ref={canvasRef} className="w-full rounded-xl bg-slate-900/60" aria-label="Photo preview" />}
        <input className="input" type="datetime-local" value={state.captured_local} onChange={(e) => setState((s) => ({ ...s, captured_local: e.target.value }))} />
        <input className="input" placeholder="Optional title" value={state.title} onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))} />
        <textarea className="input min-h-20" placeholder="Memory / journal" value={state.memory} onChange={(e) => setState((s) => ({ ...s, memory: e.target.value }))} />
        <textarea className="input min-h-20" placeholder="Observation" value={state.observation} onChange={(e) => setState((s) => ({ ...s, observation: e.target.value }))} />
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="Height cm" value={state.height_cm} onChange={(e) => setState((s) => ({ ...s, height_cm: e.target.value }))} />
          <input className="input" placeholder="Leaves" value={state.leaf_count} onChange={(e) => setState((s) => ({ ...s, leaf_count: e.target.value }))} />
          <input className="input" placeholder="Flowers" value={state.flower_count} onChange={(e) => setState((s) => ({ ...s, flower_count: e.target.value }))} />
        </div>
        <input className="input" placeholder="Tags (comma separated)" value={state.tags} onChange={(e) => setState((s) => ({ ...s, tags: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={state.watering_done} onChange={(e) => setState((s) => ({ ...s, watering_done: e.target.checked }))} />
          Watered today
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={state.fertilized} onChange={(e) => setState((s) => ({ ...s, fertilized: e.target.checked }))} />
          Fertilized today
        </label>
        <button className="btn-primary w-full" disabled={disabled}>
          {createEntry.isPending ? 'Saving...' : 'Save entry'}
        </button>
      </form>
    </section>
  )
}

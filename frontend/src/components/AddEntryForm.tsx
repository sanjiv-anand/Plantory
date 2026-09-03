import { format, isSameDay } from 'date-fns'
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  Flower2,
  ImagePlus,
  Leaf,
  Ruler,
  Sparkles,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import { useCreateEntry, useUpdatePlant } from '../hooks/useApi'
import { api } from '../lib'
import { extractPhotoLocation } from '../lib/exif'
import { queueEntry } from '../lib/offlineQueue'
import type { JournalEntry } from '../types'

type Props = {
  plantId: string
  plantName: string
  entries?: JournalEntry[]
  hasCoordinates?: boolean
}

const nowLocal = () => format(new Date(), "yyyy-MM-dd'T'HH:mm")

export function AddEntryForm({ plantId, plantName, entries = [], hasCoordinates = true }: Props) {
  const createEntry = useCreateEntry(plantId)
  const updatePlant = useUpdatePlant(plantId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [file, setFile] = useState<File>()
  const [exifNotice, setExifNotice] = useState<string | null>(null)
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null)
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

  const todayEntry = useMemo(
    () => entries.find((entry) => isSameDay(new Date(entry.captured_at), new Date())),
    [entries],
  )

  const disabled = useMemo(() => createEntry.isPending || !file, [createEntry.isPending, file])

  useEffect(() => {
    if (!file || !canvasRef.current) return
    let isCancelled = false
    createImageBitmap(file)
      .then((bitmap) => {
        if (isCancelled || !canvasRef.current) return
        const canvas = canvasRef.current
        const maxWidth = 1080
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

  async function handleFileSelected(selected?: File) {
    if (!selected) return
    setFile(selected)
    setExifNotice(null)
    if (!hasCoordinates) {
      const location = await extractPhotoLocation(selected)
      if (location) {
        await updatePlant.mutateAsync({
          latitude: Number(location.latitude.toFixed(5)),
          longitude: Number(location.longitude.toFixed(5)),
        })
        setExifNotice('Location saved from photo GPS data.')
      }
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    const form = new FormData()
    form.set('photo', file)
    form.set('captured_at', new Date(state.captured_local).toISOString())
    form.set('watering_done', String(state.watering_done))
    form.set('fertilized', String(state.fertilized))
    if (state.title.trim()) form.set('title', state.title.trim())
    if (state.memory.trim()) form.set('memory', state.memory.trim())
    if (state.observation.trim()) form.set('observation', state.observation.trim())
    if (state.height_cm.trim()) form.set('height_cm', state.height_cm.trim())
    if (state.leaf_count.trim()) form.set('leaf_count', state.leaf_count.trim())
    if (state.flower_count.trim()) form.set('flower_count', state.flower_count.trim())
    if (state.tags.trim()) form.set('tags', state.tags.trim())

    if (!navigator.onLine) {
      const record: Record<string, string | Blob> = {}
      form.forEach((value, key) => {
        record[key] = value
      })
      await queueEntry({
        id: crypto.randomUUID(),
        plantId,
        formData: record,
        createdAt: new Date().toISOString(),
      })
      setOfflineNotice('Saved offline. Will sync when you are back online.')
      setFile(undefined)
      setShowComposer(false)
      setShowDetails(false)
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
      return
    }

    try {
      await createEntry.mutateAsync(form)
    } catch {
      return
    }
    setOfflineNotice(null)
    setFile(undefined)
    setShowComposer(false)
    setShowDetails(false)
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

  if (todayEntry && !showComposer) {
    return (
      <section className="journal-card overflow-hidden">
        <div className="journal-photo-frame">
          <img
            src={`${api.MEDIA_URL}${todayEntry.display_path}`}
            alt={todayEntry.title ?? `${plantName} today`}
            className="journal-photo"
          />
          <div className="journal-photo-badge">
            <CheckCircle2 className="h-4 w-4" />
            Logged today
          </div>
        </div>

        <div className="journal-body">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="label">Today&apos;s journal</p>
              <h2 className="journal-title">{plantName}</h2>
              <p className="journal-subtitle">{format(new Date(todayEntry.captured_at), 'EEEE · p')}</p>
            </div>
          </div>

          {todayEntry.memory && <p className="journal-note-preview">{todayEntry.memory}</p>}

          <div className="journal-care-row">
            {todayEntry.watering_done && <CareTile icon={Droplets} label="Watered" active />}
            {todayEntry.fertilized && <CareTile icon={Sparkles} label="Fed" active />}
            {!todayEntry.watering_done && !todayEntry.fertilized && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No care actions logged today.
              </p>
            )}
          </div>

          <button className="btn-secondary mt-5 w-full" onClick={() => setShowComposer(true)} type="button">
            <ImagePlus className="mr-2 h-4 w-4" />
            Add another photo today
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="journal-card overflow-hidden">
      <form onSubmit={onSubmit}>
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          onChange={(event) => void handleFileSelected(event.target.files?.[0])}
        />

        {!file ? (
          <button className="journal-upload-hero w-full" onClick={() => fileInputRef.current?.click()} type="button">
            <div className="journal-upload-icon">
              <Camera className="h-7 w-7" />
            </div>
            <p className="journal-upload-title">Capture today&apos;s moment</p>
            <p className="journal-upload-copy">Tap to take a photo or choose from your gallery.</p>
          </button>
        ) : (
          <div className="journal-photo-frame relative">
            <canvas ref={canvasRef} className="journal-photo" aria-label="Photo preview" />
            <button
              className="journal-change-photo"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Camera className="h-4 w-4" />
              Retake
            </button>
          </div>
        )}

        <div className="journal-body space-y-5">
          <div>
            <p className="label">Journal note</p>
            <textarea
              className="journal-textarea mt-2"
              placeholder={`What changed with ${plantName} today?`}
              rows={4}
              value={state.memory}
              onChange={(e) => setState((s) => ({ ...s, memory: e.target.value }))}
            />
          </div>

          <div>
            <p className="label mb-3">Care today</p>
            <div className="grid grid-cols-2 gap-2">
              <CareTile
                icon={Droplets}
                label="Watered"
                active={state.watering_done}
                onClick={() => setState((s) => ({ ...s, watering_done: !s.watering_done }))}
              />
              <CareTile
                icon={Sparkles}
                label="Fertilized"
                active={state.fertilized}
                onClick={() => setState((s) => ({ ...s, fertilized: !s.fertilized }))}
              />
            </div>
          </div>

          <button
            className="journal-details-toggle"
            onClick={() => setShowDetails((value) => !value)}
            type="button"
          >
            <span>Growth details</span>
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showDetails && (
            <div className="space-y-3 rounded-[18px] p-4" style={{ background: 'var(--bg-card-inner)' }}>
              <input className="input" type="datetime-local" value={state.captured_local} onChange={(e) => setState((s) => ({ ...s, captured_local: e.target.value }))} />
              <input className="input" placeholder="Optional title" value={state.title} onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))} />
              <textarea className="input min-h-20" placeholder="Observation notes" value={state.observation} onChange={(e) => setState((s) => ({ ...s, observation: e.target.value }))} />
              <div className="grid grid-cols-3 gap-2">
                <MetricField icon={Ruler} label="Height" placeholder="cm" value={state.height_cm} onChange={(value) => setState((s) => ({ ...s, height_cm: value }))} />
                <MetricField icon={Leaf} label="Leaves" placeholder="#" value={state.leaf_count} onChange={(value) => setState((s) => ({ ...s, leaf_count: value }))} />
                <MetricField icon={Flower2} label="Flowers" placeholder="#" value={state.flower_count} onChange={(value) => setState((s) => ({ ...s, flower_count: value }))} />
              </div>
              <input className="input" placeholder="Tags (comma separated)" value={state.tags} onChange={(e) => setState((s) => ({ ...s, tags: e.target.value }))} />
            </div>
          )}
        </div>

        <div className="journal-save-bar space-y-3">
          {exifNotice && <p className="text-sm" style={{ color: 'var(--accent)' }}>{exifNotice}</p>}
          {offlineNotice && <p className="text-sm" style={{ color: 'var(--accent)' }}>{offlineNotice}</p>}
          {createEntry.error && (
            <p className="text-sm text-rose-500">{(createEntry.error as Error).message}</p>
          )}
          <button className="btn-primary w-full py-4 text-base" disabled={disabled} type="submit">
            {createEntry.isPending ? 'Saving entry...' : 'Save journal entry'}
          </button>
        </div>
      </form>
    </section>
  )
}

function CareTile({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Droplets
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      className={['journal-care-tile', active ? 'journal-care-tile-active' : ''].join(' ')}
      onClick={onClick}
      type={onClick ? 'button' : 'button'}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  )
}

function MetricField({
  icon: Icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: typeof Ruler
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="journal-metric">
      <span className="journal-metric-label">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <input className="journal-metric-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

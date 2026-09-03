import { Loader2, MapPin, RefreshCw } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'

import { useCreatePlant } from '../hooks/useApi'
import { CARE_TEMPLATES, findCareTemplate } from '../lib/careTemplates'
import { GeoError, getCurrentPosition, getDeviceTimezone, reverseGeocode } from '../lib/geolocation'

const initialState = {
  name: '',
  species: '',
  variety: '',
  description: '',
  planting_date: '',
  location_name: '',
  latitude: '',
  longitude: '',
  timezone: '',
  pot_size: '',
  pot_material: '',
  soil_mix: '',
  sunlight_description: '',
  watering_notes: '',
  notes: '',
}

type LocationStatus = 'idle' | 'loading' | 'success' | 'error'

type Props = {
  open?: boolean
  alwaysOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddPlantForm({ open: controlledOpen, alwaysOpen = false, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = alwaysOpen || controlledOpen === true ? true : controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [state, setState] = useState(initialState)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [locationError, setLocationError] = useState<string | null>(null)
  const create = useCreatePlant()

  const detectLocation = useCallback(async () => {
    setLocationStatus('loading')
    setLocationError(null)

    try {
      const position = await getCurrentPosition()
      const label = await reverseGeocode(position.latitude, position.longitude).catch(() => null)

      setState((current) => ({
        ...current,
        latitude: position.latitude.toFixed(5),
        longitude: position.longitude.toFixed(5),
        location_name: current.location_name || label || current.location_name,
        timezone: current.timezone || getDeviceTimezone(),
      }))
      setLocationStatus('success')
    } catch (error) {
      setLocationStatus('error')
      if (error instanceof GeoError) {
        setLocationError(error.message)
      } else {
        setLocationError('Unable to detect your location.')
      }
    }
  }, [])

  useEffect(() => {
    if (controlledOpen) setInternalOpen(true)
  }, [controlledOpen])

  useEffect(() => {
    if (!open) return
    void detectLocation()
  }, [open, detectLocation])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await create.mutateAsync({
      ...state,
      latitude: state.latitude ? Number(state.latitude) : null,
      longitude: state.longitude ? Number(state.longitude) : null,
      planting_date: state.planting_date || null,
      timezone: state.timezone || null,
      status: 'ACTIVE',
    })
    setState(initialState)
    setLocationStatus('idle')
    setLocationError(null)
    setOpen(false)
  }

  function applyTemplate(species: string) {
    const template = findCareTemplate(species)
    if (!template) return
    setState((current) => ({
      ...current,
      species: template.species,
      sunlight_description: template.sunlight_description,
      watering_notes: template.watering_notes,
      soil_mix: template.soil_mix,
      pot_size: template.pot_size,
    }))
  }

  if (!open && !alwaysOpen) {
    return (
      <section className="card p-5">
        <button className="btn-secondary w-full" onClick={() => setOpen(true)} type="button">
          + Add plant
        </button>
      </section>
    )
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="label">New plant</p>
          <h3 className="mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Add to your garden
          </h3>
        </div>
        {!alwaysOpen && (
          <button className="btn-ghost px-2 py-2" onClick={() => setOpen(false)} type="button">
            Close
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input required className="input" placeholder="Plant name" value={state.name} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} />
        <input required className="input" placeholder="Species" value={state.species} onChange={(e) => setState((s) => ({ ...s, species: e.target.value }))} />
        <select className="input" onChange={(e) => applyTemplate(e.target.value)} value="">
          <option value="">Apply care template...</option>
          {CARE_TEMPLATES.map((template) => (
            <option key={template.species} value={template.species}>
              {template.species}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Variety" value={state.variety} onChange={(e) => setState((s) => ({ ...s, variety: e.target.value }))} />
        <input className="input" type="date" value={state.planting_date} onChange={(e) => setState((s) => ({ ...s, planting_date: e.target.value }))} />

        <div className="card-inner space-y-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Location
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {locationStatus === 'loading' && 'Detecting your location...'}
                  {locationStatus === 'success' && state.latitude && state.longitude && (
                    <>
                      {Number(state.latitude).toFixed(4)}, {Number(state.longitude).toFixed(4)}
                    </>
                  )}
                  {locationStatus === 'error' && (locationError ?? 'Location unavailable')}
                  {locationStatus === 'idle' && 'Used for weather snapshots on journal entries.'}
                </p>
              </div>
            </div>
            <button
              className="btn-ghost shrink-0 px-2 py-1.5 text-xs"
              disabled={locationStatus === 'loading'}
              onClick={() => void detectLocation()}
              type="button"
            >
              {locationStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                  {locationStatus === 'success' ? 'Refresh' : 'Use location'}
                </>
              )}
            </button>
          </div>
          <input
            className="input"
            placeholder="Location label (e.g. balcony, backyard)"
            value={state.location_name}
            onChange={(e) => setState((s) => ({ ...s, location_name: e.target.value }))}
          />
        </div>
        <textarea className="input min-h-20" placeholder="Notes" value={state.notes} onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))} />
        <button className="btn-primary w-full" disabled={create.isPending}>
          {create.isPending ? 'Saving...' : 'Save plant'}
        </button>
      </form>
    </section>
  )
}

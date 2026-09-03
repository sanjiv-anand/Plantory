import { Loader2, MapPin, RefreshCw, Trash2 } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useDeletePlant, usePlant, useUpdatePlant } from '../hooks/useApi'
import { CARE_TEMPLATES, findCareTemplate } from '../lib/careTemplates'
import { GeoError, getCurrentPosition, getDeviceTimezone, reverseGeocode } from '../lib/geolocation'
import type { Plant } from '../types'

type LocationStatus = 'idle' | 'loading' | 'success' | 'error'

type Props = {
  plantId: string
}

export function EditPlantForm({ plantId }: Props) {
  const navigate = useNavigate()
  const { data: plant } = usePlant(plantId)
  const update = useUpdatePlant(plantId)
  const remove = useDeletePlant()
  const [state, setState] = useState<Partial<Plant> | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (plant && !state) {
      setState({
        name: plant.name,
        species: plant.species,
        variety: plant.variety ?? '',
        description: plant.description ?? '',
        planting_date: plant.planting_date ?? '',
        location_name: plant.location_name ?? '',
        latitude: plant.latitude ?? undefined,
        longitude: plant.longitude ?? undefined,
        timezone: plant.timezone ?? '',
        pot_size: plant.pot_size ?? '',
        pot_material: plant.pot_material ?? '',
        soil_mix: plant.soil_mix ?? '',
        sunlight_description: plant.sunlight_description ?? '',
        watering_notes: plant.watering_notes ?? '',
        notes: plant.notes ?? '',
        status: plant.status,
      })
    }
  }, [plant, state])

  const detectLocation = useCallback(async () => {
    setLocationStatus('loading')
    setLocationError(null)
    try {
      const position = await getCurrentPosition()
      const label = await reverseGeocode(position.latitude, position.longitude).catch(() => null)
      setState((current) =>
        current
          ? {
              ...current,
              latitude: Number(position.latitude.toFixed(5)),
              longitude: Number(position.longitude.toFixed(5)),
              location_name: current.location_name || label || current.location_name,
              timezone: current.timezone || getDeviceTimezone(),
            }
          : current,
      )
      setLocationStatus('success')
    } catch (error) {
      setLocationStatus('error')
      setLocationError(error instanceof GeoError ? error.message : 'Unable to detect location.')
    }
  }, [])

  function applyTemplate(species: string) {
    const template = findCareTemplate(species)
    if (!template || !state) return
    setState({
      ...state,
      species: template.species,
      sunlight_description: template.sunlight_description,
      watering_notes: template.watering_notes,
      soil_mix: template.soil_mix,
      pot_size: template.pot_size,
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!state) return
    await update.mutateAsync({
      ...state,
      variety: state.variety || null,
      description: state.description || null,
      planting_date: state.planting_date || null,
      location_name: state.location_name || null,
      timezone: state.timezone || null,
      pot_size: state.pot_size || null,
      pot_material: state.pot_material || null,
      soil_mix: state.soil_mix || null,
      sunlight_description: state.sunlight_description || null,
      watering_notes: state.watering_notes || null,
      notes: state.notes || null,
    })
    navigate(`/plants/${plantId}`)
  }

  async function onDelete() {
    await remove.mutateAsync(plantId)
    navigate('/plants')
  }

  if (!state) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <input required className="input" placeholder="Plant name" value={state.name ?? ''} onChange={(e) => setState((s) => ({ ...s!, name: e.target.value }))} />
      <input required className="input" placeholder="Species" value={state.species ?? ''} onChange={(e) => setState((s) => ({ ...s!, species: e.target.value }))} />
      <select className="input" onChange={(e) => applyTemplate(e.target.value)} value="">
        <option value="">Apply care template...</option>
        {CARE_TEMPLATES.map((template) => (
          <option key={template.species} value={template.species}>
            {template.species}
          </option>
        ))}
      </select>
      <input className="input" placeholder="Variety" value={state.variety ?? ''} onChange={(e) => setState((s) => ({ ...s!, variety: e.target.value }))} />
      <input className="input" type="date" value={state.planting_date ?? ''} onChange={(e) => setState((s) => ({ ...s!, planting_date: e.target.value }))} />

      <div className="card-inner space-y-2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Location</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {locationStatus === 'loading' && 'Detecting...'}
                {locationStatus === 'success' && state.latitude != null && `${Number(state.latitude).toFixed(4)}, ${Number(state.longitude).toFixed(4)}`}
                {locationStatus === 'error' && (locationError ?? 'Unavailable')}
                {locationStatus === 'idle' && state.latitude != null && `${Number(state.latitude).toFixed(4)}, ${Number(state.longitude).toFixed(4)}`}
                {locationStatus === 'idle' && state.latitude == null && 'No coordinates yet'}
              </p>
            </div>
          </div>
          <button className="btn-ghost shrink-0 px-2 py-1.5 text-xs" disabled={locationStatus === 'loading'} onClick={() => void detectLocation()} type="button">
            {locationStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
        <input className="input" placeholder="Location label" value={state.location_name ?? ''} onChange={(e) => setState((s) => ({ ...s!, location_name: e.target.value }))} />
      </div>

      <textarea className="input min-h-16" placeholder="Sunlight" value={state.sunlight_description ?? ''} onChange={(e) => setState((s) => ({ ...s!, sunlight_description: e.target.value }))} />
      <textarea className="input min-h-16" placeholder="Watering notes" value={state.watering_notes ?? ''} onChange={(e) => setState((s) => ({ ...s!, watering_notes: e.target.value }))} />
      <input className="input" placeholder="Pot size" value={state.pot_size ?? ''} onChange={(e) => setState((s) => ({ ...s!, pot_size: e.target.value }))} />
      <input className="input" placeholder="Pot material" value={state.pot_material ?? ''} onChange={(e) => setState((s) => ({ ...s!, pot_material: e.target.value }))} />
      <textarea className="input min-h-16" placeholder="Soil mix" value={state.soil_mix ?? ''} onChange={(e) => setState((s) => ({ ...s!, soil_mix: e.target.value }))} />
      <textarea className="input min-h-20" placeholder="Notes" value={state.notes ?? ''} onChange={(e) => setState((s) => ({ ...s!, notes: e.target.value }))} />

      <select className="input" value={state.status ?? 'ACTIVE'} onChange={(e) => setState((s) => ({ ...s!, status: e.target.value as Plant['status'] }))}>
        <option value="ACTIVE">Active</option>
        <option value="DORMANT">Dormant</option>
        <option value="ARCHIVED">Archived</option>
      </select>

      <button className="btn-primary w-full" disabled={update.isPending} type="submit">
        {update.isPending ? 'Saving...' : 'Save changes'}
      </button>

      {!confirmDelete ? (
        <button className="btn-secondary w-full text-rose-500" onClick={() => setConfirmDelete(true)} type="button">
          <Trash2 className="mr-2 inline h-4 w-4" />
          Delete plant
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-rose-500">Delete this plant and all entries?</p>
          <button className="btn-primary w-full bg-rose-600" disabled={remove.isPending} onClick={() => void onDelete()} type="button">
            {remove.isPending ? 'Deleting...' : 'Confirm delete'}
          </button>
          <button className="btn-secondary w-full" onClick={() => setConfirmDelete(false)} type="button">
            Cancel
          </button>
        </div>
      )}
    </form>
  )
}

import { type FormEvent, useState } from 'react'

import { useCreatePlant } from '../hooks/useApi'

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

export function AddPlantForm() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState(initialState)
  const create = useCreatePlant()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await create.mutateAsync({
      ...state,
      latitude: state.latitude ? Number(state.latitude) : null,
      longitude: state.longitude ? Number(state.longitude) : null,
      planting_date: state.planting_date || null,
      status: 'ACTIVE',
    })
    setState(initialState)
    setOpen(false)
  }

  return (
    <section className="card p-4">
      <button className="btn-primary w-full" onClick={() => setOpen((v) => !v)} type="button">
        {open ? 'Close' : '+ Add Plant'}
      </button>
      {open && (
        <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3">
          <input required className="input" placeholder="Plant name" value={state.name} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} />
          <input required className="input" placeholder="Species" value={state.species} onChange={(e) => setState((s) => ({ ...s, species: e.target.value }))} />
          <input className="input" placeholder="Variety" value={state.variety} onChange={(e) => setState((s) => ({ ...s, variety: e.target.value }))} />
          <input className="input" type="date" value={state.planting_date} onChange={(e) => setState((s) => ({ ...s, planting_date: e.target.value }))} />
          <input className="input" placeholder="Location" value={state.location_name} onChange={(e) => setState((s) => ({ ...s, location_name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Latitude" value={state.latitude} onChange={(e) => setState((s) => ({ ...s, latitude: e.target.value }))} />
            <input className="input" placeholder="Longitude" value={state.longitude} onChange={(e) => setState((s) => ({ ...s, longitude: e.target.value }))} />
          </div>
          <input className="input" placeholder="Timezone (e.g. Asia/Kolkata)" value={state.timezone} onChange={(e) => setState((s) => ({ ...s, timezone: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Pot size" value={state.pot_size} onChange={(e) => setState((s) => ({ ...s, pot_size: e.target.value }))} />
            <input className="input" placeholder="Pot material" value={state.pot_material} onChange={(e) => setState((s) => ({ ...s, pot_material: e.target.value }))} />
          </div>
          <textarea className="input min-h-20" placeholder="Soil mix" value={state.soil_mix} onChange={(e) => setState((s) => ({ ...s, soil_mix: e.target.value }))} />
          <textarea className="input min-h-20" placeholder="Sunlight notes" value={state.sunlight_description} onChange={(e) => setState((s) => ({ ...s, sunlight_description: e.target.value }))} />
          <textarea className="input min-h-20" placeholder="Watering notes" value={state.watering_notes} onChange={(e) => setState((s) => ({ ...s, watering_notes: e.target.value }))} />
          <textarea className="input min-h-20" placeholder="General notes" value={state.notes} onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))} />
          <button className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Saving...' : 'Save plant'}
          </button>
        </form>
      )}
    </section>
  )
}

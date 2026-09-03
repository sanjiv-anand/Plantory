import { AddPlantForm } from '../components/AddPlantForm'

export function AddPlantPage() {
  return (
    <main className="space-y-4">
      <section className="px-1">
        <p className="label">New plant</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          Add plant
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Keep the form simple now. You can always add more details later.
        </p>
      </section>

      <AddPlantForm alwaysOpen open />
    </main>
  )
}

import { AddPlantForm } from '../components/AddPlantForm'
import { PlantCard } from '../components/PlantCard'
import { usePlants } from '../hooks/useApi'

export function HomePage() {
  const { data: plants, isLoading, error } = usePlants()

  return (
    <main className="space-y-4">
      <AddPlantForm />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your plants</h2>
        {isLoading && <p className="text-sm text-slate-400">Loading plants...</p>}
        {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}
        {plants?.map((plant) => <PlantCard key={plant.id} plant={plant} />)}
        {!plants?.length && !isLoading && <p className="text-sm text-slate-400">No plants yet. Add your first plant above.</p>}
      </section>
    </main>
  )
}

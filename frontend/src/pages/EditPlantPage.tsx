import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { EditPlantForm } from '../components/EditPlantForm'

export function EditPlantPage() {
  const { plantId = '' } = useParams()

  return (
    <main className="space-y-4">
      <div>
        <Link className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }} to={`/plants/${plantId}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to plant
        </Link>
      </div>
      <section className="px-1">
        <p className="label">Edit plant</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          Plant profile
        </h1>
      </section>
      <section className="card p-5">
        <EditPlantForm plantId={plantId} />
      </section>
    </main>
  )
}

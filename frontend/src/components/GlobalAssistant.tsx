import { useEffect, useMemo, useState } from 'react'
import { useLocation, useMatch } from 'react-router-dom'

import { useAssistantContext } from '../context/AssistantContext'
import { usePlant, usePlants } from '../hooks/useApi'
import { PlantAssistant } from './PlantAssistant'

const LAST_PLANT_KEY = 'lilylog-assistant-plant-id'

function readStoredPlantId(): number | null {
  try {
    const raw = sessionStorage.getItem(LAST_PLANT_KEY)
    if (!raw) return null
    const id = Number(raw)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

function storePlantId(plantId: number) {
  try {
    sessionStorage.setItem(LAST_PLANT_KEY, String(plantId))
  } catch {
    // Ignore storage errors.
  }
}

function routePageLabel(pathname: string): string {
  if (pathname === '/') return 'home'
  if (pathname === '/plants') return 'plants'
  if (pathname === '/overview') return 'overview'
  if (pathname === '/map') return 'map'
  if (pathname === '/settings') return 'settings'
  if (pathname === '/add') return 'add-plant'
  if (pathname === '/scan') return 'scan'
  if (pathname.includes('/edit')) return 'plant/edit'
  return pathname.replace(/^\//, '') || 'app'
}

export function GlobalAssistant() {
  const location = useLocation()
  const { pageContext } = useAssistantContext()
  const { data: plants = [] } = usePlants()
  const plantRoute = useMatch('/plants/:plantId')
  const routePlantId = plantRoute?.params.plantId

  const activePlants = useMemo(
    () => plants.filter((plant) => plant.status === 'ACTIVE'),
    [plants],
  )

  const [pickedPlantId, setPickedPlantId] = useState<number | null>(() => readStoredPlantId())

  const resolvedPlantId = useMemo(() => {
    if (pageContext?.plantId) return pageContext.plantId
    if (routePlantId) return Number(routePlantId)
    if (pickedPlantId && plants.some((plant) => plant.id === pickedPlantId)) return pickedPlantId
    return activePlants[0]?.id ?? plants[0]?.id ?? null
  }, [pageContext?.plantId, routePlantId, pickedPlantId, plants, activePlants])

  useEffect(() => {
    if (resolvedPlantId != null) {
      storePlantId(resolvedPlantId)
    }
  }, [resolvedPlantId])

  const { data: plant } = usePlant(resolvedPlantId != null ? String(resolvedPlantId) : undefined)

  const currentPage = pageContext?.currentPage ?? routePageLabel(location.pathname)

  return (
    <PlantAssistant
      currentPage={currentPage}
      journalEntryId={pageContext?.journalEntryId}
      plant={plant ?? null}
      plants={plants}
      selectedDate={pageContext?.selectedDate}
      showPlantPicker={!pageContext?.plantId && !routePlantId && plants.length > 1}
      onPlantChange={(plantId) => {
        setPickedPlantId(plantId)
        storePlantId(plantId)
      }}
    />
  )
}

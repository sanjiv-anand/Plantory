import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { LockScreen } from './components/LockScreen'
import { Layout } from './components/Layout'
import { useAuth } from './context/AuthContext'
import { AddPlantPage } from './pages/AddPlantPage'
import { EditPlantPage } from './pages/EditPlantPage'
import { HomePage } from './pages/HomePage'
import { MapPage } from './pages/MapPage'
import { OverviewPage } from './pages/OverviewPage'
import { PlantPage } from './pages/PlantPage'
import { PlantsPage } from './pages/PlantsPage'
import { ScanPage } from './pages/ScanPage'
import { SettingsPage } from './pages/SettingsPage'

const queryClient = new QueryClient()

function AppRoutes() {
  const { status, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center">
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    )
  }

  if (!status?.authenticated) {
    return <LockScreen />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/plants" element={<PlantsPage />} />
        <Route path="/add" element={<AddPlantPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/plants/:plantId" element={<PlantPage />} />
        <Route path="/plants/:plantId/edit" element={<EditPlantPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

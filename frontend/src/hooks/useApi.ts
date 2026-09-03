import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import { client } from '../lib'
import type { JournalEntry, Plant, PlantEvent } from '../types'

export function usePlants() {
  return useQuery({
    queryKey: ['plants'],
    queryFn: () => client.get<Plant[]>('/plants'),
  })
}

export function usePlant(plantId?: string) {
  return useQuery({
    queryKey: ['plant', plantId],
    enabled: !!plantId,
    queryFn: () => client.get<Plant>(`/plants/${plantId}`),
  })
}

export function useEntries(plantId?: string) {
  return useQuery({
    queryKey: ['entries', plantId],
    enabled: !!plantId,
    queryFn: () => client.get<JournalEntry[]>(`/plants/${plantId}/entries`),
  })
}

export function useAllEntries(plantIds: number[]) {
  return useQueries({
    queries: plantIds.map((id) => ({
      queryKey: ['entries', String(id)],
      queryFn: () => client.get<JournalEntry[]>(`/plants/${id}/entries`),
      staleTime: 60_000,
    })),
  })
}

export function useEvents(plantId?: string) {
  return useQuery({
    queryKey: ['events', plantId],
    enabled: !!plantId,
    queryFn: () => client.get<PlantEvent[]>(`/plants/${plantId}/events`),
  })
}

export function useWeatherForecast(latitude?: number | null, longitude?: number | null) {
  return useQuery({
    queryKey: ['weather-forecast', latitude, longitude],
    enabled: latitude != null && longitude != null,
    queryFn: () =>
      client.get<{ days: ForecastDay[]; alerts: WeatherAlert[] }>(
        `/weather/forecast?latitude=${latitude}&longitude=${longitude}`,
      ),
    staleTime: 30 * 60_000,
  })
}

export type ForecastDay = {
  date: string
  temp_max: number | null
  temp_min: number | null
  precipitation: number | null
  weather_code: number | null
  sunrise: string | null
  sunset: string | null
}

export type WeatherAlert = {
  type: 'frost' | 'heat'
  severity: string
  date: string
  message: string
}

export function useCreateEvent(plantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Pick<PlantEvent, 'event_type' | 'event_date' | 'title' | 'description'>) =>
      client.post<PlantEvent>(`/plants/${plantId}/events`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', plantId] })
      qc.invalidateQueries({ queryKey: ['plants'] })
    },
  })
}

export function useCreatePlant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Plant>) => client.post<Plant>('/plants', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plants'] }),
  })
}

export function useUpdatePlant(plantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Plant>) => client.patch<Plant>(`/plants/${plantId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plants'] })
      qc.invalidateQueries({ queryKey: ['plant', plantId] })
    },
  })
}

export function useDeletePlant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (plantId: string) => client.del(`/plants/${plantId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plants'] }),
  })
}

export function useCreateEntry(plantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (form: FormData) => client.postForm<JournalEntry>(`/plants/${plantId}/entries`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries', plantId] })
      qc.invalidateQueries({ queryKey: ['plants'] })
    },
  })
}

export function useDeleteEntry(plantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId: number) => client.del(`/plants/${plantId}/entries/${entryId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries', plantId] }),
  })
}

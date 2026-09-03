import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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

export function useEvents(plantId?: string) {
  return useQuery({
    queryKey: ['events', plantId],
    enabled: !!plantId,
    queryFn: () => client.get<PlantEvent[]>(`/plants/${plantId}/events`),
  })
}

export function useCreatePlant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Plant>) => client.post<Plant>('/plants', body),
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

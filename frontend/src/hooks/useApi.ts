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

export type AIStatus = {
  online: boolean
  assistant_enabled: boolean
  daily_summary_enabled: boolean
  story_enabled: boolean
  model: string
  runtime: string
  privacy: string
  max_tokens: number
  temperature: number
}

export type AssistantChatResult = {
  conversation_id?: string
  message?: string
  context_used?: string[]
  actions_applied?: AssistantLogAction[]
  error?: string
  detail?: string
}

export type AssistantLogAction = {
  entry_id: number
  date: string
  field: string
  value: string
  created: boolean
  summary: string
}

export type AIMemory = {
  id: number
  plant_id: number | null
  plant_name: string | null
  memory_type: string
  content: string
  source_type: string
  source_id: number | null
  importance: number
  confidence: string
  auto_generated: boolean
  created_at: string
  updated_at: string
}

export type AssistantContext = {
  sections: string[]
  plant_name?: string
  memory_count: number
  journal_count: number
  event_count: number
  contradictions: string[]
  preview: string
}

export type AssistantStoryResult = {
  story?: string
  cached?: boolean
  generated_at?: string
  message?: string
  error?: string
  detail?: string
}

export function useAIStatus() {
  return useQuery({
    queryKey: ['ai-status'],
    queryFn: () => client.get<AIStatus>('/ai/status'),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useUpdateAISettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Pick<AIStatus, 'assistant_enabled' | 'daily_summary_enabled' | 'story_enabled' | 'max_tokens' | 'temperature'>>) =>
      client.patch<AIStatus>('/ai/settings', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-status'] }),
  })
}

export function useAITest() {
  return useMutation({
    mutationFn: () => client.post<{ ok?: boolean; message?: string; error?: string; detail?: string }>('/ai/test', {}),
  })
}

export function useAssistantChat(plantId: number) {
  return useMutation({
    mutationFn: (body: {
      message: string
      conversation_id?: string
      history?: Array<{ role: string; content: string }>
      journal_entry_id?: number
      current_page?: string
    }) => client.post<AssistantChatResult>(`/plants/${plantId}/assistant/chat`, body),
  })
}

export function useAssistantStory(plantId: number) {
  return useMutation({
    mutationFn: () => client.post<AssistantStoryResult>(`/plants/${plantId}/assistant/story`, {}),
  })
}

export function useAssistantSummary(plantId: number) {
  return useMutation({
    mutationFn: (body?: { date?: string }) =>
      client.post<{ summary?: string; date?: string; error?: string; detail?: string }>(
        `/plants/${plantId}/assistant/summary`,
        body ?? {},
      ),
  })
}

export function useAIMemories(plantId?: number) {
  const query = plantId != null ? `?plant_id=${plantId}` : ''
  return useQuery({
    queryKey: ['ai-memories', plantId ?? 'all'],
    queryFn: () => client.get<AIMemory[]>(`/ai/memory${query}`),
    staleTime: 30_000,
  })
}

export function useCreateAIMemory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { content: string; memory_type?: string; plant_id?: number; importance?: number }) =>
      client.post<AIMemory>('/ai/memory', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-memories'] }),
  })
}

export function useUpdateAIMemory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memoryId, ...body }: { memoryId: number; content?: string; importance?: number }) =>
      client.patch<AIMemory>(`/ai/memory/${memoryId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-memories'] }),
  })
}

export function useDeleteAIMemory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memoryId: number) => client.del(`/ai/memory/${memoryId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-memories'] }),
  })
}

export type MemoryForgetResult = {
  deleted: number
}

export function useForgetAIMemories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => client.del<MemoryForgetResult>('/ai/memory'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-memories'] }),
  })
}

export function useRebuildAIMemories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (plantId?: number) =>
      client.post<{ cleared: number; created: number }>(
        `/ai/memory/rebuild${plantId != null ? `?plant_id=${plantId}` : ''}`,
        {},
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-memories'] }),
  })
}

export function useAssistantContext(plantId: number, params?: { query?: string; journal_entry_id?: number; current_page?: string }) {
  const search = new URLSearchParams()
  if (params?.query) search.set('query', params.query)
  if (params?.journal_entry_id) search.set('journal_entry_id', String(params.journal_entry_id))
  if (params?.current_page) search.set('current_page', params.current_page)
  const qs = search.toString()
  return useQuery({
    queryKey: ['assistant-context', plantId, params],
    queryFn: () => client.get<AssistantContext>(`/plants/${plantId}/assistant/context${qs ? `?${qs}` : ''}`),
    enabled: plantId > 0,
    staleTime: 15_000,
  })
}

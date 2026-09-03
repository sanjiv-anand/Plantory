export type Plant = {
  id: number
  name: string
  species: string
  variety?: string | null
  description?: string | null
  planting_date?: string | null
  location_name?: string | null
  latitude?: number | null
  longitude?: number | null
  timezone?: string | null
  pot_size?: string | null
  pot_material?: string | null
  soil_mix?: string | null
  sunlight_description?: string | null
  watering_notes?: string | null
  notes?: string | null
  status: 'ACTIVE' | 'DORMANT' | 'ARCHIVED'
  cover_photo_id?: number | null
  created_at: string
  updated_at: string
}

export type WeatherSnapshot = {
  id: number
  journal_entry_id: number
  timestamp: string
  temperature?: number | null
  apparent_temperature?: number | null
  humidity?: number | null
  precipitation?: number | null
  precipitation_probability?: number | null
  wind_speed?: number | null
  uv_index?: number | null
  cloud_cover?: number | null
  weather_code?: number | null
  sunrise?: string | null
  sunset?: string | null
  soil_temperature?: number | null
  soil_moisture?: number | null
  evapotranspiration?: number | null
}

export type JournalEntry = {
  id: number
  plant_id: number
  captured_at: string
  photo_path: string
  display_path: string
  thumbnail_path: string
  original_filename?: string | null
  title?: string | null
  memory?: string | null
  observation?: string | null
  height_cm?: number | null
  leaf_count?: number | null
  flower_count?: number | null
  watering_done: boolean
  fertilized: boolean
  tags?: string[] | null
  created_at: string
  updated_at: string
  weather_snapshot?: WeatherSnapshot | null
}

export type PlantEvent = {
  id: number
  plant_id: number
  event_type:
    | 'PLANTED'
    | 'SPROUTED'
    | 'FIRST_LEAF'
    | 'REPOTTED'
    | 'WATERED'
    | 'FERTILIZED'
    | 'BUD_FORMED'
    | 'FIRST_FLOWER'
    | 'FLOWERING'
    | 'DORMANT'
    | 'OTHER'
  event_date: string
  title: string
  description?: string | null
  event_metadata?: Record<string, unknown> | null
  created_at: string
}

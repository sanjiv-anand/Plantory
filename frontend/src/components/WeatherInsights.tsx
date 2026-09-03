import { format } from 'date-fns'
import { CloudRain, Droplets, Sun, Thermometer } from 'lucide-react'

import type { JournalEntry } from '../types'

export function WeatherInsights({ entries }: { entries: JournalEntry[] }) {
  const withWeather = entries.filter((entry) => entry.weather_snapshot)
  const rainy = withWeather.filter((entry) => (entry.weather_snapshot?.precipitation ?? 0) > 0)
  const hot = withWeather.filter((entry) => (entry.weather_snapshot?.temperature ?? 0) >= 28)
  const humid = withWeather.filter((entry) => (entry.weather_snapshot?.humidity ?? 0) >= 70)

  const latest = withWeather[0]?.weather_snapshot

  return (
    <section className="card p-5">
      <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Weather insights
      </h3>
      {!withWeather.length ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Add plant coordinates to capture weather with each journal entry.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <InsightChip icon={CloudRain} label="Rainy entries" value={rainy.length} />
            <InsightChip icon={Thermometer} label="Hot days (28°C+)" value={hot.length} />
            <InsightChip icon={Droplets} label="Humid entries" value={humid.length} />
            <InsightChip icon={Sun} label="With weather data" value={withWeather.length} />
          </div>

          {latest && (
            <div className="card-inner space-y-2 p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Latest snapshot
              </p>
              <p>
                {latest.temperature != null && `${latest.temperature}°C`}
                {latest.humidity != null && ` · ${latest.humidity}% humidity`}
                {latest.precipitation != null && latest.precipitation > 0 && ` · ${latest.precipitation}mm rain`}
              </p>
              {latest.sunrise && latest.sunset && (
                <SunCareTip sunrise={latest.sunrise} sunset={latest.sunset} />
              )}
            </div>
          )}

          {rainy.length > 0 && (
            <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              {rainy.length} entries were logged on rainy days — growth often slows; check drainage and avoid overwatering.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function SunCareTip({ sunrise, sunset }: { sunrise: string; sunset: string }) {
  const sunriseTime = format(new Date(sunrise), 'p')
  const sunsetTime = format(new Date(sunset), 'p')
  return (
    <p className="leading-6">
      <Sun className="mr-1 inline h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
      Best outdoor care window: after {sunriseTime}, before harsh midday sun. Sunset around {sunsetTime} — move sensitive plants out of direct evening heat if needed.
    </p>
  )
}

function InsightChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CloudRain
  label: string
  value: number
}) {
  return (
    <div className="card-inner px-3 py-3">
      <Icon className="mb-1 h-4 w-4" style={{ color: 'var(--accent)' }} />
      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
    </div>
  )
}

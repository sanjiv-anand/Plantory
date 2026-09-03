import type { JournalEntry } from '../types'

export function WeatherTrend({ entries }: { entries: JournalEntry[] }) {
  const withWeather = entries.filter((entry) => entry.weather_snapshot?.temperature != null)
  const avgTemp =
    withWeather.length > 0
      ? withWeather.reduce((sum, entry) => sum + Number(entry.weather_snapshot?.temperature ?? 0), 0) / withWeather.length
      : null

  const avgHumidity =
    withWeather.length > 0
      ? withWeather.reduce((sum, entry) => sum + Number(entry.weather_snapshot?.humidity ?? 0), 0) / withWeather.length
      : null

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Weather trends
        </h3>
      </div>
      {withWeather.length ? (
        <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>Entries with weather: {withWeather.length}</p>
          <p>Average temperature: {avgTemp?.toFixed(1)}°C</p>
          <p>Average humidity: {avgHumidity?.toFixed(1)}%</p>
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Weather snapshots will appear after entries are added for plants with coordinates.
        </p>
      )}
    </section>
  )
}

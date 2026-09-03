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
    <section className="card p-4">
      <h3 className="mb-2 text-lg font-semibold">Weather trends</h3>
      {withWeather.length ? (
        <div className="space-y-1 text-sm text-slate-300">
          <p>Entries with weather: {withWeather.length}</p>
          <p>Average temperature: {avgTemp?.toFixed(1)}°C</p>
          <p>Average humidity: {avgHumidity?.toFixed(1)}%</p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Weather snapshots will appear after entries are added for plants with coordinates.</p>
      )}
    </section>
  )
}

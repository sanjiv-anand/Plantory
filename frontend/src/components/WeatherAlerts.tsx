import { AlertTriangle, Snowflake, Sun } from 'lucide-react'

import { usePlants, useWeatherForecast, type WeatherAlert } from '../hooks/useApi'

export function WeatherAlerts() {
  const { data: plants = [] } = usePlants()
  const located = plants.filter((plant) => plant.latitude != null && plant.longitude != null)
  const primary = located[0]
  const { data: forecast } = useWeatherForecast(primary?.latitude, primary?.longitude)

  if (!located.length || !forecast?.alerts?.length) return null

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Weather alerts
        </h3>
      </div>
      <div className="space-y-2">
        {forecast.alerts.map((alert) => (
          <AlertRow key={`${alert.type}-${alert.date}`} alert={alert} />
        ))}
      </div>
      {located.length > 1 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Based on {primary?.location_name ?? 'primary plant location'}. {located.length - 1} other plant{located.length > 2 ? 's' : ''} also tracked.
        </p>
      )}
    </section>
  )
}

function AlertRow({ alert }: { alert: WeatherAlert }) {
  const Icon = alert.type === 'frost' ? Snowflake : Sun
  return (
    <div className="card-inner flex items-start gap-3 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        {alert.message}
      </p>
    </div>
  )
}

export type GeoPosition = {
  latitude: number
  longitude: number
}

export type GeoErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

export class GeoError extends Error {
  code: GeoErrorCode

  constructor(code: GeoErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeoError('unsupported', 'Geolocation is not supported on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new GeoError('denied', 'Location permission was denied.'))
          return
        }
        if (error.code === error.TIMEOUT) {
          reject(new GeoError('timeout', 'Location request timed out.'))
          return
        }
        reject(new GeoError('unavailable', 'Unable to detect your location.'))
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    )
  })
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) return null

  const payload = (await response.json()) as {
    address?: {
      neighbourhood?: string
      suburb?: string
      city?: string
      town?: string
      village?: string
      state?: string
      country?: string
    }
    display_name?: string
  }

  const address = payload.address
  if (!address) return payload.display_name ?? null

  const locality = address.neighbourhood || address.suburb || address.city || address.town || address.village
  const region = address.state || address.country
  if (locality && region) return `${locality}, ${region}`
  return payload.display_name ?? null
}

export function getDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

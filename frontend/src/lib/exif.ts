import exifr from 'exifr'

export type ExifLocation = {
  latitude: number
  longitude: number
}

export async function extractPhotoLocation(file: File): Promise<ExifLocation | null> {
  try {
    const gps = await exifr.gps(file)
    if (!gps?.latitude || !gps?.longitude) return null
    return { latitude: gps.latitude, longitude: gps.longitude }
  } catch {
    return null
  }
}

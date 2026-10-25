type Coordinate = [number, number]

export function parseIncidentPosition(latitude: string, longitude: string): Coordinate | null {
  if (!latitude.trim() || !longitude.trim()) return null
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}


import type { Geometry, LineString, Point, Polygon } from 'geojson'
import type { AnyMapFeature, GeometryInputType } from '../types/gis'

export type LngLat = [number, number]
export type LatLng = [number, number]

export function parseCoordinatePairs(raw: string): LngLat[] {
  const parsedPairs = raw
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [lngText, latText] = pair.split(',').map((entry) => entry.trim())
      const lng = Number(lngText)
      const lat = Number(latText)

      if (Number.isNaN(lng) || Number.isNaN(lat)) {
        throw new Error('Tọa độ không hợp lệ. Dùng định dạng lng,lat;lng,lat')
      }

      return [lng, lat] as LngLat
    })

  if (!parsedPairs.length) {
    throw new Error('Cần nhập ít nhất một cặp tọa độ')
  }

  return parsedPairs
}

export function buildGeometry(
  geometryType: GeometryInputType,
  coordinatePairs: LngLat[],
): Geometry {
  if (geometryType === 'Point') {
    return {
      type: 'Point',
      coordinates: coordinatePairs[0],
    } as Point
  }

  if (geometryType === 'LineString') {
    if (coordinatePairs.length < 2) {
      throw new Error('LineString cần tối thiểu 2 điểm')
    }

    return {
      type: 'LineString',
      coordinates: coordinatePairs,
    } as LineString
  }

  if (coordinatePairs.length < 3) {
    throw new Error('Polygon cần tối thiểu 3 điểm')
  }

  const firstPoint = coordinatePairs[0]
  const lastPoint = coordinatePairs[coordinatePairs.length - 1]
  const isClosed = firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1]
  const ring = isClosed ? coordinatePairs : [...coordinatePairs, firstPoint]

  return {
    type: 'Polygon',
    coordinates: [ring],
  } as Polygon
}

function isLngLatCoord(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

function collectGeometryCoords(geometry: Geometry): LngLat[] {
  if (geometry.type === 'Point') {
    return isLngLatCoord(geometry.coordinates) ? [geometry.coordinates] : []
  }

  if (geometry.type === 'MultiPoint') {
    return geometry.coordinates.filter(isLngLatCoord)
  }

  if (geometry.type === 'LineString') {
    return geometry.coordinates.filter(isLngLatCoord)
  }

  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.flat().filter(isLngLatCoord)
  }

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat().filter(isLngLatCoord)
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat(2).filter(isLngLatCoord)
  }

  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap(collectGeometryCoords)
  }

  return []
}

export function getFeatureBounds(
  feature: AnyMapFeature,
): [[number, number], [number, number]] | null {
  const coords = collectGeometryCoords(feature.geometry)

  if (!coords.length) {
    return null
  }

  let minLng = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}

export function getFeatureCenter(feature: AnyMapFeature): LatLng {
  const bounds = getFeatureBounds(feature)

  if (!bounds) {
    return [10.8845, 106.4255]
  }

  const [[minLat, minLng], [maxLat, maxLng]] = bounds

  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2]
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineDistanceKm(start: LngLat, end: LngLat): number {
  const earthRadius = 6371

  const [startLng, startLat] = start
  const [endLng, endLat] = end

  const deltaLat = toRadians(endLat - startLat)
  const deltaLng = toRadians(endLng - startLng)

  const lat1Rad = toRadians(startLat)
  const lat2Rad = toRadians(endLat)

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadius * c
}

export function calculateLineLengthKm(coordinates: LngLat[]): number {
  if (coordinates.length < 2) {
    return 0
  }

  return coordinates.slice(1).reduce((sum, currentCoord, index) => {
    const prevCoord = coordinates[index]
    return sum + haversineDistanceKm(prevCoord, currentCoord)
  }, 0)
}

export function calculateFeatureLineLengthKm(feature: AnyMapFeature): number {
  if (feature.geometry.type === 'LineString') {
    return calculateLineLengthKm(feature.geometry.coordinates as LngLat[])
  }

  if (feature.geometry.type === 'MultiLineString') {
    return feature.geometry.coordinates.reduce((sum, line) => {
      return sum + calculateLineLengthKm(line as LngLat[])
    }, 0)
  }

  return 0
}

import type { Geometry, Position } from 'geojson'

export type FocusPoint = [number, number]

function cross(origin: FocusPoint, a: FocusPoint, b: FocusPoint) {
  return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0])
}

/** Monotone-chain hull; also handles a single point and collinear networks. */
export function convexFocusHull(points: readonly FocusPoint[]): FocusPoint[] {
  const sorted = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .filter((point, index, all) => index === 0 || point[0] !== all[index - 1][0] || point[1] !== all[index - 1][1])
  if (sorted.length < 3) return sorted
  const lower: FocusPoint[] = []
  const upper: FocusPoint[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop()
    lower.push(point)
  }
  for (const point of sorted.toReversed()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop()
    upper.push(point)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** Cacheable geographic hull in Web Mercator, matching Leaflet's street/satellite maps. */
export function geographicFocusHull(features: ReadonlyArray<{ geometry: Geometry | null }>): FocusPoint[] {
  const points: FocusPoint[] = []
  const collectPosition = (position: Position) => {
    const [lng, lat] = position
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) return
    const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180
    points.push([lng, Math.log(Math.tan(Math.PI / 4 + clampedLat / 2)) * 180 / Math.PI])
  }
  const collectGeometry = (geometry: Geometry | null) => {
    if (!geometry) return
    switch (geometry.type) {
      case 'Point': collectPosition(geometry.coordinates); break
      case 'MultiPoint':
      case 'LineString': geometry.coordinates.forEach(collectPosition); break
      case 'MultiLineString':
      case 'Polygon': geometry.coordinates.forEach((line) => line.forEach(collectPosition)); break
      case 'MultiPolygon': geometry.coordinates.forEach((polygon) => polygon.forEach((line) => line.forEach(collectPosition))); break
      case 'GeometryCollection': geometry.geometries.forEach(collectGeometry); break
    }
  }
  features.forEach((feature) => collectGeometry(feature.geometry))
  return convexFocusHull(points).map(([lng, y]) => [lng, (2 * Math.atan(Math.exp(y * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI])
}

/** Screen-space padding keeps the network and its nearby streets sharp at every zoom. */
export function paddedFocusHull(points: readonly FocusPoint[], padding = 64): FocusPoint[] {
  if (!points.length) return []
  const radius = Number.isFinite(padding) ? Math.max(0, padding) : 64
  const expanded: FocusPoint[] = []
  for (const [x, y] of points) {
    for (let step = 0; step < 16; step++) {
      const angle = step * Math.PI / 8
      expanded.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius])
    }
  }
  return convexFocusHull(expanded)
}

/** Even-odd hole: only the surrounding basemap receives the backdrop filter. */
export function geographicFocusMaskPath(width: number, height: number, hull: readonly FocusPoint[]): string | null {
  if (width <= 0 || height <= 0 || hull.length < 3) return null
  const pointPath = hull.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')
  return `path(evenodd, "M-2 -2 H${width + 2} V${height + 2} H-2 Z M${pointPath} Z")`
}

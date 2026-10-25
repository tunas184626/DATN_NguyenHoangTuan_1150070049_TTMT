import { describe, expect, it } from 'vitest'
import { convexFocusHull, geographicFocusHull, geographicFocusMaskPath, paddedFocusHull } from '../../src/utils/mapFocus'

describe('geographic map focus', () => {
  it('follows the actual network hull, excludes interior vertices and handles duplicate coordinates', () => {
    expect(convexFocusHull([[0, 0], [10, 0], [0, 10], [1, 1], [0, 0]])).toEqual([[0, 0], [10, 0], [0, 10]])
    expect(convexFocusHull([[3, 3], [1, 1], [2, 2]])).toEqual([[1, 1], [3, 3]])
  })

  it('collects nested geographic geometries and rejects CAD coordinates or invalid WGS84 values', () => {
    const hull = geographicFocusHull([{ geometry: { type: 'GeometryCollection', geometries: [
      { type: 'MultiPolygon', coordinates: [[[[106, 10], [107, 10], [106, 11], [106, 10]]]] },
      { type: 'MultiPoint', coordinates: [[106.1, 10.1], [569367, 1205504], [Number.NaN, 10], [106, 91]] },
    ] } }])
    expect(hull).toHaveLength(3)
    expect(hull[0][0]).toBe(106)
    expect(hull[0][1]).toBeCloseTo(10)
    expect(hull[2][1]).toBeCloseTo(11)
  })

  it('leaves an empty map unmasked instead of inventing a focus rectangle', () => {
    expect(geographicFocusHull([{ geometry: null }, { geometry: { type: 'MultiPoint', coordinates: [] } }])).toEqual([])
    expect(paddedFocusHull([])).toEqual([])
    expect(geographicFocusMaskPath(800, 600, [])).toBeNull()
  })

  it('uses a padded circle for one point and a capsule for a collinear route', () => {
    const circle = paddedFocusHull([[200, 100]], 60)
    expect(circle).toHaveLength(16)
    expect(Math.min(...circle.map(([x]) => x))).toBe(140)
    expect(Math.max(...circle.map(([, y]) => y))).toBe(160)
    const route = paddedFocusHull([[0, 0], [100, 0]], 20)
    expect(Math.min(...route.map(([x]) => x))).toBe(-20)
    expect(Math.max(...route.map(([x]) => x))).toBe(120)
  })

  it('preserves screen-space padding when the geographic projection zooms or moves', () => {
    const original = paddedFocusHull([[0, 0], [100, 0]], 20)
    const zoomed = paddedFocusHull([[200, 50], [400, 50]], 20)
    expect(Math.min(...original.map(([x]) => x))).toBe(-20)
    expect(Math.min(...zoomed.map(([x]) => x))).toBe(180)
    expect(Math.max(...zoomed.map(([, y]) => y))).toBe(70)
  })

  it('creates an even-odd transparent hole for the network, including hulls outside the viewport', () => {
    const path = geographicFocusMaskPath(800, 600, [[-100, 0], [900, 0], [900, 700], [-100, 700]])
    expect(path).toContain('path(evenodd,')
    expect(path).toContain('H802 V602 H-2 Z')
    expect(path).toContain('M-100.0 0.0')
    expect(geographicFocusMaskPath(0, 600, [[0, 0], [10, 0], [0, 10]])).toBeNull()
  })
})

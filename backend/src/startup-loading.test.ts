import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('../../src/services/apiClient', () => ({ apiGet }))
const empty = { type: 'FeatureCollection', features: [], meta: { total: 0, limit: 200, offset: 0 } }

beforeEach(() => { vi.resetModules(); apiGet.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('startup loading budget and fallback', () => {
  it('shares concurrent initialization and starts incidents alongside all eight asset types', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const pending: Array<() => void> = []
    apiGet.mockImplementation(() => new Promise((resolve) => pending.push(() => resolve(empty))))
    const { loadLayerDataWithFallback } = await import('../../src/data/dataService')
    const first = loadLayerDataWithFallback()
    const second = loadLayerDataWithFallback()
    expect(first).toBe(second)
    expect(apiGet).toHaveBeenCalledTimes(9)
    expect(apiGet.mock.calls[0]![0]).toContain('/incidents?')
    pending.forEach((resolve) => resolve())
    const result = await first
    expect(result.dataSource.mode).toBe('api')
    expect(fetch).not.toHaveBeenCalled()
    expect(result.data.pipelines.features).toHaveLength(0)
  })

  it('falls back directly to WGS84 CAD without downloading demo or raw CAD exports', async () => {
    apiGet.mockRejectedValue(new Error('offline'))
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [106.42, 10.88] }, properties: { id: 'cad-1', type: 'water_plant', name: 'Nhà máy' } }],
    }) })
    vi.stubGlobal('fetch', fetch)
    const { loadLayerDataWithFallback } = await import('../../src/data/dataService')
    const result = await loadLayerDataWithFallback()
    expect(result.dataSource.mode).toBe('cad')
    expect(result.data.waterPlant.features[0]?.properties.id).toBe('cad-1')
    expect(result.data.incidents.features).toHaveLength(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]![0]).toContain('operational-map-wgs84.geojson')
  })

  it('retains successful API assets and reports incident errors without loading fake incidents', async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/incidents')) throw new Error('incident API unavailable')
      return empty
    })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { loadLayerDataWithFallback } = await import('../../src/data/dataService')
    const result = await loadLayerDataWithFallback()
    expect(result.dataSource.mode).toBe('api')
    expect(result.dataSource.layers.incidents.status).toBe('api_error')
    expect(result.data.incidents.features).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('loads demo only after both CAD fallback formats are unavailable', async () => {
    apiGet.mockRejectedValue(new Error('offline'))
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      const isCad = url.includes('cad-vector') || url.includes('biwase')
      return { ok: !isCad, status: isCad ? 404 : 200, json: async () => empty }
    })
    vi.stubGlobal('fetch', fetch)
    const { loadLayerDataWithFallback } = await import('../../src/data/dataService')
    const result = await loadLayerDataWithFallback()
    expect(result.dataSource.mode).toBe('demo')
    expect(fetch.mock.calls.slice(0, 8).every(([url]: [string]) => url.includes('cad-vector') || url.includes('biwase'))).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(14)
  })
})

describe('explicit CAD loading', () => {
  it('does not fetch on module import, and shares one web export across concurrent/repeated calls', async () => {
    const fetch = vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('web-map.geojson')
      ? { type: 'FeatureCollection', features: [{ properties: { id: 'cad-1', sourceGroup: 'irrigation' } }] } : [] }))
    vi.stubGlobal('fetch', fetch)
    const { loadCadVectorData } = await import('../../src/services/cadVectorDataService')
    expect(fetch).not.toHaveBeenCalled()
    const first = loadCadVectorData()
    expect(loadCadVectorData()).toBe(first)
    const result = await first
    expect((await loadCadVectorData()).entities).toBe(result.entities)
    expect(result.hasCadVectorData).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('never downloads the 119 MB raw export automatically when the web export is missing', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    vi.stubGlobal('fetch', fetch)
    const { loadCadVectorData } = await import('../../src/services/cadVectorDataService')
    expect((await loadCadVectorData()).hasCadVectorData).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(fetch.mock.calls.some(([url]: [string]) => url.endsWith('/entities.geojson'))).toBe(false)
    await loadCadVectorData()
    expect(fetch).toHaveBeenCalledTimes(8)
  })
})

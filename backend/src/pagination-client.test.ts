import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssetFeature, AssetType, IncidentFeature } from '../../src/types/gis'
import { apiGet } from '../../src/services/apiClient'
import { loadAllFeaturePages } from '../../src/services/featurePagination'
import { loadOperationsPage, loadOperationsSummary } from '../../src/services/operationsService'
import { loadApiIncidents, loadLayerDataWithFallback } from '../../src/data/dataService'

vi.mock('../../src/services/apiClient', () => ({ apiGet: vi.fn() }))
const emptyCollection = { type: 'FeatureCollection', features: [] }
const assetTypes: AssetType[] = ['water_plant', 'raw_water_lake', 'pipeline', 'canal', 'supply_zone', 'boundary', 'label', 'pending_data']

function asset(type: AssetType): AssetFeature {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [106.42, 10.88] }, properties: {
    id: type, name: type, type, status: 'active', description: '', address: '', notes: [], lastUpdated: '2026-10-13', version: 1,
  } }
}
function incident(index: number): IncidentFeature {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [106.42, 10.88] }, properties: {
    id: `INC-${index}`, name: 'Sự cố', type: 'incident', status: 'new', incidentCode: `SC-${index}`, incidentType: 'leak', severity: 'low', reportedDate: '2026-10-13', description: '', address: '', notes: [], lastUpdated: '2026-10-13', version: 1,
  } }
}

beforeEach(() => { vi.mocked(apiGet).mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('management requests and complete bootstrap data', () => {
  it('requests the current server asset page with all filters and uses its total', async () => {
    vi.mocked(apiGet).mockResolvedValue({ ...emptyCollection, features: [asset('raw_water_lake')], meta: { total: 1507, limit: 20, offset: 40 } })
    const controller = new AbortController()
    const page = await loadOperationsPage({ tab: 'assets', page: 3, pageSize: 20, type: 'raw_water_lake', status: 'maintenance', search: ' Hồ ' }, controller.signal)
    const [path, timeout, signal] = vi.mocked(apiGet).mock.calls[0]!
    const url = new URL(String(path), 'http://localhost')
    expect(url.pathname).toBe('/assets')
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: '20', offset: '40', sort: 'name', search: 'Hồ', status: 'maintenance', type: 'raw_water_lake' })
    expect(timeout).toBe(10_000)
    expect(signal).toBe(controller.signal)
    expect(page.meta.total).toBe(1507)
    expect(page.features).toHaveLength(1)
  })

  it('requests server incident pages beyond 200 without sending asset-type filters', async () => {
    vi.mocked(apiGet).mockResolvedValue({ ...emptyCollection, meta: { total: 1207, limit: 20, offset: 240 } })
    await loadOperationsPage({ tab: 'incidents', page: 13, pageSize: 20, type: 'pipeline', status: 'new', search: 'Rò' })
    const url = new URL(String(vi.mocked(apiGet).mock.calls[0]![0]), 'http://localhost')
    expect(url.pathname).toBe('/incidents')
    expect(url.searchParams.get('offset')).toBe('240')
    expect(url.searchParams.get('sort')).toBe('priority')
    expect(url.searchParams.has('type')).toBe(false)
  })

  it('does not substitute loaded row counts when the server omits the total', async () => {
    vi.mocked(apiGet).mockResolvedValue({ ...emptyCollection, features: [asset('pipeline')] })
    await expect(loadOperationsPage({ tab: 'assets', page: 1, pageSize: 20, type: 'all', status: 'all', search: '' })).rejects.toThrow('số tổng')
  })

  it('gets KPI counts through the aggregate endpoint and rejects invalid counts', async () => {
    const summary = { assets: 8400, incidents: 1207, openIncidents: 523, overdueIncidents: 84, highPriorityIncidents: 135, unassignedIncidents: 27, inProgressIncidents: 35, generatedAt: '2026-10-13' }
    vi.mocked(apiGet).mockResolvedValueOnce(summary).mockResolvedValueOnce({ ...summary, assets: -1 })
    expect(await loadOperationsSummary()).toEqual(summary)
    expect(vi.mocked(apiGet).mock.calls[0]![0]).toBe('/operations/summary')
    await expect(loadOperationsSummary()).rejects.toThrow('không hợp lệ')
  })

  it('restores incidents from every API page rather than stopping at 200', async () => {
    const all = Array.from({ length: 451 }, (_, index) => incident(index))
    vi.mocked(apiGet).mockImplementation(async (path) => {
      const offset = Number(new URL(path, 'http://localhost').searchParams.get('offset'))
      return { type: 'FeatureCollection', features: all.slice(offset, offset + 200), meta: { total: all.length, limit: 200, offset } }
    })
    const loaded = await loadApiIncidents()
    expect(loaded.features).toHaveLength(451)
    expect(loaded.features.at(-1)?.properties.id).toBe('INC-450')
    expect(vi.mocked(apiGet).mock.calls.map(([path]) => new URL(path, 'http://localhost').searchParams.get('offset'))).toEqual(['0', '200', '400'])
  })

  it('fails instead of looping forever or silently dropping records on an incomplete page', async () => {
    await expect(loadAllFeaturePages(async () => ({ ...emptyCollection, meta: { total: 200, limit: 200, offset: 0 } }))).rejects.toThrow('chưa trả đủ')
  })

  it('initializes every asset type, merging label and pending-data rows in their shared layer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => emptyCollection }))
    vi.mocked(apiGet).mockImplementation(async (path) => {
      const url = new URL(path, 'http://localhost')
      const type = url.searchParams.get('type') as AssetType | null
      return { type: 'FeatureCollection', features: type ? [asset(type)] : [], meta: { total: type ? 1 : 0, limit: 500, offset: 0 } }
    })
    const loaded = await loadLayerDataWithFallback()
    const requested = vi.mocked(apiGet).mock.calls.map(([path]) => new URL(path, 'http://localhost').searchParams.get('type')).filter(Boolean)
    expect(requested.sort()).toEqual([...assetTypes].sort())
    expect(loaded.data.rawWaterLakes.features[0]?.properties.type).toBe('raw_water_lake')
    expect(loaded.data.canals.features[0]?.properties.type).toBe('canal')
    expect(loaded.data.supplyZones.features[0]?.properties.type).toBe('supply_zone')
    expect(loaded.data.labels.features.map((feature) => feature.properties.type)).toEqual(['label', 'pending_data'])
    expect(loaded.dataSource.mode).toBe('api')
    expect(loaded.dataSource.layers.rawWaterLakes.source).toBe('api')
    expect(fetch).not.toHaveBeenCalled()
  })
})

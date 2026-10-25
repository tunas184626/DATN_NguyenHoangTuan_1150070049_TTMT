import { describe, expect, it } from 'vitest'
import type { AssetFeature, IncidentFeature, LayerDataState } from '../../src/types/gis'
import { clearLocalDrafts, isLocalDraft, isServerFeature, loadLocalDrafts, LOCAL_DRAFTS_KEY, mergeLocalDrafts, saveLocalDraft } from '../../src/services/localDraftStore'

class MemoryStorage {
  values = new Map<string, string>()
  failWrites = false
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError')
    this.values.set(key, value)
  }
  removeItem(key: string) { this.values.delete(key) }
}

function asset(id = 'CAD-1', name = 'Tuyến ống CAD'): AssetFeature {
  return {
    type: 'Feature', geometry: { type: 'LineString', coordinates: [[106.42, 10.88], [106.43, 10.89]] },
    properties: { id, name, type: 'pipeline', status: 'active', description: '', address: '', notes: [], lastUpdated: '2026-10-13', source: 'CAD gốc' },
  }
}

function incident(): IncidentFeature {
  return {
    type: 'Feature', geometry: { type: 'Point', coordinates: [106.42, 10.88] },
    properties: { id: 'INC-local', name: 'Rò rỉ', type: 'incident', status: 'new', incidentCode: 'SC-local', incidentType: 'leak', severity: 'medium', reportedDate: '2026-10-13', description: '', address: '', notes: [], lastUpdated: '2026-10-13' },
  }
}

function layers(): LayerDataState {
  return Object.fromEntries(['waterPlant', 'rawWaterLakes', 'pipelines', 'canals', 'supplyZones', 'boundaries', 'labels', 'incidents']
    .map((key) => [key, { type: 'FeatureCollection', features: [] }])) as unknown as LayerDataState
}

describe('local changes survive refresh over CAD/API data', () => {
  it('never treats a locally versioned incident as a server record after API recovery', () => {
    const storage = new MemoryStorage()
    const local = saveLocalDraft({ ...incident(), properties: { ...incident().properties, version: 4 } }, storage)
    const server = { ...incident(), properties: { ...incident().properties, id: 'server-incident', version: 4 } }
    expect(isServerFeature(local)).toBe(false)
    expect(isServerFeature(loadLocalDrafts(storage)[0]!)).toBe(false)
    expect(isServerFeature(server)).toBe(true)
    expect(isServerFeature(asset())).toBe(false)
  })
  it('restores a new asset and incident together with an edited CAD asset without mutating the source', () => {
    const storage = new MemoryStorage()
    const base = layers()
    base.pipelines.features = [asset()]
    saveLocalDraft(asset('AST-local', 'Ống mới'), storage)
    saveLocalDraft({ ...asset(), properties: { ...asset().properties, name: 'Đã sửa CAD', diameter: 'D300' } }, storage)
    saveLocalDraft(incident(), storage)
    const restored = mergeLocalDrafts(base, loadLocalDrafts(storage))
    expect(restored.pipelines.features.map((feature) => feature.properties.name)).toEqual(['Đã sửa CAD', 'Ống mới'])
    expect(restored.pipelines.features[0]?.properties.diameter).toBe('D300')
    expect(restored.incidents.features[0]?.properties.id).toBe('INC-local')
    expect(base.pipelines.features[0]?.properties.name).toBe('Tuyến ống CAD')
    expect(base.incidents.features).toHaveLength(0)
  })

  it('keeps only the latest incident status, linked assets and comments across repeated saves', () => {
    const storage = new MemoryStorage()
    const created = saveLocalDraft(incident(), storage)
    saveLocalDraft({ ...created, properties: { ...created.properties, status: 'in_progress', notes: ['Đang xử lý'] } }, storage)
    saveLocalDraft({ ...created, properties: { ...created.properties, status: 'resolved', assetIds: ['AST-local'], notes: ['Đã sửa xong'] } }, storage)
    const restored = loadLocalDrafts(storage)
    expect(restored).toHaveLength(1)
    expect(restored[0]?.properties).toMatchObject({ status: 'resolved', localOnly: true, assetIds: ['AST-local'], notes: ['Đã sửa xong'] })
  })

  it('preserves unsynced drafts when API data becomes available or refreshes', () => {
    const storage = new MemoryStorage()
    const draft = saveLocalDraft(incident(), storage)
    const online = layers()
    online.incidents.features = [{ ...incident(), properties: { ...incident().properties, id: 'server-incident', version: 3 } }]
    const recovered = mergeLocalDrafts(online, loadLocalDrafts(storage))
    const refreshed = mergeLocalDrafts(online, loadLocalDrafts(storage))
    expect(recovered.incidents.features).toHaveLength(2)
    expect(refreshed.incidents.features).toHaveLength(2)
    expect(refreshed.incidents.features.find((item) => item.properties.id === draft.properties.id)?.properties.localOnly).toBe(true)
    expect(isLocalDraft(refreshed.incidents.features[0]!)).toBe(false)
  })

  it('does not write unchanged CAD geometries to browser storage', () => {
    const storage = new MemoryStorage()
    const base = layers()
    base.pipelines.features = Array.from({ length: 500 }, (_, index) => asset(`CAD-${index}`))
    saveLocalDraft(asset('AST-local'), storage)
    const restored = mergeLocalDrafts(base, loadLocalDrafts(storage))
    expect(restored.pipelines.features).toHaveLength(501)
    expect(JSON.parse(storage.getItem(LOCAL_DRAFTS_KEY)!).features).toHaveLength(1)
  })

  it('throws when storage is full and keeps the last successfully saved change', () => {
    const storage = new MemoryStorage()
    saveLocalDraft(asset('AST-local', 'Đã lưu'), storage)
    storage.failWrites = true
    expect(() => saveLocalDraft(asset('AST-local', 'Chưa lưu'), storage)).toThrow('Thay đổi chưa được lưu')
    expect(loadLocalDrafts(storage)[0]?.properties.name).toBe('Đã lưu')
  })

  it('keeps the base map readable but rejects saves when browser storage access is blocked', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
    try {
      expect(loadLocalDrafts()).toEqual([])
      expect(() => saveLocalDraft(asset())).toThrow('Thay đổi chưa được lưu')
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  it('recovers valid drafts even when the legacy storage contains invalid JSON', () => {
    const storage = new MemoryStorage()
    storage.setItem('webgis-water-assets-v1', '{invalid')
    saveLocalDraft(asset('AST-local'), storage)
    expect(loadLocalDrafts(storage)).toHaveLength(1)
  })

  it('ignores malformed entries and leaves base CAD data usable', () => {
    const storage = new MemoryStorage()
    storage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify({ version: 1, features: [null, {}, { type: 'Feature', properties: { type: 'unknown' } }] }))
    const base = layers()
    base.pipelines.features = [asset()]
    expect(loadLocalDrafts(storage)).toEqual([])
    expect(mergeLocalDrafts(base, loadLocalDrafts(storage))).toEqual(base)
  })

  it('imports only locally saved legacy objects, and newer changes take precedence', () => {
    const storage = new MemoryStorage()
    const legacy = asset('AST-local', 'Cũ')
    legacy.properties.source = 'Dữ liệu lưu tạm trên thiết bị'
    storage.setItem('webgis-water-assets-v1', JSON.stringify({ pipelines: { type: 'FeatureCollection', features: [legacy, asset()] } }))
    expect(loadLocalDrafts(storage)).toHaveLength(1)
    saveLocalDraft(asset('AST-local', 'Mới'), storage)
    expect(loadLocalDrafts(storage)[0]?.properties.name).toBe('Mới')
  })

  it('clears both draft formats when explicitly resetting demo data', () => {
    const storage = new MemoryStorage()
    saveLocalDraft(asset(), storage)
    storage.setItem('webgis-water-assets-v1', '{}')
    clearLocalDrafts(storage)
    expect(loadLocalDrafts(storage)).toEqual([])
    expect(storage.values.size).toBe(0)
  })
})

import type { AnyMapFeature, LayerDataState, LayerKey } from '../types/gis'
import { assetTypeToLayerKey } from '../utils/asset.ts'

export const LOCAL_DRAFTS_KEY = 'webgis-local-drafts-v1'
const LEGACY_STORAGE_KEY = 'webgis-water-assets-v1'
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const ASSET_TYPES = new Set(['water_plant', 'raw_water_lake', 'pipeline', 'canal', 'supply_zone', 'boundary', 'label', 'pending_data'])

function isFeature(value: unknown): value is AnyMapFeature {
  if (!value || typeof value !== 'object') return false
  const feature = value as Partial<AnyMapFeature>
  const properties = feature.properties
  return feature.type === 'Feature' && Boolean(feature.geometry?.type)
    && typeof properties?.id === 'string' && properties.id.length > 0
    && typeof properties.name === 'string' && typeof properties.status === 'string'
    && Array.isArray(properties.notes)
    && (ASSET_TYPES.has(properties.type) || (properties.type === 'incident' && feature.geometry?.type === 'Point'))
}

export function isLocalDraft(feature: AnyMapFeature): boolean {
  return feature.properties.localOnly === true || Boolean(feature.properties.source?.includes('lưu tạm'))
}

export function isServerFeature(feature: AnyMapFeature): boolean {
  return !isLocalDraft(feature) && typeof feature.properties.version === 'number'
}

function markLocalDraft<T extends AnyMapFeature>(feature: T): T {
  return { ...feature, properties: { ...feature.properties, localOnly: true } } as T
}

function readFeatures(storage: DraftStorage, key: string): AnyMapFeature[] {
  try {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (key === LOCAL_DRAFTS_KEY) {
      return parsed?.version === 1 && Array.isArray(parsed.features) ? parsed.features.filter(isFeature) : []
    }
    // Chỉ khôi phục các đối tượng đã được đánh dấu lưu tạm từ định dạng cũ.
    if (!parsed || typeof parsed !== 'object') return []
    return Object.values(parsed).flatMap((layer) => {
      const features = (layer as { features?: unknown[] } | null)?.features
      return Array.isArray(features) ? features.filter(isFeature).filter(isLocalDraft) : []
    })
  } catch {
    return []
  }
}

export function loadLocalDrafts(storage?: DraftStorage): AnyMapFeature[] {
  try {
    const port = storage ?? localStorage
    const byId = new Map<string, AnyMapFeature>()
    for (const feature of [...readFeatures(port, LEGACY_STORAGE_KEY), ...readFeatures(port, LOCAL_DRAFTS_KEY)]) {
      byId.set(feature.properties.id, markLocalDraft(feature))
    }
    return [...byId.values()]
  } catch {
    // Chặn lưu trữ trên trình duyệt không được làm mất khả năng đọc bản đồ gốc.
    return []
  }
}

export function saveLocalDraft<T extends AnyMapFeature>(feature: T, storage?: DraftStorage): T {
  const draft = markLocalDraft(feature)
  try {
    const port = storage ?? localStorage
    const byId = new Map(loadLocalDrafts(port).map((item) => [item.properties.id, item]))
    byId.set(draft.properties.id, draft)
    port.setItem(LOCAL_DRAFTS_KEY, JSON.stringify({ version: 1, features: [...byId.values()] }))
  } catch {
    throw new Error('Không thể lưu trên thiết bị. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn. Thay đổi chưa được lưu; vui lòng thử lại.')
  }
  return draft
}

export function mergeLocalDrafts(data: LayerDataState, drafts: AnyMapFeature[]): LayerDataState {
  const result = { ...data }
  const groups = new Map<LayerKey, AnyMapFeature[]>()
  for (const feature of drafts) {
    const key = feature.properties.type === 'incident' ? 'incidents' : assetTypeToLayerKey(feature.properties.type)
    const group = groups.get(key) ?? []
    group.push(feature)
    groups.set(key, group)
  }
  for (const [key, features] of groups) {
    const byId = new Map<string, AnyMapFeature>(data[key].features.map((feature) => [feature.properties.id, feature]))
    for (const feature of features) byId.set(feature.properties.id, feature)
    result[key] = { ...data[key], features: [...byId.values()] } as never
  }
  return result
}

export function clearLocalDrafts(storage: DraftStorage = localStorage): void {
  storage.removeItem(LOCAL_DRAFTS_KEY)
  storage.removeItem(LEGACY_STORAGE_KEY)
}

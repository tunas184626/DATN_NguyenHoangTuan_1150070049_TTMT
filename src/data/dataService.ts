import { loadAllFeaturePages } from '../services/featurePagination'
import type { FeaturePage } from '../types/operations'
import type { Geometry } from 'geojson'
import type {
  AssetCollection,
  AssetFeature,
  AssetStatus,
  AssetType,
  DataSourceState,
  IncidentCollection,
  IncidentFeature,
  LayerDataState,
  LayerKey,
  LayerSourceMeta,
} from '../types/gis'
import { LAYER_LABELS } from '../utils/asset'
import { createEmptyFeatureCollection, loadMockLayerData } from './loaders'
import { apiGet } from '../services/apiClient'

const CAD_SOURCE_NAME = 'BIWASE_HIEN TRANG.dwg'
const CAD_OPERATIONAL_WGS84_URL = 'data/cad-vector/operational-map-wgs84.geojson'

type CadLayerKey = Exclude<LayerKey, 'incidents'>

const CAD_LAYER_KEYS: CadLayerKey[] = [
  'waterPlant',
  'rawWaterLakes',
  'pipelines',
  'canals',
  'supplyZones',
  'boundaries',
  'labels',
]

const ALL_LAYER_KEYS: LayerKey[] = [...CAD_LAYER_KEYS, 'incidents']

const LAYER_BY_ASSET_TYPE: Partial<Record<AssetType, CadLayerKey>> = {
  water_plant: 'waterPlant',
  raw_water_lake: 'rawWaterLakes',
  pipeline: 'pipelines',
  canal: 'canals',
  supply_zone: 'supplyZones',
  boundary: 'boundaries',
  label: 'labels',
  pending_data: 'labels',
}

export interface ViewportAssetsResult {
  layers: Record<CadLayerKey, AssetCollection>
  total: number
  truncated: boolean
  simplified: boolean
}

const CAD_LAYER_URLS: Record<CadLayerKey, string> = {
  waterPlant: 'data/biwase/water-plants.geojson',
  rawWaterLakes: 'data/biwase/raw-water-lakes.geojson',
  pipelines: 'data/biwase/pipelines.geojson',
  canals: 'data/biwase/canals.geojson',
  supplyZones: 'data/biwase/supply-zones.geojson',
  boundaries: 'data/biwase/boundaries.geojson',
  labels: 'data/biwase/labels.geojson',
}

const DEFAULT_TYPE_BY_LAYER: Record<CadLayerKey, AssetType> = {
  waterPlant: 'water_plant',
  rawWaterLakes: 'raw_water_lake',
  pipelines: 'pipeline',
  canals: 'canal',
  supplyZones: 'supply_zone',
  boundaries: 'boundary',
  labels: 'label',
}

const ID_PREFIX_BY_LAYER: Record<CadLayerKey, string> = {
  waterPlant: 'WP',
  rawWaterLakes: 'RWL',
  pipelines: 'PL',
  canals: 'CN',
  supplyZones: 'SZ',
  boundaries: 'BD',
  labels: 'LB',
}

const VALID_ASSET_STATUSES: AssetStatus[] = [
  'active',
  'maintenance',
  'need_inspection',
  'pending_data',
]

const VALID_ASSET_TYPES: AssetType[] = [
  'water_plant',
  'raw_water_lake',
  'pipeline',
  'canal',
  'supply_zone',
  'boundary',
  'label',
  'pending_data',
]

const CAD_VECTOR_TYPE_TO_LAYER: Record<string, CadLayerKey> = {
  water_plant: 'waterPlant',
  raw_water_lake: 'rawWaterLakes',
  pipeline: 'pipelines',
  canal: 'canals',
  irrigation_canal: 'canals',
  irrigation_area: 'canals',
  supply_zone: 'supplyZones',
  boundary: 'boundaries',
}

function toPublicUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}

function getTextValue(properties: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return ''
}

function normalizeNotes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeAssetType(value: unknown, layerKey: CadLayerKey): AssetType {
  if (typeof value === 'string' && VALID_ASSET_TYPES.includes(value as AssetType)) {
    return value as AssetType
  }

  return DEFAULT_TYPE_BY_LAYER[layerKey]
}

function normalizeAssetStatus(value: unknown): AssetStatus {
  if (typeof value === 'string' && VALID_ASSET_STATUSES.includes(value as AssetStatus)) {
    return value as AssetStatus
  }

  return 'pending_data'
}

function normalizeFeature(
  layerKey: CadLayerKey,
  feature: unknown,
  index: number,
): AssetFeature | null {
  if (!feature || typeof feature !== 'object') {
    return null
  }

  const rawFeature = feature as {
    type?: string
    geometry?: Geometry | null
    properties?: Record<string, unknown> | null
  }

  if (rawFeature.type !== 'Feature' || !rawFeature.geometry) {
    return null
  }

  const rawProperties = rawFeature.properties ?? {}
  const cadLayer = getTextValue(rawProperties, [
    'cadLayer',
    'sourceLayer',
    'Layer',
    'layer',
    'LAYER',
    'LayerName',
    'layerName',
  ])
  const id =
    getTextValue(rawProperties, ['id', 'ID', 'fid', 'FID', 'objectid', 'OBJECTID']) ||
    `${ID_PREFIX_BY_LAYER[layerKey]}-${String(index + 1).padStart(3, '0')}`
  const name =
    getTextValue(rawProperties, [
      'name',
      'Name',
      'NAME',
      'text',
      'Text',
      'TextString',
      'label',
      'LABEL',
    ]) || `${LAYER_LABELS[layerKey]} ${index + 1}`
  const type = normalizeAssetType(rawProperties.type, layerKey)

  const normalizedFeature: AssetFeature = {
    type: 'Feature',
    geometry: rawFeature.geometry,
    properties: {
      id,
      assetCode: typeof rawProperties.assetCode === 'string' ? rawProperties.assetCode : undefined,
      version: typeof rawProperties.version === 'number' ? rawProperties.version : undefined,
      name,
      type,
      status: normalizeAssetStatus(rawProperties.status),
      source: getTextValue(rawProperties, ['source']) || CAD_SOURCE_NAME,
      cadLayer,
      sourceLayer: getTextValue(rawProperties, ['sourceLayer']) || cadLayer,
      description: getTextValue(rawProperties, ['description', 'Description', 'DESC']),
      address: getTextValue(rawProperties, ['address', 'Address', 'LOCATION', 'location']),
      capacity: getTextValue(rawProperties, ['capacity', 'Capacity', 'CONG_SUAT']),
      area: getTextValue(rawProperties, ['area', 'Area', 'DIEN_TICH']),
      volume: getTextValue(rawProperties, ['volume', 'Volume', 'DUNG_TICH']),
      material: getTextValue(rawProperties, ['material', 'Material', 'VAT_LIEU']),
      diameter: getTextValue(rawProperties, ['diameter', 'Diameter', 'DUONG_KINH', 'DIA']),
      length: getTextValue(rawProperties, ['length', 'Length', 'CHIEU_DAI']),
      imageUrl: getTextValue(rawProperties, ['imageUrl', 'image_url']),
      googleMapsUrl: getTextValue(rawProperties, ['googleMapsUrl', 'google_maps_url']),
      lastUpdated:
        getTextValue(rawProperties, ['lastUpdated', 'last_updated']) ||
        new Date().toISOString().slice(0, 10),
      notes: normalizeNotes(rawProperties.notes),
    },
  }

  return normalizedFeature
}

function normalizeCollection(layerKey: CadLayerKey, rawData: unknown): AssetCollection {
  if (!rawData || typeof rawData !== 'object') {
    throw new Error('GeoJSON không hợp lệ')
  }

  const rawCollection = rawData as { type?: string; features?: unknown[] }

  if (rawCollection.type !== 'FeatureCollection' || !Array.isArray(rawCollection.features)) {
    throw new Error('GeoJSON phai la FeatureCollection')
  }

  const normalizedFeatures = rawCollection.features
    .map((feature, index) => normalizeFeature(layerKey, feature, index))
    .filter((feature): feature is AssetFeature => Boolean(feature))

  return {
    type: 'FeatureCollection',
    features: normalizedFeatures,
  }
}

export async function loadGeoJsonLayer(layerKey: CadLayerKey, url: string): Promise<AssetCollection> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return normalizeCollection(layerKey, await response.json())
}

async function loadApiAssets(type: AssetType): Promise<AssetCollection> {
  return normalizeCollection(LAYER_BY_ASSET_TYPE[type] ?? 'labels', await apiGet<unknown>(`/assets?type=${type}&limit=500`))
}

export async function loadApiAssetsForViewport(
  bbox: [number, number, number, number],
  zoom: number,
  signal?: AbortSignal,
): Promise<ViewportAssetsResult> {
  const params = new URLSearchParams({
    bbox: bbox.map((value) => value.toFixed(6)).join(','),
    zoom: String(Math.round(zoom)),
    limit: '1000',
  })
  const raw = await apiGet<unknown>(`/assets?${params.toString()}`, 8000, signal)
  if (!raw || typeof raw !== 'object') throw new Error('Dữ liệu bản đồ không hợp lệ')

  const response = raw as {
    type?: string
    features?: unknown[]
    meta?: { total?: number; simplified?: boolean }
  }
  if (response.type !== 'FeatureCollection' || !Array.isArray(response.features)) {
    throw new Error('Dữ liệu bản đồ không hợp lệ')
  }

  const layers = Object.fromEntries(
    CAD_LAYER_KEYS.map((layerKey) => [layerKey, createEmptyFeatureCollection()]),
  ) as Record<CadLayerKey, AssetCollection>

  for (const [index, feature] of response.features.entries()) {
    if (!feature || typeof feature !== 'object') continue
    const rawType = String((feature as { properties?: { type?: string } }).properties?.type ?? '') as AssetType
    const layerKey = LAYER_BY_ASSET_TYPE[rawType]
    if (!layerKey) continue
    const normalized = normalizeFeature(layerKey, feature, index)
    if (normalized) layers[layerKey].features.push(normalized)
  }

  const total = Number(response.meta?.total ?? response.features.length)
  return {
    layers,
    total,
    truncated: total > response.features.length,
    simplified: response.meta?.simplified === true,
  }
}

export async function loadApiIncidents(signal?: AbortSignal): Promise<IncidentCollection> {
  const features = await loadAllFeaturePages<IncidentFeature>((offset) =>
    apiGet<FeaturePage<IncidentFeature>>(`/incidents?limit=200&offset=${offset}`, 8000, signal),
  )
  return {
    type: 'FeatureCollection',
    features: features.filter((feature) => feature?.geometry?.type === 'Point' && feature.properties?.type === 'incident'),
  }
}

export async function loadOperationalCadLayers(url = toPublicUrl(CAD_OPERATIONAL_WGS84_URL)): Promise<Record<CadLayerKey, AssetCollection>> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const rawCollection = (await response.json()) as { type?: string; features?: unknown[] }
  if (rawCollection.type !== 'FeatureCollection' || !Array.isArray(rawCollection.features)) {
    throw new Error('GeoJSON CAD WGS84 không hợp lệ')
  }

  const collections = Object.fromEntries(
    CAD_LAYER_KEYS.map((layerKey) => [layerKey, createEmptyFeatureCollection()]),
  ) as Record<CadLayerKey, AssetCollection>

  for (const [index, feature] of rawCollection.features.entries()) {
    const rawType =
      feature && typeof feature === 'object'
        ? String((feature as { properties?: Record<string, unknown> }).properties?.type ?? '')
        : ''
    const layerKey = CAD_VECTOR_TYPE_TO_LAYER[rawType]
    if (!layerKey) continue
    const normalized = normalizeFeature(layerKey, feature, index)
    if (normalized) collections[layerKey].features.push(normalized)
  }

  return collections
}

function createLayerMeta(
  layerKey: LayerKey,
  source: LayerSourceMeta['source'],
  status: LayerSourceMeta['status'],
  featureCount: number,
  url?: string,
  message?: string,
): LayerSourceMeta {
  return {
    layerKey,
    label: LAYER_LABELS[layerKey],
    source,
    status,
    featureCount,
    url,
    message,
  }
}

export function ensureLayerDataState(data: Partial<LayerDataState>): LayerDataState {
  return {
    waterPlant: data.waterPlant ?? createEmptyFeatureCollection(),
    rawWaterLakes: data.rawWaterLakes ?? createEmptyFeatureCollection(),
    pipelines: data.pipelines ?? createEmptyFeatureCollection(),
    canals: data.canals ?? createEmptyFeatureCollection(),
    supplyZones: data.supplyZones ?? createEmptyFeatureCollection(),
    boundaries: data.boundaries ?? createEmptyFeatureCollection(),
    labels: data.labels ?? createEmptyFeatureCollection(),
    incidents: data.incidents ?? createEmptyFeatureCollection(),
  } as LayerDataState
}

type InitialData = { data: LayerDataState; dataSource: DataSourceState }
let initialDataRequest: Promise<InitialData> | null = null

// React StrictMode may mount twice; share only the active request, never mutable data forever.
export function loadLayerDataWithFallback(): Promise<InitialData> {
  initialDataRequest ??= initializeLayerData().finally(() => { initialDataRequest = null })
  return initialDataRequest
}

async function initializeLayerData(): Promise<InitialData> {
  const data = ensureLayerDataState({})
  const layers = Object.fromEntries(ALL_LAYER_KEYS.map((key) => [
    key, createLayerMeta(key, 'api', 'api_error', 0, undefined, 'Chưa kết nối được máy chủ'),
  ])) as Record<LayerKey, LayerSourceMeta>

  // Incidents and all asset types start together. Offline fallback never waits for demo files.
  const incidentRequest = loadApiIncidents().then(
    (collection) => ({ collection }),
    () => ({ collection: null }),
  )
  try {
    const collections = await Promise.all((Object.keys(LAYER_BY_ASSET_TYPE) as AssetType[]).map(async (type) => ({
      layerKey: LAYER_BY_ASSET_TYPE[type]!,
      collection: await loadApiAssets(type),
    })))
    for (const layerKey of CAD_LAYER_KEYS) {
      const features = collections.filter((entry) => entry.layerKey === layerKey).flatMap((entry) => entry.collection.features)
      data[layerKey] = { type: 'FeatureCollection', features }
      layers[layerKey] = createLayerMeta(layerKey, 'api', features.length ? 'api_loaded' : 'api_empty', features.length, undefined, 'Dữ liệu máy chủ')
    }
    const { collection } = await incidentRequest
    if (collection) {
      data.incidents = collection
      layers.incidents = createLayerMeta('incidents', 'api', collection.features.length ? 'api_loaded' : 'api_empty', collection.features.length)
    }
    return { data, dataSource: { mode: 'api', label: 'Đã kết nối máy chủ', usingCad: false, layers } }
  } catch {
    // Only download fallback data when the API cannot supply the asset collections.
  }

  let loadedCadFeatureCount = 0
  const operationalUrl = toPublicUrl(CAD_OPERATIONAL_WGS84_URL)
  try {
    const operationalLayers = await loadOperationalCadLayers(operationalUrl)
    for (const layerKey of CAD_LAYER_KEYS) {
      const collection = operationalLayers[layerKey]
      data[layerKey] = collection
      loadedCadFeatureCount += collection.features.length
      layers[layerKey] = createLayerMeta(layerKey, 'cad', collection.features.length ? 'cad_loaded' : 'cad_empty', collection.features.length, operationalUrl)
    }
  } catch {
    // Keep compatibility with older per-layer exports.
  }

  if (!loadedCadFeatureCount) {
    await Promise.all(CAD_LAYER_KEYS.map(async (layerKey) => {
      const url = toPublicUrl(CAD_LAYER_URLS[layerKey])
      try {
        const collection = await loadGeoJsonLayer(layerKey, url)
        data[layerKey] = collection
        loadedCadFeatureCount += collection.features.length
        layers[layerKey] = createLayerMeta(layerKey, 'cad', collection.features.length ? 'cad_loaded' : 'cad_empty', collection.features.length, url)
      } catch (error) {
        layers[layerKey] = createLayerMeta(layerKey, 'cad', 'cad_error', 0, url, error instanceof Error ? error.message : 'Không thể tải GeoJSON CAD')
      }
    }))
  }
  if (loadedCadFeatureCount) {
    return { data, dataSource: { mode: 'cad', label: 'Đang dùng dữ liệu CAD/GeoJSON', usingCad: true, layers } }
  }

  const mockData = ensureLayerDataState(await loadMockLayerData())
  const mockLayers = Object.fromEntries(ALL_LAYER_KEYS.map((key) => [key, createLayerMeta(key, 'mock', 'mock', mockData[key].features.length)])) as Record<LayerKey, LayerSourceMeta>
  return { data: mockData, dataSource: { mode: 'demo', label: 'Đang dùng dữ liệu demo', usingCad: false, layers: mockLayers } }
}

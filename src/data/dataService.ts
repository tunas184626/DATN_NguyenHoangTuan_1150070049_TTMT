import type { Geometry } from 'geojson'
import type {
  AssetCollection,
  AssetFeature,
  AssetStatus,
  AssetType,
  DataSourceState,
  LayerDataState,
  LayerKey,
  LayerSourceMeta,
} from '../types/gis'
import { LAYER_LABELS } from '../utils/asset'
import { createEmptyFeatureCollection, loadMockLayerData } from './loaders'

const CAD_SOURCE_NAME = 'BIWASE_HIEN TRANG.dwg'

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

export async function loadLayerDataWithFallback(): Promise<{
  data: LayerDataState
  dataSource: DataSourceState
}> {
  const mockData = await loadMockLayerData()
  const data = ensureLayerDataState(mockData)
  const layerEntries: Array<[LayerKey, LayerSourceMeta]> = ALL_LAYER_KEYS.map((layerKey) => [
    layerKey,
    createLayerMeta(layerKey, 'mock', 'mock', data[layerKey].features.length),
  ])
  const layers = Object.fromEntries(layerEntries) as Record<LayerKey, LayerSourceMeta>

  let loadedCadFeatureCount = 0

  await Promise.all(
    CAD_LAYER_KEYS.map(async (layerKey) => {
      const url = toPublicUrl(CAD_LAYER_URLS[layerKey])

      try {
        const cadCollection = await loadGeoJsonLayer(layerKey, url)
        const featureCount = cadCollection.features.length
        const hasRenderableCadData = featureCount > 0

        if (hasRenderableCadData || layerKey === 'boundaries' || layerKey === 'labels') {
          data[layerKey] = cadCollection as never
        }

        if (hasRenderableCadData) {
          loadedCadFeatureCount += featureCount
        }

        layers[layerKey] = createLayerMeta(
          layerKey,
          'cad',
          hasRenderableCadData ? 'cad_loaded' : 'cad_empty',
          featureCount,
          url,
        )
      } catch (error) {
        layers[layerKey] = createLayerMeta(
          layerKey,
          'cad',
          error instanceof Error && error.message.includes('HTTP 404') ? 'cad_missing' : 'cad_error',
          0,
          url,
          error instanceof Error ? error.message : 'Không thể tải GeoJSON CAD',
        )
      }
    }),
  )

  const usingCad = loadedCadFeatureCount > 0

  return {
    data,
    dataSource: {
      mode: usingCad ? 'cad' : 'demo',
      label: usingCad ? 'Đang dùng dữ liệu CAD/GeoJSON' : 'Đang dùng dữ liệu demo',
      usingCad,
      layers,
    },
  }
}

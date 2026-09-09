import { useCallback, useEffect, useMemo, useState } from 'react'
import { ensureLayerDataState, loadLayerDataWithFallback } from '../data/dataService'
import { loadMockLayerData } from '../data/loaders'
import type {
  AnyMapFeature,
  AssetCollection,
  AssetFeature,
  DataSourceState,
  IncidentFeature,
  LayerDataState,
  LayerKey,
  NewAssetInput,
  NewIncidentInput,
  UpdateAssetInput,
} from '../types/gis'
import { assetTypeToLayerKey, LAYER_LABELS } from '../utils/asset'
import { buildGeometry } from '../utils/geo'
import { flattenAllFeatures, flattenAssets, flattenIncidents } from '../utils/metrics'
import { apiRequest } from '../services/apiClient'

const STORAGE_KEY = 'webgis-water-assets-v1'

const ASSET_LAYER_KEYS: Array<Exclude<LayerKey, 'incidents'>> = [
  'waterPlant',
  'rawWaterLakes',
  'pipelines',
  'canals',
  'supplyZones',
  'boundaries',
  'labels',
]

const ALL_LAYER_KEYS: LayerKey[] = [...ASSET_LAYER_KEYS, 'incidents']

function createDemoDataSource(data: LayerDataState): DataSourceState {
  return {
    mode: 'demo',
    label: 'Đang dùng dữ liệu demo',
    usingCad: false,
    layers: Object.fromEntries(
      ALL_LAYER_KEYS.map((layerKey) => [
        layerKey,
        {
          layerKey,
          label: LAYER_LABELS[layerKey],
          source: 'mock',
          status: 'mock',
          featureCount: data[layerKey].features.length,
        },
      ]),
    ) as DataSourceState['layers'],
  }
}

function generateAssetId(): string {
  return `AST-${Date.now()}`
}

function generateIncidentId(): string {
  return `INC-${Date.now()}`
}

function createAssetFeature(input: NewAssetInput): AssetFeature {
  return {
    type: 'Feature',
    geometry: buildGeometry(input.geometryType, input.coordinates),
    properties: {
      id: generateAssetId(),
      name: input.name.trim(),
      type: input.type,
      status: input.status,
      description: input.description.trim(),
      address: input.address.trim(),
      capacity: input.capacity?.trim() ?? '',
      area: input.area?.trim() ?? '',
      volume: input.volume?.trim() ?? '',
      material: input.material?.trim() ?? '',
      diameter: input.diameter?.trim() ?? '',
      length: input.length?.trim() ?? '',
      source: 'Dữ liệu lưu tạm trên thiết bị',
      cadLayer: '',
      imageUrl: input.imageUrl?.trim() ?? '',
      googleMapsUrl: input.googleMapsUrl?.trim() ?? '',
      lastUpdated: new Date().toISOString().slice(0, 10),
      notes: input.notes.filter(Boolean),
    },
  }
}

function createIncidentFeature(input: NewIncidentInput): IncidentFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [input.longitude, input.latitude],
    },
    properties: {
      id: generateIncidentId(),
      name: input.name.trim(),
      type: 'incident',
      status: input.status,
      incidentCode: input.incidentCode.trim(),
      incidentType: input.incidentType,
      severity: input.severity,
      reportedDate: input.reportedDate,
      description: input.description.trim(),
      address: input.address.trim(),
      imageUrl: input.imageUrl?.trim() ?? '',
      googleMapsUrl: input.googleMapsUrl?.trim() ?? '',
      lastUpdated: new Date().toISOString().slice(0, 10),
      notes: input.notes.filter(Boolean),
      source: 'Dữ liệu lưu tạm trên thiết bị',
    },
  }
}

function loadFromStorage(): LayerDataState | null {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY)

    if (!rawData) {
      return null
    }

    return JSON.parse(rawData) as LayerDataState
  } catch {
    return null
  }
}

export function useWebGISData() {
  const [data, setData] = useState<LayerDataState | null>(null)
  const [dataSource, setDataSource] = useState<DataSourceState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      setLoading(true)
      setError(null)

      try {
        const loaded = await loadLayerDataWithFallback()
        const localData = loadFromStorage()
        const initialData =
          loaded.dataSource.usingCad || !localData
            ? loaded.data
            : ensureLayerDataState(localData)

        if (mounted) {
          setData(initialData)
          setDataSource(loaded.dataSource)
        }

        return
      } catch {
        try {
          const mockData = await loadMockLayerData()

          if (mounted) {
            const fallbackData = ensureLayerDataState(mockData)
            setData(fallbackData)
            setDataSource(createDemoDataSource(fallbackData))
          }

          return
        } catch {
          if (mounted) {
            setError('Không thể khởi tạo dữ liệu bản đồ')
          }
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void initialize()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!data || dataSource?.usingCad) {
      return
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data, dataSource])

  const addAsset = useCallback(
    async (input: NewAssetInput): Promise<AssetFeature | null> => {
      if (!data) return null
      const geometry = buildGeometry(input.geometryType, input.coordinates)
      let createdFeature: AssetFeature

      if (dataSource?.mode === 'api') {
        createdFeature = await apiRequest<AssetFeature>('/assets', {
          method: 'POST',
          body: JSON.stringify({
            name: input.name,
            type: input.type,
            status: input.status,
            description: input.description,
            address: input.address,
            geometry,
            attributes: {
              capacity: input.capacity,
              area: input.area,
              volume: input.volume,
              material: input.material,
              diameter: input.diameter,
              length: input.length,
              imageUrl: input.imageUrl,
              googleMapsUrl: input.googleMapsUrl,
              notes: input.notes,
            },
          }),
        })
      } else {
        createdFeature = createAssetFeature(input)
      }

      const layerKey = assetTypeToLayerKey(input.type)
      setData((current) => {
        if (!current) return current
        const layer = current[layerKey] as AssetCollection
        return {
          ...current,
          [layerKey]: { ...layer, features: [...layer.features, createdFeature] },
        }
      })
      return createdFeature
    },
    [data, dataSource?.mode],
  )

  const updateAsset = useCallback(
    async (featureId: string, input: UpdateAssetInput): Promise<AssetFeature | null> => {
      if (!data) return null
      const original = ASSET_LAYER_KEYS
        .flatMap((layerKey) => data[layerKey].features)
        .find((feature) => feature.properties.id === featureId)
      if (!original) return null

      let updatedFeature: AssetFeature = {
        ...original,
        properties: { ...original.properties, ...input, lastUpdated: new Date().toISOString() },
      }

      if (dataSource?.mode === 'api' && typeof original.properties.version === 'number') {
        updatedFeature = await apiRequest<AssetFeature>(`/assets/${encodeURIComponent(featureId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: input.name,
            status: input.status,
            description: input.description,
            address: input.address,
            version: original.properties.version,
            attributes: {
              capacity: input.capacity,
              area: input.area,
              volume: input.volume,
              material: input.material,
              diameter: input.diameter,
              length: input.length,
              imageUrl: input.imageUrl,
              googleMapsUrl: input.googleMapsUrl,
              notes: input.notes,
            },
          }),
        })
      }

      const layerKey = assetTypeToLayerKey(original.properties.type)
      setData((current) => current ? {
        ...current,
        [layerKey]: {
          ...current[layerKey],
          features: current[layerKey].features.map((feature) =>
            feature.properties.id === featureId ? updatedFeature : feature,
          ),
        },
      } : current)
      return updatedFeature
    },
    [data, dataSource?.mode],
  )

  const addIncident = useCallback(
    async (input: NewIncidentInput): Promise<IncidentFeature | null> => {
      if (!data) return null

      let createdIncident: IncidentFeature
      if (dataSource?.mode === 'api') {
        createdIncident = await apiRequest<IncidentFeature>('/incidents', {
          method: 'POST',
          body: JSON.stringify({
            name: input.name,
            incidentType: input.incidentType,
            severity: input.severity,
            description: input.description,
            address: input.address,
            latitude: input.latitude,
            longitude: input.longitude,
            reportedAt: `${input.reportedDate}T00:00:00.000Z`,
            details: {
              imageUrl: input.imageUrl,
              googleMapsUrl: input.googleMapsUrl,
              notes: input.notes,
            },
          }),
        })
      } else {
        createdIncident = createIncidentFeature(input)
      }

      // Chỉ sao chép nhánh incidents; tránh structuredClone toàn bộ hàng nghìn geometry.
      setData((current) => current ? {
        ...current,
        incidents: {
          ...current.incidents,
          features: [...current.incidents.features, createdIncident],
        },
      } : current)
      return createdIncident
    },
    [data, dataSource?.mode],
  )

  const resetData = useCallback(async () => {
    const mockData = await loadMockLayerData()
    const fallbackData = ensureLayerDataState(mockData)
    setData(fallbackData)
    setDataSource(createDemoDataSource(fallbackData))
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const assets = useMemo(() => {
    if (!data) {
      return []
    }

    return flattenAssets(data)
  }, [data])

  const incidents = useMemo(() => {
    if (!data) {
      return []
    }

    return flattenIncidents(data)
  }, [data])

  const allFeatures = useMemo(() => {
    if (!data) {
      return []
    }

    return flattenAllFeatures(data)
  }, [data])

  const getFeatureById = useCallback(
    (featureId: string): AnyMapFeature | null => {
      if (!data) {
        return null
      }

      const foundFeature = flattenAllFeatures(data).find(
        (feature) => feature.properties.id === featureId,
      )

      return foundFeature ?? null
    },
    [data],
  )

  return {
    data,
    dataSource,
    loading,
    error,
    assets,
    incidents,
    allFeatures,
    addAsset,
    updateAsset,
    addIncident,
    resetData,
    getFeatureById,
  }
}

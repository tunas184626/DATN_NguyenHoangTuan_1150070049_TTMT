import { useCallback, useEffect, useMemo, useState } from 'react'
import { ensureLayerDataState, loadLayerDataWithFallback } from '../data/dataService'
import { loadMockLayerData } from '../data/loaders'
import type {
  AnyMapFeature,
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
      source: 'Dữ liệu nhập từ giao diện thử nghiệm',
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
    (input: NewAssetInput): AssetFeature | null => {
      if (!data) {
        return null
      }

      const createdFeature = createAssetFeature(input)
      const nextData = structuredClone(data)
      const layerKey = assetTypeToLayerKey(input.type)

      switch (layerKey) {
        case 'waterPlant':
          nextData.waterPlant.features.push(createdFeature as never)
          break
        case 'rawWaterLakes':
          nextData.rawWaterLakes.features.push(createdFeature as never)
          break
        case 'pipelines':
          nextData.pipelines.features.push(createdFeature as never)
          break
        case 'canals':
          nextData.canals.features.push(createdFeature as never)
          break
        case 'supplyZones':
          nextData.supplyZones.features.push(createdFeature as never)
          break
        case 'boundaries':
          nextData.boundaries.features.push(createdFeature as never)
          break
        case 'labels':
          nextData.labels.features.push(createdFeature as never)
          break
      }

      setData(nextData)
      return createdFeature
    },
    [data],
  )

  const updateAsset = useCallback(
    (featureId: string, input: UpdateAssetInput): AssetFeature | null => {
      if (!data) {
        return null
      }

      let updatedFeature: AssetFeature | null = null
      const nextData = structuredClone(data)

      for (const layerKey of ASSET_LAYER_KEYS) {
        const targetLayer = nextData[layerKey]
        targetLayer.features = targetLayer.features.map((feature) => {
          if (feature.properties.id !== featureId) {
            return feature
          }

          const nextFeature = {
            ...feature,
            properties: {
              ...feature.properties,
              ...input,
              lastUpdated: new Date().toISOString().slice(0, 10),
            },
          }

          updatedFeature = nextFeature as AssetFeature
          return nextFeature
        }) as never
      }

      if (!updatedFeature) {
        return null
      }

      setData(nextData)
      return updatedFeature
    },
    [data],
  )

  const addIncident = useCallback(
    (input: NewIncidentInput): IncidentFeature | null => {
      if (!data) {
        return null
      }

      const createdIncident = createIncidentFeature(input)
      const nextData = structuredClone(data)
      nextData.incidents.features.push(createdIncident)

      setData(nextData)
      return createdIncident
    },
    [data],
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

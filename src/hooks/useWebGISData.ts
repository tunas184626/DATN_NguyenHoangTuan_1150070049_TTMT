import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ensureLayerDataState,
  loadApiAssetsForViewport,
  loadApiIncidents,
  loadLayerDataWithFallback,
} from '../data/dataService'
import { loadMockLayerData } from '../data/loaders'
import type {
  AnyMapFeature,
  AssetCollection,
  AssetFeature,
  DataSourceState,
  IncidentAttachment,
  IncidentAssignee,
  IncidentFeature,
  IncidentHistoryItem,
  IncidentLinkedAsset,
  IncidentRealtimeEvent,
  IncidentWorkflowStatus,
  LayerDataState,
  LayerKey,
  NewAssetInput,
  NewIncidentInput,
  UpdateAssetInput,
} from '../types/gis'
import { assetTypeToLayerKey, LAYER_LABELS } from '../utils/asset'
import { buildGeometry } from '../utils/geo'
import { parseIncidentPosition } from '../utils/coordinates'
import { flattenAllFeatures, flattenAssets, flattenIncidents } from '../utils/metrics'
import { apiRequest } from '../services/apiClient'
import { clearLocalDrafts, isLocalDraft, isServerFeature, loadLocalDrafts, mergeLocalDrafts, saveLocalDraft } from '../services/localDraftStore'
import {
  loadIncidentAssignees,
  loadIncidentLinkedAssets,
  subscribeToIncidentChanges,
} from '../services/incidentWorkflowService'

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
  return `AST-${crypto.randomUUID()}`
}

function generateIncidentId(): string {
  return `INC-${crypto.randomUUID()}`
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
  const reportedAt = input.reportedAt ?? new Date().toISOString()
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
      reportedAt,
      escalationLevel: 0,
      assetIds: input.assetIds,
      assetId: input.assetIds[0] ?? null,
      origin: input.origin,
      intake: input.intake,
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
  const [reloadVersion, setReloadVersion] = useState(0)
  const [incidentRealtimeEvent, setIncidentRealtimeEvent] = useState<IncidentRealtimeEvent | null>(null)
  const viewportAbortController = useRef<AbortController | null>(null)

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      setLoading(true)
      setError(null)

      try {
        const loaded = await loadLayerDataWithFallback()
        const localData = loadFromStorage()
        const baseData =
          loaded.dataSource.mode !== 'demo' || !localData
            ? loaded.data
            : ensureLayerDataState(localData)
        const initialData = mergeLocalDrafts(baseData, loadLocalDrafts())

        if (mounted) {
          setData(initialData)
          setDataSource(loaded.dataSource)
        }

        return
      } catch {
        try {
          const mockData = await loadMockLayerData()

          if (mounted) {
            const fallbackData = mergeLocalDrafts(ensureLayerDataState(mockData), loadLocalDrafts())
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
  }, [reloadVersion])

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
        createdFeature = saveLocalDraft(createAssetFeature(input))
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

      if (dataSource?.mode === 'api' && isServerFeature(original)) {
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
      } else {
        updatedFeature = saveLocalDraft(updatedFeature)
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
      if (!parseIncidentPosition(String(input.latitude), String(input.longitude))) {
        throw new Error('Cần chọn vị trí WGS84 hợp lệ trước khi lưu sự cố')
      }

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
            reportedAt: input.reportedAt ?? new Date().toISOString(),
            details: {
              imageUrl: input.imageUrl,
              googleMapsUrl: input.googleMapsUrl,
              notes: input.notes,
              origin: input.origin,
              intake: input.intake,
            },
            assetIds: input.assetIds,
          }),
        })
      } else {
        createdIncident = saveLocalDraft(createIncidentFeature(input))
      }

      // Chỉ sao chép nhánh incidents; tránh structuredClone toàn bộ hàng nghìn geometry.
      setData((current) => current ? {
        ...current,
        incidents: {
          ...current.incidents,
          features: current.incidents.features.some((incident) => incident.properties.id === createdIncident.properties.id)
            ? current.incidents.features.map((incident) => incident.properties.id === createdIncident.properties.id ? createdIncident : incident)
            : [createdIncident, ...current.incidents.features],
        },
      } : current)
      return createdIncident
    },
    [data, dataSource?.mode],
  )

  const replaceIncident = useCallback((updated: IncidentFeature) => {
    // Ghi vào bộ nhớ trình duyệt trước khi báo lưu thành công hoặc thay đổi UI.
    const next = isLocalDraft(updated) ? saveLocalDraft(updated) : updated
    setData((current) => current ? {
      ...current,
      incidents: {
        ...current.incidents,
        features: current.incidents.features.some((incident) => incident.properties.id === updated.properties.id)
          ? current.incidents.features.map((incident) => incident.properties.id === next.properties.id
            ? isLocalDraft(incident) && !isLocalDraft(next) ? incident : next
            : incident)
          : [next, ...current.incidents.features],
      },
    } : current)
    return next
  }, [])

  const cacheFeature = useCallback((feature: AnyMapFeature) => {
    const key = feature.properties.type === 'incident' ? 'incidents' : assetTypeToLayerKey(feature.properties.type)
    setData((current) => {
      if (!current) return current
      const existing = current[key].features.find((item) => item.properties.id === feature.properties.id)
      if (existing && isLocalDraft(existing) && !isLocalDraft(feature)) return current
      if (existing && !isLocalDraft(feature) && typeof existing.properties.version === 'number'
        && (typeof feature.properties.version !== 'number' || feature.properties.version < existing.properties.version)) return current
      const features: AnyMapFeature[] = existing
        ? current[key].features.map((item) => item.properties.id === feature.properties.id ? feature : item)
        : [...current[key].features, feature]
      return { ...current, [key]: { ...current[key], features } } as LayerDataState
    })
  }, [])

  const retry = useCallback(() => {
    setReloadVersion((version) => version + 1)
  }, [])

  const transitionIncident = useCallback(async (
    incidentId: string,
    status: IncidentWorkflowStatus,
    note: string,
  ): Promise<IncidentFeature> => {
    if (status === 'resolved' && !note.trim()) throw new Error('Ghi kết quả khắc phục trước khi hoàn tất sự cố')
    const current = data?.incidents.features.find((incident) => incident.properties.id === incidentId)
    if (!current) throw new Error('Không tìm thấy sự cố')
    let updated: IncidentFeature
    if (dataSource?.mode === 'api' && isServerFeature(current)) {
      if (typeof current.properties.version !== 'number') throw new Error('Sự cố chưa được đồng bộ')
      updated = await apiRequest<IncidentFeature>(`/incidents/${encodeURIComponent(incidentId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, version: current.properties.version, note }),
      })
    } else {
      updated = {
        ...current,
        properties: {
          ...current.properties,
          localOnly: true,
          status,
          resolvedAt: status === 'resolved' ? new Date().toISOString() : undefined,
          version: (current.properties.version ?? 0) + 1,
          lastUpdated: new Date().toISOString(),
          notes: note ? [...current.properties.notes, note] : current.properties.notes,
        },
      }
    }
    return replaceIncident(updated)
  }, [data?.incidents.features, dataSource?.mode, replaceIncident])

  const assignIncident = useCallback(async (
    incidentId: string,
    assigneeId: string,
    note: string,
  ): Promise<IncidentFeature> => {
    const current = data?.incidents.features.find((incident) => incident.properties.id === incidentId)
    if (!current) throw new Error('Không tìm thấy sự cố')
    let updated: IncidentFeature
    if (dataSource?.mode === 'api' && isServerFeature(current)) {
      if (typeof current.properties.version !== 'number') throw new Error('Sự cố chưa được đồng bộ')
      updated = await apiRequest<IncidentFeature>(`/incidents/${encodeURIComponent(incidentId)}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify({ assigneeId, version: current.properties.version, note }),
      })
    } else {
      updated = {
        ...current,
        properties: {
          ...current.properties,
          localOnly: true,
          notes: note ? [...current.properties.notes, note] : current.properties.notes,
          assignedUserId: assigneeId,
          assignedTo: assigneeId,
          version: (current.properties.version ?? 0) + 1,
          lastUpdated: new Date().toISOString(),
        },
      }
    }
    return replaceIncident(updated)
  }, [data?.incidents.features, dataSource?.mode, replaceIncident])

  const getIncidentAssignees = useCallback(async (): Promise<IncidentAssignee[]> => {
    if (dataSource?.mode !== 'api') return []
    return loadIncidentAssignees()
  }, [dataSource?.mode])

  const getIncidentLinkedAssets = useCallback(async (incidentId: string): Promise<IncidentLinkedAsset[]> => {
    const incident = data?.incidents.features.find((item) => item.properties.id === incidentId)
    if (dataSource?.mode === 'api' && incident && isServerFeature(incident)) return loadIncidentLinkedAssets(incidentId)
    const assetIds = data?.incidents.features.find((item) => item.properties.id === incidentId)?.properties.assetIds ?? []
    return ASSET_LAYER_KEYS.flatMap((key) => data?.[key].features ?? [])
      .filter((asset) => assetIds.includes(asset.properties.id))
      .map((asset) => ({
        id: asset.properties.id,
        assetCode: asset.properties.id,
        name: asset.properties.name,
        type: asset.properties.type,
        status: asset.properties.status,
      }))
  }, [data, dataSource?.mode])

  const updateIncidentAssets = useCallback(async (
    incidentId: string,
    assetIds: string[],
    note: string,
  ): Promise<IncidentFeature> => {
    const current = data?.incidents.features.find((item) => item.properties.id === incidentId)
    if (!current) throw new Error('Không tìm thấy sự cố')
    let updated: IncidentFeature
    if (dataSource?.mode === 'api' && isServerFeature(current)) {
      if (typeof current.properties.version !== 'number') throw new Error('Sự cố chưa được đồng bộ')
      updated = await apiRequest<IncidentFeature>(`/incidents/${encodeURIComponent(incidentId)}/assets`, {
        method: 'PUT',
        body: JSON.stringify({ assetIds, version: current.properties.version, note }),
      })
    } else {
      updated = {
        ...current,
        properties: {
          ...current.properties,
          localOnly: true,
          notes: note ? [...current.properties.notes, note] : current.properties.notes,
          assetIds,
          assetId: assetIds[0] ?? null,
          version: (current.properties.version ?? 0) + 1,
          lastUpdated: new Date().toISOString(),
        },
      }
    }
    return replaceIncident(updated)
  }, [data?.incidents.features, dataSource?.mode, replaceIncident])

  const escalateIncident = useCallback(async (incidentId: string, note: string): Promise<IncidentFeature> => {
    const current = data?.incidents.features.find((item) => item.properties.id === incidentId)
    if (!current) throw new Error('Không tìm thấy sự cố')
    let updated: IncidentFeature
    if (dataSource?.mode === 'api' && isServerFeature(current)) {
      if (typeof current.properties.version !== 'number') throw new Error('Sự cố chưa được đồng bộ')
      updated = await apiRequest<IncidentFeature>(`/incidents/${encodeURIComponent(incidentId)}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ version: current.properties.version, note }),
      })
    } else {
      updated = {
        ...current,
        properties: {
          ...current.properties,
          localOnly: true,
          notes: note ? [...current.properties.notes, note] : current.properties.notes,
          escalationLevel: Math.min((current.properties.escalationLevel ?? 0) + 1, 3),
          version: (current.properties.version ?? 0) + 1,
          lastUpdated: new Date().toISOString(),
        },
      }
    }
    return replaceIncident(updated)
  }, [data?.incidents.features, dataSource?.mode, replaceIncident])

  const addIncidentComment = useCallback(async (incidentId: string, content: string): Promise<void> => {
    const current = data?.incidents.features.find((incident) => incident.properties.id === incidentId)
    if (!current) throw new Error('Không tìm thấy sự cố')
    if (dataSource?.mode === 'api' && isServerFeature(current)) {
      await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
      return
    }
    replaceIncident({
      ...current,
      properties: { ...current.properties, localOnly: true, lastUpdated: new Date().toISOString(), notes: [...current.properties.notes, content] },
    })
  }, [data?.incidents.features, dataSource?.mode, replaceIncident])

  const getIncidentHistory = useCallback(async (incidentId: string): Promise<IncidentHistoryItem[]> => {
    const incident = data?.incidents.features.find((item) => item.properties.id === incidentId)
    if (dataSource?.mode !== 'api' || !incident || !isServerFeature(incident)) return []
    const response = await apiRequest<{ items: IncidentHistoryItem[] }>(
      `/incidents/${encodeURIComponent(incidentId)}/history`, { method: 'GET' },
    )
    return response.items
  }, [data?.incidents.features, dataSource?.mode])

  const getIncidentAttachments = useCallback(async (incidentId: string): Promise<IncidentAttachment[]> => {
    const incident = data?.incidents.features.find((item) => item.properties.id === incidentId)
    if (dataSource?.mode !== 'api' || !incident || !isServerFeature(incident)) return incident?.properties.attachments ?? []
    const response = await apiRequest<{ items: IncidentAttachment[] }>(
      `/incidents/${encodeURIComponent(incidentId)}/attachments`, { method: 'GET' },
    )
    return response.items
  }, [data?.incidents.features, dataSource?.mode])

  const uploadIncidentAttachment = useCallback(async (
    incidentId: string,
    file: File,
    newlyCreated?: IncidentFeature,
  ): Promise<IncidentAttachment> => {
    // The create-and-upload handler still owns its pre-create render closure.
    const incident = newlyCreated?.properties.id === incidentId ? newlyCreated
      : data?.incidents.features.find((item) => item.properties.id === incidentId)
    if (dataSource?.mode !== 'api' || !incident || !isServerFeature(incident)) {
      throw new Error('Ảnh chỉ tải được khi sự cố đã được lưu trên máy chủ. Thông tin sự cố lưu tạm vẫn được giữ trên thiết bị.')
    }
    const body = new FormData()
    body.append('file', file)
    const attachment = await apiRequest<IncidentAttachment>(
      `/incidents/${encodeURIComponent(incidentId)}/attachments`, { method: 'POST', body }, 20_000,
    )
    setData((current) => current ? {
      ...current,
      incidents: {
        ...current.incidents,
        features: current.incidents.features.map((incident) =>
          incident.properties.id === incidentId
            ? { ...incident, properties: { ...incident.properties, attachments: [...(incident.properties.attachments ?? []), attachment] } }
            : incident,
        ),
      },
    } : current)
    return attachment
  }, [data?.incidents.features, dataSource?.mode])

  const loadAssetsForViewport = useCallback(async (
    bbox: [number, number, number, number],
    zoom: number,
  ) => {
    if (dataSource?.mode !== 'api') return null
    viewportAbortController.current?.abort()
    const controller = new AbortController()
    viewportAbortController.current = controller
    return loadApiAssetsForViewport(bbox, zoom, controller.signal)
  }, [dataSource?.mode])

  useEffect(() => {
    if (dataSource?.mode !== 'api') return
    let active = true
    let unsubscribe: (() => void) | undefined
    const refresh = () => {
      void loadApiIncidents()
        .then((collection) => {
          if (!active) return
          setData((current) => current ? {
            ...current,
            incidents: { ...current.incidents, features: mergeLocalDrafts({ ...current, incidents: { ...current.incidents, features: collection.features } }, loadLocalDrafts()).incidents.features },
          } : current)
        })
        .catch(() => undefined)
    }
    const refreshInterval = window.setInterval(refresh, 60_000)

    void subscribeToIncidentChanges((event) => {
      if (!active) return
      if (event.eventType === 'DELETE') {
        setData((current) => current ? {
          ...current,
          incidents: {
            ...current.incidents,
            features: current.incidents.features.filter((incident) => incident.properties.id !== event.id),
          },
        } : current)
        setIncidentRealtimeEvent(event)
        return
      }
      void apiRequest<IncidentFeature>(`/incidents/${encodeURIComponent(event.id)}`, { method: 'GET' })
        .then((incident) => {
          if (!active) return
          replaceIncident(incident)
          setIncidentRealtimeEvent(event)
        })
        .catch(() => undefined)
    }).then((cleanup) => {
      if (!active) cleanup()
      else unsubscribe = cleanup
    })

    return () => {
      active = false
      window.clearInterval(refreshInterval)
      unsubscribe?.()
    }
  }, [dataSource?.mode, replaceIncident])

  useEffect(() => () => viewportAbortController.current?.abort(), [])

  const resetData = useCallback(async () => {
    const mockData = await loadMockLayerData()
    const fallbackData = ensureLayerDataState(mockData)
    clearLocalDrafts()
    setData(fallbackData)
    setDataSource(createDemoDataSource(fallbackData))
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
    retry,
    assets,
    incidents,
    allFeatures,
    addAsset,
    updateAsset,
    addIncident,
    transitionIncident,
    assignIncident,
    addIncidentComment,
    getIncidentHistory,
    getIncidentAttachments,
    uploadIncidentAttachment,
    getIncidentAssignees,
    getIncidentLinkedAssets,
    updateIncidentAssets,
    escalateIncident,
    incidentRealtimeEvent,
    loadAssetsForViewport,
    cacheFeature,
    resetData,
    getFeatureById,
  }
}

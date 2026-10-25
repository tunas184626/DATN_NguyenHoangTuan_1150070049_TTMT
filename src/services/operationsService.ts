import { apiGet } from './apiClient'
import type { AnyMapFeature } from '../types/gis'
import type { AssetQualitySummary, FeaturePage, OperationsFilters, OperationsSummary } from '../types/operations'

export async function loadOperationsFeature(feature: AnyMapFeature): Promise<AnyMapFeature> {
  const path = feature.properties.type === 'incident' ? 'incidents' : 'assets'
  return apiGet<AnyMapFeature>(`/${path}/${encodeURIComponent(feature.properties.id)}`, 10_000)
}

export async function loadOperationsPage(filters: OperationsFilters, signal?: AbortSignal): Promise<FeaturePage> {
  const params = new URLSearchParams({
    limit: String(filters.pageSize),
    offset: String((filters.page - 1) * filters.pageSize),
    sort: filters.tab === 'assets' ? 'name' : 'priority',
  })
  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.tab === 'assets' && filters.type !== 'all') params.set('type', filters.type)
  if (filters.tab === 'assets' && filters.quality) params.set('quality', filters.quality)
  if (filters.tab === 'incidents' && filters.queue) params.set('queue', filters.queue)
  const result = await apiGet<FeaturePage>(`/${filters.tab}?${params.toString()}`, 10_000, signal)
  if (result.type !== 'FeatureCollection' || !Array.isArray(result.features)
    || !Number.isSafeInteger(result.meta?.total) || result.meta.total < 0) {
    throw new Error('Danh sách máy chủ chưa có số tổng hợp lệ')
  }
  return result
}

export async function loadAssetQualitySummary(signal?: AbortSignal): Promise<AssetQualitySummary> {
  const result = await apiGet<AssetQualitySummary>('/operations/asset-quality', 10_000, signal)
  if (![result.total, result.technical, result.address, result.inspection, result.maintenance]
    .every((count) => Number.isSafeInteger(count) && count >= 0)) {
    throw new Error('Thống kê chất lượng hồ sơ không hợp lệ')
  }
  return result
}

export async function loadOperationsSummary(signal?: AbortSignal): Promise<OperationsSummary> {
  const result = await apiGet<OperationsSummary>('/operations/summary', 10_000, signal)
  if (![result.assets, result.incidents, result.openIncidents, result.overdueIncidents, result.highPriorityIncidents, result.unassignedIncidents, result.inProgressIncidents]
    .every((count) => Number.isSafeInteger(count) && count >= 0)) {
    throw new Error('Thống kê máy chủ không hợp lệ')
  }
  return result
}

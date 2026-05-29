import type {
  AnyMapFeature,
  AssetFeature,
  AssetStatus,
  IncidentFeature,
  IncidentSeverity,
  LayerDataState,
} from '../types/gis'
import { calculateFeatureLineLengthKm } from './geo'

export interface DashboardStats {
  totalObjects: number
  waterPlants: number
  rawWaterLakes: number
  pipelineAndCanals: number
  needInspection: number
  pipelineLengthKm: number
}

export interface ChartDatum {
  label: string
  value: number
}

export function flattenAssets(data: LayerDataState): AssetFeature[] {
  return [
    ...data.waterPlant.features,
    ...data.rawWaterLakes.features,
    ...data.pipelines.features,
    ...data.canals.features,
    ...data.supplyZones.features,
    ...data.boundaries.features,
    ...data.labels.features,
  ]
}

export function flattenIncidents(data: LayerDataState): IncidentFeature[] {
  return data.incidents.features
}

export function flattenAllFeatures(data: LayerDataState): AnyMapFeature[] {
  return [...flattenAssets(data), ...flattenIncidents(data)]
}

export function computeDashboardStats(data: LayerDataState): DashboardStats {
  const assets = flattenAssets(data)
  const incidents = flattenIncidents(data)

  const needInspectionAssetCount = assets.filter(
    (feature) => feature.properties.status === 'need_inspection',
  ).length

  const needInspectionIncidentCount = incidents.filter(
    (feature) => feature.properties.incidentType === 'need_inspection',
  ).length

  const pipelineLengthKm = data.pipelines.features.reduce((sum, feature) => {
    return sum + calculateFeatureLineLengthKm(feature)
  }, 0)

  return {
    totalObjects: assets.length + incidents.length,
    waterPlants: data.waterPlant.features.length,
    rawWaterLakes: data.rawWaterLakes.features.length,
    pipelineAndCanals: data.pipelines.features.length + data.canals.features.length,
    needInspection: needInspectionAssetCount + needInspectionIncidentCount,
    pipelineLengthKm,
  }
}

export function buildAssetStatusChart(data: LayerDataState): ChartDatum[] {
  const assets = flattenAssets(data)
  const baseCount: Record<AssetStatus, number> = {
    active: 0,
    maintenance: 0,
    need_inspection: 0,
    pending_data: 0,
  }

  for (const feature of assets) {
    const status = feature.properties.status
    baseCount[status] += 1
  }

  return [
    { label: 'Đang hoạt động', value: baseCount.active },
    { label: 'Bảo trì', value: baseCount.maintenance },
    { label: 'Cần kiểm tra', value: baseCount.need_inspection },
    { label: 'Chờ dữ liệu', value: baseCount.pending_data },
  ]
}

export function buildIncidentSeverityChart(data: LayerDataState): ChartDatum[] {
  const incidents = flattenIncidents(data)
  const counts: Record<IncidentSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
  }

  for (const incident of incidents) {
    counts[incident.properties.severity] += 1
  }

  return [
    { label: 'Thấp', value: counts.low },
    { label: 'Trung bình', value: counts.medium },
    { label: 'Cao', value: counts.high },
  ]
}

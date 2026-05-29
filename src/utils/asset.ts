import type { AssetType, LayerKey } from '../types/gis'

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  water_plant: 'Nhà máy nước',
  raw_water_lake: 'Hồ chứa nước thô',
  pipeline: 'Tuyến ống cấp nước',
  canal: 'Kênh thủy lợi',
  supply_zone: 'Khu vực cấp nước',
  boundary: 'Ranh giới khu vực',
  label: 'Điểm/nhãn CAD',
  pending_data: 'Chờ phân loại từ CAD',
}

export const LAYER_LABELS: Record<LayerKey, string> = {
  waterPlant: 'Nhà máy nước',
  rawWaterLakes: 'Hồ chứa nước thô',
  pipelines: 'Tuyến ống cấp nước',
  canals: 'Kênh/thủy lợi',
  supplyZones: 'Khu vực cấp nước',
  boundaries: 'Ranh giới khu vực',
  labels: 'Điểm/nhãn quan trọng',
  incidents: 'Điểm sự cố',
}

export const LAYER_COLORS: Record<LayerKey, string> = {
  waterPlant: '#166534',
  rawWaterLakes: '#8b5cf6',
  pipelines: '#2563eb',
  canals: '#16a34a',
  supplyZones: '#22c55e',
  boundaries: '#334155',
  labels: '#7c3aed',
  incidents: '#dc2626',
}

export function assetTypeToLayerKey(
  type: AssetType,
): Exclude<LayerKey, 'incidents'> {
  switch (type) {
    case 'water_plant':
      return 'waterPlant'
    case 'raw_water_lake':
      return 'rawWaterLakes'
    case 'pipeline':
      return 'pipelines'
    case 'canal':
      return 'canals'
    case 'supply_zone':
      return 'supplyZones'
    case 'boundary':
      return 'boundaries'
    case 'label':
    case 'pending_data':
      return 'labels'
  }
}

export function layerKeyToLabel(layerKey: LayerKey): string {
  return LAYER_LABELS[layerKey]
}

export function formatAssetType(type: AssetType): string {
  return ASSET_TYPE_LABELS[type]
}

export function mapFeatureTypeLabel(type: AssetType | 'incident'): string {
  if (type === 'incident') {
    return 'Điểm sự cố'
  }

  return formatAssetType(type)
}

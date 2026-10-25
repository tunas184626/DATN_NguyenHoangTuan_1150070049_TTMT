import type { AssetFeature, AssetProperties } from '../../types/gis'
import type { AssetQualityFilter, AssetQualitySummary } from '../../types/operations'

type TechnicalField = 'diameter' | 'material' | 'length' | 'capacity' | 'area' | 'volume'
export const TECHNICAL_LABELS: Record<TechnicalField, string> = {
  diameter: 'Đường kính', material: 'Vật liệu', length: 'Chiều dài', capacity: 'Công suất', area: 'Diện tích', volume: 'Dung tích',
}
const REQUIRED_FIELDS: Partial<Record<AssetProperties['type'], TechnicalField[]>> = {
  pipeline: ['diameter', 'material', 'length'], water_plant: ['capacity'], raw_water_lake: ['area', 'volume'], canal: ['length'], supply_zone: ['area'],
}
const PLACEHOLDERS = new Set(['', '-', '—', 'n/a', 'na', 'null', 'unknown', 'chưa cập nhật', 'chưa có'])
export function isMissingMetadata(value: unknown): boolean {
  return value == null || PLACEHOLDERS.has(String(value).trim().toLocaleLowerCase('vi'))
}
export function assetChecklist(asset: AssetFeature) {
  const fields = REQUIRED_FIELDS[asset.properties.type] ?? []
  return [
    ...fields.map((field) => ({ label: TECHNICAL_LABELS[field], present: !isMissingMetadata(asset.properties[field]) })),
    { label: 'Địa chỉ / mô tả vị trí', present: !isMissingMetadata(asset.properties.address) },
  ]
}
export function matchesAssetQuality(asset: AssetFeature, filter: AssetQualityFilter): boolean {
  if (filter === 'inspection') return asset.properties.status === 'need_inspection'
  if (filter === 'maintenance') return asset.properties.status === 'maintenance'
  if (filter === 'address') return isMissingMetadata(asset.properties.address)
  return (REQUIRED_FIELDS[asset.properties.type] ?? []).some((field) => isMissingMetadata(asset.properties[field]))
}
export function summarizeAssetQuality(assets: AssetFeature[]): AssetQualitySummary {
  return { total: assets.length, technical: assets.filter((asset) => matchesAssetQuality(asset, 'technical')).length,
    address: assets.filter((asset) => matchesAssetQuality(asset, 'address')).length, inspection: assets.filter((asset) => matchesAssetQuality(asset, 'inspection')).length,
    maintenance: assets.filter((asset) => matchesAssetQuality(asset, 'maintenance')).length, generatedAt: new Date().toISOString() }
}

export const QUALITY_GROUPS: Array<{ key: AssetQualityFilter; label: string; hint: string; action: string }> = [
  { key: 'technical', label: 'Thiếu thông số', hint: 'Theo trường kỹ thuật của từng loại tài sản', action: 'Bổ sung thông số' },
  { key: 'address', label: 'Thiếu địa chỉ', hint: 'Bổ sung mô tả để đội hiện trường tìm đúng vị trí', action: 'Hoàn thiện vị trí' },
  { key: 'inspection', label: 'Cần kiểm tra', hint: 'Tài sản được đánh dấu cần kiểm tra hiện trường', action: 'Kiểm tra hiện trường' },
  { key: 'maintenance', label: 'Đang bảo trì', hint: 'Theo dõi tài sản có trạng thái bảo trì', action: 'Cập nhật trạng thái' },
]

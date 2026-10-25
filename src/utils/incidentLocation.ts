import proj4 from 'proj4'
import { parseIncidentPosition } from './coordinates.ts'
export { parseIncidentPosition } from './coordinates.ts'
import type { Geometry } from 'geojson'
import type { AssetFeature, CadVectorMetadata, IncidentAnchor, IncidentReportTarget } from '../types/gis'
import { getFeatureDisplayName } from './textUtils.ts'

type Coordinate = [number, number]

function finitePair(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length >= 2
    && typeof value[0] === 'number' && Number.isFinite(value[0])
    && typeof value[1] === 'number' && Number.isFinite(value[1])
}

function firstCoordinate(value: unknown): Coordinate | null {
  if (finitePair(value)) return [value[0], value[1]]
  if (!Array.isArray(value)) return null
  for (const child of value) {
    const pair = firstCoordinate(child)
    if (pair) return pair
  }
  return null
}

function geometryPosition(geometry: Geometry): Coordinate | null {
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const pair = geometryPosition(child)
      if (pair) return pair
    }
    return null
  }
  // Dùng một điểm trên đối tượng, thay vì tâm bounding box có thể nằm ngoài tuyến/vùng.
  return firstCoordinate(geometry.coordinates)
}

export function buildIncidentAnchor(
  target: IncidentReportTarget,
  metadata: CadVectorMetadata | null,
  availableAssets: AssetFeature[],
  cadClickPosition?: Coordinate,
): IncidentAnchor {
  const properties = target.kind === 'cadImage' ? target.asset : target.feature.properties
  const featureId = properties.id
  const featureName = target.kind === 'cadVector' ? getFeatureDisplayName(target.feature) : properties.name
  const address = typeof properties.address === 'string' && !/tọa độ ảnh|anh CAD \[|ảnh CAD \[/i.test(properties.address) ? properties.address : ''
  const linkedAsset = availableAssets.find((asset) =>
    target.kind === 'asset'
      ? asset.properties.id === featureId && target.feature.properties.type !== 'incident'
      : target.kind === 'cadVector' && (asset.properties.assetCode === featureId || asset.properties.id === featureId),
  )
  const anchor: IncidentAnchor = {
    origin: { kind: target.kind, featureId, featureName, coordinateMethod: 'manual' },
    address,
    assetId: linkedAsset?.properties.id ?? null,
    position: null,
    locationMessage: 'Chọn vị trí trên bản đồ hoặc nhập kinh độ/vĩ độ WGS84 trước khi ghi nhận sự cố.',
  }

  if (target.kind === 'cadImage') {
    anchor.locationMessage = 'Ảnh CAD chưa có vị trí địa lý. Chọn vị trí trên bản đồ hoặc nhập kinh độ/vĩ độ WGS84.'
    return anchor
  }

  const geometry = target.feature.geometry
  const coordinate = target.kind === 'cadVector' && geometry.type !== 'Point' && finitePair(cadClickPosition)
    ? cadClickPosition
    : geometryPosition(geometry)
  if (!coordinate) return anchor

  if (target.kind === 'asset') {
    anchor.position = parseIncidentPosition(String(coordinate[1]), String(coordinate[0]))
    if (anchor.position) {
      anchor.origin.coordinateMethod = 'wgs84'
      anchor.locationMessage = 'Vị trí lấy từ đối tượng đang chọn. Có thể chọn lại trên bản đồ.'
    }
    return anchor
  }

  const spatial = metadata?.spatialReference
  const bounds = metadata?.originalBounds
  if (target.feature.properties.cadSpace !== 'model' || target.feature.properties.layoutArtifact === true
    || target.feature.properties.isLayoutArtifact === true || target.feature.properties.type === 'layout_artifact') {
    anchor.locationMessage = 'Đối tượng thuộc khung/bản vẽ tham chiếu, chưa có vị trí địa lý. Hãy chọn vị trí WGS84.'
    return anchor
  }
  if (spatial?.status !== 'identified_by_spatial_crosscheck' || spatial.sourceCrs?.id !== 'EPSG:9210'
    || spatial.targetCrs?.id !== 'EPSG:4326' || spatial.currentDisplayCoordinateSystem !== 'LOCAL_NORMALIZED'
    || metadata?.transform !== 'normalizedX = x - minX; normalizedY = y - minY'
    || !bounds || !Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) return anchor

  const raw: Coordinate = [coordinate[0] + bounds.minX, coordinate[1] + bounds.minY]
  try {
    const [lng, lat] = proj4(spatial.sourceCrs.proj4, 'EPSG:4326', raw)
    // Giới hạn vùng CAD đã được kiểm tra trong pipeline export của dự án.
    if (lng < 105 || lng > 108 || lat < 9 || lat > 12) return anchor
    anchor.position = parseIncidentPosition(String(lat), String(lng))
    if (anchor.position) {
      anchor.origin.coordinateMethod = 'cad_reprojected'
      anchor.origin.sourceCrs = 'EPSG:9210'
      anchor.origin.cadPosition = raw
      anchor.locationMessage = 'Vị trí được chuyển từ CAD sang WGS84. Có thể chọn lại vị trí sự cố trên bản đồ.'
    }
  } catch {
    // Không dùng tâm bản đồ hoặc tọa độ ảnh làm vị trí sự cố khi chuyển đổi thất bại.
  }
  return anchor
}

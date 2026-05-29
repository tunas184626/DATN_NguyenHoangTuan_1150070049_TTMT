import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Database,
  Droplets,
  Factory,
  Filter,
  Gauge,
  Layers,
  ListChecks,
  LocateFixed,
  MapPin,
  Menu,
  Move,
  PencilLine,
  Plus,
  RefreshCcw,
  Route,
  Search,
  Waves,
  X,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  AnyMapFeature,
  AssetFeature,
  AssetStatus,
  AssetType,
  CadBlueprintAsset,
  CadVectorData,
  CadVectorFeature,
  CadVectorLayerIndexItem,
  CadVectorType,
  DataSourceState,
  GeometryInputType,
  IncidentFeature,
  IncidentSeverity,
  IncidentType,
  IncidentWorkflowStatus,
  LayerDataState,
  LayerKey,
  MapMode,
  NewAssetInput,
  NewIncidentInput,
  ObjectListItem,
  UpdateAssetInput,
  ViewMode,
} from './types/gis'
import { useWebGISData } from './hooks/useWebGISData'
import { CadBlueprintMap } from './components/map/CadBlueprintMap'
import { CadVectorMap, cadVectorTypeLabelForUi } from './components/map/CadVectorMap'
import { CAD_LAYOUT_OPTIONS, CadLayoutPreview } from './components/map/CadLayoutPreview'
import { cadBlueprintAssets, CAD_BLUEPRINT_CONFIG } from './data/cadBlueprintAssets'
import { CURATED_MAIN_WORKS, type CuratedMainWork } from './data/curatedMainWorks'
import { loadCadVectorData } from './services/cadVectorDataService'
import { LAYER_COLORS, LAYER_LABELS, mapFeatureTypeLabel } from './utils/asset'
import { buildSearchItems, flattenLayerData, getFeatureById } from './utils/features'
import {
  buildAssetStatusChart,
  buildIncidentSeverityChart,
  computeDashboardStats,
} from './utils/metrics'
import {
  calculateFeatureLineLengthKm,
  getFeatureBounds,
  getFeatureCenter,
  parseCoordinatePairs,
} from './utils/geo'
import {
  formatIncidentType,
  getAssetStatusMeta,
  getIncidentSeverityMeta,
  getIncidentStatusMeta,
  workflowStatusToAssetStatus,
} from './utils/status'
import {
  cadVectorTypePriority,
  getCadFeatureText,
  getFeatureDisplayName,
  isCadTextFeature,
  isLikelyMojibake,
  isPipeDiameterText,
  normalizeSearchText,
  shouldRenderCadLabel,
  type CadLabelVisibilityOptions,
} from './utils/textUtils'
import {
  GeoJSON,
  LayersControl,
  MapContainer,
  Popup,
  Polyline,
  TileLayer,
  Tooltip as LeafletTooltip,
  useMap,
  CircleMarker,
} from 'react-leaflet'
import type { Layer } from 'leaflet'

const { Overlay } = LayersControl

const BASE_MAP_CENTER: [number, number] = [10.8845, 106.4255]
const BASE_MAP_ZOOM = 13

const STORAGE_UI_KEY = 'webgis-ui-v1'
const CAD_ASSET_STORAGE_KEY = 'webgis-cad-blueprint-assets-v1'
const CAD_CURATED_WORKS_STORAGE_KEY = 'webgis-curated-main-works-v1'
const CAD_BASE_LAYER_KEY = '__baseCadLayer'
const CAD_HTCN_CONTEXT_LAYER_KEY = '__htcnPmvContext'
const CAD_CURATED_MAIN_WORKS_LAYER_KEY = '__curatedMainWorks'
const CAD_LAYOUT_ARTIFACT_LAYER_KEY = '__layoutArtifacts'

const ASSET_LAYER_KEYS: LayerKey[] = [
  'waterPlant',
  'rawWaterLakes',
  'pipelines',
  'canals',
  'supplyZones',
  'boundaries',
  'labels',
]

const CAD_LAYER_KEYS: Array<Exclude<LayerKey, 'incidents'>> = [
  'waterPlant',
  'rawWaterLakes',
  'pipelines',
  'canals',
  'supplyZones',
  'boundaries',
  'labels',
]

const STATUS_FILTERS: Array<{ value: 'all' | AssetStatus; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'need_inspection', label: 'Cần kiểm tra' },
  { value: 'pending_data', label: 'Chờ bổ sung dữ liệu' },
]

const INCIDENT_TYPE_OPTIONS: Array<{ value: IncidentType; label: string }> = [
  { value: 'leak', label: 'Rò rỉ' },
  { value: 'pressure_loss', label: 'Mất áp' },
  { value: 'pipe_burst', label: 'Vỡ ống' },
  { value: 'turbid_water', label: 'Nước đục' },
  { value: 'need_inspection', label: 'Cần kiểm tra' },
]

const INCIDENT_SEVERITY_OPTIONS: Array<{ value: IncidentSeverity; label: string }> = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
]

const INCIDENT_WORKFLOW_OPTIONS: Array<{
  value: IncidentWorkflowStatus
  label: string
}> = [
  { value: 'new', label: 'Mới ghi nhận' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
]

const CAD_VECTOR_TYPE_FILTERS: Array<{ value: CadVectorType | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pipeline', label: 'Tuyến ống' },
  { value: 'water_plant', label: 'Nhà máy nước' },
  { value: 'raw_water_lake', label: 'Hồ nước thô' },
  { value: 'main_work_candidate', label: 'Công trình chính' },
  { value: 'irrigation_canal', label: 'Kênh thủy lợi' },
  { value: 'irrigation_area', label: 'Vùng thủy lợi' },
  { value: 'canal', label: 'Kênh/sông' },
  { value: 'boundary', label: 'Ranh giới' },
  { value: 'pipe_diameter_label', label: 'Nhãn đường kính' },
  { value: 'location_label', label: 'Nhãn địa danh' },
  { value: 'layout_artifact', label: 'Khung/layout CAD' },
  { value: 'cad_point', label: 'Điểm CAD' },
  { value: 'cad_line', label: 'Đường CAD' },
  { value: 'cad_polygon', label: 'Vùng CAD' },
  { value: 'unknown', label: 'Chưa phân loại' },
]

const GEOMETRY_OPTIONS: Array<{ value: GeometryInputType; label: string }> = [
  { value: 'Point', label: 'Điểm (Point)' },
  { value: 'LineString', label: 'Tuyến (LineString)' },
  { value: 'Polygon', label: 'Vùng (Polygon)' },
]

const ASSET_TYPE_OPTIONS: Array<{ value: AssetType; label: string }> = [
  { value: 'water_plant', label: 'Nhà máy nước' },
  { value: 'raw_water_lake', label: 'Hồ chứa nước thô' },
  { value: 'pipeline', label: 'Tuyến ống cấp nước' },
  { value: 'canal', label: 'Kênh/thủy lợi' },
  { value: 'supply_zone', label: 'Khu vực cấp nước' },
  { value: 'boundary', label: 'Ranh giới khu vực' },
  { value: 'label', label: 'Điểm/nhãn CAD' },
]

interface LayerVisibilityState {
  waterPlant: boolean
  rawWaterLakes: boolean
  pipelines: boolean
  canals: boolean
  supplyZones: boolean
  boundaries: boolean
  labels: boolean
  incidents: boolean
}

interface StoredUiState {
  collapsedSidebar: boolean
  collapsedDetail: boolean
  visibleLayers: LayerVisibilityState
}

interface TopbarSearchResult {
  id: string
  label: string
  meta: string
}

interface FlyToRequest {
  feature: AnyMapFeature
  zoom?: number
}

type CadVectorGroupKey =
  | 'htcnContext'
  | 'curatedMainWorks'
  | 'layoutArtifact'
  | 'waterPlants'
  | 'rawWaterLakes'
  | 'irrigation'
  | 'pipeline'
  | 'diameterLabels'
  | 'boundary'
  | 'background'
  | 'unclassified'

type CadVectorViewPresetKey = 'overview' | 'water_plants' | 'raw_water_lakes' | 'irrigation_system'

type CadVectorViewCategory = 'all' | 'water_plants' | 'raw_water_lakes' | 'irrigation_system'

type CadVectorPresetBusinessLayerKey =
  | 'baseCad'
  | 'curatedMainWorks'
  | 'pipelines'
  | 'irrigation'
  | 'boundary'
  | 'background'

type CadVectorPresetRawGroupKey = 'htcnContext' | 'layoutArtifacts' | 'unknown'

interface CadVectorViewPresetConfig {
  key: CadVectorViewPresetKey
  label: string
  description: string
  category: CadVectorViewCategory
  visibleBusinessLayers: Record<CadVectorPresetBusinessLayerKey, boolean>
  visibleRawGroups: Record<CadVectorPresetRawGroupKey, boolean>
  showLayoutArtifacts: boolean
  showCadLabels: boolean
  showDiameterLabels: boolean
  showUnknown: boolean
  fitStrategy: CadVectorViewPresetKey
}

interface CadVectorLayerGroup {
  key: CadVectorGroupKey
  label: string
  description: string
  featureCount: number
  layers: CadVectorLayerIndexItem[]
  defaultExpanded: boolean
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  visibleLayers: LayerVisibilityState
  onToggleLayer: (key: LayerKey) => void
  statusFilter: 'all' | AssetStatus
  onStatusFilterChange: (value: 'all' | AssetStatus) => void
  objectItems: ObjectListItem[]
  selectedId: string | null
  onSelectObject: (id: string) => void
  dataSource: DataSourceState | null
  mapMode: MapMode
  cadImageLoaded: boolean
  cadVectorData: CadVectorData | null
  cadVectorVisibleLayers: Record<string, boolean>
  onToggleCadVectorLayer: (layerName: string) => void
  cadVectorTypeFilter: CadVectorType | 'all'
  onCadVectorTypeFilterChange: (value: CadVectorType | 'all') => void
  cadVectorViewPreset: CadVectorViewPresetKey
  onCadVectorViewPresetChange: (preset: CadVectorViewPresetKey) => void
  cadVectorLabelOptions: CadLabelVisibilityOptions
  onCadVectorLabelOptionChange: (key: keyof CadLabelVisibilityOptions, value: boolean) => void
  curatedMainWorks: CuratedMainWork[]
  positionUpdateTargetId: string | null
  onSelectCuratedMainWork: (id: string) => void
  onStartCuratedMainWorkPositionUpdate: (id: string) => void
  onCancelCuratedMainWorkPositionUpdate: () => void
  onExportCuratedMainWorks: () => void
  cadVectorLayerGroups: CadVectorLayerGroup[]
  expandedCadVectorGroups: Record<string, boolean>
  onToggleCadVectorGroupExpanded: (groupKey: CadVectorGroupKey) => void
  onSetCadVectorLayers: (layerNames: string[], visible: boolean) => void
  selectedLayoutId: string
  onSelectLayoutPreview: (layoutId: string) => void
  onOpenCadVectorMap: () => void
  onOpenCadImage: () => void
  onOpenOsm: () => void
}

interface TopbarProps {
  mapMode: MapMode
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  results: TopbarSearchResult[]
  onSelectResult: (id: string) => void
  cadVectorData: CadVectorData | null
  cadVectorLoading: boolean
}

interface DashboardCardsProps {
  data: LayerDataState
  mapMode: MapMode
  cadVectorData: CadVectorData | null
  curatedMainWorks: CuratedMainWork[]
  cadVectorViewPreset: CadVectorViewPresetKey
}

interface IncidentListProps {
  incidents: IncidentFeature[]
  selectedId: string | null
  onSelectIncident: (id: string) => void
}

interface DetailPanelProps {
  collapsed: boolean
  onToggle: () => void
  feature: AnyMapFeature | null
  cadVectorFeature: CadVectorFeature | null
  cadAsset: CadBlueprintAsset | null
  cadEditMode: boolean
  onToggleCadEdit: () => void
  positionUpdateTargetId: string | null
  onStartCadVectorPositionUpdate: (feature: CadVectorFeature) => void
  onOpenUpdate: (feature: AssetFeature) => void
  onOpenIncident: (feature: AnyMapFeature | null) => void
}

interface AssetFormProps {
  mode: 'create' | 'update'
  feature: AssetFeature | null
  onClose: () => void
  onSubmit: (payload: NewAssetInput | UpdateAssetInput) => void
}

interface IncidentFormProps {
  anchorFeature: AnyMapFeature | null
  onClose: () => void
  onSubmit: (payload: NewIncidentInput) => void
}

interface MapPanelProps {
  data: LayerDataState
  visibleLayers: LayerVisibilityState
  selectedFeatureId: string | null
  hoveredFeatureId: string | null
  onHoverFeature: (id: string | null) => void
  onSelectFeature: (id: string) => void
  flyToRequest: FlyToRequest | null
  onFlyHandled: () => void
  mapVersion: number
}

function statusBadgeClass(status: AssetStatus): string {
  return `status-chip ${getAssetStatusMeta(status).className}`
}

function incidentStatusBadgeClass(status: IncidentWorkflowStatus): string {
  return `status-chip ${getIncidentStatusMeta(status).className}`
}

function severityBadgeClass(severity: IncidentSeverity): string {
  return `status-chip ${getIncidentSeverityMeta(severity).className}`
}

function parseNotes(input: string): string[] {
  return input
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatDate(dateIso: string): string {
  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) {
    return dateIso
  }

  return date.toLocaleDateString('vi-VN')
}

function getCadLayerStatusText(
  dataSource: DataSourceState | null,
  layerKey: Exclude<LayerKey, 'incidents'>,
  cadImageLoaded: boolean,
): string {
  const meta = dataSource?.layers[layerKey]

  if (meta?.status === 'cad_loaded') {
    return `${meta.featureCount} đối tượng đã nạp`
  }

  if (cadImageLoaded) {
    return 'Overlay thủ công trên ảnh CAD'
  }

  if (meta?.status === 'cad_error') {
    return 'Lỗi GeoJSON - đang dùng dữ liệu dự phòng'
  }

  return 'Chưa có dữ liệu / chờ convert từ DWG'
}

const CAD_VECTOR_GROUP_META: Record<
  CadVectorGroupKey,
  { label: string; description: string; defaultExpanded: boolean }
> = {
  curatedMainWorks: {
    label: 'Công trình chính chuẩn hóa',
    description: '5 đối tượng nghiệp vụ chính theo yêu cầu hướng dẫn.',
    defaultExpanded: true,
  },
  htcnContext: {
    label: 'HTCN PMV tham chiếu',
    description: 'Dữ liệu HTCN PMV đầy đủ, chỉ dùng làm nền tham chiếu mờ.',
    defaultExpanded: false,
  },
  layoutArtifact: {
    label: 'Dữ liệu layout/khung bản vẽ',
    description: 'Khung giấy, title block, viewport và bảng chú thích CAD.',
    defaultExpanded: false,
  },
  waterPlants: {
    label: 'Nhà máy nước',
    description: 'Nhà máy nước trong danh sách công trình chính chuẩn hóa.',
    defaultExpanded: true,
  },
  rawWaterLakes: {
    label: 'Hồ nước thô',
    description: 'Hồ nước thô 7ha, 13ha trong danh sách chuẩn hóa.',
    defaultExpanded: true,
  },
  irrigation: {
    label: 'Hệ thống kênh thủy lợi',
    description: 'Kênh, vùng và điểm thủy lợi từ bản đồ khu tưới.',
    defaultExpanded: true,
  },
  pipeline: {
    label: 'Tuyến ống cấp nước',
    description: 'Các tuyến ống chính và nhánh từ layer Pipe/ống.',
    defaultExpanded: true,
  },
  diameterLabels: {
    label: 'Nhãn đường kính ống',
    description: 'OD90, OD160, OD315, OD630 và các nhãn Diameter_Text.',
    defaultExpanded: false,
  },
  boundary: {
    label: 'Ranh giới/khu vực',
    description: 'Ranh giới hành chính, vùng dân cư, vùng cấp nước.',
    defaultExpanded: false,
  },
  background: {
    label: 'Đường giao thông/nền bản đồ',
    description: 'Đường, cầu cống và lớp nền CAD hỗ trợ đọc bản vẽ.',
    defaultExpanded: false,
  },
  unclassified: {
    label: 'Layer chưa phân loại',
    description: 'Các layer CAD còn lại, mặc định giảm rối bản đồ.',
    defaultExpanded: false,
  },
}

const DEFAULT_CAD_LABEL_OPTIONS: CadLabelVisibilityOptions = {
  showMainWorkLabels: true,
  showDiameterLabels: false,
  showIrrigationLabels: false,
  showLocationLabels: false,
  showAllLabels: false,
  hideCorruptedText: true,
}

const viewPresets: Record<CadVectorViewPresetKey, CadVectorViewPresetConfig> = {
  overview: {
    key: 'overview',
    label: 'Tổng quan',
    description: 'Đủ 3 nhóm chính: nhà máy nước, hồ nước thô và kênh thủy lợi.',
    category: 'all',
    visibleBusinessLayers: {
      baseCad: true,
      curatedMainWorks: true,
      pipelines: true,
      irrigation: true,
      boundary: true,
      background: true,
    },
    visibleRawGroups: {
      htcnContext: false,
      layoutArtifacts: false,
      unknown: false,
    },
    showLayoutArtifacts: false,
    showCadLabels: false,
    showDiameterLabels: false,
    showUnknown: false,
    fitStrategy: 'overview',
  },
  water_plants: {
    key: 'water_plants',
    label: 'Nhà máy nước',
    description: 'NMN Hòa Khánh Tây và NMN Đức Hòa 3, có nền CAD/ống tham chiếu.',
    category: 'water_plants',
    visibleBusinessLayers: {
      baseCad: true,
      curatedMainWorks: true,
      pipelines: true,
      irrigation: false,
      boundary: true,
      background: true,
    },
    visibleRawGroups: {
      htcnContext: false,
      layoutArtifacts: false,
      unknown: false,
    },
    showLayoutArtifacts: false,
    showCadLabels: false,
    showDiameterLabels: false,
    showUnknown: false,
    fitStrategy: 'water_plants',
  },
  raw_water_lakes: {
    key: 'raw_water_lakes',
    label: 'Hồ nước thô',
    description: 'Hồ 7ha xã Hậu Nghĩa và hồ 13ha xã Mỹ Hạnh.',
    category: 'raw_water_lakes',
    visibleBusinessLayers: {
      baseCad: true,
      curatedMainWorks: true,
      pipelines: true,
      irrigation: true,
      boundary: true,
      background: true,
    },
    visibleRawGroups: {
      htcnContext: false,
      layoutArtifacts: false,
      unknown: false,
    },
    showLayoutArtifacts: false,
    showCadLabels: false,
    showDiameterLabels: false,
    showUnknown: false,
    fitStrategy: 'raw_water_lakes',
  },
  irrigation_system: {
    key: 'irrigation_system',
    label: 'Kênh thủy lợi',
    description: 'Hệ thống kênh thủy lợi từ bản vẽ khu tưới.',
    category: 'irrigation_system',
    visibleBusinessLayers: {
      baseCad: true,
      curatedMainWorks: false,
      pipelines: false,
      irrigation: true,
      boundary: true,
      background: true,
    },
    visibleRawGroups: {
      htcnContext: false,
      layoutArtifacts: false,
      unknown: false,
    },
    showLayoutArtifacts: false,
    showCadLabels: false,
    showDiameterLabels: false,
    showUnknown: false,
    fitStrategy: 'irrigation_system',
  },
}

const CAD_VECTOR_VIEW_PRESETS = Object.values(viewPresets)

function classifyCadVectorLayerGroup(layer: CadVectorLayerIndexItem): CadVectorGroupKey {
  const layerName = layer.layerName.toUpperCase()
  const inferredType = layer.inferredType
  const typeCounts = layer.typeCounts ?? {}
  const sourceGroup = layer.sourceGroup ?? layer.sourceGroups?.[0]
  const paperOnly = (layer.cadSpaceCounts?.paper ?? 0) > 0 && (layer.cadSpaceCounts?.model ?? 0) === 0

  if (inferredType === 'layout_artifact' || typeCounts.layout_artifact) {
    return 'layoutArtifact'
  }

  if (sourceGroup === 'irrigation' || typeCounts.irrigation_canal || typeCounts.irrigation_area || typeCounts.irrigation_point || typeCounts.irrigation_label) {
    return 'irrigation'
  }

  if (sourceGroup === 'main_works') {
    return 'htcnContext'
  }

  if (inferredType === 'water_plant' || typeCounts.water_plant) {
    return 'waterPlants'
  }

  if (inferredType === 'raw_water_lake' || typeCounts.raw_water_lake) {
    return 'rawWaterLakes'
  }

  if (inferredType === 'main_work_candidate' || typeCounts.main_work_candidate) {
    return 'htcnContext'
  }

  if (
    inferredType === 'pipe_diameter_label' ||
    typeCounts.pipe_diameter_label ||
    layerName.includes('DIAMETER_TEXT') ||
    /\bOD\d+|\bD\d+/.test(layerName)
  ) {
    return 'diameterLabels'
  }

  if (inferredType === 'location_label' || layerName.includes('CNTV-TEXT')) {
    return 'unclassified'
  }

  if (paperOnly) {
    return 'layoutArtifact'
  }

  if (
    inferredType === 'pipeline' ||
    typeCounts.pipeline ||
    layerName.includes('PIPE') ||
    /(^|[^A-Z0-9])ONG([^A-Z0-9]|$)/.test(layerName) ||
    layerName.includes('TUYEN ONG')
  ) {
    return 'pipeline'
  }

  if (
    inferredType === 'canal' ||
    typeCounts.canal ||
    layerName.includes('SONG') ||
    /(^|[^A-Z0-9])HO([^A-Z0-9]|$)/.test(layerName) ||
    layerName.includes('KENH') ||
    layerName.includes('THUY')
  ) {
    return 'irrigation'
  }

  if (
    layerName.includes('DUONG') ||
    layerName.includes('NEN') ||
    layerName.includes('CAU') ||
    layerName.includes('CONG') ||
    layerName.startsWith('XR_NEN')
  ) {
    return 'background'
  }

  if (
    inferredType === 'boundary' ||
    inferredType === 'supply_zone' ||
    inferredType === 'cad_polygon' ||
    layerName.includes('RANH') ||
    layerName.includes('BOUNDARY') ||
    layerName.includes('VUNG') ||
    layerName.includes('KHU')
  ) {
    return 'boundary'
  }

  return 'unclassified'
}

function buildCadVectorLayerGroups(layerIndex: CadVectorLayerIndexItem[]): CadVectorLayerGroup[] {
  const groups = new Map<CadVectorGroupKey, CadVectorLayerIndexItem[]>()

  for (const layer of layerIndex) {
    const groupKey = classifyCadVectorLayerGroup(layer)
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), layer])
  }

  return (Object.keys(CAD_VECTOR_GROUP_META) as CadVectorGroupKey[]).map((key) => {
    const layers = groups.get(key) ?? []
    const meta = CAD_VECTOR_GROUP_META[key]

    return {
      key,
      label: meta.label,
      description: meta.description,
      defaultExpanded: meta.defaultExpanded,
      featureCount: layers.reduce((sum, layer) => sum + layer.featureCount, 0),
      layers,
    }
  })
}

function cadVectorTypeToLayerKey(type: CadVectorType): LayerKey {
  switch (type) {
    case 'water_plant':
      return 'waterPlant'
    case 'raw_water_lake':
      return 'rawWaterLakes'
    case 'pipeline':
      return 'pipelines'
    case 'canal':
    case 'irrigation_canal':
    case 'irrigation_area':
    case 'irrigation_point':
    case 'irrigation_label':
      return 'canals'
    case 'supply_zone':
      return 'supplyZones'
    case 'boundary':
      return 'boundaries'
    case 'pipe_diameter_label':
    case 'location_label':
    case 'main_work_candidate':
    case 'layout_artifact':
    case 'road_background':
    case 'cad_point':
    case 'cad_line':
    case 'cad_polygon':
    case 'unknown':
      return 'labels'
  }
}

function getCadVectorLayerCount(layerIndex: CadVectorLayerIndexItem[]): number {
  return layerIndex.filter((layer) => layer.featureCount > 0).length
}

function isCadVectorTextFeature(feature: CadVectorFeature): boolean {
  return isCadTextFeature(feature)
}

function isCuratedCadVectorFeature(feature: CadVectorFeature): boolean {
  return feature.properties.curatedMainWork === true
}

function isBaseCadReferenceFeature(feature: CadVectorFeature): boolean {
  return (
    feature.properties.sourceGroup === 'cad_base' &&
    feature.properties.type !== 'pipeline' &&
    feature.properties.type !== 'pipe_diameter_label'
  )
}

function isLayoutArtifactFeature(feature: CadVectorFeature): boolean {
  const type = String(feature.properties.type)
  return (
    type === 'layout_artifact' ||
    type === 'layout_frame' ||
    type === 'cad_layout_artifact' ||
    feature.properties.layoutArtifact === true ||
    feature.properties.isLayoutArtifact === true
  )
}

function isGroupVisibleForPreset(preset: CadVectorViewPresetKey, groupKey: CadVectorGroupKey): boolean {
  const config = viewPresets[preset]

  switch (groupKey) {
    case 'curatedMainWorks':
    case 'waterPlants':
    case 'rawWaterLakes':
      return config.visibleBusinessLayers.curatedMainWorks
    case 'pipeline':
      return config.visibleBusinessLayers.pipelines
    case 'irrigation':
      return config.visibleBusinessLayers.irrigation
    case 'boundary':
      return config.visibleBusinessLayers.boundary
    case 'background':
      return config.visibleBusinessLayers.background
    case 'diameterLabels':
      return config.showDiameterLabels
    case 'htcnContext':
      return config.visibleRawGroups.htcnContext
    case 'layoutArtifact':
      return config.showLayoutArtifacts
    case 'unclassified':
      return config.showUnknown
  }
}

function getLabelOptionsForPreset(preset: CadVectorViewPresetKey): CadLabelVisibilityOptions {
  const config = viewPresets[preset]

  return {
    showMainWorkLabels: true,
    showDiameterLabels: config.showDiameterLabels,
    showIrrigationLabels: config.showCadLabels,
    showLocationLabels: config.showCadLabels,
    showAllLabels: config.showCadLabels,
    hideCorruptedText: true,
  }
}

function createCadVectorLayerVisibility(
  layerIndex: CadVectorLayerIndexItem[],
  preset: CadVectorViewPresetKey,
): Record<string, boolean> {
  const config = viewPresets[preset]
  const next: Record<string, boolean> = {
    [CAD_BASE_LAYER_KEY]: config.visibleBusinessLayers.baseCad,
    [CAD_HTCN_CONTEXT_LAYER_KEY]: config.visibleRawGroups.htcnContext,
    [CAD_CURATED_MAIN_WORKS_LAYER_KEY]: config.visibleBusinessLayers.curatedMainWorks,
    [CAD_LAYOUT_ARTIFACT_LAYER_KEY]: config.showLayoutArtifacts,
  }

  for (const layer of layerIndex) {
    const groupKey = classifyCadVectorLayerGroup(layer)
    next[layer.layerKey ?? layer.layerName] = isGroupVisibleForPreset(preset, groupKey)
  }

  return next
}

function isCadVectorObjectVisible(
  feature: CadVectorFeature,
  visibleLayers: Record<string, boolean>,
  typeFilter: CadVectorType | 'all',
  labelOptions: CadLabelVisibilityOptions,
): boolean {
  if (isCuratedCadVectorFeature(feature) && visibleLayers[CAD_CURATED_MAIN_WORKS_LAYER_KEY] === false) {
    return false
  }

  if (isLayoutArtifactFeature(feature) && visibleLayers[CAD_LAYOUT_ARTIFACT_LAYER_KEY] === false) {
    return false
  }

  if (isBaseCadReferenceFeature(feature) && visibleLayers[CAD_BASE_LAYER_KEY] === false) {
    return false
  }

  if (
    feature.properties.sourceGroup === 'main_works' &&
    !isCuratedCadVectorFeature(feature) &&
    visibleLayers[CAD_HTCN_CONTEXT_LAYER_KEY] === false
  ) {
    return false
  }

  const layerKey = feature.properties.layerKey ?? feature.properties.cadLayer
  if (visibleLayers[layerKey] === false || visibleLayers[feature.properties.cadLayer] === false) {
    return false
  }

  if (typeFilter !== 'all' && feature.properties.type !== typeFilter) {
    return false
  }

  if (isCadVectorTextFeature(feature) && !shouldRenderCadLabel(feature, labelOptions)) {
    return false
  }

  return true
}

function createCadVectorObjectList(
  cadVectorData: CadVectorData | null,
  visibleLayers: Record<string, boolean>,
  typeFilter: CadVectorType | 'all',
  labelOptions: CadLabelVisibilityOptions,
): ObjectListItem[] {
  const features = cadVectorData?.entities?.features ?? []

  return features
    .filter((feature) => isCadVectorObjectVisible(feature, visibleLayers, typeFilter, labelOptions))
    .sort(
      (a, b) =>
        cadVectorTypePriority(a.properties.type, getCadFeatureText(a)) -
          cadVectorTypePriority(b.properties.type, getCadFeatureText(b)) ||
        a.properties.id.localeCompare(b.properties.id),
    )
    .slice(0, 600)
    .map((feature) => ({
      id: feature.properties.id,
      name: getFeatureDisplayName(feature),
      typeLabel: cadVectorTypeLabelForUi(feature.properties.type),
      statusLabel: feature.properties.businessGroup || feature.properties.cadLayer,
      status: feature.properties.status,
      layerKey: cadVectorTypeToLayerKey(feature.properties.type),
      meta: `${feature.properties.cadLayer} | ${feature.properties.geometryType}`,
    }))
}

function calculateCadVectorLineLength(feature: CadVectorFeature): number {
  if (!['LineString', 'MultiLineString'].includes(feature.geometry.type) || !('coordinates' in feature.geometry)) {
    return 0
  }

  const lineLength = (coordinates: unknown): number => {
    if (!Array.isArray(coordinates)) {
      return 0
    }

    let length = 0
    for (let index = 1; index < coordinates.length; index += 1) {
      const previous = coordinates[index - 1]
      const current = coordinates[index]
      if (
        Array.isArray(previous) &&
        Array.isArray(current) &&
        typeof previous[0] === 'number' &&
        typeof previous[1] === 'number' &&
        typeof current[0] === 'number' &&
        typeof current[1] === 'number'
      ) {
        length += Math.hypot(current[0] - previous[0], current[1] - previous[1])
      }
    }

    return length
  }

  if (feature.geometry.type === 'LineString') {
    return lineLength(feature.geometry.coordinates)
  }

  return (feature.geometry.coordinates as unknown[]).reduce<number>((sum, line) => sum + lineLength(line), 0)
}

function calculateCadVectorTotalLineLength(data: CadVectorData | null): number {
  const lineFeatures =
    data?.lines?.features ??
    data?.entities?.features.filter((feature) =>
      ['LineString', 'MultiLineString'].includes(feature.geometry.type),
    ) ??
    []

  return lineFeatures.reduce((sum, feature) => sum + calculateCadVectorLineLength(feature), 0)
}

function getFirstFeatureId(data: LayerDataState): string | null {
  for (const layerKey of [...ASSET_LAYER_KEYS, 'incidents'] as LayerKey[]) {
    const feature = data[layerKey].features[0]
    if (feature) {
      return feature.properties.id
    }
  }

  return null
}

function getCadAssetCenter(asset: CadBlueprintAsset): [number, number] {
  const coordinates = asset.geometryType === 'Point' ? (asset.cadPosition ? [asset.cadPosition] : []) : asset.cadPath ?? []

  if (!coordinates.length) {
    return [0, 0]
  }

  const sum = coordinates.reduce(
    (total, [y, x]) => ({
      y: total.y + y,
      x: total.x + x,
    }),
    { y: 0, x: 0 },
  )

  return [Math.round(sum.y / coordinates.length), Math.round(sum.x / coordinates.length)]
}

function loadCadAssetsFromStorage(): CadBlueprintAsset[] {
  try {
    const stored = localStorage.getItem(CAD_ASSET_STORAGE_KEY)
    if (!stored) {
      return cadBlueprintAssets
    }

    const parsed = JSON.parse(stored) as CadBlueprintAsset[]
    const storedById = new Map(parsed.map((asset) => [asset.id, asset]))

    return cadBlueprintAssets.map((asset) => ({
      ...asset,
      ...storedById.get(asset.id),
    }))
  } catch {
    return cadBlueprintAssets
  }
}

function loadCuratedMainWorksFromStorage(): CuratedMainWork[] {
  try {
    const stored = localStorage.getItem(CAD_CURATED_WORKS_STORAGE_KEY)
    if (!stored) {
      return CURATED_MAIN_WORKS
    }

    const parsed = JSON.parse(stored) as CuratedMainWork[]
    const storedById = new Map(parsed.map((work) => [work.id, work]))

    return CURATED_MAIN_WORKS.map((work) => ({
      ...work,
      ...storedById.get(work.id),
      notes: storedById.get(work.id)?.notes ?? work.notes,
    }))
  } catch {
    return CURATED_MAIN_WORKS
  }
}

function walkCadCoordinates(coordinates: unknown, visitor: (x: number, y: number) => void) {
  if (!Array.isArray(coordinates)) {
    return
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    visitor(coordinates[0], coordinates[1])
    return
  }

  for (const child of coordinates) {
    walkCadCoordinates(child, visitor)
  }
}

function getCadVectorFeatureCadCenter(feature: CadVectorFeature): [number, number] | null {
  if (!('coordinates' in feature.geometry)) {
    return null
  }

  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  }

  walkCadCoordinates(feature.geometry.coordinates, (x, y) => {
    bounds.minX = Math.min(bounds.minX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.maxY = Math.max(bounds.maxY, y)
  })

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    return null
  }

  return [
    Math.round(((bounds.minX + bounds.maxX) / 2) * 1000) / 1000,
    Math.round(((bounds.minY + bounds.maxY) / 2) * 1000) / 1000,
  ]
}

function getCadVectorFeatureSearchText(feature: CadVectorFeature): string {
  return normalizeSearchText(
    [
      feature.properties.id,
      feature.properties.name,
      feature.properties.displayName,
      feature.properties.Text,
      feature.properties.originalText,
      feature.properties.normalizedText,
      feature.properties.cadLayer,
      feature.properties.sourceName,
      feature.properties.originalFile,
      feature.properties.type,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function inferCuratedMainWorkPosition(
  work: CuratedMainWork,
  cadVectorData: CadVectorData | null,
): [number, number] | undefined {
  const features = cadVectorData?.entities?.features ?? []

  const targetText = normalizeSearchText(`${work.displayName} ${work.name}`)
  const candidates = features
    .filter((feature) => feature.properties.sourceGroup === 'main_works')
    .filter((feature) => feature.properties.type === work.type)
    .map((feature) => ({ feature, text: getCadVectorFeatureSearchText(feature) }))

  const matched =
    candidates.find(({ text }) => work.id.includes('hoa-khanh') && text.includes('hoa khanh')) ??
    candidates.find(({ text }) => work.id.includes('duc-hoa-3') && text.includes('duc hoa 3')) ??
    candidates.find(({ text }) => work.id.includes('13ha') && text.includes('13ha')) ??
    candidates.find(({ text }) => work.id.includes('7ha') && text.includes('7ha')) ??
    candidates.find(({ text }) =>
      targetText
        .split(' ')
        .filter((token) => token.length >= 3)
        .every((token) => text.includes(token)),
    )

  return matched ? getCadVectorFeatureCadCenter(matched.feature) ?? undefined : undefined
}

function resolveCuratedMainWorks(
  works: CuratedMainWork[],
  cadVectorData: CadVectorData | null,
): CuratedMainWork[] {
  return works.map((work) => {
    const inferredPosition = work.cadPosition ?? inferCuratedMainWorkPosition(work, cadVectorData)

    return {
      ...work,
      cadPosition: inferredPosition,
      status: inferredPosition ? 'positioned' : 'needs_position',
    }
  })
}

function curatedWorkTypeToCadVectorType(work: CuratedMainWork): CadVectorType {
  return work.type
}

function buildCuratedMainWorkFeature(work: CuratedMainWork): CadVectorFeature | null {
  if (!work.cadPosition) {
    return null
  }

  const sourceGroup = 'main_works'
  const cadType = curatedWorkTypeToCadVectorType(work)

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: work.cadPosition,
    },
    properties: {
      id: work.id,
      name: work.displayName,
      displayName: work.displayName,
      type: cadType,
      status: work.status,
      source: work.source,
      sourceFormat: 'DWG -> DXF -> QGIS -> GeoJSON -> curated WebGIS',
      sourceGroup,
      sourceName: work.source,
      businessGroup: 'Công trình chính chuẩn hóa',
      layerKey: CAD_CURATED_MAIN_WORKS_LAYER_KEY,
      cadLayer: 'Công trình chính chuẩn hóa',
      cadEntityType: 'CURATED_POINT',
      geometryType: 'Point',
      description: work.description,
      originalFile: work.source,
      cadSpace: 'model',
      Text: work.displayName,
      originalText: work.displayName,
      normalizedText: work.name,
      EntityHandle: work.id,
      curatedMainWork: true,
      curatedMainWorkId: work.id,
      manuallyPositioned: work.manuallyPositioned,
      notes: work.notes,
    },
  }
}

function buildCuratedMainWorkCollection(works: CuratedMainWork[]): CadVectorFeature[] {
  return works
    .map(buildCuratedMainWorkFeature)
    .filter((feature): feature is CadVectorFeature => Boolean(feature))
}

function mergeCadVectorDataWithCurated(
  cadVectorData: CadVectorData | null,
  curatedFeatures: CadVectorFeature[],
): CadVectorData | null {
  if (!cadVectorData?.entities) {
    return cadVectorData
  }

  const curatedIds = new Set(curatedFeatures.map((feature) => feature.properties.id))
  const rawFeatures = cadVectorData.entities.features.filter((feature) => !curatedIds.has(feature.properties.id))

  return {
    ...cadVectorData,
    entities: {
      ...cadVectorData.entities,
      features: [...rawFeatures, ...curatedFeatures],
    },
  }
}

function getAppCadFeatureBounds(feature: CadVectorFeature): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  pointCount: number
} | null {
  if (!('coordinates' in feature.geometry)) {
    return null
  }

  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    pointCount: 0,
  }

  walkCadCoordinates(feature.geometry.coordinates, (x, y) => {
    bounds.minX = Math.min(bounds.minX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.maxY = Math.max(bounds.maxY, y)
    bounds.pointCount += 1
  })

  return Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY) ? bounds : null
}

function isLikelyCadLayoutArtifactForView(feature: CadVectorFeature, cadVectorData: CadVectorData | null): boolean {
  if (isLayoutArtifactFeature(feature)) {
    return true
  }

  const haystack = normalizeSearchText(
    [
      feature.properties.cadLayer,
      feature.properties.name,
      feature.properties.Text,
      feature.properties.originalText,
      feature.properties.cadSpace,
      feature.properties.PaperSpace,
    ]
      .filter(Boolean)
      .join(' '),
  )
  const layoutTerms = [
    'khung',
    'frame',
    'layout',
    'title',
    'legend',
    'chu thich',
    'chú thích',
    'bang',
    'bảng',
    'viewport',
    'paper',
    'border',
  ]

  if (feature.properties.cadSpace === 'paper' || layoutTerms.some((term) => haystack.includes(normalizeSearchText(term)))) {
    return true
  }

  if (feature.properties.sourceGroup !== 'main_works' && feature.properties.sourceGroup !== 'irrigation') {
    return false
  }

  if (!['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
    return false
  }

  const mapBounds = cadVectorData?.metadata?.normalizedBounds
  const featureBounds = getAppCadFeatureBounds(feature)
  if (!mapBounds || !featureBounds) {
    return false
  }

  const mapWidth = Math.max(mapBounds.maxX - mapBounds.minX, 1)
  const mapHeight = Math.max(mapBounds.maxY - mapBounds.minY, 1)
  const widthRatio = (featureBounds.maxX - featureBounds.minX) / mapWidth
  const heightRatio = (featureBounds.maxY - featureBounds.minY) / mapHeight

  return featureBounds.pointCount <= 120 && (widthRatio >= 0.4 || heightRatio >= 0.4)
}

function isFloatingIrrigationAnnotationFeature(feature: CadVectorFeature): boolean {
  if (feature.properties.sourceGroup !== 'irrigation') {
    return false
  }

  const layerName = normalizeSearchText(feature.properties.cadLayer)
  if (['ghichu', 'ghi chu', 'ky hieu', 'defpoints'].some((term) => layerName.includes(term))) {
    return true
  }

  const bounds = getAppCadFeatureBounds(feature)
  if (!bounds || !['LineString', 'MultiLineString'].includes(feature.geometry.type)) {
    return false
  }

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const isSmallDetachedStroke = width <= 1800 && height <= 900 && bounds.pointCount <= 12
  const inUpperAnnotationStrip = centerX >= 569000 && centerY >= 1211800

  return inUpperAnnotationStrip && isSmallDetachedStroke && !layerName.includes('duongchinh')
}

function isUpperDetachedCadScratchFeature(feature: CadVectorFeature): boolean {
  if (!['LineString', 'MultiLineString'].includes(feature.geometry.type)) {
    return false
  }

  const bounds = getAppCadFeatureBounds(feature)
  if (!bounds) {
    return false
  }

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const layerName = normalizeSearchText(feature.properties.cadLayer)
  const isUpperLooseStroke = centerX >= 577000 && centerX <= 584500 && centerY >= 1212500 && centerY <= 1214300
  const isSmallStroke = width <= 1900 && height <= 260 && bounds.pointCount <= 10
  const isKnownAnnotationLayer = ['ghichu', 'ghi chu', 'ky hieu', 'defpoints'].some((term) => layerName.includes(term))

  return isUpperLooseStroke && (isSmallStroke || isKnownAnnotationLayer)
}

function isPrimaryCadVectorFeature(feature: CadVectorFeature, cadVectorData: CadVectorData | null): boolean {
  if (feature.properties.curatedMainWork === true) {
    return true
  }

  if (isLikelyCadLayoutArtifactForView(feature, cadVectorData)) {
    return false
  }

  if (isFloatingIrrigationAnnotationFeature(feature)) {
    return false
  }

  if (isUpperDetachedCadScratchFeature(feature)) {
    return false
  }

  if (feature.properties.sourceGroup === 'main_works') {
    return false
  }

  if (feature.properties.type === 'unknown') {
    return false
  }

  if (
    isCadVectorTextFeature(feature) &&
    feature.properties.type !== 'pipe_diameter_label' &&
    feature.properties.type !== 'water_plant' &&
    feature.properties.type !== 'raw_water_lake'
  ) {
    return false
  }

  return true
}

function filterCadVectorDataForView(
  cadVectorData: CadVectorData | null,
  viewKey: CadVectorViewPresetKey,
): CadVectorData | null {
  if (!cadVectorData?.entities) {
    return cadVectorData
  }

  void viewKey
  const primaryFeatures = cadVectorData.entities.features.filter((feature) =>
    isPrimaryCadVectorFeature(feature, cadVectorData),
  )

  return {
    ...cadVectorData,
    entities: {
      ...cadVectorData.entities,
      features: primaryFeatures,
    },
    hasCadVectorData: cadVectorData.hasCadVectorData,
  }
}

function getPreferredCadFeatureForView(
  features: CadVectorFeature[],
  viewKey: CadVectorViewPresetKey,
): CadVectorFeature | null {
  if (viewKey === 'water_plants') {
    return features.find((feature) => feature.properties.curatedMainWork === true && feature.properties.type === 'water_plant') ?? null
  }

  if (viewKey === 'raw_water_lakes') {
    return features.find((feature) => feature.properties.curatedMainWork === true && feature.properties.type === 'raw_water_lake') ?? null
  }

  if (viewKey === 'irrigation_system') {
    return features.find((feature) => feature.properties.sourceGroup === 'irrigation') ?? null
  }

  return features.find((feature) => feature.properties.curatedMainWork === true) ?? features[0] ?? null
}

function createCadObjectList(
  assets: CadBlueprintAsset[],
  visibleLayers: LayerVisibilityState,
  statusFilter: 'all' | AssetStatus,
): ObjectListItem[] {
  return assets
    .filter((asset) => visibleLayers[asset.layerKey])
    .filter((asset) => statusFilter === 'all' || asset.status === statusFilter)
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      typeLabel: mapFeatureTypeLabel(asset.type),
      statusLabel: getAssetStatusMeta(asset.status).label,
      status: asset.status,
      layerKey: asset.layerKey,
    }))
}

function createObjectList(
  data: LayerDataState,
  visibleLayers: LayerVisibilityState,
  statusFilter: 'all' | AssetStatus,
): ObjectListItem[] {
  return flattenLayerData(data)
    .filter(({ layerKey, feature }) => {
      if (!visibleLayers[layerKey]) {
        return false
      }

      if (feature.properties.type === 'incident') {
        if (statusFilter === 'all') {
          return true
        }

        return workflowStatusToAssetStatus(feature.properties.status) === statusFilter
      }

      if (statusFilter === 'all') {
        return true
      }

      return feature.properties.status === statusFilter
    })
    .map(({ feature, layerKey }) => {
      const statusLabel =
        feature.properties.type === 'incident'
          ? getIncidentStatusMeta(feature.properties.status).label
          : getAssetStatusMeta(feature.properties.status).label

      return {
        id: feature.properties.id,
        name: feature.properties.name,
        typeLabel: mapFeatureTypeLabel(feature.properties.type),
        statusLabel,
        status: feature.properties.status,
        layerKey,
      }
    })
}

function applyFeatureStyle(
  layerKey: LayerKey,
  selected: boolean,
  hovered: boolean,
): {
  color: string
  weight: number
  fillOpacity: number
  opacity: number
  fillColor: string
  dashArray?: string
} {
  const base = LAYER_COLORS[layerKey]
  const weight = selected ? 5 : hovered ? 4 : 3
  const fillOpacity =
    layerKey === 'boundaries' ? 0.04 : selected ? 0.35 : hovered ? 0.28 : 0.18
  const opacity = selected ? 1 : hovered ? 0.92 : 0.75

  return {
    color: base,
    weight,
    fillOpacity,
    opacity,
    fillColor: base,
    dashArray: layerKey === 'boundaries' ? '6 6' : undefined,
  }
}

function MapFlyController({ request, onHandled }: { request: FlyToRequest | null; onHandled: () => void }) {
  const map = useMap()

  useEffect(() => {
    if (!request) {
      return
    }

    const bounds = getFeatureBounds(request.feature)

    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: request.zoom ?? 16 })
    } else {
      const center = getFeatureCenter(request.feature)
      map.flyTo(center, request.zoom ?? 16, { duration: 1.1 })
    }

    onHandled()
  }, [map, onHandled, request])

  return null
}

function MapDataBoundsController({ data }: { data: LayerDataState }) {
  const map = useMap()

  useEffect(() => {
    const bounds = flattenLayerData(data)
      .map(({ feature }) => getFeatureBounds(feature))
      .filter((item): item is [[number, number], [number, number]] => Boolean(item))

    if (!bounds.length) {
      return
    }

    const minLat = Math.min(...bounds.map((item) => item[0][0]))
    const minLng = Math.min(...bounds.map((item) => item[0][1]))
    const maxLat = Math.max(...bounds.map((item) => item[1][0]))
    const maxLng = Math.max(...bounds.map((item) => item[1][1]))

    map.fitBounds(
      [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
      { padding: [36, 36], maxZoom: 15 },
    )
  }, [data, map])

  return null
}

function RenderFeatureLayer({
  layerKey,
  features,
  selectedFeatureId,
  hoveredFeatureId,
  onHoverFeature,
  onSelectFeature,
}: {
  layerKey: LayerKey
  features: AnyMapFeature[]
  selectedFeatureId: string | null
  hoveredFeatureId: string | null
  onHoverFeature: (id: string | null) => void
  onSelectFeature: (id: string) => void
}) {
  return (
    <>
      {features.map((feature) => {
        const featureId = feature.properties.id
        const selected = selectedFeatureId === featureId
        const hovered = hoveredFeatureId === featureId

        if (feature.geometry.type === 'Point') {
          const center = getFeatureCenter(feature)
          const markerStyle = applyFeatureStyle(layerKey, selected, hovered)
          const markerRadius = layerKey === 'labels' ? 5 : selected ? 9 : hovered ? 8 : 7

          return (
            <CircleMarker
              key={featureId}
              center={center}
              radius={markerRadius}
              pathOptions={{
                ...markerStyle,
                fillOpacity: selected ? 0.9 : hovered ? 0.82 : 0.72,
              }}
              eventHandlers={{
                click: () => onSelectFeature(featureId),
                mouseover: () => onHoverFeature(featureId),
                mouseout: () => onHoverFeature(null),
              }}
            >
              <LeafletTooltip direction="top" opacity={0.95} permanent={layerKey === 'labels'}>
                <div className="text-xs font-semibold">{feature.properties.name}</div>
              </LeafletTooltip>
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{feature.properties.name}</p>
                  <p>Loại: {mapFeatureTypeLabel(feature.properties.type)}</p>
                </div>
              </Popup>
            </CircleMarker>
          )
        }

        if (feature.geometry.type === 'LineString') {
          return (
            <Polyline
              key={featureId}
              positions={feature.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
              pathOptions={applyFeatureStyle(layerKey, selected, hovered)}
              eventHandlers={{
                click: () => onSelectFeature(featureId),
                mouseover: () => onHoverFeature(featureId),
                mouseout: () => onHoverFeature(null),
              }}
            >
              <LeafletTooltip sticky>
                <div className="text-xs font-semibold">{feature.properties.name}</div>
              </LeafletTooltip>
            </Polyline>
          )
        }

        return (
          <GeoJSON
            key={featureId}
            data={feature as never}
            style={() => applyFeatureStyle(layerKey, selected, hovered)}
            eventHandlers={{
              click: () => onSelectFeature(featureId),
              mouseover: () => onHoverFeature(featureId),
              mouseout: () => onHoverFeature(null),
            }}
            onEachFeature={(_, layer: Layer) => {
              layer.bindTooltip(feature.properties.name)
            }}
          />
        )
      })}
    </>
  )
}

function WebGISMapPanel({
  data,
  visibleLayers,
  selectedFeatureId,
  hoveredFeatureId,
  onHoverFeature,
  onSelectFeature,
  flyToRequest,
  onFlyHandled,
  mapVersion,
}: MapPanelProps) {
  const layerData = useMemo(
    () => ({
      waterPlant: data.waterPlant.features,
      rawWaterLakes: data.rawWaterLakes.features,
      pipelines: data.pipelines.features,
      canals: data.canals.features,
      supplyZones: data.supplyZones.features,
      boundaries: data.boundaries.features,
      labels: data.labels.features,
      incidents: data.incidents.features,
    }),
    [data],
  )

  const incidentStyle = useMemo(
    () => ({ color: '#dc2626', weight: 5, fillColor: '#dc2626', fillOpacity: 0.5, opacity: 1 }),
    [],
  )

  return (
    <div className="panel relative h-full min-h-[580px] overflow-hidden">
      <div className="absolute left-4 top-4 z-[800] flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const targetId = selectedFeatureId ?? getFirstFeatureId(data)
            if (targetId) {
              onSelectFeature(targetId)
            }
          }}
          className="ghost-btn h-9 px-3"
        >
          <LocateFixed className="mr-2 size-4" />
          Zoom tới đối tượng
        </button>
      </div>

      <MapContainer
        key={mapVersion}
        center={BASE_MAP_CENTER}
        zoom={BASE_MAP_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LayersControl position="topright">
          {ASSET_LAYER_KEYS.map((layerKey) => (
            <Overlay key={layerKey} checked={visibleLayers[layerKey]} name={LAYER_LABELS[layerKey]}>
              <div>
                {visibleLayers[layerKey] && (
                  <RenderFeatureLayer
                    layerKey={layerKey}
                    features={layerData[layerKey]}
                    selectedFeatureId={selectedFeatureId}
                    hoveredFeatureId={hoveredFeatureId}
                    onHoverFeature={onHoverFeature}
                    onSelectFeature={onSelectFeature}
                  />
                )}
              </div>
            </Overlay>
          ))}

          <Overlay checked={visibleLayers.incidents} name={LAYER_LABELS.incidents}>
            <div>
              {visibleLayers.incidents && (
                <>
                  <RenderFeatureLayer
                    layerKey="incidents"
                    features={layerData.incidents}
                    selectedFeatureId={selectedFeatureId}
                    hoveredFeatureId={hoveredFeatureId}
                    onHoverFeature={onHoverFeature}
                    onSelectFeature={onSelectFeature}
                  />
                  {layerData.incidents.map((incident) => (
                    <GeoJSON
                      key={`${incident.properties.id}-ring`}
                      data={incident as never}
                      pointToLayer={(_, latlng) =>
                        new window.L.CircleMarker(latlng, {
                          ...incidentStyle,
                          radius: 12,
                        })
                      }
                    />
                  ))}
                </>
              )}
            </div>
          </Overlay>
        </LayersControl>

        <MapDataBoundsController data={data} />
        <MapFlyController request={flyToRequest} onHandled={onFlyHandled} />
      </MapContainer>
    </div>
  )
}

function Topbar({
  mapMode,
  searchQuery,
  onSearchQueryChange,
  results,
  onSelectResult,
  cadVectorData,
  cadVectorLoading,
}: TopbarProps) {
  const usingCadVector = mapMode === 'cadVector' && cadVectorData?.hasCadVectorData
  const sourceBadgeLabel = usingCadVector
    ? `Đang dùng dữ liệu CAD Vector từ QGIS (${cadVectorData.metadata?.totalFeatures ?? 0} feature)`
    : mapMode === 'layoutPreview'
      ? 'Bản vẽ gốc tham chiếu'
    : cadVectorLoading && mapMode === 'cadVector'
      ? 'Đang kiểm tra dữ liệu CAD Vector'
      : 'Chưa có CAD Vector, đang dùng dữ liệu dự phòng'

  return (
    <header className="panel relative z-[900] mx-3 mt-3 flex h-[78px] items-center gap-4 px-4 lg:px-6">
      <div>
        <p className="font-display text-[24px] uppercase leading-none tracking-wide text-water-800">WebGIS</p>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-water-600">
          Quản lý hệ thống cấp nước
        </p>
      </div>

      <div className="hidden items-center gap-2 rounded-xl border border-water-100 bg-water-50 px-3 py-2 text-sm font-semibold text-water-800 md:flex">
        <Route className="size-4" />
        Bản đồ CAD Vector
      </div>

      <div
        className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold lg:flex ${
          usingCadVector
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}
      >
        <Database className="size-3.5" />
        <span>{sourceBadgeLabel}</span>
      </div>

      <div className="relative ml-auto w-full max-w-[440px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Tìm đối tượng: OD315, Diameter_Text, Xã Mỹ Hạnh..."
          className="field-input h-10 pl-9"
        />

        {searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-12 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {results.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">Không tìm thấy đối tượng phù hợp.</p>
            ) : (
              <ul className="space-y-1">
                {results.map((item, index) => (
                  <li key={`${item.id}-${index}`}>
                    <button
                      type="button"
                      onClick={() => onSelectResult(item.id)}
                      className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-water-50"
                    >
                      <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.meta}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="hidden items-center gap-2 rounded-xl border border-water-100 bg-white px-3 py-2 text-sm font-semibold text-water-800 md:flex">
        <MapPin className="size-4" />
        Bản đồ hệ thống
      </div>
    </header>
  )
}

function LayerSidebar({
  collapsed,
  onToggle,
  visibleLayers,
  onToggleLayer,
  statusFilter,
  onStatusFilterChange,
  objectItems,
  selectedId,
  onSelectObject,
  dataSource,
  mapMode,
  cadImageLoaded,
  cadVectorData,
  cadVectorVisibleLayers,
  onToggleCadVectorLayer,
  cadVectorTypeFilter,
  onCadVectorTypeFilterChange,
  cadVectorViewPreset,
  onCadVectorViewPresetChange,
  cadVectorLabelOptions,
  onCadVectorLabelOptionChange,
  curatedMainWorks,
  positionUpdateTargetId,
  onSelectCuratedMainWork,
  onStartCuratedMainWorkPositionUpdate,
  onCancelCuratedMainWorkPositionUpdate,
  onExportCuratedMainWorks,
  cadVectorLayerGroups,
  expandedCadVectorGroups,
  onToggleCadVectorGroupExpanded,
  onSetCadVectorLayers,
  selectedLayoutId,
  onSelectLayoutPreview,
  onOpenCadVectorMap,
  onOpenCadImage,
  onOpenOsm,
}: SidebarProps) {
  const hasCadVectorData = Boolean(cadVectorData?.hasCadVectorData)
  const [quickGuideOpen, setQuickGuideOpen] = useState(true)
  const getCadVectorGroupLayerNames = (groupKey: CadVectorGroupKey) =>
    cadVectorLayerGroups
      .find((group) => group.key === groupKey)
      ?.layers.map((layer) => layer.layerKey ?? layer.layerName) ?? []
  const isCadVectorGroupVisible = (groupKey: CadVectorGroupKey) => {
    const layerNames = getCadVectorGroupLayerNames(groupKey)
    return layerNames.length > 0 && layerNames.some((layerName) => cadVectorVisibleLayers[layerName] !== false)
  }

  return (
    <aside
      className={`relative h-full transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[320px]'}`}
    >
      <div className="panel flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-water-100 px-3 py-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-water-700" />
            {!collapsed && <p className="text-sm font-semibold text-water-900">Lớp dữ liệu và bộ lọc</p>}
          </div>
          <button type="button" onClick={onToggle} className="ghost-btn h-8 w-8 !px-0">
            {collapsed ? <Menu className="size-4" /> : <X className="size-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {mapMode !== 'cadVector' && mapMode !== 'layoutPreview' && (
              <div className="border-b border-slate-100 px-4 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Danh sách layer</p>
                <div className="space-y-2">
                  {Object.entries(LAYER_LABELS).map(([key, label]) => {
                    const typedKey = key as LayerKey
                    const active = visibleLayers[typedKey]

                    return (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-water-50"
                      >
                        <span className="flex items-center gap-2 text-slate-700">
                          <span
                            className="inline-block size-2.5 rounded-full"
                            style={{ backgroundColor: LAYER_COLORS[typedKey] }}
                          />
                          {label}
                        </span>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => onToggleLayer(typedKey)}
                          className="size-4 rounded border-slate-300 text-water-600 focus:ring-water-500"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="border-b border-slate-100 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dữ liệu từ CAD</p>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    hasCadVectorData || dataSource?.usingCad
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {hasCadVectorData ? 'CAD Vector' : cadImageLoaded ? 'Ảnh CAD' : dataSource?.usingCad ? 'CAD/GeoJSON' : 'Dự phòng'}
                </span>
              </div>
              {mapMode === 'cadVector' ? (
                <>
                  {hasCadVectorData ? (
                    <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <p className="font-semibold">Đã tải CAD Vector từ QGIS</p>
                      <p>
                        {cadVectorData?.metadata?.totalFeatures ?? 0} feature |{' '}
                        {getCadVectorLayerCount(cadVectorData?.layerIndex ?? [])} CAD layer
                      </p>
                    </div>
                  ) : (
                    <div className="mb-3 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                      Chưa có dữ liệu CAD Vector.
                    </div>
                  )}

                  <div className="mb-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Chế độ xem nghiệp vụ
                    </p>
                    <div className="space-y-1.5">
                      {CAD_VECTOR_VIEW_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => onCadVectorViewPresetChange(preset.key)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                            cadVectorViewPreset === preset.key
                              ? 'border-water-300 bg-water-50 text-water-800'
                              : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="block text-sm font-semibold">{preset.label}</span>
                          <span className="text-xs text-slate-500">{preset.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3 space-y-2 rounded-lg border border-slate-100 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lớp hiển thị</p>
                    {[
                      ['showMainWorkLabels', 'Hiện nhãn công trình chính'],
                      ['showDiameterLabels', 'Hiện nhãn đường kính'],
                      ['hideCorruptedText', 'Ẩn text lỗi font'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                        <span className="text-slate-700">{label}</span>
                        <input
                          type="checkbox"
                          checked={cadVectorLabelOptions[key as keyof CadLabelVisibilityOptions]}
                          onChange={(event) =>
                            onCadVectorLabelOptionChange(
                              key as keyof CadLabelVisibilityOptions,
                              event.target.checked,
                            )
                          }
                          className="size-4 rounded border-slate-300 text-water-600 focus:ring-water-500"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mb-3 space-y-2 rounded-lg border border-slate-100 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Lớp nghiệp vụ chính
                    </p>
                    {[
                      [CAD_BASE_LAYER_KEY, 'Nền CAD gốc', 'Luôn giữ bản vẽ nền mờ để không trắng map.'],
                      [CAD_CURATED_MAIN_WORKS_LAYER_KEY, 'Công trình chính', '4 đối tượng chính được làm nổi bật.'],
                    ].map(([key, label, description]) => (
                      <label key={key} className="flex cursor-pointer items-start justify-between gap-3 text-sm">
                        <span>
                          <span className="block font-medium text-slate-700">{label}</span>
                          <span className="block text-xs text-slate-500">{description}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={cadVectorVisibleLayers[key] !== false}
                          onChange={() => onToggleCadVectorLayer(key)}
                          className="mt-1 size-4 rounded border-slate-300 text-water-600 focus:ring-water-500"
                        />
                      </label>
                    ))}
                    {[
                      ['pipeline', 'Tuyến ống cấp nước', 'Các tuyến ống cấp nước được làm nổi bật.'],
                      ['irrigation', 'Kênh/thủy lợi', 'Dữ liệu kênh/thủy lợi liên quan view hiện tại.'],
                    ].map(([groupKey, label, description]) => {
                      const typedGroupKey = groupKey as CadVectorGroupKey
                      const layerNames = getCadVectorGroupLayerNames(typedGroupKey)

                      return (
                        <label key={groupKey} className="flex cursor-pointer items-start justify-between gap-3 text-sm">
                          <span>
                            <span className="block font-medium text-slate-700">{label}</span>
                            <span className="block text-xs text-slate-500">{description}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={isCadVectorGroupVisible(typedGroupKey)}
                            disabled={layerNames.length === 0}
                            onChange={(event) => onSetCadVectorLayers(layerNames, event.target.checked)}
                            className="mt-1 size-4 rounded border-slate-300 text-water-600 focus:ring-water-500 disabled:opacity-40"
                          />
                        </label>
                      )
                    })}
                  </div>

                  <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                        Công trình chính chuẩn hóa
                      </p>
                      <button type="button" onClick={onExportCuratedMainWorks} className="ghost-btn h-7 px-2 text-[11px]">
                        Xuất JSON
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {curatedMainWorks.map((work) => {
                        const isUpdating = positionUpdateTargetId === work.id

                        return (
                          <div
                            key={work.id}
                            className="rounded-lg border border-emerald-100 bg-white/90 p-2 shadow-sm transition hover:border-water-200 hover:bg-water-50/50"
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm ${
                                  work.type === 'water_plant'
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-violet-500 text-white'
                                }`}
                              >
                                {work.type === 'water_plant' ? (
                                  <Factory className="size-4" />
                                ) : (
                                  <Waves className="size-4" />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-slate-800">{work.displayName}</p>
                                <p className="text-[11px] font-medium text-slate-500">
                                  {work.type === 'water_plant' ? 'Nhà máy nước' : 'Hồ nước thô'}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {work.cadPosition
                                    ? `Vị trí CAD [${work.cadPosition[0].toFixed(1)}, ${work.cadPosition[1].toFixed(1)}]`
                                    : 'Chưa có vị trí, có thể cập nhật thủ công'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectCuratedMainWork(work.id)}
                                className="h-7 rounded-md border border-water-200 bg-water-50 px-2 text-[11px] font-semibold text-water-800 hover:bg-water-100"
                              >
                                Xem
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectCuratedMainWork(work.id)}
                                className="h-7 rounded-md border border-amber-200 bg-amber-50 px-2 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                              >
                                Làm nổi bật
                              </button>
                              <button
                                type="button"
                                onClick={() => onStartCuratedMainWorkPositionUpdate(work.id)}
                                className={`h-7 rounded-md border px-2 text-[11px] font-semibold ${
                                  isUpdating
                                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {isUpdating ? 'Đang chờ click' : 'Cập nhật vị trí'}
                              </button>
                              {isUpdating && (
                                <button
                                  type="button"
                                  onClick={onCancelCuratedMainWorkPositionUpdate}
                                  className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600"
                                >
                                  Hủy
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mb-3 rounded-lg border border-slate-100 p-3">
                    <button
                      type="button"
                      onClick={() => setQuickGuideOpen((value) => !value)}
                      className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Hướng dẫn nhanh
                      <span>{quickGuideOpen ? 'Thu gọn' : 'Mở'}</span>
                    </button>
                    {quickGuideOpen && (
                      <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-600">
                        <li>Chọn 1 trong 4 view: Tổng quan, Nhà máy nước, Hồ nước thô, Kênh thủy lợi.</li>
                        <li>Bật/tắt nền CAD, tuyến ống, kênh và công trình chính khi cần.</li>
                        <li>Click đối tượng để xem chi tiết CAD.</li>
                        <li>Dùng Fit bản đồ CAD để quay về khu vực đang xem.</li>
                      </ol>
                    )}
                  </div>

                  <details className="mb-3 rounded-lg border border-slate-100 p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Dữ liệu CAD thô / nâng cao
                    </summary>
                    <div className="mt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Lọc nhanh theo loại
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {CAD_VECTOR_TYPE_FILTERS.map((filter) => (
                          <button
                            key={filter.value}
                            type="button"
                            onClick={() => onCadVectorTypeFilterChange(filter.value)}
                            className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                              cadVectorTypeFilter === filter.value
                                ? 'border-water-300 bg-water-50 text-water-800'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
                      {cadVectorLayerGroups.map((group) => {
                        const groupLayerNames = group.layers.map((layer) => layer.layerKey ?? layer.layerName)
                        const visibleCount = group.layers.filter(
                          (layer) => cadVectorVisibleLayers[layer.layerKey ?? layer.layerName] !== false,
                        ).length
                        const allVisible = group.layers.length > 0 && visibleCount === group.layers.length
                        const expanded = expandedCadVectorGroups[group.key] ?? group.defaultExpanded

                        return (
                          <div key={group.key} className="rounded-lg border border-slate-100">
                            <div className="flex items-start justify-between gap-2 px-3 py-2">
                              <button
                                type="button"
                                onClick={() => onToggleCadVectorGroupExpanded(group.key)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <span className="block text-sm font-semibold text-slate-700">{group.label}</span>
                                <span className="block text-xs text-slate-500">
                                  {group.featureCount.toLocaleString('vi-VN')} feature | {group.layers.length} layer
                                </span>
                              </button>
                              <input
                                type="checkbox"
                                checked={allVisible}
                                disabled={group.layers.length === 0}
                                onChange={(event) => onSetCadVectorLayers(groupLayerNames, event.target.checked)}
                                className="mt-1 size-4 rounded border-slate-300 text-water-600 focus:ring-water-500 disabled:opacity-40"
                              />
                            </div>
                            {expanded && group.layers.length > 0 && (
                              <div className="space-y-1 border-t border-slate-100 px-3 py-2">
                                {group.layers.map((layer) => (
                                  <label
                                    key={layer.layerKey ?? `${group.key}-${layer.layerName}`}
                                    className="flex cursor-pointer items-start justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-water-50"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate text-xs font-medium text-slate-700">
                                        {layer.layerName}
                                      </span>
                                      <span className="text-[11px] text-slate-500">
                                        {cadVectorTypeLabelForUi(layer.inferredType)} | {layer.featureCount}
                                      </span>
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={cadVectorVisibleLayers[layer.layerKey ?? layer.layerName] !== false}
                                      onChange={() => onToggleCadVectorLayer(layer.layerKey ?? layer.layerName)}
                                      className="mt-0.5 size-3.5 rounded border-slate-300 text-water-600 focus:ring-water-500"
                                    />
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </details>
                </>
              ) : (
                <>
                  {cadImageLoaded && (
                    <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <p className="font-semibold">Đã tải ảnh CAD</p>
                      <p>
                        {dataSource?.usingCad
                          ? 'GeoJSON CAD đã sẵn sàng; vẫn có thể dùng overlay thủ công trên ảnh.'
                          : 'Chưa có GeoJSON, đang dùng overlay thủ công trên ảnh CAD.'}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {CAD_LAYER_KEYS.map((layerKey) => {
                      const meta = dataSource?.layers[layerKey]
                      const loaded = meta?.status === 'cad_loaded'

                      return (
                        <div key={layerKey} className="rounded-lg border border-slate-100 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <span
                                className="inline-block size-2.5 rounded-full"
                                style={{ backgroundColor: LAYER_COLORS[layerKey] }}
                              />
                              {LAYER_LABELS[layerKey]}
                            </span>
                            <span className={loaded ? 'text-xs font-semibold text-emerald-700' : 'text-xs text-slate-500'}>
                              {loaded ? meta.featureCount : 0}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {getCadLayerStatusText(dataSource, layerKey, cadImageLoaded)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <details className="border-b border-slate-100 px-4 py-4">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
                Công cụ phụ / nâng cao
              </summary>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={onOpenCadVectorMap}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    mapMode === 'cadVector'
                      ? 'border-water-300 bg-water-50 text-water-800'
                      : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-semibold">Bản đồ CAD Vector</span>
                  <span className="text-xs text-slate-500">Dữ liệu GIS chính từ QGIS</span>
                </button>
                {CAD_LAYOUT_OPTIONS.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => onSelectLayoutPreview(layout.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      mapMode === 'layoutPreview' && selectedLayoutId === layout.id
                        ? 'border-water-300 bg-water-50 text-water-800'
                        : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{layout.label}</span>
                    <span className="text-xs text-slate-500">{layout.fileName}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onOpenCadImage}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    mapMode === 'cadImage'
                      ? 'border-water-300 bg-water-50 text-water-800'
                      : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-semibold">Ảnh CAD tham chiếu</span>
                  <span className="text-xs text-slate-500">PNG bản vẽ, không phải dữ liệu chính</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenOsm}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    mapMode === 'osm'
                      ? 'border-water-300 bg-water-50 text-water-800'
                      : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-semibold">OpenStreetMap tham khảo</span>
                  <span className="text-xs text-slate-500">Chỉ dùng khi cần đối chiếu nền địa lý</span>
                </button>
              </div>
            </details>

            {mapMode !== 'cadVector' && mapMode !== 'layoutPreview' && (
              <div className="border-b border-slate-100 px-4 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Filter className="mr-1 inline size-3.5" />
                Lọc theo trạng thái
              </p>
              <div className="space-y-2">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => onStatusFilterChange(filter.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      statusFilter === filter.value
                        ? 'border-water-300 bg-water-50 text-water-800'
                        : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              </div>
            )}

            <div className="min-h-0 flex-1 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Danh sách đối tượng ({objectItems.length})
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                  {mapMode === 'cadVector'
                    ? 'CAD Vector'
                    : mapMode === 'layoutPreview'
                      ? 'Bản vẽ gốc'
                      : mapMode === 'cadImage'
                        ? 'Ảnh CAD'
                        : 'OSM'}
                </span>
              </div>
              {objectItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Không có đối tượng phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                <ul className="max-h-full space-y-2 overflow-auto pr-1">
                  {objectItems.map((item, index) => (
                    <li key={`${item.id}-${index}`}>
                      <button
                        type="button"
                        onClick={() => onSelectObject(item.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                          selectedId === item.id
                            ? 'border-water-300 bg-water-50'
                            : 'border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.typeLabel}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{item.statusLabel}</p>
                        {item.meta && <p className="text-xs text-slate-400">{item.meta}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function DashboardCards({ data, mapMode, cadVectorData, curatedMainWorks, cadVectorViewPreset }: DashboardCardsProps) {
  const stats = useMemo(() => computeDashboardStats(data), [data])

  if (mapMode === 'cadVector' && cadVectorData?.hasCadVectorData) {
    const features = cadVectorData.entities?.features ?? []
    const pipelineCount = features.filter((feature) => feature.properties.type === 'pipeline').length
    const irrigationCount = features.filter((feature) => feature.properties.sourceGroup === 'irrigation').length
    const waterPlantCount = features.filter(
      (feature) => feature.properties.curatedMainWork === true && feature.properties.type === 'water_plant',
    ).length
    const rawWaterLakeCount = features.filter(
      (feature) => feature.properties.curatedMainWork === true && feature.properties.type === 'raw_water_lake',
    ).length
    const mainWorksCount = waterPlantCount + rawWaterLakeCount
    const isOverview = cadVectorViewPreset === 'overview'
    const cards = isOverview
      ? [
          {
            label: 'Đối tượng hiển thị',
            value: features.length,
            icon: ListChecks,
            accent: 'text-sky-700',
          },
          {
            label: 'Tổng layer CAD',
            value: getCadVectorLayerCount(cadVectorData.layerIndex),
            icon: Layers,
            accent: 'text-indigo-700',
          },
          {
            label: 'Tuyến ống cấp nước',
            value: pipelineCount,
            icon: Route,
            accent: 'text-blue-700',
          },
          {
            label: 'Kênh/thủy lợi',
            value: irrigationCount,
            icon: Waves,
            accent: 'text-green-700',
          },
          {
            label: 'Nhà máy nước',
            value: curatedMainWorks.filter((work) => work.type === 'water_plant').length,
            icon: Factory,
            accent: 'text-emerald-700',
          },
          {
            label: 'Hồ nước thô',
            value: curatedMainWorks.filter((work) => work.type === 'raw_water_lake').length,
            icon: Waves,
            accent: 'text-violet-700',
          },
        ]
      : [
          {
            label: 'Đối tượng hiển thị',
            value: features.length,
            icon: ListChecks,
            accent: 'text-sky-700',
          },
          {
            label: 'Tuyến ống cấp nước',
            value: pipelineCount,
            icon: Route,
            accent: 'text-blue-700',
          },
          {
            label: 'Kênh thủy lợi',
            value: irrigationCount,
            icon: Waves,
            accent: 'text-green-700',
          },
          {
            label: cadVectorViewPreset === 'water_plants' ? 'Nhà máy nước' : 'Hồ nước thô',
            value: cadVectorViewPreset === 'water_plants' ? waterPlantCount : cadVectorViewPreset === 'raw_water_lakes' ? rawWaterLakeCount : mainWorksCount,
            icon: Factory,
            accent: 'text-emerald-700',
          },
        ]

    return (
      <section className={`grid grid-cols-2 gap-3 ${isOverview ? 'lg:grid-cols-6' : 'lg:grid-cols-4'}`}>
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <article key={card.label} className="panel p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <Icon className={`size-4 ${card.accent}`} />
              </div>
              <p className="text-xl font-bold text-slate-800">{card.value}</p>
            </article>
          )
        })}
      </section>
    )
  }

  const cards = [
    {
      label: 'Tổng số đối tượng',
      value: stats.totalObjects,
      icon: ListChecks,
      accent: 'text-sky-700',
    },
    {
      label: 'Số nhà máy nước',
      value: stats.waterPlants,
      icon: Factory,
      accent: 'text-indigo-700',
    },
    {
      label: 'Số hồ chứa nước thô',
      value: stats.rawWaterLakes,
      icon: Waves,
      accent: 'text-cyan-700',
    },
    {
      label: 'Số tuyến ống/kênh',
      value: stats.pipelineAndCanals,
      icon: Route,
      accent: 'text-emerald-700',
    },
    {
      label: 'Điểm cần kiểm tra',
      value: stats.needInspection,
      icon: AlertTriangle,
      accent: 'text-orange-700',
    },
    {
      label: 'Tổng chiều dài ống',
      value: `${stats.pipelineLengthKm.toFixed(2)} km`,
      icon: Gauge,
      accent: 'text-water-700',
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon

        return (
          <article key={card.label} className="panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <Icon className={`size-4 ${card.accent}`} />
            </div>
            <p className="text-xl font-bold text-slate-800">{card.value}</p>
          </article>
        )
      })}
    </section>
  )
}

function safeDisplayText(value: unknown, fallback = 'Không có'): string {
  if (value === null || value === undefined) {
    return fallback
  }

  const text = String(value).replace(/\u0000/g, '').trim()
  return text || fallback
}

function formatCadRawValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

function cadVectorBusinessTypeLabel(feature: CadVectorFeature): string {
  switch (feature.properties.type) {
    case 'water_plant':
      return 'Nhà máy nước'
    case 'raw_water_lake':
      return 'Hồ nước thô'
    case 'irrigation_canal':
      return 'Kênh thủy lợi'
    case 'irrigation_area':
      return 'Vùng thủy lợi'
    case 'irrigation_point':
      return 'Điểm thủy lợi'
    case 'irrigation_label':
      return 'Nhãn kênh/thủy lợi'
    case 'main_work_candidate':
      return 'Công trình chính'
    default:
      return cadVectorTypeLabelForUi(feature.properties.type)
  }
}

function DetailPanel({
  collapsed,
  onToggle,
  feature,
  cadVectorFeature,
  cadAsset,
  cadEditMode,
  onToggleCadEdit,
  positionUpdateTargetId,
  onStartCadVectorPositionUpdate,
  onOpenUpdate,
  onOpenIncident,
}: DetailPanelProps) {
  const [copyState, setCopyState] = useState('Copy thông tin')

  const handleCopyCadVectorProperties = async () => {
    if (!cadVectorFeature) {
      return
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(cadVectorFeature.properties, null, 2))
      setCopyState('Đã copy')
      window.setTimeout(() => setCopyState('Copy thông tin'), 1200)
    } catch {
      setCopyState('Không copy được')
    }
  }
  const cadVectorRawText = cadVectorFeature ? getCadFeatureText(cadVectorFeature) : ''
  const cadVectorTextCorrupted = cadVectorFeature
    ? Boolean(cadVectorFeature.properties.corruptedText) || isLikelyMojibake(cadVectorRawText)
    : false
  const cadVectorValidText = cadVectorRawText && !cadVectorTextCorrupted ? cadVectorRawText : ''
  const cadVectorDiameterText =
    cadVectorFeature?.properties.diameterText ||
    (isPipeDiameterText(cadVectorRawText) ? cadVectorRawText : '')
  const cadVectorIsMainWork = cadVectorFeature?.properties.sourceGroup === 'main_works'
  const cadVectorIsIrrigation = cadVectorFeature?.properties.sourceGroup === 'irrigation'
  const cadVectorIsCurated = cadVectorFeature?.properties.curatedMainWork === true

  if (collapsed) {
    return (
      <aside className="w-[56px]">
        <div className="panel flex h-full items-start justify-center py-3">
          <button type="button" onClick={onToggle} className="ghost-btn h-8 w-8 !px-0">
            <Menu className="size-4" />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-[360px]">
      <div className="panel flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-water-100 px-4 py-3">
          <p className="text-sm font-semibold text-water-900">Thông tin chi tiết</p>
          <button type="button" onClick={onToggle} className="ghost-btn h-8 w-8 !px-0">
            <X className="size-4" />
          </button>
        </div>

        {cadVectorFeature ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            <div>
              <p className="text-lg font-bold text-slate-800">{getFeatureDisplayName(cadVectorFeature)}</p>
              <p className="text-sm text-slate-500">{cadVectorBusinessTypeLabel(cadVectorFeature)}</p>
            </div>

            <span className="status-chip bg-emerald-50 text-emerald-700">
              {cadVectorFeature.properties.businessGroup || cadVectorFeature.properties.status}
            </span>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Thông tin chính</p>
              <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">ID:</span> {cadVectorFeature.properties.id}
              </p>
              <p>
                <span className="font-semibold">Loại đối tượng:</span> {cadVectorTypeLabelForUi(cadVectorFeature.properties.type)}
              </p>
              {(cadVectorIsMainWork || cadVectorIsIrrigation) && (
                <p>
                  <span className="font-semibold">Nhóm nghiệp vụ:</span>{' '}
                  {cadVectorFeature.properties.businessGroup}
                </p>
              )}
              {(cadVectorIsMainWork || cadVectorIsIrrigation) && (
                <p>
                  <span className="font-semibold">Nguồn file:</span> {cadVectorFeature.properties.sourceName}
                </p>
              )}
              <p>
                <span className="font-semibold">Layer CAD:</span> {safeDisplayText(cadVectorFeature.properties.Layer ?? cadVectorFeature.properties.cadLayer)}
              </p>
              <p>
                <span className="font-semibold">Text hợp lệ:</span>{' '}
                {safeDisplayText(cadVectorValidText)}
              </p>
              {cadVectorTextCorrupted && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Text CAD có thể bị lỗi mã hóa sau khi chuyển từ DWG/DXF. Text gốc vẫn được giữ trong phần thông tin CAD gốc.
                </div>
              )}
              {cadVectorDiameterText && (
                <p>
                  <span className="font-semibold">Đường kính:</span> {cadVectorDiameterText}
                </p>
              )}
              {cadVectorFeature.properties.type === 'pipeline' && (
                <p>
                  <span className="font-semibold">Đường kính tham chiếu:</span> Chưa liên kết nhãn đường kính
                </p>
              )}
              <p>
                <span className="font-semibold">PaperSpace:</span>{' '}
                {formatCadRawValue(cadVectorFeature.properties.PaperSpace)}
              </p>
              <p>
                <span className="font-semibold">CAD space:</span> {cadVectorFeature.properties.cadSpace}
              </p>
              <p>
                <span className="font-semibold">SubClasses:</span>{' '}
                {safeDisplayText(cadVectorFeature.properties.SubClasses)}
              </p>
              <p>
                <span className="font-semibold">Linetype:</span>{' '}
                {safeDisplayText(cadVectorFeature.properties.Linetype)}
              </p>
              <p>
                <span className="font-semibold">EntityHandle:</span>{' '}
                {safeDisplayText(cadVectorFeature.properties.EntityHandle ?? cadVectorFeature.properties.sourceEntityHandle)}
              </p>
              <p>
                <span className="font-semibold">Geometry:</span> {cadVectorFeature.geometry.type}
              </p>
              <p>
                <span className="font-semibold">Nguồn dữ liệu:</span> {cadVectorFeature.properties.source}
              </p>
              <p>
                <span className="font-semibold">Source file:</span> {cadVectorFeature.properties.originalFile}
              </p>
              <p>
                <span className="font-semibold">Mô tả:</span> {cadVectorFeature.properties.description}
              </p>
              {cadVectorFeature.properties.Color !== undefined && (
                <p>
                  <span className="font-semibold">Color:</span> {String(cadVectorFeature.properties.Color)}
                </p>
              )}
              </div>
            </div>

            {cadVectorIsCurated && (
              <button
                type="button"
                onClick={() => onStartCadVectorPositionUpdate(cadVectorFeature)}
                className="primary-btn"
              >
                <Move className="mr-1 size-4" />
                {positionUpdateTargetId === (cadVectorFeature.properties.curatedMainWorkId ?? cadVectorFeature.properties.id)
                  ? 'Click lên bản đồ để lưu vị trí'
                  : 'Cập nhật vị trí'}
              </button>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thông tin CAD gốc</p>
                <button type="button" onClick={handleCopyCadVectorProperties} className="ghost-btn h-7 px-2 text-[11px]">
                  {copyState}
                </button>
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                <dl className="space-y-1 text-xs">
                  {Object.entries(cadVectorFeature.properties).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[110px_1fr] gap-2 border-b border-slate-100 py-1 last:border-b-0">
                      <dt className="truncate font-semibold text-slate-500">{key}</dt>
                      <dd className="break-words text-slate-700">{formatCadRawValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <button type="button" onClick={() => onOpenIncident(null)} className="ghost-btn">
              <AlertTriangle className="mr-1 size-4" />
              Báo sự cố
            </button>
          </div>
        ) : cadAsset ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            <div>
              <p className="text-lg font-bold text-slate-800">{cadAsset.name}</p>
              <p className="text-sm text-slate-500">{mapFeatureTypeLabel(cadAsset.type)}</p>
            </div>

            <span className={statusBadgeClass(cadAsset.status)}>{getAssetStatusMeta(cadAsset.status).label}</span>

            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">ID:</span> {cadAsset.id}
              </p>
              <p>
                <span className="font-semibold">Tọa độ ảnh CAD [y, x]:</span>{' '}
                {cadAsset.geometryType === 'Point' && cadAsset.cadPosition
                  ? `[${cadAsset.cadPosition[0]}, ${cadAsset.cadPosition[1]}]`
                  : `[${getCadAssetCenter(cadAsset).join(', ')}]`}
              </p>
              <p>
                <span className="font-semibold">Nguồn:</span> {cadAsset.source}
              </p>
              <p>
                <span className="font-semibold">Dữ liệu nền:</span>{' '}
                {cadAsset.backgroundImage ?? CAD_BLUEPRINT_CONFIG.imageFileName}
              </p>
              <p>
                <span className="font-semibold">CAD Layer:</span> {cadAsset.cadLayer}
              </p>
              <p>
                <span className="font-semibold">Kiểu dữ liệu:</span> {cadAsset.dataType}
              </p>
              <p>
                <span className="font-semibold">Loại geometry:</span> {cadAsset.geometryType}
              </p>
              <p>
                <span className="font-semibold">Vị trí:</span> {cadAsset.address}
              </p>
              <p>
                <span className="font-semibold">Mô tả:</span> {cadAsset.description}
              </p>
              <p>
                <span className="font-semibold">Ngày cập nhật:</span> {formatDate(cadAsset.lastUpdated)}
              </p>
              {cadAsset.type === 'water_plant' && cadAsset.capacity && (
                <p>
                  <span className="font-semibold">Công suất:</span> {cadAsset.capacity}
                </p>
              )}
              {cadAsset.type === 'raw_water_lake' && cadAsset.area && (
                <p>
                  <span className="font-semibold">Diện tích:</span> {cadAsset.area}
                </p>
              )}
              {cadAsset.type === 'raw_water_lake' && cadAsset.volume && (
                <p>
                  <span className="font-semibold">Dung tích:</span> {cadAsset.volume}
                </p>
              )}
              {cadAsset.type === 'pipeline' && cadAsset.diameter && (
                <p>
                  <span className="font-semibold">Đường kính:</span> {cadAsset.diameter}
                </p>
              )}
              {cadAsset.type === 'pipeline' && cadAsset.material && (
                <p>
                  <span className="font-semibold">Vật liệu:</span> {cadAsset.material}
                </p>
              )}
              {cadAsset.type === 'pipeline' && cadAsset.length && (
                <p>
                  <span className="font-semibold">Chiều dài:</span> {cadAsset.length}
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú CAD</p>
              <ul className="space-y-2">
                {cadAsset.notes.map((note, index) => (
                  <li key={`${cadAsset.id}-${index}`} className="rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onToggleCadEdit}
                className={`primary-btn ${cadEditMode ? '!bg-emerald-700' : ''}`}
              >
                <Move className="mr-1 size-4" />
                {cadEditMode ? 'Dừng chỉnh vị trí' : 'Cập nhật vị trí'}
              </button>
              <button type="button" onClick={() => onOpenIncident(null)} className="ghost-btn">
                <AlertTriangle className="mr-1 size-4" />
                Báo sự cố
              </button>
            </div>
          </div>
        ) : !feature ? (
          <div className="p-4 text-sm text-slate-500">Chọn đối tượng trên bản đồ hoặc sidebar để xem chi tiết.</div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            <div>
              <p className="text-lg font-bold text-slate-800">{feature.properties.name}</p>
              <p className="text-sm text-slate-500">{mapFeatureTypeLabel(feature.properties.type)}</p>
            </div>

            {feature.properties.type === 'incident' ? (
              <span className={incidentStatusBadgeClass(feature.properties.status)}>
                {getIncidentStatusMeta(feature.properties.status).label}
              </span>
            ) : (
              <span className={statusBadgeClass(feature.properties.status)}>
                {getAssetStatusMeta(feature.properties.status).label}
              </span>
            )}

            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">ID:</span> {feature.properties.id}
              </p>
              <p>
                <span className="font-semibold">Địa chỉ/vị trí:</span> {feature.properties.address}
              </p>
              <p>
                <span className="font-semibold">Mô tả:</span> {feature.properties.description}
              </p>
              <p>
                <span className="font-semibold">Nguồn dữ liệu:</span>{' '}
                {feature.properties.source ?? 'Dữ liệu dự phòng'}
              </p>
              <p>
                <span className="font-semibold">Loại geometry:</span> {feature.geometry.type}
              </p>
              <p>
                <span className="font-semibold">Ngày cập nhật:</span>{' '}
                {formatDate(feature.properties.lastUpdated)}
              </p>
              {feature.properties.type !== 'incident' && (
                <>
                  <p>
                    <span className="font-semibold">CAD Layer:</span>{' '}
                    {feature.properties.cadLayer || feature.properties.sourceLayer || 'Không có'}
                  </p>
                </>
              )}
              {feature.properties.type === 'water_plant' && feature.properties.capacity && (
                <p>
                  <span className="font-semibold">Công suất:</span> {feature.properties.capacity}
                </p>
              )}
              {feature.properties.type === 'raw_water_lake' && feature.properties.area && (
                <p>
                  <span className="font-semibold">Diện tích:</span> {feature.properties.area}
                </p>
              )}
              {feature.properties.type === 'raw_water_lake' && feature.properties.volume && (
                <p>
                  <span className="font-semibold">Dung tích:</span> {feature.properties.volume}
                </p>
              )}
              {feature.properties.type === 'pipeline' && feature.properties.diameter && (
                <p>
                  <span className="font-semibold">Đường kính:</span> {feature.properties.diameter}
                </p>
              )}
              {feature.properties.type === 'pipeline' && feature.properties.material && (
                <p>
                  <span className="font-semibold">Vật liệu:</span> {feature.properties.material}
                </p>
              )}
              {feature.properties.type === 'pipeline' && feature.properties.length && (
                <p>
                  <span className="font-semibold">Chiều dài:</span> {feature.properties.length}
                </p>
              )}
              {feature.properties.type === 'incident' && (
                <>
                  <p>
                    <span className="font-semibold">Mã sự cố:</span> {feature.properties.incidentCode}
                  </p>
                  <p>
                    <span className="font-semibold">Loại sự cố:</span>{' '}
                    {formatIncidentType(feature.properties.incidentType)}
                  </p>
                  <p>
                    <span className="font-semibold">Mức độ:</span>{' '}
                    <span className={severityBadgeClass(feature.properties.severity)}>
                      {getIncidentSeverityMeta(feature.properties.severity).label}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold">Ngày ghi nhận:</span>{' '}
                    {formatDate(feature.properties.reportedDate)}
                  </p>
                </>
              )}
            </div>

            {feature.properties.imageUrl && (
              <img
                src={feature.properties.imageUrl}
                alt={feature.properties.name}
                className="h-44 w-full rounded-xl object-cover"
              />
            )}

            {feature.properties.googleMapsUrl && (
              <a
                href={feature.properties.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm font-semibold text-water-700 hover:underline"
              >
                <MapPin className="mr-1 size-4" />
                Mở trên Google Maps
              </a>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Lịch sử ghi chú/bảo trì</p>
              <ul className="space-y-2">
                {(feature.properties.notes ?? []).map((note, index) => (
                  <li key={`${feature.properties.id}-${index}`} className="rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              {feature.properties.type !== 'incident' && (
                <button
                  type="button"
                  onClick={() => onOpenUpdate(feature as AssetFeature)}
                  className="primary-btn"
                >
                  <PencilLine className="mr-1 size-4" />
                  Cập nhật thông tin
                </button>
              )}

              <button type="button" onClick={() => onOpenIncident(feature)} className="ghost-btn">
                <AlertTriangle className="mr-1 size-4" />
                Báo sự cố
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function IncidentList({ incidents, selectedId, onSelectIncident }: IncidentListProps) {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="size-4 text-red-600" />
        <p className="text-sm font-semibold text-slate-800">Module quản lý sự cố</p>
      </div>

      {incidents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
          Chưa có sự cố nào trong dữ liệu.
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map((incident) => {
            const active = selectedId === incident.properties.id

            return (
              <button
                key={incident.properties.id}
                type="button"
                onClick={() => onSelectIncident(incident.properties.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  active ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">
                    {incident.properties.incidentCode} - {incident.properties.name}
                  </p>
                  <span className={severityBadgeClass(incident.properties.severity)}>
                    {getIncidentSeverityMeta(incident.properties.severity).label}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Loại: {formatIncidentType(incident.properties.incidentType)}</p>
                <p className="text-xs text-slate-500">Vị trí: {incident.properties.address}</p>
                <div className="mt-2 inline-flex">
                  <span className={incidentStatusBadgeClass(incident.properties.status)}>
                    {getIncidentStatusMeta(incident.properties.status).label}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function AssetFormModal({ mode, feature, onClose, onSubmit }: AssetFormProps) {
  const [name, setName] = useState(feature?.properties.name ?? '')
  const [type, setType] = useState<AssetType>(feature?.properties.type ?? 'water_plant')
  const [status, setStatus] = useState<AssetStatus>(feature?.properties.status ?? 'active')
  const [description, setDescription] = useState(feature?.properties.description ?? '')
  const [address, setAddress] = useState(feature?.properties.address ?? '')
  const [capacity, setCapacity] = useState(feature?.properties.capacity ?? '')
  const [area, setArea] = useState(feature?.properties.area ?? '')
  const [volume, setVolume] = useState(feature?.properties.volume ?? '')
  const [material, setMaterial] = useState(feature?.properties.material ?? '')
  const [diameter, setDiameter] = useState(feature?.properties.diameter ?? '')
  const [length, setLength] = useState(feature?.properties.length ?? '')
  const [imageUrl, setImageUrl] = useState(feature?.properties.imageUrl ?? '')
  const [googleMapsUrl, setGoogleMapsUrl] = useState(feature?.properties.googleMapsUrl ?? '')
  const [notesRaw, setNotesRaw] = useState((feature?.properties.notes ?? []).join('\n'))
  const [geometryType, setGeometryType] = useState<GeometryInputType>('Point')
  const [coordinatesRaw, setCoordinatesRaw] = useState('106.4232,10.8815')
  const [error, setError] = useState('')

  const submitLabel = mode === 'create' ? 'Thêm mới đối tượng' : 'Lưu cập nhật'
  const title = mode === 'create' ? 'Thêm đối tượng hạ tầng mới' : `Cập nhật: ${feature?.properties.name ?? ''}`

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!name.trim() || !address.trim() || !description.trim()) {
      setError('Vui lòng nhập đầy đủ tên, địa chỉ và mô tả')
      return
    }

    if (mode === 'update') {
      onSubmit({
        name,
        status,
        description,
        address,
        capacity,
        area,
        volume,
        material,
        diameter,
        length,
        imageUrl,
        googleMapsUrl,
        notes: parseNotes(notesRaw),
      } satisfies UpdateAssetInput)
      return
    }

    try {
      const coordinates = parseCoordinatePairs(coordinatesRaw)
      onSubmit({
        name,
        type,
        status,
        description,
        address,
        capacity,
        area,
        volume,
        material,
        diameter,
        length,
        imageUrl,
        googleMapsUrl,
        notes: parseNotes(notesRaw),
        geometryType,
        coordinates,
      } satisfies NewAssetInput)
    } catch {
      setError('Định dạng tọa độ không hợp lệ. Ví dụ: 106.4232,10.8815;106.425,10.883')
    }
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-900/45 p-4">
      <form onSubmit={handleSubmit} className="panel w-full max-w-2xl space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-slate-800">{title}</p>
          <button type="button" onClick={onClose} className="ghost-btn h-8 w-8 !px-0">
            <X className="size-4" />
          </button>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">Tên đối tượng</label>
            <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="field-label">Loại đối tượng</label>
            <select
              className="field-input"
              disabled={mode === 'update'}
              value={type}
              onChange={(event) => setType(event.target.value as AssetType)}
            >
              {ASSET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Trạng thái</label>
            <select
              className="field-input"
              value={status}
              onChange={(event) => setStatus(event.target.value as AssetStatus)}
            >
              {STATUS_FILTERS.filter((entry) => entry.value !== 'all').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Địa chỉ</label>
            <input className="field-input" value={address} onChange={(event) => setAddress(event.target.value)} />
          </div>
        </div>

        <div>
          <label className="field-label">Mô tả</label>
          <textarea
            className="field-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="field-label">Công suất</label>
            <input className="field-input" value={capacity} onChange={(event) => setCapacity(event.target.value)} />
          </div>
          <div>
            <label className="field-label">Diện tích</label>
            <input className="field-input" value={area} onChange={(event) => setArea(event.target.value)} />
          </div>
          <div>
            <label className="field-label">Dung tích</label>
            <input className="field-input" value={volume} onChange={(event) => setVolume(event.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">Vật liệu</label>
            <input className="field-input" value={material} onChange={(event) => setMaterial(event.target.value)} />
          </div>
          <div>
            <label className="field-label">Đường kính</label>
            <input className="field-input" value={diameter} onChange={(event) => setDiameter(event.target.value)} />
          </div>
          <div>
            <label className="field-label">Chiều dài</label>
            <input className="field-input" value={length} onChange={(event) => setLength(event.target.value)} />
          </div>
          <div>
            <label className="field-label">Link Google Maps</label>
            <input
              className="field-input"
              value={googleMapsUrl}
              onChange={(event) => setGoogleMapsUrl(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="field-label">Hình ảnh (URL)</label>
          <input className="field-input" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
        </div>

        <div>
          <label className="field-label">Ghi chú (mỗi dòng 1 mục)</label>
          <textarea className="field-textarea" value={notesRaw} onChange={(event) => setNotesRaw(event.target.value)} />
        </div>

        {mode === 'create' && (
          <div className="space-y-3 rounded-xl border border-water-100 bg-water-50/50 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="field-label">Kiểu hình học</label>
                <select
                  className="field-input"
                  value={geometryType}
                  onChange={(event) => setGeometryType(event.target.value as GeometryInputType)}
                >
                  {GEOMETRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Tọa độ (lng,lat;lng,lat)</label>
                <input
                  className="field-input"
                  value={coordinatesRaw}
                  onChange={(event) => setCoordinatesRaw(event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Ví dụ Point: 106.4232,10.8815 | LineString: 106.4232,10.8815;106.4258,10.8828
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ghost-btn">
            Hủy
          </button>
          <button type="submit" className="primary-btn">
            <Plus className="mr-1 size-4" />
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

function IncidentFormModal({ anchorFeature, onClose, onSubmit }: IncidentFormProps) {
  const center = anchorFeature ? getFeatureCenter(anchorFeature) : BASE_MAP_CENTER
  const [name, setName] = useState('Điểm sự cố mới')
  const [incidentCode, setIncidentCode] = useState(`SC-${Math.floor(Math.random() * 900 + 100)}`)
  const [incidentType, setIncidentType] = useState<IncidentType>('leak')
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')
  const [status, setStatus] = useState<IncidentWorkflowStatus>('new')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState(anchorFeature?.properties.address ?? '')
  const [reportedDate, setReportedDate] = useState(new Date().toISOString().slice(0, 10))
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [notesRaw, setNotesRaw] = useState('')
  const [latitude, setLatitude] = useState(String(center[0].toFixed(6)))
  const [longitude, setLongitude] = useState(String(center[1].toFixed(6)))
  const [error, setError] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!name.trim() || !incidentCode.trim() || !description.trim() || !address.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin bắt buộc')
      return
    }

    const lat = Number(latitude)
    const lng = Number(longitude)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Tọa độ không hợp lệ')
      return
    }

    onSubmit({
      name,
      incidentCode,
      incidentType,
      severity,
      status,
      description,
      address,
      reportedDate,
      googleMapsUrl,
      imageUrl,
      notes: parseNotes(notesRaw),
      latitude: lat,
      longitude: lng,
    } satisfies NewIncidentInput)
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-900/45 p-4">
      <form onSubmit={handleSubmit} className="panel w-full max-w-2xl space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-slate-800">Tạo điểm sự cố mới</p>
          <button type="button" onClick={onClose} className="ghost-btn h-8 w-8 !px-0">
            <X className="size-4" />
          </button>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">Tên sự cố</label>
            <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="field-label">Mã sự cố</label>
            <input
              className="field-input"
              value={incidentCode}
              onChange={(event) => setIncidentCode(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Loại sự cố</label>
            <select
              className="field-input"
              value={incidentType}
              onChange={(event) => setIncidentType(event.target.value as IncidentType)}
            >
              {INCIDENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Mức độ</label>
            <select
              className="field-input"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}
            >
              {INCIDENT_SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Trạng thái xử lý</label>
            <select
              className="field-input"
              value={status}
              onChange={(event) => setStatus(event.target.value as IncidentWorkflowStatus)}
            >
              {INCIDENT_WORKFLOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Ngày ghi nhận</label>
            <input
              type="date"
              className="field-input"
              value={reportedDate}
              onChange={(event) => setReportedDate(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="field-label">Vị trí</label>
          <input className="field-input" value={address} onChange={(event) => setAddress(event.target.value)} />
        </div>

        <div>
          <label className="field-label">Mô tả</label>
          <textarea
            className="field-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">Latitude</label>
            <input className="field-input" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </div>
          <div>
            <label className="field-label">Longitude</label>
            <input className="field-input" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">Hình ảnh (URL)</label>
            <input className="field-input" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
          </div>
          <div>
            <label className="field-label">Google Maps URL</label>
            <input
              className="field-input"
              value={googleMapsUrl}
              onChange={(event) => setGoogleMapsUrl(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="field-label">Ghi chú</label>
          <textarea className="field-textarea" value={notesRaw} onChange={(event) => setNotesRaw(event.target.value)} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ghost-btn">
            Hủy
          </button>
          <button type="submit" className="primary-btn">
            <Plus className="mr-1 size-4" />
            Tạo điểm sự cố
          </button>
        </div>
      </form>
    </div>
  )
}

function ReportsView({ data }: { data: LayerDataState }) {
  const assetChart = useMemo(() => buildAssetStatusChart(data), [data])
  const incidentChart = useMemo(() => buildIncidentSeverityChart(data), [data])
  const trendData = useMemo(
    () => [
      { month: 'T1', incidents: 5, maintenance: 2 },
      { month: 'T2', incidents: 4, maintenance: 3 },
      { month: 'T3', incidents: 6, maintenance: 3 },
      { month: 'T4', incidents: 3, maintenance: 2 },
      { month: 'T5', incidents: 4, maintenance: 4 },
      { month: 'T6', incidents: 2, maintenance: 3 },
    ],
    [],
  )

  return (
    <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-2">
      <section className="panel p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Phan bo trang thai tai san</p>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={assetChart}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={88}
                fill="#0ea5e9"
                label
              />
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Mức độ nghiêm trọng sự cố</p>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={incidentChart}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={88}
                fill="#ef4444"
                label
              />
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel p-4 lg:col-span-2">
        <p className="mb-3 text-sm font-semibold text-slate-800">Xu hướng sự cố và bảo trì (mô phỏng)</p>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="4 4" stroke="#dbeafe" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="incidents"
                name="Su co"
                stroke="#dc2626"
                strokeWidth={3}
              />
              <Line
                type="monotone"
                dataKey="maintenance"
                name="Bảo trì"
                stroke="#0284c7"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}

function ManageView({
  onAddAsset,
  onAddIncident,
  onReset,
}: {
  onAddAsset: () => void
  onAddIncident: () => void
  onReset: () => void
}) {
  return (
    <section className="panel h-full p-5">
      <p className="mb-3 text-base font-bold text-slate-800">Quản lý dữ liệu hạ tầng cấp nước</p>
      <p className="mb-5 text-sm text-slate-600">
        Thêm/sửa đối tượng, tạo sự cố mới và reset dữ liệu dự phòng trong localStorage.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <button type="button" onClick={onAddAsset} className="primary-btn h-11">
          <Plus className="mr-1 size-4" />
          Thêm đối tượng
        </button>
        <button type="button" onClick={onAddIncident} className="ghost-btn h-11 border-red-200 text-red-700 hover:bg-red-50">
          <AlertTriangle className="mr-1 size-4" />
          Tạo điểm sự cố
        </button>
        <button type="button" onClick={onReset} className="ghost-btn h-11">
          <RefreshCcw className="mr-1 size-4" />
          Reset dữ liệu dự phòng ban đầu
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-water-100 bg-water-50/60 p-4">
          <p className="mb-1 text-sm font-semibold text-water-900">Quy trình dữ liệu từ AutoCAD</p>
          <p className="text-sm text-water-900/80">DWG/DXF -&gt; QGIS -&gt; GeoJSON -&gt; Normalize schema -&gt; WebGIS Leaflet</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Mọi thao tác thêm/sửa hiện lưu tạm vào localStorage để phục vụ bản thử nghiệm.
        </div>
      </div>
    </section>
  )
}

function WebGISDashboardPage() {
  const { data, dataSource, loading, error, incidents, addAsset, addIncident, updateAsset, resetData } =
    useWebGISData()

  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [mapMode, setMapMode] = useState<MapMode>('cadVector')
  const [cadVectorData, setCadVectorData] = useState<CadVectorData | null>(null)
  const [cadVectorLoading, setCadVectorLoading] = useState(true)
  const [cadVectorVisibleLayers, setCadVectorVisibleLayers] = useState<Record<string, boolean>>({})
  const [cadVectorTypeFilter, setCadVectorTypeFilter] = useState<CadVectorType | 'all'>('all')
  const [cadVectorViewPreset, setCadVectorViewPreset] = useState<CadVectorViewPresetKey>('overview')
  const [cadVectorFitVersion, setCadVectorFitVersion] = useState(0)
  const [cadVectorLabelOptions, setCadVectorLabelOptions] =
    useState<CadLabelVisibilityOptions>(DEFAULT_CAD_LABEL_OPTIONS)
  const [selectedCadVectorFeature, setSelectedCadVectorFeature] = useState<CadVectorFeature | null>(null)
  const [cadVectorFocusVersion, setCadVectorFocusVersion] = useState(0)
  const [selectedLayoutId, setSelectedLayoutId] = useState(CAD_LAYOUT_OPTIONS[0].id)
  const [cadAssets, setCadAssets] = useState<CadBlueprintAsset[]>(loadCadAssetsFromStorage)
  const [curatedMainWorks, setCuratedMainWorks] = useState<CuratedMainWork[]>(loadCuratedMainWorksFromStorage)
  const [positionUpdateTargetId, setPositionUpdateTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null)
  const [selectedCadAssetId, setSelectedCadAssetId] = useState<string | null>(cadBlueprintAssets[0]?.id ?? null)
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null)
  const [hoveredCadAssetId, setHoveredCadAssetId] = useState<string | null>(null)
  const [cadEditMode, setCadEditMode] = useState(false)
  const [cadImageLoaded, setCadImageLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | AssetStatus>('all')
  const [flyToRequest, setFlyToRequest] = useState<FlyToRequest | null>(null)
  const [mapVersion, setMapVersion] = useState(0)
  const [showCreateAsset, setShowCreateAsset] = useState(false)
  const [showCreateIncident, setShowCreateIncident] = useState(false)
  const [editingFeature, setEditingFeature] = useState<AssetFeature | null>(null)

  const [uiState, setUiState] = useState<StoredUiState>(() => ({
    collapsedSidebar: false,
    collapsedDetail: false,
    visibleLayers: {
      waterPlant: true,
      rawWaterLakes: true,
      pipelines: true,
      canals: true,
      supplyZones: true,
      boundaries: true,
      labels: true,
      incidents: true,
    },
  }))

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_UI_KEY)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as StoredUiState
      setUiState((prev) => ({
        ...prev,
        ...parsed,
        visibleLayers: {
          ...prev.visibleLayers,
          ...parsed.visibleLayers,
        },
      }))
    } catch {
      // ignore invalid storage state
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_UI_KEY, JSON.stringify(uiState))
  }, [uiState])

  useEffect(() => {
    localStorage.setItem(CAD_ASSET_STORAGE_KEY, JSON.stringify(cadAssets))
  }, [cadAssets])

  useEffect(() => {
    localStorage.setItem(CAD_CURATED_WORKS_STORAGE_KEY, JSON.stringify(curatedMainWorks))
  }, [curatedMainWorks])

  useEffect(() => {
    let active = true

    async function loadVectorData() {
      setCadVectorLoading(true)
      const loaded = await loadCadVectorData()

      if (!active) {
        return
      }

      setCadVectorData(loaded)
      const overviewVisibility = createCadVectorLayerVisibility(loaded.layerIndex, 'overview')
      setCadVectorVisibleLayers(overviewVisibility)
      setCadVectorLabelOptions(DEFAULT_CAD_LABEL_OPTIONS)
      setCadVectorViewPreset('overview')

      if (loaded.hasCadVectorData) {
        const initialCuratedFeatures = buildCuratedMainWorkCollection(
          resolveCuratedMainWorks(loadCuratedMainWorksFromStorage(), loaded),
        )
        const initialDisplayData = filterCadVectorDataForView(
          mergeCadVectorDataWithCurated(loaded, initialCuratedFeatures),
          'overview',
        )
        const initialFeatures = initialDisplayData?.entities?.features ?? []
        setMapMode('cadVector')
        setSelectedCadVectorFeature(
          initialFeatures.find((feature) => feature.properties.curatedMainWork === true) ??
            initialFeatures.find((feature) =>
              isCadVectorObjectVisible(feature, overviewVisibility, 'all', DEFAULT_CAD_LABEL_OPTIONS),
            ) ??
            initialFeatures[0] ??
            null,
        )
      } else {
        setMapMode('cadImage')
      }

      setCadVectorLoading(false)
    }

    void loadVectorData()

    return () => {
      active = false
    }
  }, [])

  const selectedEnvelope = useMemo(() => {
    if (!data || !selectedFeatureId) {
      return null
    }

    return getFeatureById(data, selectedFeatureId)
  }, [data, selectedFeatureId])

  const selectedFeature = selectedEnvelope?.feature ?? null
  const selectedCadAsset = useMemo(() => {
    return cadAssets.find((asset) => asset.id === selectedCadAssetId) ?? null
  }, [cadAssets, selectedCadAssetId])
  const resolvedCuratedMainWorks = useMemo(
    () => resolveCuratedMainWorks(curatedMainWorks, cadVectorData),
    [cadVectorData, curatedMainWorks],
  )
  const curatedMainWorkFeatures = useMemo(
    () => buildCuratedMainWorkCollection(resolvedCuratedMainWorks),
    [resolvedCuratedMainWorks],
  )
  const cadVectorFullDisplayData = useMemo(
    () => mergeCadVectorDataWithCurated(cadVectorData, curatedMainWorkFeatures),
    [cadVectorData, curatedMainWorkFeatures],
  )
  const cadVectorDisplayData = useMemo(
    () => filterCadVectorDataForView(cadVectorFullDisplayData, cadVectorViewPreset),
    [cadVectorFullDisplayData, cadVectorViewPreset],
  )
  const cadVectorFeatureById = useMemo(() => {
    return new Map((cadVectorFullDisplayData?.entities?.features ?? []).map((feature) => [feature.properties.id, feature]))
  }, [cadVectorFullDisplayData])
  const cadVectorLayerGroups = useMemo(
    () => buildCadVectorLayerGroups(cadVectorData?.layerIndex ?? []),
    [cadVectorData],
  )
  const [expandedCadVectorGroups, setExpandedCadVectorGroups] = useState<Record<string, boolean>>({})

  const searchResults = useMemo<TopbarSearchResult[]>(() => {
    if (!searchQuery.trim()) {
      return []
    }

    const lowerSearch = normalizeSearchText(searchQuery)

    if (mapMode === 'cadVector') {
      return (cadVectorDisplayData?.entities?.features ?? [])
        .map((feature) => {
          const text = getCadFeatureText(feature)
          const keywords = [
            feature.properties.id,
            feature.properties.name,
            feature.properties.cadLayer,
            feature.properties.businessGroup,
            feature.properties.sourceGroup,
            feature.properties.sourceName,
            feature.properties.originalFile,
            feature.properties.Text,
            feature.properties.originalText,
            feature.properties.normalizedText,
            feature.properties.diameterText,
            feature.properties.EntityHandle,
            feature.properties.sourceEntityHandle,
            feature.properties.type,
            feature.properties.type === 'irrigation_canal' ? 'kenh thuy loi irrigation' : '',
            feature.properties.sourceName === 'HTCN PMV.dwg' ? 'HTCN PMV cong trinh chinh' : '',
          ]
            .filter((value): value is string => typeof value === 'string')
            .map((value) => normalizeSearchText(value))

          return {
            feature,
            matched: keywords.some((keyword) => keyword.includes(lowerSearch)),
            priority: cadVectorTypePriority(feature.properties.type, text),
          }
        })
        .filter((entry) => entry.matched)
        .sort((a, b) => a.priority - b.priority || a.feature.properties.id.localeCompare(b.feature.properties.id))
        .slice(0, 8)
        .map(({ feature }) => ({
          id: feature.properties.id,
          label: getFeatureDisplayName(feature),
          meta: `${feature.properties.type === 'pipe_diameter_label' ? 'Đường kính' : cadVectorTypeLabelForUi(feature.properties.type)} - ${feature.properties.cadLayer}`,
        }))
    }

    if (mapMode === 'cadImage') {
      return cadAssets.filter((asset) => {
        const keywords = [
          asset.id,
          asset.name,
          asset.cadLayer,
          asset.source,
          mapFeatureTypeLabel(asset.type),
        ].map((value) => value.toLowerCase())

        return keywords.some((keyword) => keyword.includes(lowerSearch))
      })
        .slice(0, 8)
        .map((asset) => ({
          id: asset.id,
          label: asset.name,
          meta: `${LAYER_LABELS[asset.layerKey]} - ${asset.cadLayer}`,
        }))
    }

    if (mapMode === 'layoutPreview') {
      return []
    }

    if (!data) {
      return []
    }

    const items = buildSearchItems(data)

    return items
      .filter((item) => item.keywords.some((keyword) => keyword.includes(lowerSearch)))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        label: item.label,
        meta: `${LAYER_LABELS[item.layerKey]} - ${item.id}`,
      }))
  }, [cadAssets, cadVectorDisplayData, data, mapMode, searchQuery])

  const objectItems = useMemo(() => {
    if (mapMode === 'cadVector') {
      return createCadVectorObjectList(
        cadVectorDisplayData,
        cadVectorVisibleLayers,
        cadVectorTypeFilter,
        cadVectorLabelOptions,
      )
    }

    if (mapMode === 'cadImage') {
      return createCadObjectList(cadAssets, uiState.visibleLayers, statusFilter)
    }

    if (mapMode === 'layoutPreview') {
      return []
    }

    if (!data) {
      return []
    }

    return createObjectList(data, uiState.visibleLayers, statusFilter)
  }, [
    cadAssets,
    cadVectorDisplayData,
    cadVectorLabelOptions,
    cadVectorTypeFilter,
    cadVectorVisibleLayers,
    data,
    mapMode,
    statusFilter,
    uiState.visibleLayers,
  ])

  useEffect(() => {
    if (!data || selectedFeatureId) {
      return
    }

    const firstFeatureId = getFirstFeatureId(data)
    if (firstFeatureId) {
      setSelectedFeatureId(firstFeatureId)
    }
  }, [data, selectedFeatureId])

  const handleFocusFeature = (featureId: string) => {
    if (!data) {
      return
    }

    const envelope = getFeatureById(data, featureId)
    if (!envelope) {
      return
    }

    setSelectedFeatureId(featureId)
    setFlyToRequest({ feature: envelope.feature, zoom: 16 })
  }

  const handleFocusCadAsset = (assetId: string) => {
    if (!cadAssets.some((asset) => asset.id === assetId)) {
      return
    }

    setViewMode('map')
    setMapMode('cadImage')
    setSelectedCadAssetId(assetId)
  }

  const handleFocusCadVectorFeature = (featureId: string) => {
    const feature = cadVectorFeatureById.get(featureId)
    if (!feature) {
      return
    }

    setViewMode('map')
    setMapMode('cadVector')
    setUiState((prev) => ({ ...prev, collapsedDetail: false }))
    setCadVectorTypeFilter('all')
    setCadVectorVisibleLayers((prev) => ({
      ...prev,
      [feature.properties.layerKey ?? feature.properties.cadLayer]: true,
    }))
    if (isCadVectorTextFeature(feature)) {
      setCadVectorLabelOptions((prev) => ({
        ...prev,
        showMainWorkLabels:
          prev.showMainWorkLabels ||
          feature.properties.type === 'water_plant' ||
          feature.properties.type === 'raw_water_lake' ||
          feature.properties.type === 'main_work_candidate',
        showDiameterLabels: prev.showDiameterLabels || isPipeDiameterText(getCadFeatureText(feature)),
        showIrrigationLabels: prev.showIrrigationLabels || feature.properties.type === 'irrigation_label',
        showLocationLabels: prev.showLocationLabels || feature.properties.type === 'location_label',
        showAllLabels:
          prev.showAllLabels ||
          (!isPipeDiameterText(getCadFeatureText(feature)) && feature.properties.type !== 'location_label'),
      }))
    }
    setSelectedCadVectorFeature(feature)
    setCadVectorFocusVersion((value) => value + 1)
  }

  const handleSelectLayoutPreview = (layoutId: string) => {
    setViewMode('map')
    setMapMode('layoutPreview')
    setSelectedLayoutId(layoutId)
  }

  const handleMapModeChange = (nextMode: MapMode) => {
    setViewMode('map')
    setMapMode(nextMode)

    if (nextMode === 'cadVector' && !selectedCadVectorFeature) {
      setSelectedCadVectorFeature(cadVectorData?.entities?.features[0] ?? null)
    }

    if (nextMode === 'cadImage' && !selectedCadAssetId) {
      setSelectedCadAssetId(cadAssets[0]?.id ?? null)
    }

    if (nextMode === 'osm' && data && !selectedFeatureId) {
      setSelectedFeatureId(getFirstFeatureId(data))
    }
  }

  const handleAddAsset = (payload: NewAssetInput | UpdateAssetInput) => {
    if ('geometryType' in payload) {
      const created = addAsset(payload)
      if (created) {
        setSelectedFeatureId(created.properties.id)
        setFlyToRequest({ feature: created, zoom: 16 })
      }
      setShowCreateAsset(false)
      return
    }

    if (editingFeature) {
      const updated = updateAsset(editingFeature.properties.id, payload)
      if (updated) {
        setSelectedFeatureId(updated.properties.id)
      }
      setEditingFeature(null)
    }
  }

  const handleAddIncident = (payload: NewIncidentInput) => {
    const created = addIncident(payload)
    if (created) {
      setSelectedFeatureId(created.properties.id)
      setFlyToRequest({ feature: created, zoom: 16 })
    }
    setShowCreateIncident(false)
  }

  const handleSelectSearchResult = (featureId: string) => {
    if (mapMode === 'cadVector') {
      handleFocusCadVectorFeature(featureId)
      setSearchQuery('')
      return
    }

    if (mapMode === 'cadImage') {
      handleFocusCadAsset(featureId)
      setSearchQuery('')
      return
    }

    handleFocusFeature(featureId)
    setSearchQuery('')
  }

  const pipelineLengthSummary = useMemo(() => {
    if (!data) {
      return 0
    }

    return data.pipelines.features.reduce((sum, feature) => sum + calculateFeatureLineLengthKm(feature), 0)
  }, [data])
  const cadVectorLineLengthSummary = useMemo(
    () => calculateCadVectorTotalLineLength(cadVectorData),
    [cadVectorData],
  )
  const cadVectorViewPresetLabel =
    CAD_VECTOR_VIEW_PRESETS.find((preset) => preset.key === cadVectorViewPreset)?.label ?? 'Tổng quan'
  const showIncidentCompanionPanel = viewMode === 'map' && mapMode === 'osm'

  const handleResetData = async () => {
    await resetData()
    setSelectedFeatureId(null)
    setMapVersion((prev) => prev + 1)
  }

  const uiLayerToggle = (key: LayerKey) => {
    setUiState((prev) => ({
      ...prev,
      visibleLayers: {
        ...prev.visibleLayers,
        [key]: !prev.visibleLayers[key],
      },
    }))
  }

  const toggleCadVectorLayer = (layerName: string) => {
    setCadVectorVisibleLayers((prev) => ({
      ...prev,
      [layerName]: prev[layerName] === false,
    }))
  }

  const setCadVectorLayersVisibility = (layerNames: string[], visible: boolean) => {
    setCadVectorVisibleLayers((prev) => {
      const next = { ...prev }
      for (const layerName of layerNames) {
        next[layerName] = visible
      }
      return next
    })
  }

  const applyViewPreset = (viewKey: CadVectorViewPresetKey) => {
    setCadVectorViewPreset(viewKey)
    setCadVectorTypeFilter('all')
    setCadVectorLabelOptions(getLabelOptionsForPreset(viewKey))
    setCadVectorVisibleLayers((prev) => {
      const next: Record<string, boolean> = {
        ...prev,
        [CAD_BASE_LAYER_KEY]: true,
        [CAD_CURATED_MAIN_WORKS_LAYER_KEY]: true,
      }

      const requiredGroups = new Set<CadVectorGroupKey>(['background', 'boundary'])
      if (viewKey === 'overview') {
        requiredGroups.add('pipeline')
        requiredGroups.add('irrigation')
      }
      if (viewKey === 'water_plants' || viewKey === 'raw_water_lakes') {
        requiredGroups.add('pipeline')
      }
      if (viewKey === 'raw_water_lakes' || viewKey === 'irrigation_system') {
        requiredGroups.add('irrigation')
      }

      for (const layer of cadVectorData?.layerIndex ?? []) {
        const groupKey = classifyCadVectorLayerGroup(layer)
        if (requiredGroups.has(groupKey)) {
          next[layer.layerKey ?? layer.layerName] = true
        }
      }

      return Object.keys(next).length === Object.keys(prev).length &&
        Object.entries(next).every(([key, value]) => prev[key] === value)
        ? prev
        : next
    })
    setCadVectorFitVersion((value) => value + 1)
    const nextDisplayData = filterCadVectorDataForView(
      mergeCadVectorDataWithCurated(cadVectorData, curatedMainWorkFeatures),
      viewKey,
    )
    const nextFeatures = nextDisplayData?.entities?.features ?? []
    setSelectedCadVectorFeature(getPreferredCadFeatureForView(nextFeatures, viewKey))
  }

  const handleCadVectorLabelOptionChange = (key: keyof CadLabelVisibilityOptions, value: boolean) => {
    setCadVectorLabelOptions((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const toggleCadVectorGroupExpanded = (groupKey: CadVectorGroupKey) => {
    setExpandedCadVectorGroups((prev) => ({
      ...prev,
      [groupKey]: !(prev[groupKey] ?? CAD_VECTOR_GROUP_META[groupKey].defaultExpanded),
    }))
  }

  const handleSelectObject = (id: string) => {
    if (mapMode === 'cadVector') {
      handleFocusCadVectorFeature(id)
      return
    }

    if (mapMode === 'cadImage') {
      handleFocusCadAsset(id)
      return
    }

    handleFocusFeature(id)
  }

  const handleSelectCuratedMainWork = (id: string) => {
    const feature = cadVectorFeatureById.get(id)
    setViewMode('map')
    setMapMode('cadVector')
    setUiState((prev) => ({ ...prev, collapsedDetail: false }))
    setCadVectorVisibleLayers((prev) => ({
      ...prev,
      [CAD_BASE_LAYER_KEY]: true,
      [CAD_CURATED_MAIN_WORKS_LAYER_KEY]: true,
    }))

    if (feature) {
      setSelectedCadVectorFeature(feature)
      setCadVectorFocusVersion((value) => value + 1)
    } else {
      setPositionUpdateTargetId(id)
    }
  }

  const handleStartCuratedMainWorkPositionUpdate = (id: string) => {
    handleSelectCuratedMainWork(id)
    setPositionUpdateTargetId(id)
  }

  const handleCadVectorCoordinateClick = (cadPosition: [number, number]) => {
    if (!positionUpdateTargetId) {
      return
    }

    const roundedPosition: [number, number] = [
      Math.round(cadPosition[0] * 1000) / 1000,
      Math.round(cadPosition[1] * 1000) / 1000,
    ]

    setCuratedMainWorks((prev) =>
      prev.map((work) =>
        work.id === positionUpdateTargetId
          ? {
              ...work,
              cadPosition: roundedPosition,
              manuallyPositioned: true,
              status: 'positioned',
              notes: [
                ...(work.notes ?? []),
                `Cập nhật vị trí thủ công: [${roundedPosition[0]}, ${roundedPosition[1]}]`,
              ],
            }
          : work,
      ),
    )
    const targetWork = resolvedCuratedMainWorks.find((work) => work.id === positionUpdateTargetId)
    const updatedFeature = targetWork
      ? buildCuratedMainWorkFeature({
          ...targetWork,
          cadPosition: roundedPosition,
          manuallyPositioned: true,
          status: 'positioned',
        })
      : null
    if (updatedFeature) {
      setSelectedCadVectorFeature(updatedFeature)
      setCadVectorFocusVersion((value) => value + 1)
    }
    setPositionUpdateTargetId(null)
  }

  const handleExportCuratedMainWorks = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(resolvedCuratedMainWorks, null, 2))
    } catch {
      window.alert('Không copy được JSON công trình chính. Hãy thử lại trong trình duyệt.')
    }
  }

  const handleUpdateCadPointPosition = (assetId: string, cadPosition: [number, number]) => {
    setCadAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId && asset.geometryType === 'Point'
          ? {
              ...asset,
              cadPosition,
              lastUpdated: new Date().toISOString().slice(0, 10),
              notes: [
                ...(asset.notes ?? []),
                `Cập nhật vị trí thủ công: [${cadPosition[0]}, ${cadPosition[1]}]`,
              ],
            }
          : asset,
      ),
    )
    setSelectedCadAssetId(assetId)
  }

  if (loading) {
    return (
      <main className="flex h-full items-center justify-center p-8">
        <div className="panel max-w-md p-6 text-center">
          <div className="mb-3 inline-flex rounded-full bg-water-100 p-3 text-water-700">
            <Droplets className="size-6 animate-pulse" />
          </div>
          <p className="text-lg font-semibold text-slate-800">Đang tải dữ liệu WebGIS...</p>
          <p className="mt-2 text-sm text-slate-500">Khởi tạo lớp dữ liệu CAD Vector và dữ liệu hạ tầng</p>
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="flex h-full items-center justify-center p-8">
        <div className="panel max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 size-7 text-red-600" />
          <p className="text-base font-semibold text-slate-800">Không thể khởi tạo dữ liệu bản đồ</p>
          <p className="mt-1 text-sm text-slate-500">{error ?? 'Không có dữ liệu để hiển thị'}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-full flex-col">
      <Topbar
        mapMode={mapMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        results={searchResults}
        onSelectResult={handleSelectSearchResult}
        cadVectorData={cadVectorData}
        cadVectorLoading={cadVectorLoading}
      />

      <section className="flex min-h-0 flex-1 gap-3 p-3 pt-2">
        <LayerSidebar
          collapsed={uiState.collapsedSidebar}
          onToggle={() => setUiState((prev) => ({ ...prev, collapsedSidebar: !prev.collapsedSidebar }))}
          visibleLayers={uiState.visibleLayers}
          onToggleLayer={uiLayerToggle}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          objectItems={objectItems}
          selectedId={
            mapMode === 'cadVector'
              ? selectedCadVectorFeature?.properties.id ?? null
              : mapMode === 'cadImage'
                ? selectedCadAssetId
                : mapMode === 'layoutPreview'
                  ? null
                  : selectedFeatureId
          }
          onSelectObject={handleSelectObject}
          dataSource={dataSource}
          mapMode={mapMode}
          cadImageLoaded={cadImageLoaded}
          cadVectorData={cadVectorData}
          cadVectorVisibleLayers={cadVectorVisibleLayers}
          onToggleCadVectorLayer={toggleCadVectorLayer}
          cadVectorTypeFilter={cadVectorTypeFilter}
          onCadVectorTypeFilterChange={setCadVectorTypeFilter}
          cadVectorViewPreset={cadVectorViewPreset}
          onCadVectorViewPresetChange={applyViewPreset}
          cadVectorLabelOptions={cadVectorLabelOptions}
          onCadVectorLabelOptionChange={handleCadVectorLabelOptionChange}
          curatedMainWorks={resolvedCuratedMainWorks}
          positionUpdateTargetId={positionUpdateTargetId}
          onSelectCuratedMainWork={handleSelectCuratedMainWork}
          onStartCuratedMainWorkPositionUpdate={handleStartCuratedMainWorkPositionUpdate}
          onCancelCuratedMainWorkPositionUpdate={() => setPositionUpdateTargetId(null)}
          onExportCuratedMainWorks={handleExportCuratedMainWorks}
          cadVectorLayerGroups={cadVectorLayerGroups}
          expandedCadVectorGroups={expandedCadVectorGroups}
          onToggleCadVectorGroupExpanded={toggleCadVectorGroupExpanded}
          onSetCadVectorLayers={setCadVectorLayersVisibility}
          selectedLayoutId={selectedLayoutId}
          onSelectLayoutPreview={handleSelectLayoutPreview}
          onOpenCadVectorMap={() => handleMapModeChange('cadVector')}
          onOpenCadImage={() => handleMapModeChange('cadImage')}
          onOpenOsm={() => handleMapModeChange('osm')}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {mapMode !== 'cadVector' && (
            <DashboardCards
              data={data}
              mapMode={mapMode}
              cadVectorData={cadVectorDisplayData}
              curatedMainWorks={resolvedCuratedMainWorks}
              cadVectorViewPreset={cadVectorViewPreset}
            />
          )}

          <div
            className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${
              showIncidentCompanionPanel ? 'xl:grid-cols-[1fr_340px]' : ''
            }`}
          >
            {viewMode === 'map' && mapMode === 'cadVector' && (
              <CadVectorMap
                data={cadVectorDisplayData}
                loading={cadVectorLoading}
                visibleLayers={cadVectorVisibleLayers}
                typeFilter={cadVectorTypeFilter}
                labelOptions={cadVectorLabelOptions}
                selectedFeature={selectedCadVectorFeature}
                focusVersion={cadVectorFocusVersion}
                fitVersion={cadVectorFitVersion}
                viewPresetKey={cadVectorViewPreset}
                viewPresetLabel={cadVectorViewPresetLabel}
                positionUpdateTargetLabel={
                  positionUpdateTargetId
                    ? resolvedCuratedMainWorks.find((work) => work.id === positionUpdateTargetId)?.displayName ?? null
                    : null
                }
                onCadCoordinateClick={handleCadVectorCoordinateClick}
                onSelectFeature={(feature) => {
                  setSelectedCadVectorFeature(feature)
                  setCadVectorFocusVersion((value) => value + 1)
                }}
              />
            )}

            {viewMode === 'map' && mapMode === 'cadImage' && (
              <CadBlueprintMap
                assets={cadAssets}
                config={CAD_BLUEPRINT_CONFIG}
                visibleLayers={uiState.visibleLayers}
                selectedAssetId={selectedCadAssetId}
                hoveredAssetId={hoveredCadAssetId}
                editMode={cadEditMode}
                onEditModeChange={setCadEditMode}
                onSelectAsset={handleFocusCadAsset}
                onHoverAsset={setHoveredCadAssetId}
                onUpdatePointPosition={handleUpdateCadPointPosition}
                onImageStatusChange={setCadImageLoaded}
              />
            )}

            {viewMode === 'map' && mapMode === 'layoutPreview' && (
              <CadLayoutPreview
                selectedLayoutId={selectedLayoutId}
                onSelectedLayoutChange={setSelectedLayoutId}
              />
            )}

            {viewMode === 'map' && mapMode === 'osm' && (
              <WebGISMapPanel
                data={data}
                visibleLayers={uiState.visibleLayers}
                selectedFeatureId={selectedFeatureId}
                hoveredFeatureId={hoveredFeatureId}
                onHoverFeature={setHoveredFeatureId}
                onSelectFeature={handleFocusFeature}
                flyToRequest={flyToRequest}
                onFlyHandled={() => setFlyToRequest(null)}
                mapVersion={mapVersion}
              />
            )}

            {viewMode === 'manage' && (
              <ManageView
                onAddAsset={() => setShowCreateAsset(true)}
                onAddIncident={() => setShowCreateIncident(true)}
                onReset={handleResetData}
              />
            )}

            {viewMode === 'report' && <ReportsView data={data} />}

            {showIncidentCompanionPanel && (
              <IncidentList
                incidents={incidents}
                selectedId={selectedFeatureId}
                onSelectIncident={handleFocusFeature}
              />
            )}
          </div>

          <div className="panel flex items-center justify-between px-4 py-2 text-sm text-slate-600">
            {mapMode === 'cadVector' && cadVectorData?.hasCadVectorData ? (
              <>
                <p>
                  Tổng chiều dài tuyến/line:{' '}
                  <span className="font-semibold text-slate-800">
                    {cadVectorLineLengthSummary.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đơn vị CAD
                  </span>
                </p>
                <p>
                  {cadVectorData.metadata?.totalFeatures ?? 0} feature | {cadVectorData.layerIndex.length} CAD layer
                </p>
              </>
            ) : mapMode === 'layoutPreview' ? (
              <>
                <p>
                  Bản vẽ gốc: <span className="font-semibold text-slate-800">
                    {CAD_LAYOUT_OPTIONS.find((layout) => layout.id === selectedLayoutId)?.label ?? 'Layout'}
                  </span>
                </p>
                <p>Layout chỉ để tham khảo, không dùng làm dữ liệu GIS chính</p>
              </>
            ) : (
              <>
                <p>
                  Tổng chiều dài tuyến ống:{' '}
                  <span className="font-semibold text-slate-800">{pipelineLengthSummary.toFixed(2)} km</span>
                </p>
                <p>
                  {data.waterPlant.features.length} nhà máy | {data.rawWaterLakes.features.length} hồ chứa |{' '}
                  {data.incidents.features.length} sự cố
                </p>
              </>
            )}
          </div>
        </div>

        <DetailPanel
          collapsed={uiState.collapsedDetail}
          onToggle={() => setUiState((prev) => ({ ...prev, collapsedDetail: !prev.collapsedDetail }))}
          feature={mapMode === 'osm' ? selectedFeature : null}
          cadVectorFeature={mapMode === 'cadVector' ? selectedCadVectorFeature : null}
          cadAsset={mapMode === 'cadImage' ? selectedCadAsset : null}
          cadEditMode={cadEditMode}
          onToggleCadEdit={() => setCadEditMode((value) => !value)}
          positionUpdateTargetId={positionUpdateTargetId}
          onStartCadVectorPositionUpdate={(feature) =>
            handleStartCuratedMainWorkPositionUpdate(
              String(feature.properties.curatedMainWorkId ?? feature.properties.id),
            )
          }
          onOpenUpdate={(feature) => setEditingFeature(feature)}
          onOpenIncident={() => setShowCreateIncident(true)}
        />
      </section>

      {(showCreateAsset || editingFeature) && (
        <AssetFormModal
          mode={showCreateAsset ? 'create' : 'update'}
          feature={editingFeature}
          onClose={() => {
            setShowCreateAsset(false)
            setEditingFeature(null)
          }}
          onSubmit={handleAddAsset}
        />
      )}

      {showCreateIncident && (
        <IncidentFormModal
          anchorFeature={selectedFeature}
          onClose={() => setShowCreateIncident(false)}
          onSubmit={handleAddIncident}
        />
      )}
    </main>
  )
}

function App() {
  return <WebGISDashboardPage />
}

export default App

import { isLocalDraft, isServerFeature, mergeLocalDrafts } from './services/localDraftStore'
import { MapResizeController } from './components/map/MapResizeController'
import { IncidentAlertMarkers } from './components/map/IncidentAlertMarkers'
import { WorkspaceSettings } from './components/layout/WorkspaceSettings'
import { readMapExperience, MAP_EXPERIENCE_KEY, type MapExperience } from './utils/mapPreferences'
import { GeographicFocusMask } from './components/map/GeographicFocusMask'
import { GeographicBaseMap } from './components/map/GeographicBaseMap'
import { GeographicCadOverlay } from './components/map/GeographicCadOverlay'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Droplets,
  Factory,
  Gauge,
  Layers,
  ListChecks,
  LogOut,
  LocateFixed,
  MapPin,
  Move,
  Plus,
  Route,
  Search,
  Waves,
  X,
} from 'lucide-react'
import { lazy, Suspense, useCallback, useId, useRef } from 'react'
import { useAuth } from './auth/AuthContext'
import LoginPage from './components/auth/LoginPage'
import { LoadingPanel, RegionError, Toast, type ToastTone } from './components/ui/Feedback'
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard'
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
  IncidentAnchor,
  IncidentReportTarget,
  IncidentAttachment,
  IncidentAssignee,
  IncidentHistoryItem,
  IncidentLinkedAsset,
  IncidentWorkflowStatus,
  LayerDataState,
  LayerKey,
  MapMode,
  NewAssetInput,
  NewIncidentInput,
  UpdateAssetInput,
  ViewMode,
} from './types/gis'
import { useWebGISData } from './hooks/useWebGISData'
import type { ViewportAssetsResult } from './data/dataService'
import { CAD_LAYOUT_OPTIONS } from './data/cadLayoutOptions'
import { cadBlueprintAssets, CAD_BLUEPRINT_CONFIG } from './data/cadBlueprintAssets'
import { CURATED_MAIN_WORKS, type CuratedMainWork } from './data/curatedMainWorks'
import { LAYER_COLORS, LAYER_LABELS, mapFeatureTypeLabel } from './utils/asset'
import { buildSearchItems, flattenLayerData, getFeatureById } from './utils/features'
import { computeDashboardStats } from './utils/metrics'
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
} from './utils/status'
import {
  cadVectorTypePriority,
  cadVectorTypeLabelForUi,
  getCadFeatureText,
  getFeatureDisplayName,
  isCadTextFeature,
  isLikelyMojibake,
  isPipeDiameterText,
  normalizeSearchText,
  type CadLabelVisibilityOptions,
} from './utils/textUtils'
import {
  GeoJSON,
  MapContainer,
  ZoomControl,
  Popup,
  Polyline,
  Tooltip as LeafletTooltip,
  useMap,
  CircleMarker,
} from 'react-leaflet'
import type { Layer } from 'leaflet'

const CadBlueprintMap = lazy(() =>
  import('./components/map/CadBlueprintMap').then((module) => ({ default: module.CadBlueprintMap })),
)
const CadVectorMap = lazy(() =>
  import('./components/map/CadVectorMap').then((module) => ({ default: module.CadVectorMap })),
)
const CadLayoutPreview = lazy(() =>
  import('./components/map/CadLayoutPreview').then((module) => ({ default: module.CadLayoutPreview })),
)
const ReportsView = lazy(() => import('./components/reports/ReportsView'))
const IncidentDetailTabs = lazy(() =>
  import('./components/incidents/IncidentDetailTabs').then((module) => ({ default: module.IncidentDetailTabs })),
)
const AssetDetailTabs = lazy(() =>
  import('./components/assets/AssetDetailTabs').then((module) => ({ default: module.AssetDetailTabs })),
)
const IncidentIntakeModal = lazy(() => import('./components/incidents/IncidentIntakeModal').then((module) => ({ default: module.IncidentIntakeModal })))
const OperationsWorkspace = lazy(() =>
  import('./components/manage/OperationsWorkspace').then((module) => ({ default: module.OperationsWorkspace })),
)

const BASE_MAP_CENTER: [number, number] = [10.8845, 106.4255]
const BASE_MAP_ZOOM = 13

const STORAGE_UI_KEY = 'webgis-ui-v1'
const CAD_ASSET_STORAGE_KEY = 'webgis-cad-blueprint-assets-v1'
const CAD_CURATED_WORKS_STORAGE_KEY = 'webgis-curated-main-works-v2'
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

function createDefaultUiState(): StoredUiState {
  const compactLayout = typeof window !== 'undefined' && window.innerWidth < 1024
  return {
    collapsedSidebar: compactLayout,
    collapsedDetail: true,
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
  }
}

function loadStoredUiState(): StoredUiState {
  const fallback = createDefaultUiState()
  try {
    const raw = localStorage.getItem(STORAGE_UI_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<StoredUiState>
    const state = {
      ...fallback,
      ...parsed,
      visibleLayers: {
        ...fallback.visibleLayers,
        ...parsed.visibleLayers,
      },
    }
    if (window.innerWidth < 1024) {
      state.collapsedSidebar = true
    }
    state.collapsedDetail = true
    return state
  } catch {
    return fallback
  }
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
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  results: TopbarSearchResult[]
  onSelectResult: (id: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  userEmail?: string
  onSignOut?: () => void
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
  onOpenIncident: (target: IncidentReportTarget) => void
  onTransitionIncident: (id: string, status: IncidentWorkflowStatus, note: string) => Promise<void>
  onAssignIncident: (id: string, assignee: string, note: string) => Promise<void>
  onEscalateIncident: (id: string, note: string) => Promise<void>
  onAddIncidentComment: (id: string, content: string) => Promise<void>
  onLoadIncidentAssignees: () => Promise<IncidentAssignee[]>
  onLoadIncidentAssets: (id: string) => Promise<IncidentLinkedAsset[]>
  onUpdateIncidentAssets: (id: string, assetIds: string[], note: string) => Promise<void>
  onLoadIncidentHistory: (id: string) => Promise<IncidentHistoryItem[]>
  onLoadIncidentAttachments: (id: string) => Promise<IncidentAttachment[]>
  onUploadIncidentAttachment: (id: string, file: File) => Promise<IncidentAttachment>
  canAssignIncident: boolean
  availableAssets: AssetFeature[]
}

interface AssetFormProps {
  mode: 'create' | 'update'
  feature: AssetFeature | null
  onClose: () => void
  onSubmit: (payload: NewAssetInput | UpdateAssetInput) => Promise<void>
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
  viewportLoading: boolean
  viewportTruncated: boolean
  viewportError: string | null
  onViewportChange: (bbox: [number, number, number, number], zoom: number) => void
  geographicCadVisible: boolean
  geographicCadFocus: [number, number] | null
  onGeographicCadVisibleChange: (visible: boolean) => void
  focusEnabled: boolean
  projectFeatures: AnyMapFeature[]
  onOpenSettings: () => void
}

interface ToastState {
  id: number
  title: string
  message?: string
  tone?: ToastTone
  featureId?: string
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
    return 'Đang dùng dữ liệu dự phòng'
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

function getCadVectorLayerCount(layerIndex: CadVectorLayerIndexItem[]): number {
  return layerIndex.filter((layer) => layer.featureCount > 0).length
}

function isCadVectorTextFeature(feature: CadVectorFeature): boolean {
  return isCadTextFeature(feature)
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

    return CURATED_MAIN_WORKS.map((work) => {
      const storedWork = storedById.get(work.id)

      if (!storedWork?.manuallyPositioned) {
        return work
      }

      return {
        ...work,
        ...storedWork,
        notes: storedWork.notes ?? work.notes,
      }
    })
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
  const fitted = useRef(false)

  useEffect(() => {
    if (fitted.current) return
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
    fitted.current = true
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
  viewportLoading,
  viewportTruncated,
  viewportError,
  onViewportChange,
  geographicCadVisible,
  geographicCadFocus,
  onGeographicCadVisibleChange,
  focusEnabled,
  projectFeatures,
  onOpenSettings,
}: MapPanelProps) {
  const [referenceFeatures, setReferenceFeatures] = useState<AssetFeature[]>([])
  const onReferenceLoaded = useCallback((features: AssetFeature[]) => setReferenceFeatures(features), [])
  const focusFeatures = useMemo(() => geographicCadVisible
    ? [...projectFeatures, ...referenceFeatures] : projectFeatures,
  [projectFeatures, geographicCadVisible, referenceFeatures])
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

  return (
    <div className="panel relative h-full min-h-[280px] sm:min-h-0 overflow-hidden">
      <div className="absolute bottom-8 left-3 z-[800] flex max-w-[calc(100%-4rem)] flex-wrap gap-2">
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
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="accent-water-600" checked={geographicCadVisible} onChange={(event) => onGeographicCadVisibleChange(event.target.checked)} />
          CAD đối chiếu
        </label>
      </div>

      {(viewportLoading || viewportTruncated) && (
        <div className="absolute bottom-4 left-1/2 z-[800] -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          {viewportLoading ? (
            <span className="flex items-center gap-2"><span className="size-2 animate-pulse rounded-full bg-water-500" />Đang cập nhật vùng bản đồ...</span>
          ) : 'Phóng to để xem đầy đủ đối tượng'}
        </div>
      )}

      {viewportError && (
        <div className="absolute bottom-4 left-4 right-4 z-[810] rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 shadow-sm sm:left-auto sm:max-w-sm">
          <span className="font-semibold">Chưa cập nhật được vùng bản đồ.</span>{' '}
          Dữ liệu gần nhất vẫn được giữ lại; di chuyển bản đồ để thử lại.
        </div>
      )}

      <MapContainer
        key={mapVersion}
        center={BASE_MAP_CENTER}
        zoom={BASE_MAP_ZOOM}
        scrollWheelZoom
        preferCanvas
        zoomControl={false}
        maxZoom={21}
        className="h-full w-full"
      >
        <ZoomControl position="bottomright" />
        <GeographicBaseMap focusEnabled={focusEnabled} onOpenSettings={onOpenSettings} />
        {geographicCadVisible && <GeographicCadOverlay focusPosition={geographicCadFocus} onFeaturesLoaded={onReferenceLoaded} />}
        <GeographicFocusMask features={focusFeatures} enabled={focusEnabled} />
        {ASSET_LAYER_KEYS.map((layerKey) => visibleLayers[layerKey] && (
          <RenderFeatureLayer
            key={layerKey}
            layerKey={layerKey}
            features={layerData[layerKey]}
            selectedFeatureId={selectedFeatureId}
            hoveredFeatureId={hoveredFeatureId}
            onHoverFeature={onHoverFeature}
            onSelectFeature={onSelectFeature}
          />
        ))}
        {visibleLayers.incidents && <IncidentAlertMarkers incidents={layerData.incidents} selectedId={selectedFeatureId} onSelect={onSelectFeature} />}

        <MapDataBoundsController data={data} />
        <MapViewportController onViewportChange={onViewportChange} />
        <MapFlyController request={flyToRequest} onHandled={onFlyHandled} />
        <MapResizeController />
      </MapContainer>
    </div>
  )
}

function Topbar({
  searchQuery,
  onSearchQueryChange,
  results,
  onSelectResult,
  viewMode,
  onViewModeChange,
  userEmail,
  onSignOut,
}: TopbarProps) {
  return (
    <header className="panel relative z-[900] mx-3 mt-3 flex h-[72px] items-center gap-3 px-4 lg:px-6">
      <div className="shrink-0">
        <p className="font-display text-[24px] uppercase leading-none tracking-wide text-water-800">WebGIS</p>
        <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-water-600 sm:block">
          Quản lý hệ thống cấp nước
        </p>
      </div>

      {viewMode === 'map' ? <div className="relative ml-auto min-w-0 w-full max-w-[440px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Tìm tên, mã hoặc địa chỉ..."
          className="field-input h-10 pl-9"
          aria-label="Tìm kiếm trên bản đồ"
        />

        {searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-12 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
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
      </div> : <div className="ml-auto" />}

      <nav className="hidden items-center rounded-xl border border-slate-200 bg-slate-100 p-1 md:flex" aria-label="Điều hướng chính">
        {([
          ['map', 'Bản đồ', MapPin],
          ['manage', 'Quản lý', ListChecks],
          ['report', 'Báo cáo', BarChart3],
        ] as const).map(([mode, label, Icon]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${
              viewMode === mode ? 'bg-white text-water-800 shadow-sm' : 'text-slate-600 hover:text-water-800'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      {userEmail && (
        <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 xl:flex">
          <div className="max-w-32">
            <p className="truncate text-xs font-semibold text-slate-700">{userEmail}</p>
            <p className="text-[11px] text-slate-400">Người dùng</p>
          </div>
          {onSignOut && (
            <button type="button" onClick={onSignOut} className="ghost-btn h-8 w-8 !px-0" title="Đăng xuất" aria-label="Đăng xuất">
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      )}

      <nav className="fixed bottom-[max(.75rem,env(safe-area-inset-bottom))] left-1/2 z-[1300] flex -translate-x-1/2 items-center rounded-xl border border-water-100 bg-white p-1 shadow-sm md:hidden" aria-label="Điều hướng chính">
        {([
          ['map', 'Bản đồ', MapPin],
          ['manage', 'Quản lý', ListChecks],
          ['report', 'Báo cáo', BarChart3],
        ] as const).map(([mode, label, Icon]) => (
          <button key={mode} type="button" onClick={() => onViewModeChange(mode)} className={`flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold ${viewMode === mode ? 'bg-water-600 text-white' : 'text-slate-600'}`}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
        {onSignOut && (
          <button type="button" onClick={onSignOut} className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border-l border-slate-200 text-slate-500" aria-label="Đăng xuất">
            <LogOut className="size-4" />
          </button>
        )}
      </nav>
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
  const getCadVectorGroupLayerNames = (groupKey: CadVectorGroupKey) =>
    cadVectorLayerGroups
      .find((group) => group.key === groupKey)
      ?.layers.map((layer) => layer.layerKey ?? layer.layerName) ?? []
  const isCadVectorGroupVisible = (groupKey: CadVectorGroupKey) => {
    const layerNames = getCadVectorGroupLayerNames(groupKey)
    return layerNames.length > 0 && layerNames.some((layerName) => cadVectorVisibleLayers[layerName] !== false)
  }

  const primaryLayerKeys: LayerKey[] = ['waterPlant', 'rawWaterLakes', 'pipelines', 'canals', 'supplyZones', 'incidents']
  const renderLayer = (key: LayerKey) => (
    <label key={key} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-water-50">
      <span className="flex items-center gap-2 text-slate-700">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: LAYER_COLORS[key] }} />
        {LAYER_LABELS[key]}
      </span>
      <input type="checkbox" checked={visibleLayers[key]} onChange={() => onToggleLayer(key)} className="size-4 accent-water-600" />
    </label>
  )

  return (
    <aside aria-label="Lớp bản đồ" className={`fixed bottom-[68px] left-3 top-[92px] z-[1200] max-w-[calc(100vw-1.5rem)] shrink-0 md:bottom-3 lg:relative lg:inset-auto lg:z-auto lg:max-w-none ${collapsed ? 'w-[52px]' : 'w-[280px]'}`}>
      <div className="panel flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-water-100 px-3 py-3">
          {!collapsed && <p className="flex items-center gap-2 text-sm font-semibold text-water-900"><Layers className="size-4" />Lớp bản đồ</p>}
          <button type="button" onClick={onToggle} aria-label={collapsed ? 'Mở lớp bản đồ' : 'Thu gọn lớp bản đồ'} aria-expanded={!collapsed} className="ghost-btn h-8 w-8 !px-0">
            {collapsed ? <Layers className="size-4" /> : <X className="size-4" />}
          </button>
        </div>
        {!collapsed && <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            <label className="block">
              <span className="field-label">Chế độ xem</span>
              <select aria-label="Chế độ xem bản đồ" className="field-input" value={mapMode === 'cadVector' ? cadVectorViewPreset : mapMode}
                onChange={(event) => {
                  const value = event.target.value
                  if (value === 'osm') onOpenOsm()
                  else if (value === 'cadImage') onOpenCadImage()
                  else if (value === 'layoutPreview') onSelectLayoutPreview(selectedLayoutId)
                  else {
                    onOpenCadVectorMap()
                    onCadVectorViewPresetChange(value as CadVectorViewPresetKey)
                  }
                }}>
                {CAD_VECTOR_VIEW_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}
                <option value="osm">Đường phố / Vệ tinh</option>
                {mapMode === 'cadImage' && <option value="cadImage">Ảnh CAD tham chiếu</option>}
                {mapMode === 'layoutPreview' && <option value="layoutPreview">Bản vẽ tham chiếu</option>}
              </select>
            </label>
            {mapMode === 'cadVector' ? <div>
              <p className="field-label">Lớp nghiệp vụ chính</p>
              {!hasCadVectorData && <p className="mb-2 text-xs text-slate-500">Chưa có dữ liệu CAD Vector.</p>}
              {[
                [CAD_BASE_LAYER_KEY, 'Nền CAD'],
                [CAD_CURATED_MAIN_WORKS_LAYER_KEY, 'Công trình chính'],
              ].map(([key, label]) => <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-water-50">
                {label}<input type="checkbox" checked={cadVectorVisibleLayers[key] !== false} onChange={() => onToggleCadVectorLayer(key)} className="size-4 accent-water-600" />
              </label>)}
              {([
                ['pipeline', 'Tuyến ống cấp nước'],
                ['irrigation', 'Kênh/thủy lợi'],
              ] as const).map(([key, label]) => {
                const layerNames = getCadVectorGroupLayerNames(key)
                return <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-water-50">
                  {label}<input type="checkbox" checked={isCadVectorGroupVisible(key)} disabled={layerNames.length === 0} onChange={(event) => onSetCadVectorLayers(layerNames, event.target.checked)} className="size-4 accent-water-600 disabled:opacity-40" />
                </label>
              })}
            </div> : mapMode !== 'layoutPreview' && <div><p className="field-label">Lớp nghiệp vụ chính</p>{primaryLayerKeys.map(renderLayer)}</div>}
          </div>
          <details className="border-t border-slate-100 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-600">Nâng cao</summary>
            <div className="mt-4 space-y-4">
              {mapMode === 'cadVector' && <>
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
                            className="rounded-lg border border-emerald-100 bg-white p-2 shadow-sm transition hover:border-water-200 hover:bg-water-50/50"
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
                                Xem trên bản đồ
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

                <details className="rounded-lg border border-slate-100 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600">Layer CAD thô</summary>
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
                                  {group.layers.length} lớp dữ liệu
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
              </>}
              {mapMode !== 'cadVector' && mapMode !== 'layoutPreview' && <>
                <div>{(['boundaries', 'labels'] as const).map(renderLayer)}</div>
                <label className="block"><span className="field-label">Lọc trạng thái</span>
                  <select className="field-input" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as 'all' | AssetStatus)}>
                    {STATUS_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                  </select>
                </label>
                <details className="rounded-lg border border-slate-100 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600">Nguồn dữ liệu</summary>
                  <div className="mt-2 space-y-2">{CAD_LAYER_KEYS.map((key) => <p key={key} className="text-xs text-slate-500"><span className="font-semibold">{LAYER_LABELS[key]}:</span> {getCadLayerStatusText(dataSource, key, cadImageLoaded)}</p>)}</div>
                </details>
              </>}
              <div className="space-y-2">
                <p className="field-label">Bản vẽ tham chiếu</p>
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

              </div>
            </div>
          </details>
        </div>}
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
            label: 'Nhóm dữ liệu',
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
                <Icon className="size-4 text-slate-500" />
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
              <Icon className="size-4 text-slate-500" />
            </div>
            <p className="text-xl font-bold text-slate-800">{card.value}</p>
          </article>
        )
      })}
    </section>
  )
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
  onTransitionIncident,
  onAssignIncident,
  onEscalateIncident,
  onAddIncidentComment,
  onLoadIncidentAssignees,
  onLoadIncidentAssets,
  onUpdateIncidentAssets,
  onLoadIncidentHistory,
  onLoadIncidentAttachments,
  onUploadIncidentAttachment,
  canAssignIncident,
  availableAssets,
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
  const cadVectorDiameterText =
    cadVectorFeature?.properties.diameterText ||
    (isPipeDiameterText(cadVectorRawText) ? cadVectorRawText : '')
  const cadVectorIsMainWork = cadVectorFeature?.properties.sourceGroup === 'main_works'
  const cadVectorIsIrrigation = cadVectorFeature?.properties.sourceGroup === 'irrigation'
  const cadVectorIsCurated = cadVectorFeature?.properties.curatedMainWork === true

  if (collapsed || (!feature && !cadVectorFeature && !cadAsset)) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[1150] bg-slate-950/25 md:hidden"
        onClick={onToggle}
        aria-label="Đóng bảng thông tin"
      />
      <aside className="fixed bottom-[68px] left-3 right-3 z-[1200] h-[min(72vh,680px)] w-auto md:bottom-3 md:left-auto md:right-3 md:top-[92px] md:h-auto md:w-[min(360px,calc(100vw-1.5rem))] lg:relative lg:inset-auto lg:z-auto lg:w-[340px] lg:shrink-0">
      <div className="panel flex h-full flex-col overflow-hidden rounded-b-none md:rounded-2xl">
        <div className="flex justify-center pb-1 pt-2 md:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-center justify-between border-b border-water-100 px-4 pb-3 pt-2 md:py-3">
          <p className="text-sm font-semibold text-water-900">Thông tin chi tiết</p>
          <button type="button" onClick={onToggle} aria-label="Đóng thông tin chi tiết" className="ghost-btn h-8 w-8 !px-0">
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
                <span className="font-semibold">Loại đối tượng:</span> {cadVectorTypeLabelForUi(cadVectorFeature.properties.type)}
              </p>
              {(cadVectorIsMainWork || cadVectorIsIrrigation) && (
                <p>
                  <span className="font-semibold">Nhóm nghiệp vụ:</span>{' '}
                  {cadVectorFeature.properties.businessGroup}
                </p>
              )}
              {cadVectorFeature.properties.description && <p>
                <span className="font-semibold">Mô tả:</span> {cadVectorFeature.properties.description}
              </p>}
              {cadVectorTextCorrupted && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Tên đối tượng này chưa đọc được đầy đủ. Dữ liệu gốc vẫn được hệ thống lưu giữ.
                </div>
              )}
              {cadVectorDiameterText && (
                <p>
                  <span className="font-semibold">Đường kính:</span> {cadVectorDiameterText}
                </p>
              )}
              </div>
            </div>

            <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <summary className="cursor-pointer text-sm font-bold text-slate-600">Nâng cao</summary>
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

              <div className="mt-3 flex items-center justify-end">
                <button type="button" onClick={handleCopyCadVectorProperties} className="ghost-btn h-7 px-2 text-[11px]">
                  {copyState}
                </button>
              </div>
              <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                <dl className="space-y-1 text-xs">
                  {Object.entries(cadVectorFeature.properties).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[110px_1fr] gap-2 border-b border-slate-100 py-1 last:border-b-0">
                      <dt className="truncate font-semibold text-slate-500">{key}</dt>
                      <dd className="break-words text-slate-700">{formatCadRawValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>

            <button type="button" onClick={() => onOpenIncident({ kind: 'cadVector', feature: cadVectorFeature })} className="ghost-btn">
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
              <details className="w-full rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-600">Nâng cao</summary>
                <div className="mt-3">
              <button
                type="button"
                onClick={onToggleCadEdit}
                className="primary-btn" aria-pressed={cadEditMode}
              >
                <Move className="mr-1 size-4" />
                {cadEditMode ? 'Dừng chỉnh vị trí' : 'Cập nhật vị trí'}
              </button>
                </div>
              </details>
              <button type="button" onClick={() => onOpenIncident({ kind: 'cadImage', asset: cadAsset })} className="ghost-btn">
                <AlertTriangle className="mr-1 size-4" />
                Báo sự cố
              </button>
            </div>
          </div>
        ) : !feature ? (
          <div className="p-4 text-sm text-slate-500">Chọn đối tượng trên bản đồ hoặc sidebar để xem chi tiết.</div>
        ) : feature.properties.type === 'incident' ? (
          <Suspense fallback={<LoadingPanel label="Đang mở sự cố..." className="h-full rounded-none border-0 shadow-none" />}>
            <IncidentDetailTabs
              key={feature.properties.id}
              incident={feature as IncidentFeature}
              onTransition={(status, note) => onTransitionIncident(feature.properties.id, status, note)}
              onAssign={(assignee, note) => onAssignIncident(feature.properties.id, assignee, note)}
              onEscalate={(note) => onEscalateIncident(feature.properties.id, note)}
              onComment={(content) => onAddIncidentComment(feature.properties.id, content)}
              onLoadAssignees={onLoadIncidentAssignees}
              onLoadLinkedAssets={onLoadIncidentAssets}
              onUpdateLinkedAssets={(assetIds, note) => onUpdateIncidentAssets(feature.properties.id, assetIds, note)}
              onLoadHistory={onLoadIncidentHistory}
              onLoadAttachments={onLoadIncidentAttachments}
              onUpload={onUploadIncidentAttachment}
              canAssign={canAssignIncident}
              availableAssets={availableAssets}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<LoadingPanel label="Đang mở tài sản..." className="h-full rounded-none border-0 shadow-none" />}>
            <AssetDetailTabs
              key={feature.properties.id}
              asset={feature as AssetFeature}
              onUpdate={onOpenUpdate}
              onReport={(asset) => onOpenIncident({ kind: 'asset', feature: asset })}
            />
          </Suspense>
        )}
      </div>
    </aside>
    </>
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
                  {incident.properties.overdue && incident.properties.status !== 'resolved' && (
                    <span className="status-chip ml-2 border-rose-200 bg-rose-50 text-rose-700">Quá hạn SLA</span>
                  )}
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
  const [submitting, setSubmitting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const titleId = useId()
  const requestClose = useUnsavedChangesGuard(dirty, onClose)

  const submitLabel = mode === 'create' ? 'Thêm mới đối tượng' : 'Lưu cập nhật'
  const title = mode === 'create' ? 'Thêm đối tượng hạ tầng mới' : `Cập nhật: ${feature?.properties.name ?? ''}`
  const technicalFields = type === 'pipeline'
    ? [
        { key: 'diameter', label: 'Đường kính', value: diameter, onChange: setDiameter },
        { key: 'material', label: 'Vật liệu', value: material, onChange: setMaterial },
        { key: 'length', label: 'Chiều dài', value: length, onChange: setLength },
      ]
    : type === 'water_plant'
      ? [{ key: 'capacity', label: 'Công suất', value: capacity, onChange: setCapacity }]
      : type === 'raw_water_lake'
        ? [
            { key: 'area', label: 'Diện tích', value: area, onChange: setArea },
            { key: 'volume', label: 'Dung tích', value: volume, onChange: setVolume },
          ]
        : type === 'canal'
          ? [{ key: 'length', label: 'Chiều dài', value: length, onChange: setLength }]
          : type === 'supply_zone'
            ? [{ key: 'area', label: 'Diện tích', value: area, onChange: setArea }]
            : []

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!name.trim() || !address.trim() || !description.trim()) {
      setError('Vui lòng nhập đầy đủ tên, địa chỉ và mô tả')
      return
    }

    // Giữ các thuộc tính cũ khi sửa, kể cả thuộc tính hiện không có trong form.
    const technicalAttributes = mode === 'update'
      ? { capacity, area, volume, material, diameter, length }
      : Object.fromEntries(technicalFields.map((field) => [field.key, field.value]))
    let payload: NewAssetInput | UpdateAssetInput
    if (mode === 'update') {
      payload = {
        name,
        status,
        description,
        address,
        ...technicalAttributes,
        imageUrl,
        googleMapsUrl,
        notes: parseNotes(notesRaw),
      } satisfies UpdateAssetInput
    } else {
      try {
        payload = {
          name,
          type,
          status,
          description,
          address,
          ...technicalAttributes,
          imageUrl,
          googleMapsUrl,
          notes: parseNotes(notesRaw),
          geometryType,
          coordinates: parseCoordinatePairs(coordinatesRaw),
        } satisfies NewAssetInput
      } catch {
        setError('Định dạng tọa độ không hợp lệ. Ví dụ: 106.4232,10.8815;106.425,10.883')
        return
      }
    }

    setSubmitting(true)
    setError('')
    try {
      await onSubmit(payload)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu tài sản. Vui lòng thử lại.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-900/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        onChangeCapture={() => setDirty(true)}
        className="panel max-h-[calc(100vh-2rem)] w-full max-w-2xl space-y-3 overflow-y-auto p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between">
          <p id={titleId} className="text-base font-bold text-slate-800">{title}</p>
          <button type="button" onClick={requestClose} className="ghost-btn h-8 w-8 !px-0" aria-label="Đóng form">
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

        {technicalFields.length > 0 && (
          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-700">Thông số tài sản</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {technicalFields.map((field) => (
                <label key={field.key}>
                  <span className="field-label">{field.label}</span>
                  <input className="field-input" value={field.value} onChange={(event) => field.onChange(event.target.value)} />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label>
            <span className="field-label">Link Google Maps</span>
            <input
              className="field-input"
              value={googleMapsUrl}
              onChange={(event) => setGoogleMapsUrl(event.target.value)}
            />
          </label>
          <label>
            <span className="field-label">Hình ảnh (URL)</span>
            <input className="field-input" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
          </label>
        </div>

        <div>
          <label className="field-label">Ghi chú (mỗi dòng 1 mục)</label>
          <textarea className="field-textarea" value={notesRaw} onChange={(event) => setNotesRaw(event.target.value)} />
        </div>

        {mode === 'create' && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
          <button type="button" onClick={requestClose} className="ghost-btn">
            Hủy
          </button>
          <button type="submit" disabled={submitting} className="primary-btn disabled:cursor-wait disabled:opacity-60">
            <Plus className="mr-1 size-4" />
            {submitting ? 'Đang lưu...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

function WorkspaceBootstrapState({
  error,
  onRetry,
}: {
  error?: string | null
  onRetry?: () => void
}) {
  return (
    <main className="flex h-full flex-col">
      <div className="panel mx-3 mt-3 flex h-[72px] items-center gap-4 px-5">
        <div className="h-9 w-36 animate-pulse rounded-lg bg-water-100" />
        <div className="ml-auto h-10 w-full max-w-md animate-pulse rounded-xl bg-slate-100" />
      </div>
      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 pb-20 pt-2 md:pb-3 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <LoadingPanel label="Đang chuẩn bị bộ lọc..." className="hidden h-full min-h-0 lg:flex" />
        {error ? (
          <RegionError
            title="Bản đồ chưa sẵn sàng"
            message={error}
            onRetry={onRetry}
            className="h-full min-h-[420px]"
          />
        ) : (
          <LoadingPanel label="Đang chuẩn bị bản đồ..." className="h-full min-h-[420px]" />
        )}
        <LoadingPanel label="Đang chuẩn bị thông tin..." className="hidden h-full min-h-0 xl:flex" />
      </section>
    </main>
  )
}

function WebGISDashboardPage() {
  const { configured: authConfigured, user, profile, signOut } = useAuth()
  const {
    data,
    dataSource,
    loading,
    error,
    retry,
    assets,
    incidents,
    addAsset,
    addIncident,
    updateAsset,
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
  } = useWebGISData()

  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [mapExperience, setMapExperience] = useState<MapExperience>(readMapExperience)
  const [showSettings, setShowSettings] = useState(false)
  const [mapMode, setMapMode] = useState<MapMode>('osm')
  const [geographicCadVisible, setGeographicCadVisible] = useState(false)
  const [geographicCadFocus, setGeographicCadFocus] = useState<[number, number] | null>(null)
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
  const [selectedCadAssetId, setSelectedCadAssetId] = useState<string | null>(null)
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null)
  const [hoveredCadAssetId, setHoveredCadAssetId] = useState<string | null>(null)
  const [cadEditMode, setCadEditMode] = useState(false)
  const [cadImageLoaded, setCadImageLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | AssetStatus>('all')
  const [flyToRequest, setFlyToRequest] = useState<FlyToRequest | null>(null)
  const [showCreateAsset, setShowCreateAsset] = useState(false)
  const [showCreateIncident, setShowCreateIncident] = useState(false)
  const [incidentAnchor, setIncidentAnchor] = useState<IncidentAnchor | null>(null)
  const [cadReportPosition, setCadReportPosition] = useState<{ featureId: string; position: [number, number] } | null>(null)
  const [editingFeature, setEditingFeature] = useState<AssetFeature | null>(null)
  const [toastQueue, setToastQueue] = useState<ToastState[]>([])
  const [viewportAssets, setViewportAssets] = useState<ViewportAssetsResult | null>(null)
  const [viewportLoading, setViewportLoading] = useState(false)
  const [viewportError, setViewportError] = useState<string | null>(null)
  const viewportRequest = useRef(0)
  const toastCounter = useRef(0)
  const realtimeToastHandledKey = useRef('')

  const [uiState, setUiState] = useState<StoredUiState>(loadStoredUiState)
  const projectFocusFeatures = useMemo<AnyMapFeature[]>(() => [
    ...assets.filter((asset) => !['label', 'pending_data'].includes(asset.properties.type)),
    ...incidents,
  ], [assets, incidents])
  const openDetailPanel = () => setUiState((prev) => ({ ...prev, collapsedDetail: false, collapsedSidebar: true }))

  useEffect(() => {
    localStorage.setItem(STORAGE_UI_KEY, JSON.stringify(uiState))
  }, [uiState])

  useEffect(() => {
    localStorage.setItem(CAD_ASSET_STORAGE_KEY, JSON.stringify(cadAssets))
  }, [cadAssets])

  useEffect(() => {
    localStorage.setItem(CAD_CURATED_WORKS_STORAGE_KEY, JSON.stringify(curatedMainWorks))
  }, [curatedMainWorks])

  const activeToast = toastQueue[0] ?? null
  const enqueueToast = useCallback((toast: Omit<ToastState, 'id'>) => {
    toastCounter.current += 1
    setToastQueue((current) => [...current, { ...toast, id: toastCounter.current }])
  }, [])
  const dismissToast = useCallback(() => {
    setToastQueue((current) => current.slice(1))
  }, [])

  useEffect(() => {
    if (!activeToast) return
    const timeout = window.setTimeout(dismissToast, 6000)
    return () => window.clearTimeout(timeout)
  }, [activeToast, dismissToast])

  useEffect(() => {
    if (!incidentRealtimeEvent) return
    const eventKey = `${incidentRealtimeEvent.id}:${incidentRealtimeEvent.eventType}:${incidentRealtimeEvent.occurredAt}`
    if (eventKey === realtimeToastHandledKey.current) return
    realtimeToastHandledKey.current = eventKey
    if (incidentRealtimeEvent.actorId === user?.id) return
    const incident = incidents.find((item) => item.properties.id === incidentRealtimeEvent.id)
    enqueueToast({
      title: incidentRealtimeEvent.eventType === 'INSERT' ? 'Có sự cố mới' : 'Sự cố vừa được cập nhật',
      message: incident
        ? `${incident.properties.incidentCode} · ${getIncidentStatusMeta(incident.properties.status).label}`
        : 'Danh sách sự cố đã thay đổi',
      tone: incidentRealtimeEvent.eventType === 'INSERT' ? 'error' : 'info',
      ...(incidentRealtimeEvent.eventType === 'DELETE' ? {} : { featureId: incidentRealtimeEvent.id }),
    })
  }, [enqueueToast, incidentRealtimeEvent, incidents, user?.id])

  const handleViewportChange = useCallback((
    bbox: [number, number, number, number],
    zoom: number,
  ) => {
    const requestId = ++viewportRequest.current
    setViewportLoading(true)
    setViewportError(null)
    void loadAssetsForViewport(bbox, zoom)
      .then((result) => {
        if (requestId !== viewportRequest.current) return
        setViewportAssets(result)
      })
      .catch(() => {
        // Giữ vùng dữ liệu gần nhất khi kết nối chập chờn.
        if (requestId === viewportRequest.current) {
          setViewportError('Không thể cập nhật dữ liệu trong vùng bản đồ hiện tại')
        }
      })
      .finally(() => {
        if (requestId === viewportRequest.current) setViewportLoading(false)
      })
  }, [loadAssetsForViewport])

  useEffect(() => {
    if (mapMode !== 'cadVector' || viewMode !== 'map' || cadVectorData) return
    let active = true
    async function loadVectorData() {
      const { loadCadVectorData } = await import('./services/cadVectorDataService')
      const loaded = await loadCadVectorData()
      if (!active) return
      setCadVectorData(loaded)
      setCadVectorVisibleLayers((current) => ({ ...createCadVectorLayerVisibility(loaded.layerIndex, cadVectorViewPreset), ...current }))
      setCadVectorLoading(false)
    }
    void loadVectorData().catch(() => { if (active) setCadVectorLoading(false) })
    return () => { active = false }
  }, [mapMode, viewMode, cadVectorData, cadVectorViewPreset])

  const selectedEnvelope = useMemo(() => {
    if (!data || !selectedFeatureId) {
      return null
    }

    return getFeatureById(data, selectedFeatureId)
  }, [data, selectedFeatureId])

  const osmMapData = useMemo<LayerDataState | null>(() => {
    if (!data || !viewportAssets) return data
    const shouldUseViewportLayer = (key: Exclude<LayerKey, 'incidents'>) =>
      dataSource?.layers[key].source === 'api' || viewportAssets.layers[key].features.length > 0
    return mergeLocalDrafts({
      waterPlant: shouldUseViewportLayer('waterPlant') ? viewportAssets.layers.waterPlant : data.waterPlant,
      rawWaterLakes: shouldUseViewportLayer('rawWaterLakes') ? viewportAssets.layers.rawWaterLakes : data.rawWaterLakes,
      pipelines: shouldUseViewportLayer('pipelines') ? viewportAssets.layers.pipelines : data.pipelines,
      canals: shouldUseViewportLayer('canals') ? viewportAssets.layers.canals : data.canals,
      supplyZones: shouldUseViewportLayer('supplyZones') ? viewportAssets.layers.supplyZones : data.supplyZones,
      boundaries: shouldUseViewportLayer('boundaries') ? viewportAssets.layers.boundaries : data.boundaries,
      labels: shouldUseViewportLayer('labels') ? viewportAssets.layers.labels : data.labels,
      incidents: data.incidents,
    }, assets.filter(isLocalDraft))
  }, [assets, data, dataSource, viewportAssets])
  const selectedFeature = selectedEnvelope?.feature ?? (osmMapData && selectedFeatureId ? getFeatureById(osmMapData, selectedFeatureId)?.feature ?? null : null)
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

  const handleFocusFeature = (featureId: string) => {
    if (!data) {
      return
    }

    const envelope = getFeatureById(osmMapData ?? data, featureId) ?? getFeatureById(data, featureId)
    if (!envelope) {
      return
    }

    cacheFeature(envelope.feature)
    openDetailPanel()
    setSelectedFeatureId(featureId)
    setFlyToRequest({ feature: envelope.feature, zoom: 16 })
  }

  const handleFocusCadAsset = (assetId: string) => {
    if (!cadAssets.some((asset) => asset.id === assetId)) {
      return
    }

    setViewMode('map')
    setMapMode('cadImage')
    openDetailPanel()
    setSelectedCadAssetId(assetId)
  }

  const handleFocusCadVectorFeature = (featureId: string) => {
    const feature = cadVectorFeatureById.get(featureId)
    if (!feature) {
      return
    }

    setViewMode('map')
    setMapMode('cadVector')
    openDetailPanel()
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
    setCadReportPosition(null)
    setSelectedCadVectorFeature(feature)
    setCadVectorFocusVersion((value) => value + 1)
  }

  const handleSelectLayoutPreview = (layoutId: string) => {
    setViewMode('map')
    setMapMode('layoutPreview')
    setUiState((prev) => ({ ...prev, collapsedDetail: true }))
    setPositionUpdateTargetId(null)
    setCadEditMode(false)
    setSelectedLayoutId(layoutId)
  }

  const handleMapModeChange = (nextMode: MapMode) => {
    setViewMode('map')
    setMapMode(nextMode)

    setUiState((prev) => ({ ...prev, collapsedDetail: true }))
    setPositionUpdateTargetId(null)
    setCadEditMode(false)
  }

  const openIncidentForm = async (target?: IncidentReportTarget) => {
    const existing = dataSource?.mode === 'api' ? assets.filter(isServerFeature) : assets
    // A management row can be selected before its cache update has rendered.
    const available = target?.kind === 'asset' && target.feature.properties.type !== 'incident'
      ? [...existing.filter((asset) => asset.properties.id !== target.feature.properties.id), target.feature as AssetFeature]
      : existing
    const clickedPosition = target?.kind === 'cadVector' && cadReportPosition?.featureId === target.feature.properties.id
      ? cadReportPosition.position
      : undefined
    setIncidentAnchor(target ? (await import('./utils/incidentLocation')).buildIncidentAnchor(target, cadVectorData?.metadata ?? null, available, clickedPosition) : null)
    setShowCreateIncident(true)
  }

  const handleAddAsset = async (payload: NewAssetInput | UpdateAssetInput) => {
    if ('geometryType' in payload) {
      const created = await addAsset(payload)
      if (created) {
        setSelectedFeatureId(created.properties.id)
        setFlyToRequest({ feature: created, zoom: 16 })
        enqueueToast({
          title: `Đã thêm ${created.properties.name}`,
          message: isLocalDraft(created) ? 'Đã lưu trên thiết bị, chưa lưu lên máy chủ' : 'Đã lưu trên máy chủ',
          featureId: created.properties.id,
        })
      }
      setShowCreateAsset(false)
      return
    }

    if (editingFeature) {
      const updated = await updateAsset(editingFeature.properties.id, payload)
      if (updated) {
        setSelectedFeatureId(updated.properties.id)
        enqueueToast({
          title: 'Đã cập nhật tài sản',
          message: isLocalDraft(updated) ? 'Đã lưu trên thiết bị, chưa lưu lên máy chủ' : 'Đã lưu trên máy chủ',
          featureId: updated.properties.id,
        })
      }
      setEditingFeature(null)
    }
  }

  const handleAddIncident = async (payload: NewIncidentInput) => {
    const created = await addIncident(payload)
    if (!created) throw new Error('Chưa thể ghi nhận sự cố. Vui lòng thử lại.')
    if (created) {
      let uploaded = 0
      for (const file of payload.imageFiles ?? []) {
        try {
          await uploadIncidentAttachment(created.properties.id, file, created)
          uploaded += 1
        } catch {
          // Sự cố đã được lưu; thông báo riêng nếu có ảnh chưa tải thành công.
        }
      }
      setMapMode('osm')
      setViewMode('map')
      setUiState((current) => ({ ...current, visibleLayers: { ...current.visibleLayers, incidents: true } }))
      openDetailPanel()
      setSelectedFeatureId(created.properties.id)
      setFlyToRequest({ feature: created, zoom: 16 })
      const toastMessage =
        uploaded === (payload.imageFiles?.length ?? 0)
          ? uploaded > 0 ? `Đã lưu trên máy chủ và tải ${uploaded} ảnh` : 'Đã lưu trên máy chủ'
          : `Đã lưu sự cố; ${Math.max((payload.imageFiles?.length ?? 0) - uploaded, 0)} ảnh chưa tải được`
      enqueueToast({
        title: `Đã tạo sự cố ${created.properties.incidentCode}`,
        message: isLocalDraft(created)
          ? `Đã lưu trên thiết bị, chưa lưu lên máy chủ${payload.imageFiles?.length ? `; ${payload.imageFiles.length} ảnh chưa được lưu` : ''}`
          : toastMessage,
        featureId: created.properties.id,
      })
    }
    setShowCreateIncident(false)
    setIncidentAnchor(null)
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
    setSelectedCadVectorFeature((current) => current && nextFeatures.some((feature) => feature.properties.id === current.properties.id) ? current : null)
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

  const handleSelectCuratedMainWork = (id: string) => {
    const feature = cadVectorFeatureById.get(id)
    setViewMode('map')
    setMapMode('cadVector')
    openDetailPanel()
    setCadVectorVisibleLayers((prev) => ({
      ...prev,
      [CAD_BASE_LAYER_KEY]: true,
      [CAD_CURATED_MAIN_WORKS_LAYER_KEY]: true,
    }))

    if (feature) {
      setCadReportPosition(null)
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
      setCadReportPosition(null)
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
    return <WorkspaceBootstrapState />
  }

  if (error || !data) {
    return <WorkspaceBootstrapState error={error ?? 'Không có dữ liệu để hiển thị'} onRetry={retry} />
  }

  return (
    <main className="workspace flex h-full flex-col">
      <Topbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        results={searchResults}
        onSelectResult={handleSelectSearchResult}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        userEmail={user?.email}
        onSignOut={authConfigured ? () => { void signOut() } : undefined}
      />

      <section className="flex min-h-0 flex-1 gap-3 p-3 pb-20 pt-2 md:pb-3">
        {viewMode === 'map' && <LayerSidebar
          collapsed={uiState.collapsedSidebar}
          onToggle={() => setUiState((prev) => ({
            ...prev,
            collapsedSidebar: !prev.collapsedSidebar,
            collapsedDetail: prev.collapsedSidebar ? true : prev.collapsedDetail,
          }))}
          visibleLayers={uiState.visibleLayers}
          onToggleLayer={uiLayerToggle}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
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
        />}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {viewMode === 'map' && mapMode !== 'cadVector' && (
            <details className="panel px-4 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-600">Thống kê hạ tầng</summary>
              <div className="mt-3">
            <DashboardCards
              data={data}
              mapMode={mapMode}
              cadVectorData={cadVectorDisplayData}
              curatedMainWorks={resolvedCuratedMainWorks}
              cadVectorViewPreset={cadVectorViewPreset}
            />
              </div>
            </details>
          )}

          <div className={`relative grid min-h-0 flex-1 grid-cols-1 gap-3 ${viewMode === 'map' ? 'map-workspace' : ''}`}>
            {viewMode === 'map' && mapMode === 'cadVector' && (
              <Suspense fallback={<LoadingPanel label="Đang mở bản đồ..." className="h-full min-h-[280px] sm:min-h-0" />}>
                <CadVectorMap
                  data={cadVectorDisplayData}
                  onShowSurroundings={async () => {
                    const anchor = selectedCadVectorFeature ? (await import('./utils/incidentLocation')).buildIncidentAnchor({ kind: 'cadVector', feature: selectedCadVectorFeature }, cadVectorData?.metadata ?? null, [], cadReportPosition?.featureId === selectedCadVectorFeature.properties.id ? cadReportPosition.position : undefined) : null
                    setGeographicCadFocus(anchor?.position ?? null)
                    setGeographicCadVisible(true)
                    handleMapModeChange('osm')
                  }}
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
                  onSelectFeature={(feature, position) => {
                    setCadReportPosition({ featureId: feature.properties.id, position })
                    openDetailPanel()
                    setSelectedCadVectorFeature(feature)
                    setCadVectorFocusVersion((value) => value + 1)
                  }}
                />
              </Suspense>
            )}

            {viewMode === 'map' && mapMode === 'cadImage' && (
              <Suspense fallback={<LoadingPanel label="Đang mở bản đồ..." className="h-full min-h-[280px] sm:min-h-0" />}>
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
              </Suspense>
            )}

            {viewMode === 'map' && mapMode === 'layoutPreview' && (
              <Suspense fallback={<LoadingPanel label="Đang mở bản vẽ..." className="h-full min-h-[280px] sm:min-h-0" />}>
                <CadLayoutPreview
                  selectedLayoutId={selectedLayoutId}
                  onSelectedLayoutChange={setSelectedLayoutId}
                />
              </Suspense>
            )}

            {viewMode === 'map' && mapMode === 'osm' && (
              <WebGISMapPanel
                data={osmMapData ?? data}
                visibleLayers={uiState.visibleLayers}
                selectedFeatureId={selectedFeatureId}
                hoveredFeatureId={hoveredFeatureId}
                onHoverFeature={setHoveredFeatureId}
                onSelectFeature={handleFocusFeature}
                flyToRequest={flyToRequest}
                onFlyHandled={() => setFlyToRequest(null)}
                mapVersion={0}
                viewportLoading={viewportLoading}
                viewportTruncated={viewportAssets?.truncated === true}
                viewportError={viewportError}
                onViewportChange={handleViewportChange}
                geographicCadVisible={geographicCadVisible}
                geographicCadFocus={geographicCadFocus}
                onGeographicCadVisibleChange={(visible) => { setGeographicCadFocus(null); setGeographicCadVisible(visible) }}
                focusEnabled={mapExperience === 'focus'}
                projectFeatures={projectFocusFeatures}
                onOpenSettings={() => setShowSettings(true)}
              />
            )}

            {viewMode === 'manage' && (
              <Suspense fallback={<LoadingPanel label="Đang mở trung tâm vận hành..." className="min-h-[520px]" />}>
                <OperationsWorkspace
                  data={data}
                  dataSource={dataSource}
                  onAddAsset={() => setShowCreateAsset(true)}
                  onSelectFeature={cacheFeature}
                  onTransitionIncident={transitionIncident}
                  onAssignIncident={assignIncident}
                  onLoadIncidentAssignees={getIncidentAssignees}
                  onAddIncidentComment={addIncidentComment}
                  canAssignIncident={!authConfigured || profile?.role === 'admin' || profile?.role === 'manager'}
                  onEditAsset={(feature) => { cacheFeature(feature); setEditingFeature(feature) }}
                  onReportAsset={(feature) => { cacheFeature(feature); void openIncidentForm({ kind: 'asset', feature }) }}
                  onAddIncident={() => openIncidentForm()}
                  onOpenFeature={(feature) => {
                    cacheFeature(feature)
                    setViewMode('map')
                    setMapMode('osm')
                    openDetailPanel()
                    setSelectedFeatureId(feature.properties.id)
                    setFlyToRequest({ feature, zoom: 16 })
                  }}
                />
              </Suspense>
            )}

            {viewMode === 'report' && (
              <Suspense fallback={<LoadingPanel label="Đang tải báo cáo..." className="h-full" />}>
                <ReportsView
                  data={data}
                  dataSourceMode={dataSource?.mode ?? 'demo'}
                  preparedBy={user?.email ?? 'Người dùng hệ thống'}
                />
              </Suspense>
            )}

            {showIncidentCompanionPanel && (
              <details className="absolute bottom-3 left-3 right-3 z-[1000] sm:left-auto sm:w-80 rounded-xl border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">Sự cố ({incidents.length})</summary>
                <div className="max-h-[50vh] overflow-auto">
                  <IncidentList incidents={incidents} selectedId={selectedFeatureId} onSelectIncident={handleFocusFeature} />
                </div>
              </details>
            )}
          </div>

          {viewMode === 'map' && <div className="panel flex items-center justify-between px-4 py-2 text-sm text-slate-600">
            {mapMode === 'cadVector' && cadVectorData?.hasCadVectorData ? (
              <>
                <p>
                  Tổng chiều dài tuyến:{' '}
                  <span className="font-semibold text-slate-800">
                    {cadVectorLineLengthSummary.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} m
                  </span>
                </p>
                <p>
                  Dữ liệu bản đồ đã sẵn sàng
                </p>
              </>
            ) : mapMode === 'layoutPreview' ? (
              <>
                <p>
                  Bản vẽ gốc: <span className="font-semibold text-slate-800">
                    {CAD_LAYOUT_OPTIONS.find((layout) => layout.id === selectedLayoutId)?.label ?? 'Layout'}
                  </span>
                </p>
                <p>Bản vẽ này chỉ dùng để tham khảo</p>
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
          </div>}
        </div>

        {viewMode === 'map' && !uiState.collapsedDetail && <DetailPanel
          collapsed={uiState.collapsedDetail}
          onToggle={() => {
            setUiState((prev) => ({ ...prev, collapsedDetail: true }))
            setSelectedFeatureId(null)
            setSelectedCadVectorFeature(null)
            setCadReportPosition(null)
            setSelectedCadAssetId(null)
            setPositionUpdateTargetId(null)
            setCadEditMode(false)
          }}
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
          onOpenIncident={openIncidentForm}
          onTransitionIncident={async (id, status, note) => {
            const updated = await transitionIncident(id, status, note)
            enqueueToast({ title: 'Đã cập nhật trạng thái', message: isLocalDraft(updated) ? 'Đã lưu trên thiết bị, chưa lưu lên máy chủ' : 'Đã lưu trên máy chủ', featureId: id })
          }}
          onAssignIncident={async (id, assignee, note) => {
            const updated = await assignIncident(id, assignee, note)
            enqueueToast({ title: 'Đã phân công người xử lý', message: isLocalDraft(updated) ? 'Đã lưu trên thiết bị, chưa lưu lên máy chủ' : 'Đã lưu trên máy chủ', featureId: id })
          }}
          onEscalateIncident={async (id, note) => {
            const updated = await escalateIncident(id, note)
            enqueueToast({ title: 'Đã nâng mức cảnh báo', message: isLocalDraft(updated) ? 'Đã lưu trên thiết bị, chưa lưu lên máy chủ' : 'Đã lưu trên máy chủ', tone: 'info', featureId: id })
          }}
          onAddIncidentComment={addIncidentComment}
          onLoadIncidentAssignees={getIncidentAssignees}
          onLoadIncidentAssets={getIncidentLinkedAssets}
          onUpdateIncidentAssets={async (id, assetIds, note) => {
            const updated = await updateIncidentAssets(id, assetIds, note)
            enqueueToast({ title: 'Đã cập nhật tài sản liên quan', message: isLocalDraft(updated) ? 'Đã lưu trên thiết bị, chưa lưu lên máy chủ' : 'Đã lưu trên máy chủ', featureId: id })
          }}
          onLoadIncidentHistory={getIncidentHistory}
          onLoadIncidentAttachments={getIncidentAttachments}
          onUploadIncidentAttachment={uploadIncidentAttachment}
          canAssignIncident={!authConfigured || profile?.role === 'admin' || profile?.role === 'manager'}
          availableAssets={dataSource?.mode === 'api' && !(selectedFeature && isLocalDraft(selectedFeature)) ? assets.filter(isServerFeature) : assets}
        />}
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
        <Suspense fallback={<LoadingPanel label="Đang mở phiếu sự cố..." className="fixed inset-4 z-[1400]" />}><IncidentIntakeModal
          online={dataSource?.mode === 'api'}
          anchor={incidentAnchor}
          availableAssets={dataSource?.mode === 'api' ? assets.filter(isServerFeature) : assets}
          onClose={() => { setShowCreateIncident(false); setIncidentAnchor(null) }}
          onSubmit={handleAddIncident}
        /></Suspense>
      )}

      {showSettings && <WorkspaceSettings value={mapExperience} onClose={() => setShowSettings(false)} onChange={(value) => {
        setMapExperience(value)
        try { localStorage.setItem(MAP_EXPERIENCE_KEY, value) } catch { /* Session preference still applies. */ }
      }} />}

      {activeToast && <Toast
        key={activeToast.id}
        title={activeToast.title}
        message={activeToast.message}
        tone={activeToast.tone}
        queuedCount={Math.max(toastQueue.length - 1, 0)}
        actionLabel={activeToast.featureId ? 'Xem chi tiết' : undefined}
        onAction={activeToast.featureId ? () => {
          const featureId = activeToast.featureId
          dismissToast()
          setMapMode('osm')
          setViewMode('map')
          if (featureId) handleFocusFeature(featureId)
        } : undefined}
        onClose={dismissToast}
      />}
    </main>
  )
}

function App() {
  const { configured, loading, user, profileError, signOut } = useAuth()

  if (loading) {
    return (
      <main className="flex h-full items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <Droplets className="mx-auto mb-3 size-8 animate-pulse text-sky-300" />
          <p className="text-sm font-semibold">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </main>
    )
  }

  if (configured && !user) return <LoginPage />
  if (configured && profileError) {
    return (
      <main className="flex h-full items-center justify-center bg-slate-950 p-4 text-white">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-amber-300" />
          <h1 className="text-lg font-bold">Tài khoản chưa được cấp quyền</h1>
          <p className="mt-2 text-sm text-slate-300">{profileError}</p>
          <button type="button" className="ghost-btn mt-5 bg-white text-slate-800" onClick={() => { void signOut() }}>
            Đăng xuất
          </button>
        </section>
      </main>
    )
  }
  return <WebGISDashboardPage />
}

function MapViewportController({
  onViewportChange,
}: {
  onViewportChange: (bbox: [number, number, number, number], zoom: number) => void
}) {
  const map = useMap()

  useEffect(() => {
    let timeout: number | undefined
    const emitViewport = () => {
      const bounds = map.getBounds()
      onViewportChange(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        map.getZoom(),
      )
    }
    const scheduleViewport = () => {
      if (timeout !== undefined) window.clearTimeout(timeout)
      timeout = window.setTimeout(emitViewport, 220)
    }

    map.on('moveend zoomend', scheduleViewport)
    scheduleViewport()
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout)
      map.off('moveend zoomend', scheduleViewport)
    }
  }, [map, onViewportChange])

  return null
}

export default App

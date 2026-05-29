import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Layers2, LocateFixed, Maximize2, Route } from 'lucide-react'
import type { Feature } from 'geojson'
import {
  CRS,
  CircleMarker as LeafletCircleMarker,
  type LatLngBoundsExpression,
  type LatLngExpression,
  type Layer,
  type LeafletMouseEvent,
  type Path,
  type PathOptions,
} from 'leaflet'
import { GeoJSON, MapContainer, useMap, useMapEvents } from 'react-leaflet'
import {
  FloatingFeatureTooltip,
  type TooltipMousePosition,
} from './FloatingFeatureTooltip'
import { CadLegend } from './CadLegend'
import type {
  CadVectorData,
  CadVectorFeature,
  CadVectorFeatureCollection,
  CadVectorMetadata,
  CadVectorType,
} from '../../types/gis'
import {
  getFeatureDisplayName,
  isCadTextFeature,
  isLikelyMojibake,
  safeDisplayText,
  shouldRenderCadLabel,
  type CadLabelVisibilityOptions,
} from '../../utils/textUtils'

interface CadVectorMapProps {
  data: CadVectorData | null
  loading: boolean
  visibleLayers: Record<string, boolean>
  typeFilter: CadVectorType | 'all'
  labelOptions: CadLabelVisibilityOptions
  selectedFeature: CadVectorFeature | null
  focusVersion: number
  fitVersion: number
  viewPresetKey: string
  viewPresetLabel: string
  positionUpdateTargetLabel?: string | null
  onCadCoordinateClick?: (cadPosition: [number, number]) => void
  onSelectFeature: (feature: CadVectorFeature) => void
}

interface TooltipState {
  feature: CadVectorFeature | null
  mousePosition: TooltipMousePosition | null
  mapContainerRect: DOMRect | null
  visible: boolean
}

interface SvgBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface SvgPoint {
  x: number
  y: number
}

interface PrintSvgShape {
  key: string
  kind: 'path' | 'circle'
  d?: string
  cx?: number
  cy?: number
  r?: number
  stroke: string
  fill: string
  strokeWidth: number
  opacity: number
  fillOpacity: number
  dashArray?: string
}

interface PrintSvgLabel {
  key: string
  x: number
  y: number
  text: string
}

type CadVisualMode = 'classic' | 'clean' | 'report' | 'water' | 'irrigation' | 'dark'

const EMPTY_COLLECTION: CadVectorFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}
const PRINT_SVG_WIDTH = 1800
const PRINT_SVG_HEIGHT = 1000

const CAD_BASE_LAYER_KEY = '__baseCadLayer'
const CAD_HTCN_CONTEXT_LAYER_KEY = '__htcnPmvContext'
const CAD_CURATED_MAIN_WORKS_LAYER_KEY = '__curatedMainWorks'
const CAD_LAYOUT_ARTIFACT_LAYER_KEY = '__layoutArtifacts'
const CAD_VISUAL_MODES: Array<{ key: CadVisualMode; label: string; description: string }> = [
  { key: 'classic', label: 'Sáng', description: 'Nền trắng sáng, không vân, không gradient.' },
  { key: 'clean', label: 'Trắng sạch', description: 'Nền trắng gọn, dùng khi cần bản đồ thật tối giản.' },
  { key: 'report', label: 'Báo cáo', description: 'Nét rõ vừa phải, hợp để xuất PDF.' },
  { key: 'water', label: 'Cấp nước nổi bật', description: 'Làm tuyến ống nổi bật nhất.' },
  { key: 'irrigation', label: 'Thủy lợi nổi bật', description: 'Làm hệ thống kênh/thủy lợi nổi bật nhất.' },
  { key: 'dark', label: 'CAD tối', description: 'Nền tối kiểu bản vẽ kỹ thuật.' },
]
const LAYOUT_ARTIFACT_TERMS = [
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

function cadVectorTypeLabel(type: CadVectorType): string {
  switch (type) {
    case 'water_plant':
      return 'Nhà máy nước'
    case 'raw_water_lake':
      return 'Hồ chứa nước thô'
    case 'pipeline':
      return 'Tuyến ống'
    case 'canal':
      return 'Kênh/thủy lợi'
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
    case 'boundary':
      return 'Ranh giới'
    case 'supply_zone':
      return 'Khu vực cấp nước'
    case 'pipe_diameter_label':
      return 'Nhãn đường kính ống'
    case 'location_label':
      return 'Nhãn địa danh'
    case 'road_background':
      return 'Đường nền CAD'
    case 'layout_artifact':
      return 'Khung/layout CAD'
    case 'cad_point':
      return 'Điểm CAD'
    case 'cad_line':
      return 'Đường CAD'
    case 'cad_polygon':
      return 'Vùng CAD'
    case 'unknown':
      return 'Chưa phân loại'
  }
}

const CAD_VECTOR_TYPE_LABELS_VI: Partial<Record<CadVectorType, string>> = {
  water_plant: 'Nhà máy nước',
  raw_water_lake: 'Hồ nước thô',
  pipeline: 'Tuyến ống',
  canal: 'Kênh/thủy lợi',
  irrigation_canal: 'Kênh thủy lợi',
  irrigation_area: 'Vùng thủy lợi',
  irrigation_point: 'Điểm thủy lợi',
  irrigation_label: 'Nhãn kênh/thủy lợi',
  main_work_candidate: 'Công trình chính',
  boundary: 'Ranh giới',
  supply_zone: 'Khu vực cấp nước',
  pipe_diameter_label: 'Nhãn đường kính ống',
  location_label: 'Nhãn địa danh',
  road_background: 'Đường nền CAD',
  cad_point: 'Điểm CAD',
  cad_line: 'Đường CAD',
  cad_polygon: 'Vùng CAD',
  unknown: 'Chưa phân loại',
}

type CadRenderGroup =
  | 'pipeline'
  | 'diameterLabel'
  | 'irrigationCanal'
  | 'irrigationArea'
  | 'irrigationLabel'
  | 'curatedIrrigation'
  | 'waterPlant'
  | 'rawWaterLake'
  | 'mainWorkCandidate'
  | 'htcnContext'
  | 'layoutArtifact'
  | 'canal'
  | 'boundary'
  | 'background'
  | 'facilityPoint'
  | 'locationLabel'
  | 'polygon'
  | 'unknown'

function getFeatureRenderGroup(feature: CadVectorFeature): CadRenderGroup {
  const layerName = String(feature.properties.cadLayer ?? '').toUpperCase()
  const type = feature.properties.type
  const typeValue = String(type)
  const sourceGroup = feature.properties.sourceGroup
  const isCurated = feature.properties.curatedMainWork === true

  if (
    typeValue === 'layout_artifact' ||
    typeValue === 'layout_frame' ||
    typeValue === 'cad_layout_artifact' ||
    feature.properties.layoutArtifact === true ||
    feature.properties.isLayoutArtifact === true
  ) {
    return 'layoutArtifact'
  }

  if (sourceGroup === 'main_works' && !isCurated) {
    return 'htcnContext'
  }

  if (type === 'water_plant') {
    return 'waterPlant'
  }

  if (type === 'raw_water_lake') {
    return 'rawWaterLake'
  }

  if (type === 'main_work_candidate' || sourceGroup === 'main_works') {
    return 'mainWorkCandidate'
  }

  if (type === 'irrigation_canal') {
    return 'irrigationCanal'
  }

  if (type === 'irrigation_area') {
    return 'irrigationArea'
  }

  if (type === 'irrigation_label') {
    return 'irrigationLabel'
  }

  if (isCurated && type === 'irrigation_point') {
    return 'curatedIrrigation'
  }

  if (type === 'irrigation_point') {
    return 'facilityPoint'
  }

  if (type === 'pipe_diameter_label' || layerName.includes('DIAMETER_TEXT')) {
    return 'diameterLabel'
  }

  if (type === 'location_label' || layerName.includes('CNTV-TEXT')) {
    return 'locationLabel'
  }

  if (
    type === 'pipeline' ||
    layerName.includes('PIPE') ||
    /(^|[^A-Z0-9])ONG([^A-Z0-9]|$)/.test(layerName) ||
    layerName.includes('TUYEN ONG')
  ) {
    return 'pipeline'
  }

  if (
    type === 'canal' ||
    layerName.includes('SONG') ||
    /(^|[^A-Z0-9])HO([^A-Z0-9]|$)/.test(layerName) ||
    layerName.includes('KENH')
  ) {
    return 'canal'
  }

  if (type === 'boundary' || type === 'supply_zone' || layerName.includes('RANH') || layerName.includes('VUNG')) {
    return 'boundary'
  }

  if (
    type === 'road_background' ||
    layerName.includes('DUONG') ||
    layerName.includes('NEN') ||
    layerName.startsWith('XR_NEN')
  ) {
    return 'background'
  }

  if (type === 'cad_polygon') {
    return 'polygon'
  }

  if (feature.geometry.type === 'Point' || feature.geometry.type === 'MultiPoint') {
    return 'facilityPoint'
  }

  return 'unknown'
}

function getTypeStyle(type: CadVectorType, selected = false): PathOptions {
  const styleMap: Record<CadVectorType, PathOptions> = {
    water_plant: { color: '#14532d', fillColor: '#166534', weight: 3, fillOpacity: 0.95, opacity: 1 },
    raw_water_lake: { color: '#4c1d95', fillColor: '#8b5cf6', weight: 2, fillOpacity: 0.2, opacity: 0.92 },
    pipeline: { color: '#2563eb', fillColor: '#2563eb', weight: 2, fillOpacity: 0.1, opacity: 0.9 },
    canal: { color: '#16a34a', fillColor: '#86efac', weight: 2, fillOpacity: 0.12, opacity: 0.85 },
    irrigation_canal: { color: '#15803d', fillColor: '#22c55e', weight: 4, fillOpacity: 0.12, opacity: 0.9 },
    irrigation_area: { color: '#166534', fillColor: '#bbf7d0', weight: 1.6, fillOpacity: 0.18, opacity: 0.86 },
    irrigation_point: { color: '#14532d', fillColor: '#4ade80', weight: 1.5, fillOpacity: 0.82, opacity: 0.9 },
    irrigation_label: { color: '#166534', fillColor: '#86efac', weight: 0.7, fillOpacity: 0.75, opacity: 0.72 },
    main_work_candidate: { color: '#c2410c', fillColor: '#f97316', weight: 2.2, fillOpacity: 0.88, opacity: 0.95 },
    boundary: {
      color: '#e2e8f0',
      fillColor: '#e2e8f0',
      weight: 2,
      fillOpacity: 0.04,
      opacity: 0.78,
      dashArray: '8 7',
    },
    supply_zone: { color: '#22c55e', fillColor: '#22c55e', weight: 2, fillOpacity: 0.1, opacity: 0.78 },
    pipe_diameter_label: { color: '#f97316', fillColor: '#f97316', weight: 1.4, fillOpacity: 0.9, opacity: 0.9 },
    location_label: { color: '#facc15', fillColor: '#fde047', weight: 1.4, fillOpacity: 0.86, opacity: 0.9 },
    layout_artifact: { color: '#f59e0b', fillColor: '#fef3c7', weight: 1, fillOpacity: 0.03, opacity: 0.35 },
    road_background: { color: '#78716c', fillColor: '#78716c', weight: 0.6, fillOpacity: 0.03, opacity: 0.3 },
    cad_point: { color: '#a855f7', fillColor: '#a855f7', weight: 2, fillOpacity: 0.85, opacity: 0.92 },
    cad_line: { color: '#94a3b8', fillColor: '#94a3b8', weight: 1.4, fillOpacity: 0.04, opacity: 0.7 },
    cad_polygon: { color: '#cbd5e1', fillColor: '#94a3b8', weight: 1.5, fillOpacity: 0.08, opacity: 0.62 },
    unknown: { color: '#64748b', fillColor: '#64748b', weight: 1.5, fillOpacity: 0.08, opacity: 0.58 },
  }
  const base = styleMap[type]

  return selected
    ? {
        ...base,
        color: '#fbbf24',
        fillColor: base.fillColor,
        weight: Math.max(Number(base.weight ?? 2) + 2, 4),
        opacity: 1,
        fillOpacity: Math.max(Number(base.fillOpacity ?? 0.1), 0.18),
      }
    : base
}

function getInitialCadVisualMode(): CadVisualMode {
  if (typeof window === 'undefined') {
    return 'classic'
  }

  const storedMode = window.localStorage.getItem('cadVectorVisualMode')
  const storedModeVersion = window.localStorage.getItem('cadVectorVisualModeVersion')
  if (storedMode === 'terrain') {
    return 'classic'
  }

  if (!storedModeVersion && storedMode === 'clean') {
    return 'classic'
  }

  return CAD_VISUAL_MODES.some((mode) => mode.key === storedMode) ? (storedMode as CadVisualMode) : 'classic'
}

function getPrintBackgroundFill(visualMode: CadVisualMode): string {
  switch (visualMode) {
    case 'dark':
      return '#061a2c'
    case 'report':
      return '#fbfdff'
    case 'water':
      return '#f8fbff'
    case 'irrigation':
      return '#f7fffb'
    case 'classic':
      return '#f7fbf8'
    case 'clean':
    default:
      return '#ffffff'
  }
}

function adjustStyleForVisualMode(
  style: PathOptions,
  group: CadRenderGroup,
  visualMode: CadVisualMode,
): PathOptions {
  if (visualMode === 'clean') {
    return style
  }

  if (visualMode === 'classic') {
    if (group === 'background' || group === 'boundary' || group === 'polygon' || group === 'canal') {
      return {
        ...style,
        color: group === 'canal' ? '#7dd3fc' : '#8b9aa7',
        fillColor: '#dbeafe',
        weight: Math.max(Number(style.weight ?? 0.7), 0.8),
        opacity: Math.max(Number(style.opacity ?? 0.3), 0.38),
        fillOpacity: Math.min(Number(style.fillOpacity ?? 0.04), 0.035),
      }
    }

    if (group === 'irrigationCanal' || group === 'irrigationArea') {
      return {
        ...style,
        color: '#15803d',
        fillColor: '#86efac',
        opacity: 0.82,
      }
    }

    return style
  }

  if (visualMode === 'report') {
    if (group === 'background' || group === 'boundary' || group === 'polygon' || group === 'canal') {
      return {
        ...style,
        color: group === 'canal' ? '#8bb8c5' : '#94a3b8',
        fillColor: '#dbeafe',
        weight: Math.max(Number(style.weight ?? 0.7), 0.78),
        opacity: group === 'background' ? 0.34 : 0.42,
        fillOpacity: Math.min(Number(style.fillOpacity ?? 0.04), 0.035),
      }
    }

    if (group === 'pipeline') {
      return {
        ...style,
        color: '#1d4ed8',
        fillColor: '#1d4ed8',
        weight: Math.max(Number(style.weight ?? 2.7), 3),
        opacity: 0.9,
      }
    }

    if (group === 'irrigationCanal' || group === 'irrigationArea') {
      return {
        ...style,
        color: '#15803d',
        fillColor: '#86efac',
        weight: Math.max(Number(style.weight ?? 2.6), 2.7),
        opacity: 0.72,
      }
    }

    return style
  }

  if (visualMode === 'water') {
    if (group === 'background' || group === 'boundary' || group === 'polygon' || group === 'canal') {
      return {
        ...style,
        color: '#cbd5e1',
        fillColor: '#e2e8f0',
        weight: Math.min(Math.max(Number(style.weight ?? 0.7), 0.55), 0.75),
        opacity: 0.18,
        fillOpacity: 0.01,
      }
    }

    if (group === 'pipeline') {
      return {
        ...style,
        color: '#2563eb',
        fillColor: '#2563eb',
        weight: Math.max(Number(style.weight ?? 2.7), 4),
        opacity: 0.98,
      }
    }

    if (group === 'irrigationCanal' || group === 'irrigationArea' || group === 'curatedIrrigation') {
      return {
        ...style,
        color: '#16a34a',
        fillColor: '#bbf7d0',
        weight: Math.max(Number(style.weight ?? 2.5), 2.3),
        opacity: 0.38,
        fillOpacity: Math.min(Number(style.fillOpacity ?? 0.12), 0.08),
      }
    }

    return style
  }

  if (visualMode === 'irrigation') {
    if (group === 'background' || group === 'boundary' || group === 'polygon' || group === 'canal') {
      return {
        ...style,
        color: '#cbd5e1',
        fillColor: '#e2e8f0',
        weight: Math.min(Math.max(Number(style.weight ?? 0.7), 0.55), 0.75),
        opacity: 0.2,
        fillOpacity: 0.01,
      }
    }

    if (group === 'pipeline') {
      return {
        ...style,
        color: '#2563eb',
        fillColor: '#2563eb',
        weight: Math.max(Number(style.weight ?? 2.3), 2.3),
        opacity: 0.46,
      }
    }

    if (group === 'irrigationCanal' || group === 'irrigationArea' || group === 'curatedIrrigation') {
      return {
        ...style,
        color: '#15803d',
        fillColor: '#22c55e',
        weight: Math.max(Number(style.weight ?? 2.8), 4),
        opacity: 0.92,
        fillOpacity: Math.max(Number(style.fillOpacity ?? 0.12), 0.16),
      }
    }

    return style
  }

  if (group === 'background' || group === 'boundary' || group === 'polygon' || group === 'canal') {
    return {
      ...style,
      color: group === 'canal' ? '#38bdf8' : '#67e8f9',
      fillColor: '#083344',
      weight: Math.max(Number(style.weight ?? 0.7), 0.75),
      opacity: group === 'background' ? 0.38 : 0.48,
      fillOpacity: 0.02,
    }
  }

  if (group === 'pipeline') {
    return {
      ...style,
      color: '#facc15',
      fillColor: '#facc15',
      opacity: 0.95,
    }
  }

  if (group === 'irrigationCanal' || group === 'irrigationArea' || group === 'curatedIrrigation') {
    return {
      ...style,
      color: '#86efac',
      fillColor: '#bbf7d0',
      opacity: 0.9,
    }
  }

  return style
}

function getIrrigationHaloStyle(visualMode: CadVisualMode): PathOptions {
  if (visualMode === 'dark') {
    return {
      color: '#bbf7d0',
      weight: 6,
      opacity: 0.2,
      lineCap: 'round',
      lineJoin: 'round',
    }
  }

  return {
    color: '#bbf7d0',
    weight: visualMode === 'irrigation' ? 7 : 5,
    opacity: visualMode === 'irrigation' ? 0.28 : visualMode === 'water' ? 0.08 : 0.18,
    lineCap: 'round',
    lineJoin: 'round',
  }
}

function getPipelineHaloStyle(visualMode: CadVisualMode): PathOptions {
  if (visualMode === 'dark') {
    return {
      color: '#dbeafe',
      weight: 7,
      opacity: 0.16,
      lineCap: 'round',
      lineJoin: 'round',
    }
  }

  return {
    color: '#ffffff',
    weight: visualMode === 'water' ? 8 : 6,
    opacity: visualMode === 'water' ? 0.46 : visualMode === 'irrigation' ? 0.12 : 0.32,
    lineCap: 'round',
    lineJoin: 'round',
  }
}

function getSelectedHaloStyle(feature: CadVectorFeature, visualMode: CadVisualMode): PathOptions {
  const group = getFeatureRenderGroup(feature)
  const darkMode = visualMode === 'dark'
  const isPoint =
    feature.geometry.type === 'Point' ||
    feature.geometry.type === 'MultiPoint' ||
    group === 'waterPlant' ||
    group === 'rawWaterLake'

  return {
    color: darkMode ? '#fde68a' : '#facc15',
    fillColor: darkMode ? '#fef3c7' : '#facc15',
    weight: isPoint ? 5 : 8,
    opacity: darkMode ? 0.85 : 0.72,
    fillOpacity: isPoint ? 0.22 : 0.08,
    lineCap: 'round',
    lineJoin: 'round',
  }
}

function shouldDimForSpotlight(group: CadRenderGroup, spotlightGroup: CadRenderGroup | null): boolean {
  if (!spotlightGroup) {
    return false
  }

  if (group === spotlightGroup) {
    return false
  }

  if (
    (spotlightGroup === 'waterPlant' || spotlightGroup === 'rawWaterLake' || spotlightGroup === 'mainWorkCandidate') &&
    (group === 'waterPlant' || group === 'rawWaterLake' || group === 'mainWorkCandidate')
  ) {
    return false
  }

  return true
}

function applySpotlightDimming(style: PathOptions, group: CadRenderGroup, spotlightGroup: CadRenderGroup | null) {
  if (!shouldDimForSpotlight(group, spotlightGroup)) {
    return style
  }

  if (group === 'background' || group === 'boundary' || group === 'polygon' || group === 'canal' || group === 'unknown') {
    return {
      ...style,
      opacity: Math.min(Number(style.opacity ?? 0.25), 0.16),
      fillOpacity: Math.min(Number(style.fillOpacity ?? 0.03), 0.01),
    }
  }

  if (group === 'pipeline' || group === 'irrigationCanal' || group === 'irrigationArea') {
    return {
      ...style,
      opacity: Math.min(Number(style.opacity ?? 0.7), 0.42),
      fillOpacity: Math.min(Number(style.fillOpacity ?? 0.1), 0.05),
    }
  }

  return {
    ...style,
    opacity: Math.min(Number(style.opacity ?? 0.7), 0.34),
    fillOpacity: Math.min(Number(style.fillOpacity ?? 0.1), 0.06),
  }
}

function getFeatureStyle(
  feature: CadVectorFeature,
  selected = false,
  viewKey = 'overview',
  visualMode: CadVisualMode = 'clean',
  spotlightGroup: CadRenderGroup | null = null,
): PathOptions {
  const group = getFeatureRenderGroup(feature)
  const styleMap: Record<CadRenderGroup, PathOptions> = {
    pipeline: {
      color: '#2563eb',
      fillColor: '#2563eb',
      weight: 2.7,
      opacity: 0.88,
      fillOpacity: 0.2,
      lineCap: 'round',
      lineJoin: 'round',
    },
    diameterLabel: {
      color: '#6b3f76',
      fillColor: '#8b5a91',
      weight: 0.65,
      opacity: 0.9,
      fillOpacity: 0.95,
    },
    irrigationCanal: {
      color: '#15803d',
      fillColor: '#22c55e',
      weight: 2.8,
      opacity: 0.75,
      fillOpacity: 0.12,
      lineCap: 'round',
      lineJoin: 'round',
    },
    irrigationArea: {
      color: '#166534',
      fillColor: '#bbf7d0',
      weight: 1.5,
      opacity: 0.88,
      fillOpacity: 0.18,
      lineCap: 'round',
      lineJoin: 'round',
    },
    irrigationLabel: {
      color: '#166534',
      fillColor: '#86efac',
      weight: 0.6,
      opacity: 0.72,
      fillOpacity: 0.72,
    },
    curatedIrrigation: {
      color: '#ffffff',
      fillColor: '#16a34a',
      weight: 2.8,
      opacity: 1,
      fillOpacity: 0.94,
    },
    waterPlant: {
      color: '#ffffff',
      fillColor: '#f97316',
      weight: 3.2,
      opacity: 1,
      fillOpacity: 0.96,
    },
    rawWaterLake: {
      color: '#4c1d95',
      fillColor: '#8b5cf6',
      weight: 2.4,
      opacity: 0.98,
      fillOpacity: 0.78,
    },
    mainWorkCandidate: {
      color: '#ffffff',
      fillColor: '#f97316',
      weight: 2.4,
      opacity: 0.96,
      fillOpacity: 0.9,
    },
    htcnContext: {
      color: '#9a6b4f',
      fillColor: '#f97316',
      weight: 0.45,
      opacity: 0.12,
      fillOpacity: 0.02,
    },
    layoutArtifact: {
      color: '#f59e0b',
      fillColor: '#fef3c7',
      weight: 1,
      opacity: 0.35,
      fillOpacity: 0.03,
      dashArray: '4 6',
    },
    canal: {
      color: '#5f6f78',
      fillColor: '#dbeafe',
      weight: 0.55,
      opacity: 0.7,
      fillOpacity: 0.04,
      lineCap: 'round',
      lineJoin: 'round',
    },
    boundary: {
      color: '#7c8794',
      fillColor: '#ffffff',
      weight: 0.55,
      opacity: 0.35,
      fillOpacity: 0.02,
      dashArray: '5 6',
    },
    background: {
      color: '#64748b',
      fillColor: '#94a3b8',
      weight: 0.7,
      opacity: 0.32,
      fillOpacity: 0.04,
      lineCap: 'round',
      lineJoin: 'round',
    },
    facilityPoint: {
      color: '#3f2a46',
      fillColor: '#8b5a91',
      weight: 0.7,
      opacity: 0.9,
      fillOpacity: 0.88,
    },
    locationLabel: {
      color: '#55515c',
      fillColor: '#8b5a91',
      weight: 0.55,
      opacity: 0.72,
      fillOpacity: 0.82,
    },
    polygon: {
      color: '#6b5a48',
      fillColor: '#ffffff',
      weight: 0.55,
      opacity: 0.72,
      fillOpacity: 0.01,
    },
    unknown: {
      color: '#80766c',
      fillColor: '#80766c',
      weight: 0.45,
      opacity: 0.12,
      fillOpacity: 0.02,
    },
  }
  const base = styleMap[group] ?? getTypeStyle(feature.properties.type)
  const viewAdjusted =
    (viewKey === 'water_plants' || viewKey === 'raw_water_lakes') && group === 'pipeline'
      ? {
          ...base,
          weight: 1.8,
          opacity: 0.42,
          fillOpacity: Math.min(Number(base.fillOpacity ?? 0.1), 0.08),
        }
      : viewKey === 'overview' && group === 'pipeline'
        ? {
            ...base,
            color: '#2563eb',
            fillColor: '#2563eb',
            weight: 3,
            opacity: 0.92,
          }
        : viewKey === 'irrigation_system' && group === 'irrigationCanal'
          ? {
              ...base,
              color: '#15803d',
              fillColor: '#22c55e',
              weight: 3,
              opacity: 0.82,
          }
        : base
  const visualAdjusted = adjustStyleForVisualMode(viewAdjusted, group, visualMode)
  const spotlightAdjusted = selected ? visualAdjusted : applySpotlightDimming(visualAdjusted, group, spotlightGroup)

  return selected
    ? {
        ...spotlightAdjusted,
        color: '#facc15',
        fillColor: spotlightAdjusted.fillColor,
        weight: Math.max(Number(spotlightAdjusted.weight ?? 0.6) + 1.5, 2.4),
        opacity: 1,
        fillOpacity: Math.max(Number(spotlightAdjusted.fillOpacity ?? 0.1), 0.2),
      }
    : spotlightAdjusted
}

function escapeHtml(value: unknown): string {
  return safeDisplayText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function normalizeCadSearchText(value: unknown): string {
  return safeDisplayText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s$.-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isLikelyLayoutFrame(feature: CadVectorFeature, metadata: CadVectorMetadata | null): boolean {
  const type = String(feature.properties.type)
  if (
    type === 'layout_artifact' ||
    type === 'layout_frame' ||
    type === 'cad_layout_artifact' ||
    feature.properties.layoutArtifact === true ||
    feature.properties.isLayoutArtifact === true
  ) {
    return true
  }

  const haystack = normalizeCadSearchText(
    [
      feature.properties.cadLayer,
      feature.properties.name,
      feature.properties.Text,
      feature.properties.originalText,
      feature.properties.cadSpace,
      feature.properties.PaperSpace,
    ].join(' '),
  )

  if (LAYOUT_ARTIFACT_TERMS.some((term) => haystack.includes(normalizeCadSearchText(term)))) {
    return true
  }

  if (feature.properties.cadSpace === 'paper') {
    return true
  }

  if (feature.properties.sourceGroup !== 'main_works' && feature.properties.sourceGroup !== 'irrigation') {
    return false
  }

  if (!['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
    return false
  }

  const featureBounds = getRawGeometryBounds(feature.geometry)
  const mapBounds = metadata?.normalizedBounds
  if (!featureBounds || !mapBounds) {
    return false
  }

  if (hasClosedAxisAlignedFrame(feature.geometry)) {
    return true
  }

  const mapWidth = Math.max(mapBounds.maxX - mapBounds.minX, 1)
  const mapHeight = Math.max(mapBounds.maxY - mapBounds.minY, 1)
  const width = featureBounds.maxX - featureBounds.minX
  const height = featureBounds.maxY - featureBounds.minY
  const widthRatio = width / mapWidth
  const heightRatio = height / mapHeight
  const edgeRatio = featureBounds.edgePointCount / Math.max(featureBounds.pointCount, 1)
  const rectangularFrame = edgeRatio >= 0.82 && featureBounds.pointCount <= 40

  return rectangularFrame && (widthRatio >= 0.4 || heightRatio >= 0.4)
}

function isFloatingIrrigationAnnotation(feature: CadVectorFeature): boolean {
  if (feature.properties.sourceGroup !== 'irrigation') {
    return false
  }

  const layerName = normalizeCadSearchText(feature.properties.cadLayer)
  if (['ghichu', 'ghi chu', 'ky hieu', 'defpoints'].some((term) => layerName.includes(term))) {
    return true
  }

  if (!['LineString', 'MultiLineString'].includes(feature.geometry.type)) {
    return false
  }

  const bounds = getRawGeometryBounds(feature.geometry)
  if (!bounds) {
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

function isUpperDetachedCadScratch(feature: CadVectorFeature): boolean {
  if (!['LineString', 'MultiLineString'].includes(feature.geometry.type)) {
    return false
  }

  const bounds = getRawGeometryBounds(feature.geometry)
  if (!bounds) {
    return false
  }

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const layerName = normalizeCadSearchText(feature.properties.cadLayer)
  const isUpperLooseStroke = centerX >= 577000 && centerX <= 584500 && centerY >= 1212500 && centerY <= 1214300
  const isSmallStroke = width <= 1900 && height <= 260 && bounds.pointCount <= 10
  const isKnownAnnotationLayer = ['ghichu', 'ghi chu', 'ky hieu', 'defpoints'].some((term) => layerName.includes(term))

  return isUpperLooseStroke && (isSmallStroke || isKnownAnnotationLayer)
}

function shouldShowFeature(
  feature: CadVectorFeature,
  visibleLayers: Record<string, boolean>,
  typeFilter: CadVectorType | 'all',
  labelOptions: CadLabelVisibilityOptions,
  metadata: CadVectorMetadata | null,
): boolean {
  const isCurated = feature.properties.curatedMainWork === true
  const isBaseCadReference =
    feature.properties.sourceGroup === 'cad_base' &&
    feature.properties.type !== 'pipeline' &&
    feature.properties.type !== 'pipe_diameter_label'

  if (isCurated && visibleLayers[CAD_CURATED_MAIN_WORKS_LAYER_KEY] === false) {
    return false
  }

  if (isLikelyLayoutFrame(feature, metadata) && visibleLayers[CAD_LAYOUT_ARTIFACT_LAYER_KEY] === false) {
    return false
  }

  if (isBaseCadReference && visibleLayers[CAD_BASE_LAYER_KEY] === false) {
    return false
  }

  if (
    feature.properties.sourceGroup === 'main_works' &&
    !isCurated &&
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

  if (isCadTextFeature(feature) && !shouldRenderCadLabel(feature, labelOptions)) {
    return false
  }

  return true
}

function getRenderableFeaturesForView(
  viewKey: string,
  collection: CadVectorFeatureCollection | null,
  visibleLayers: Record<string, boolean>,
  typeFilter: CadVectorType | 'all',
  labelOptions: CadLabelVisibilityOptions,
  metadata: CadVectorMetadata | null,
): CadVectorFeatureCollection {
  if (!collection) {
    return EMPTY_COLLECTION
  }

  const primaryView =
    viewKey === 'overview' ||
    viewKey === 'water_plants' ||
    viewKey === 'raw_water_lakes' ||
    viewKey === 'irrigation_system'

  return {
    type: 'FeatureCollection',
    features: collection.features.filter((feature) => {
      if (primaryView && isLikelyLayoutFrame(feature, metadata)) {
        return false
      }

      if (primaryView && isFloatingIrrigationAnnotation(feature)) {
        return false
      }

      if (primaryView && isUpperDetachedCadScratch(feature)) {
        return false
      }

      if (primaryView && feature.properties.type === 'unknown') {
        return false
      }

      if (
        primaryView &&
        feature.properties.sourceGroup === 'main_works' &&
        feature.properties.curatedMainWork !== true
      ) {
        return false
      }

      return shouldShowFeature(feature, visibleLayers, typeFilter, labelOptions, metadata)
    }),
  }
}

function collectionFromFeatures(features: CadVectorFeature[]): CadVectorFeatureCollection {
  return {
    type: 'FeatureCollection',
    features,
  }
}

function getCameraFeaturesForView(
  viewKey: string,
  visibleEntities: CadVectorFeatureCollection,
): CadVectorFeatureCollection {
  const focusedFeatures = visibleEntities.features.filter((feature) => {
    if (viewKey === 'water_plants') {
      return feature.properties.curatedMainWork === true && feature.properties.type === 'water_plant'
    }

    if (viewKey === 'raw_water_lakes') {
      return feature.properties.curatedMainWork === true && feature.properties.type === 'raw_water_lake'
    }

    if (viewKey === 'irrigation_system') {
      return feature.properties.sourceGroup === 'irrigation'
    }

    return false
  })

  return focusedFeatures.length > 0 ? collectionFromFeatures(focusedFeatures) : visibleEntities
}

function isCadBaseBackgroundFeature(feature: CadVectorFeature): boolean {
  if (feature.properties.sourceGroup !== 'cad_base') {
    return false
  }

  const group = getFeatureRenderGroup(feature)
  return group === 'background' || group === 'boundary' || group === 'canal' || group === 'polygon' || group === 'unknown'
}

function isCadBaseMainFeature(feature: CadVectorFeature): boolean {
  if (feature.properties.sourceGroup !== 'cad_base') {
    return false
  }

  const group = getFeatureRenderGroup(feature)
  return group === 'pipeline' || group === 'diameterLabel' || group === 'facilityPoint' || group === 'locationLabel'
}

function getMetadataBounds(metadata: CadVectorMetadata | null): LatLngBoundsExpression | null {
  const bounds = metadata?.normalizedBounds
  if (!bounds || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) {
    return null
  }

  return [
    [bounds.minY, bounds.minX],
    [bounds.maxY, bounds.maxX],
  ]
}

function getCollectionBounds(collection: CadVectorFeatureCollection): LatLngBoundsExpression | null {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  }

  for (const feature of collection.features) {
    if (!('coordinates' in feature.geometry)) {
      continue
    }

    walkCoordinates(feature.geometry.coordinates, (x, y) => {
      bounds.minX = Math.min(bounds.minX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.maxY = Math.max(bounds.maxY, y)
    })
  }

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    return null
  }

  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const padding = Math.max(width, height) * 0.04

  return [
    [bounds.minY - padding, bounds.minX - padding],
    [bounds.maxY + padding, bounds.maxX + padding],
  ]
}

function getSvgBounds(collection: CadVectorFeatureCollection): SvgBounds | null {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  }

  for (const feature of collection.features) {
    if (!('coordinates' in feature.geometry)) {
      continue
    }

    walkCoordinates(feature.geometry.coordinates, (x, y) => {
      bounds.minX = Math.min(bounds.minX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.maxY = Math.max(bounds.maxY, y)
    })
  }

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    return null
  }

  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const padding = Math.max(width, height) * 0.06

  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  }
}

function projectSvgPoint(x: number, y: number, bounds: SvgBounds): SvgPoint {
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = Math.min(PRINT_SVG_WIDTH / width, PRINT_SVG_HEIGHT / height)
  const renderedWidth = width * scale
  const renderedHeight = height * scale
  const offsetX = (PRINT_SVG_WIDTH - renderedWidth) / 2
  const offsetY = (PRINT_SVG_HEIGHT - renderedHeight) / 2

  return {
    x: offsetX + (x - bounds.minX) * scale,
    y: offsetY + (bounds.maxY - y) * scale,
  }
}

function svgPathFromCoordinateList(coordinates: unknown, bounds: SvgBounds, closed = false): string | null {
  if (!Array.isArray(coordinates)) {
    return null
  }

  const points = coordinates
    .map(getCoordinatePair)
    .filter((point): point is [number, number] => Boolean(point))
    .map(([x, y]) => projectSvgPoint(x, y, bounds))

  if (!points.length) {
    return null
  }

  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')}${
    closed ? ' Z' : ''
  }`
}

function getPrintShapeSize(feature: CadVectorFeature, group: CadRenderGroup): number {
  if (feature.properties.curatedMainWork === true || group === 'waterPlant' || group === 'rawWaterLake') {
    return 8
  }

  if (group === 'pipeline' || group === 'irrigationCanal') {
    return 2.6
  }

  if (group === 'background' || group === 'boundary' || group === 'canal') {
    return 0.75
  }

  return 1.1
}

function buildPrintSvgShapes(
  collection: CadVectorFeatureCollection,
  bounds: SvgBounds | null,
  selectedFeatureId: string | null,
  viewKey: string,
  visualMode: CadVisualMode,
): PrintSvgShape[] {
  if (!bounds) {
    return []
  }

  const shapes: PrintSvgShape[] = []

  for (const feature of collection.features) {
    if (!('coordinates' in feature.geometry)) {
      continue
    }

    const group = getFeatureRenderGroup(feature)
    const style = getFeatureStyle(feature, feature.properties.id === selectedFeatureId, viewKey, visualMode)
    const stroke = safeDisplayText(style.color, '#64748b')
    const fill = safeDisplayText(style.fillColor, 'none')
    const strokeWidth = getPrintShapeSize(feature, group)
    const opacity = Number(style.opacity ?? 0.8)
    const fillOpacity = Number(style.fillOpacity ?? 0)
    const dashArray = typeof style.dashArray === 'string' ? style.dashArray : undefined
    const baseKey = safeDisplayText(feature.properties.id, `${shapes.length}`)

    if (feature.geometry.type === 'Point') {
      const point = getCoordinatePair(feature.geometry.coordinates)
      if (!point) {
        continue
      }

      const projected = projectSvgPoint(point[0], point[1], bounds)
      shapes.push({
        key: baseKey,
        kind: 'circle',
        cx: projected.x,
        cy: projected.y,
        r: feature.properties.curatedMainWork === true ? 9 : 3,
        stroke,
        fill,
        strokeWidth,
        opacity,
        fillOpacity: Math.max(fillOpacity, feature.properties.curatedMainWork === true ? 0.9 : 0.25),
        dashArray,
      })
      continue
    }

    const rings = getGeometryLineRings(feature.geometry)
    rings.forEach((ring, index) => {
      const isPolygon = feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'
      const d = svgPathFromCoordinateList(ring, bounds, isPolygon)
      if (!d) {
        return
      }

      shapes.push({
        key: `${baseKey}-${index}`,
        kind: 'path',
        d,
        stroke,
        fill: isPolygon ? fill : 'none',
        strokeWidth,
        opacity,
        fillOpacity: isPolygon ? fillOpacity : 0,
        dashArray,
      })
    })
  }

  return shapes
}

function buildPrintSvgLabels(collection: CadVectorFeatureCollection, bounds: SvgBounds | null): PrintSvgLabel[] {
  if (!bounds) {
    return []
  }

  return collection.features
    .filter((feature) => feature.properties.curatedMainWork === true)
    .map((feature) => {
      const rawBounds = getRawGeometryBounds(feature.geometry)
      if (!rawBounds) {
        return null
      }

      const point = projectSvgPoint((rawBounds.minX + rawBounds.maxX) / 2, (rawBounds.minY + rawBounds.maxY) / 2, bounds)
      return {
        key: feature.properties.id,
        x: point.x + 12,
        y: point.y - 10,
        text: getFeatureDisplayName(feature),
      }
    })
    .filter((label): label is PrintSvgLabel => Boolean(label))
}

function walkCoordinates(coordinates: unknown, visitor: (x: number, y: number) => void) {
  if (!Array.isArray(coordinates)) {
    return
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    visitor(coordinates[0], coordinates[1])
    return
  }

  for (const child of coordinates) {
    walkCoordinates(child, visitor)
  }
}

function getRawGeometryBounds(geometry: CadVectorFeature['geometry']): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  pointCount: number
  edgePointCount: number
} | null {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    pointCount: 0,
    edgePointCount: 0,
  }

  if (!('coordinates' in geometry)) {
    return null
  }

  walkCoordinates(geometry.coordinates, (x, y) => {
    bounds.minX = Math.min(bounds.minX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.maxY = Math.max(bounds.maxY, y)
    bounds.pointCount += 1
  })

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    return null
  }

  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const tolerance = Math.max(width, height) * 0.012

  walkCoordinates(geometry.coordinates, (x, y) => {
    const nearVerticalEdge = Math.abs(x - bounds.minX) <= tolerance || Math.abs(x - bounds.maxX) <= tolerance
    const nearHorizontalEdge = Math.abs(y - bounds.minY) <= tolerance || Math.abs(y - bounds.maxY) <= tolerance
    if (nearVerticalEdge || nearHorizontalEdge) {
      bounds.edgePointCount += 1
    }
  })

  return bounds
}

function getCoordinatePair(point: unknown): [number, number] | null {
  return Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
    ? [point[0], point[1]]
    : null
}

function getGeometryLineRings(geometry: CadVectorFeature['geometry']): unknown[][] {
  if (!('coordinates' in geometry)) {
    return []
  }

  if (geometry.type === 'LineString') {
    return [geometry.coordinates as unknown[]]
  }

  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') {
    return geometry.coordinates as unknown[][]
  }

  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as unknown[][][]).flat()
  }

  return []
}

function isClosedAxisAlignedRectangle(ring: unknown[]): boolean {
  const points = ring.map(getCoordinatePair).filter((point): point is [number, number] => Boolean(point))
  if (points.length < 5 || points.length > 8) {
    return false
  }

  const bounds = {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  }
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const maxDimension = Math.max(width, height, 1)
  const tolerance = Math.max(maxDimension * 0.002, 2)

  if (width < 1000 || height < 700) {
    return false
  }

  const first = points[0]
  const last = points[points.length - 1]
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) > tolerance) {
    return false
  }

  const axisAligned = points.slice(1).every((point, index) => {
    const previous = points[index]
    return Math.abs(point[0] - previous[0]) <= tolerance || Math.abs(point[1] - previous[1]) <= tolerance
  })
  if (!axisAligned) {
    return false
  }

  return points.every(([x, y]) => {
    const onVerticalEdge = Math.abs(x - bounds.minX) <= tolerance || Math.abs(x - bounds.maxX) <= tolerance
    const onHorizontalEdge = Math.abs(y - bounds.minY) <= tolerance || Math.abs(y - bounds.maxY) <= tolerance
    return onVerticalEdge && onHorizontalEdge
  })
}

function hasClosedAxisAlignedFrame(geometry: CadVectorFeature['geometry']): boolean {
  return getGeometryLineRings(geometry).some(isClosedAxisAlignedRectangle)
}

function getFeatureBounds(feature: CadVectorFeature): LatLngBoundsExpression | null {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  }

  if ('coordinates' in feature.geometry) {
    walkCoordinates(feature.geometry.coordinates, (x, y) => {
      bounds.minX = Math.min(bounds.minX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.maxY = Math.max(bounds.maxY, y)
    })
  }

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    return null
  }

  const padding = feature.geometry.type === 'Point' ? 250 : 40

  return [
    [bounds.minY - padding, bounds.minX - padding],
    [bounds.maxY + padding, bounds.maxX + padding],
  ]
}

function setPathStyle(layer: Layer, style: PathOptions) {
  if ('setStyle' in layer) {
    ;(layer as Path).setStyle(style)
  }
}

function setCircleRadius(layer: Layer, radius: number) {
  if ('setRadius' in layer) {
    ;(layer as LeafletCircleMarker).setRadius(radius)
  }
}

function getPointRadiusForFeature(feature: CadVectorFeature, selectedFeatureId: string | null): number {
  const group = getFeatureRenderGroup(feature)
  if (feature.properties.id === selectedFeatureId) {
    return group === 'waterPlant' || group === 'rawWaterLake' || group === 'mainWorkCandidate' ? 12 : 9
  }

  if (group === 'waterPlant') {
    return 10.5
  }

  if (group === 'rawWaterLake') {
    return 10
  }

  if (group === 'curatedIrrigation') {
    return 7.5
  }

  if (group === 'mainWorkCandidate') {
    return 5
  }

  if (group === 'irrigationCanal' || group === 'irrigationArea') {
    return 3.5
  }

  if (group === 'diameterLabel' || group === 'locationLabel' || group === 'irrigationLabel') {
    return 1.6
  }

  return 2.4
}

function CadVectorController({
  bounds,
  selectedFeature,
  focusVersion,
  resetVersion,
  printVersion,
  viewPresetKey,
}: {
  bounds: LatLngBoundsExpression
  selectedFeature: CadVectorFeature | null
  focusVersion: number
  resetVersion: number
  printVersion: number
  viewPresetKey: string
}) {
  const map = useMap()
  const lastFocusVersionRef = useRef(focusVersion)

  useEffect(() => {
    const maxZoom =
      viewPresetKey === 'water_plants' || viewPresetKey === 'raw_water_lakes' ? 0 : undefined

    map.flyToBounds(bounds, {
      padding: [72, 72],
      maxZoom,
      duration: 0.85,
    })
  }, [bounds, map, resetVersion, viewPresetKey])

  useEffect(() => {
    if (printVersion <= 0) {
      return
    }

    map.invalidateSize(false)
    map.fitBounds(bounds, { padding: [42, 42], animate: false })
    const timer = window.setTimeout(() => {
      map.invalidateSize(false)
      map.fitBounds(bounds, { padding: [42, 42], animate: false })
    }, 120)

    return () => window.clearTimeout(timer)
  }, [bounds, map, printVersion])

  useEffect(() => {
    if (focusVersion <= 0 || focusVersion === lastFocusVersionRef.current) {
      return
    }

    lastFocusVersionRef.current = focusVersion

    if (!selectedFeature) {
      return
    }

    const featureBounds = getFeatureBounds(selectedFeature)
    if (featureBounds) {
      map.flyToBounds(featureBounds, { padding: [72, 72], maxZoom: 0, duration: 0.85 })
    }
  }, [focusVersion, map, selectedFeature])

  return null
}

function CadVectorClickController({
  enabled,
  onCadCoordinateClick,
}: {
  enabled: boolean
  onCadCoordinateClick?: (cadPosition: [number, number]) => void
}) {
  useMapEvents({
    click: (event) => {
      if (!enabled || !onCadCoordinateClick) {
        return
      }

      onCadCoordinateClick([event.latlng.lng, event.latlng.lat])
    },
  })

  return null
}

export function cadVectorTypeLabelForUi(type: CadVectorType): string {
  return CAD_VECTOR_TYPE_LABELS_VI[type] ?? cadVectorTypeLabel(type)
}

export function CadVectorMap({
  data,
  loading,
  visibleLayers,
  typeFilter,
  labelOptions,
  selectedFeature,
  focusVersion,
  fitVersion,
  viewPresetKey,
  viewPresetLabel,
  positionUpdateTargetLabel,
  onCadCoordinateClick,
  onSelectFeature,
}: CadVectorMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tooltipDelayRef = useRef<number | null>(null)
  const lastTooltipMoveRef = useRef<TooltipMousePosition | null>(null)
  const [resetVersion, setResetVersion] = useState(0)
  const [selectedZoomVersion, setSelectedZoomVersion] = useState(0)
  const [printVersion, setPrintVersion] = useState(0)
  const [showLegend, setShowLegend] = useState(true)
  const [visualMode, setVisualMode] = useState<CadVisualMode>(getInitialCadVisualMode)
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    feature: null,
    mousePosition: null,
    mapContainerRect: null,
    visible: false,
  })
  const metadataBounds = useMemo(() => getMetadataBounds(data?.metadata ?? null), [data?.metadata])
  const selectedFeatureId = selectedFeature?.properties.id ?? null
  const selectedFeatureRenderGroup = selectedFeature ? getFeatureRenderGroup(selectedFeature) : null
  const layerVisibilityKey = useMemo(
    () =>
      Object.entries(visibleLayers)
        .filter(([, visible]) => visible === false)
        .map(([layerName]) => layerName)
        .sort()
        .join('|'),
    [visibleLayers],
  )
  const geoJsonRenderKey = `${typeFilter}-${JSON.stringify(labelOptions)}-${layerVisibilityKey}-${visualMode}`
  const visibleEntities = useMemo(
    () =>
      getRenderableFeaturesForView(
        viewPresetKey,
        data?.entities ?? null,
        visibleLayers,
        typeFilter,
        labelOptions,
        data?.metadata ?? null,
      ),
    [data?.entities, data?.metadata, labelOptions, typeFilter, viewPresetKey, visibleLayers],
  )
  const cameraEntities = useMemo(
    () => getCameraFeaturesForView(viewPresetKey, visibleEntities),
    [viewPresetKey, visibleEntities],
  )
  const fitEntities = cameraEntities
  const bounds = useMemo(
    () => getCollectionBounds(fitEntities) ?? metadataBounds,
    [fitEntities, metadataBounds],
  )
  const printSvgBounds = useMemo(() => getSvgBounds(fitEntities), [fitEntities])
  const printSvgShapes = useMemo(
    () => buildPrintSvgShapes(visibleEntities, printSvgBounds, selectedFeatureId, viewPresetKey, visualMode),
    [printSvgBounds, selectedFeatureId, viewPresetKey, visibleEntities, visualMode],
  )
  const printSvgLabels = useMemo(
    () => buildPrintSvgLabels(visibleEntities, printSvgBounds),
    [printSvgBounds, visibleEntities],
  )
  const cadBaseBackground = useMemo(
    () => collectionFromFeatures(visibleEntities.features.filter(isCadBaseBackgroundFeature)),
    [visibleEntities],
  )
  const cadBaseMain = useMemo(
    () => collectionFromFeatures(visibleEntities.features.filter(isCadBaseMainFeature)),
    [visibleEntities],
  )
  const pipelineHalo = useMemo(
    () =>
      collectionFromFeatures(
        cadBaseMain.features.filter((feature) => getFeatureRenderGroup(feature) === 'pipeline'),
      ),
    [cadBaseMain],
  )
  const irrigation = useMemo(
    () =>
      collectionFromFeatures(
        visibleEntities.features.filter(
          (feature) => feature.properties.sourceGroup === 'irrigation' && feature.properties.curatedMainWork !== true,
        ),
      ),
    [visibleEntities],
  )
  const irrigationHalo = useMemo(
    () =>
      collectionFromFeatures(
        irrigation.features.filter((feature) => feature.properties.type === 'irrigation_canal'),
      ),
    [irrigation],
  )
  const mainWorks = useMemo(
    () =>
      collectionFromFeatures(
        visibleEntities.features.filter(
          (feature) => feature.properties.sourceGroup === 'main_works' && feature.properties.curatedMainWork !== true,
        ),
      ),
    [visibleEntities],
  )
  const curatedMainWorks = useMemo(
    () =>
      collectionFromFeatures(
        visibleEntities.features.filter((feature) => feature.properties.curatedMainWork === true),
      ),
    [visibleEntities],
  )
  const selectedHighlight = useMemo(
    () => (selectedFeature ? collectionFromFeatures([selectedFeature]) : EMPTY_COLLECTION),
    [selectedFeature],
  )
  const renderedCount = visibleEntities.features.length

  const clearTooltipDelay = () => {
    if (tooltipDelayRef.current !== null) {
      window.clearTimeout(tooltipDelayRef.current)
      tooltipDelayRef.current = null
    }
  }

  useEffect(() => {
    return () => clearTooltipDelay()
  }, [])

  useEffect(() => {
    window.localStorage.setItem('cadVectorVisualMode', visualMode)
    window.localStorage.setItem('cadVectorVisualModeVersion', '2')
  }, [visualMode])

  const onEachFeature = (feature: CadVectorFeature, layer: Layer) => {
    const baseStyle = getFeatureStyle(
      feature,
      feature.properties.id === selectedFeatureId,
      viewPresetKey,
      visualMode,
      selectedFeatureRenderGroup,
    )
    const hoverStyle: PathOptions = {
      ...baseStyle,
      color: '#00cfe8',
      weight: Math.max(Number(baseStyle.weight ?? 0.6) + 1, 1.6),
      opacity: 1,
      fillOpacity: Math.max(Number(baseStyle.fillOpacity ?? 0.1), 0.18),
    }
    const isLabel =
      isCadTextFeature(feature) ||
      feature.properties.type === 'water_plant' ||
      feature.properties.type === 'raw_water_lake' ||
      feature.properties.type === 'main_work_candidate' ||
      feature.properties.curatedMainWork === true ||
      feature.properties.type === 'irrigation_label'
    const labelText = getFeatureDisplayName(feature)
    const allowFloatingTooltip =
      feature.properties.curatedMainWork === true ||
      feature.properties.type === 'water_plant' ||
      feature.properties.type === 'raw_water_lake' ||
      feature.properties.type === 'main_work_candidate'

    if (isLabel && shouldRenderCadLabel(feature, labelOptions) && !isLikelyMojibake(labelText)) {
      layer.bindTooltip(
        `<strong>${escapeHtml(labelText || feature.properties.name)}</strong>`,
        {
          permanent: true,
          direction: 'center',
          opacity: 0.88,
          interactive: false,
          className: 'cad-vector-label-tooltip',
        },
      )
    }

    layer.on({
      click: (event: LeafletMouseEvent) => {
        event.originalEvent.stopPropagation()
        if (positionUpdateTargetLabel && onCadCoordinateClick) {
          onCadCoordinateClick([event.latlng.lng, event.latlng.lat])
          return
        }
        onSelectFeature(feature)
      },
      mouseover: (event: LeafletMouseEvent) => {
        clearTooltipDelay()
        setPathStyle(layer, hoverStyle)
        setCircleRadius(layer, getPointRadiusForFeature(feature, selectedFeatureId) + 2)

        if (!allowFloatingTooltip) {
          return
        }

        const mousePosition = {
          clientX: event.originalEvent.clientX,
          clientY: event.originalEvent.clientY,
        }
        lastTooltipMoveRef.current = mousePosition
        const mapContainerRect = containerRef.current?.getBoundingClientRect() ?? null

        setTooltipState({
          feature,
          mousePosition,
          mapContainerRect,
          visible: false,
        })
        tooltipDelayRef.current = window.setTimeout(() => {
          setTooltipState({
            feature,
            mousePosition,
            mapContainerRect,
            visible: true,
          })
        }, 120)
      },
      mousemove: (event: LeafletMouseEvent) => {
        if (!allowFloatingTooltip) {
          return
        }

        const mousePosition = {
          clientX: event.originalEvent.clientX,
          clientY: event.originalEvent.clientY,
        }
        const lastPosition = lastTooltipMoveRef.current
        if (
          lastPosition &&
          Math.abs(lastPosition.clientX - mousePosition.clientX) < 8 &&
          Math.abs(lastPosition.clientY - mousePosition.clientY) < 8
        ) {
          return
        }
        lastTooltipMoveRef.current = mousePosition
        const mapContainerRect = containerRef.current?.getBoundingClientRect() ?? null

        setTooltipState((prev) => ({
          feature,
          mousePosition,
          mapContainerRect,
          visible: prev.visible && prev.feature?.properties.id === feature.properties.id,
        }))
      },
      mouseout: () => {
        clearTooltipDelay()
        lastTooltipMoveRef.current = null
        setPathStyle(layer, baseStyle)
        setCircleRadius(layer, getPointRadiusForFeature(feature, selectedFeatureId))
        if (allowFloatingTooltip) {
          setTooltipState((prev) => ({
            ...prev,
            visible: false,
            feature: null,
          }))
        }
      },
    })
  }

  const pointToLayer = (feature: Feature, latlng: LatLngExpression) => {
    const cadFeature = feature as CadVectorFeature
    const properties = cadFeature.properties

    return new LeafletCircleMarker(latlng, {
      ...getFeatureStyle(
        cadFeature,
        properties.id === selectedFeatureId,
        viewPresetKey,
        visualMode,
        selectedFeatureRenderGroup,
      ),
      radius: getPointRadiusForFeature(cadFeature, selectedFeatureId),
    })
  }

  const selectedHaloPointToLayer = (feature: Feature, latlng: LatLngExpression) => {
    const cadFeature = feature as CadVectorFeature
    const group = getFeatureRenderGroup(cadFeature)
    const radius = group === 'waterPlant' || group === 'rawWaterLake' || group === 'mainWorkCandidate' ? 18 : 11

    return new LeafletCircleMarker(latlng, {
      ...getSelectedHaloStyle(cadFeature, visualMode),
      radius,
    })
  }

  const handlePrintPdf = () => {
    setShowLegend(true)
    setPrintVersion((value) => value + 1)
    const previousTitle = document.title
    const restoreTitle = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }

    document.title = 'WebGIS Cap Nuoc'
    window.addEventListener('afterprint', restoreTitle)
    window.setTimeout(() => {
      window.print()
      window.setTimeout(restoreTitle, 1200)
    }, 360)
  }

  if (loading) {
    return (
      <div className="panel flex h-full min-h-[580px] items-center justify-center bg-[#0f172a] p-6 text-center text-white">
        <div>
          <Route className="mx-auto mb-3 size-8 animate-pulse text-sky-300" />
          <p className="text-base font-semibold">Đang tải CAD Vector...</p>
          <p className="mt-1 text-sm text-slate-300">Đọc GeoJSON thật từ QGIS trong public/data/cad-vector</p>
        </div>
      </div>
    )
  }

  if (!data?.hasCadVectorData || !bounds) {
    return (
      <div className="panel flex h-full min-h-[580px] items-center justify-center bg-[#0f172a] p-6 text-center text-white">
        <div className="max-w-md rounded-xl border border-slate-700 bg-slate-900/80 p-5">
          <AlertTriangle className="mx-auto mb-3 size-8 text-amber-300" />
          <p className="text-base font-semibold">Chưa có dữ liệu CAD Vector</p>
          <p className="mt-2 text-sm text-slate-300">
            Hãy đặt GeoJSON vào source-data/converted/geojson và chạy npm run normalize:cad-vector.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="cad-print-root panel relative h-full min-h-[580px] overflow-hidden bg-white">
      <div className="cad-print-sheet hidden">
        <header className="cad-print-header">
          <div>
            <p className="cad-print-kicker">WEBGIS HỆ THỐNG CẤP NƯỚC</p>
            <h1>Bản đồ WebGIS hệ thống cấp nước</h1>
          </div>
          <div className="cad-print-meta">
            <span>Chế độ: {viewPresetLabel}</span>
            <span>{new Date().toLocaleString('vi-VN')}</span>
            <span>{renderedCount.toLocaleString('vi-VN')} feature hiển thị</span>
          </div>
        </header>

        <section className="cad-print-map-frame">
          <svg
            className="cad-print-svg-map"
            viewBox={`0 0 ${PRINT_SVG_WIDTH} ${PRINT_SVG_HEIGHT}`}
            role="img"
            aria-label="Bản đồ WebGIS hệ thống cấp nước"
          >
            <rect width={PRINT_SVG_WIDTH} height={PRINT_SVG_HEIGHT} fill={getPrintBackgroundFill(visualMode)} />
            {printSvgShapes.map((shape) =>
              shape.kind === 'circle' ? (
                <circle
                  key={shape.key}
                  cx={shape.cx}
                  cy={shape.cy}
                  r={shape.r}
                  stroke={shape.stroke}
                  strokeWidth={shape.strokeWidth}
                  fill={shape.fill}
                  opacity={shape.opacity}
                  fillOpacity={shape.fillOpacity}
                />
              ) : (
                <path
                  key={shape.key}
                  d={shape.d}
                  stroke={shape.stroke}
                  strokeWidth={shape.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={shape.dashArray}
                  fill={shape.fill}
                  opacity={shape.opacity}
                  fillOpacity={shape.fillOpacity}
                />
              ),
            )}
            {printSvgLabels.map((label) => (
              <text
                key={label.key}
                x={label.x}
                y={label.y}
                fontSize="22"
                fontWeight="700"
                fill="#334155"
                stroke="#ffffff"
                strokeWidth="5"
                paintOrder="stroke"
              >
                {label.text}
              </text>
            ))}
          </svg>
        </section>

        <footer className="cad-print-footer">
          <div className="cad-print-legend">
            <span><i style={{ backgroundColor: '#f97316' }} /> Nhà máy nước</span>
            <span><i style={{ backgroundColor: '#8b5cf6' }} /> Hồ nước thô</span>
            <span><b style={{ backgroundColor: '#2563eb' }} /> Tuyến ống cấp nước</span>
            <span><b style={{ backgroundColor: '#16a34a' }} /> Kênh/thủy lợi</span>
            <span><b style={{ backgroundColor: '#64748b' }} /> Nền CAD gốc</span>
          </div>
          <div className="cad-print-sources">
            Nguồn: BIWASE_HIEN TRANG.dwg; HTCN PMV.dwg; Ban do khu tuoi duc hoa cap nhat moi 19 7 2014.dwg.
            Quy trình: DWG -&gt; DXF -&gt; QGIS -&gt; GeoJSON -&gt; CAD Vector WebGIS.
          </div>
        </footer>
      </div>

      <div className="cad-print-summary hidden p-4">
        <h1 className="text-xl font-bold text-slate-900">Bản đồ WebGIS hệ thống cấp nước</h1>
        <p className="mt-1 text-sm text-slate-700">Chế độ xem hiện tại: {viewPresetLabel}</p>
        <p className="text-sm text-slate-700">Thời gian xuất: {new Date().toLocaleString('vi-VN')}</p>
        <p className="mt-2 text-sm font-semibold text-slate-800">Nguồn dữ liệu</p>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>BIWASE_HIEN TRANG.dwg</li>
          <li>HTCN PMV.dwg</li>
          <li>Ban do khu tuoi duc hoa cap nhat moi 19 7 2014.dwg</li>
          <li>Quy trình: DWG → ODA DXF → QGIS → GeoJSON → CAD Vector WebGIS</li>
        </ul>
      </div>

      <div className="hidden">
        <h1 className="text-xl font-bold text-slate-900">Bản đồ WebGIS hệ thống cấp nước</h1>
        <p className="mt-1 text-sm text-slate-700">Chế độ xem hiện tại: {viewPresetLabel}</p>
        <p className="text-sm text-slate-700">Thời gian xuất: {new Date().toLocaleString('vi-VN')}</p>
        <p className="mt-2 text-sm font-semibold text-slate-800">Nguồn dữ liệu</p>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>BIWASE_HIEN TRANG.dwg</li>
          <li>HTCN PMV.dwg</li>
          <li>Ban do khu tuoi duc hoa cap nhat moi 19 7 2014.dwg</li>
          <li>Quy trình: DWG → ODA DXF → QGIS → GeoJSON → CAD Vector WebGIS</li>
        </ul>
      </div>

      <div className="hidden">
        <h1 className="text-xl font-bold text-slate-900">Bản đồ WebGIS hệ thống cấp nước</h1>
        <p className="mt-1 text-sm text-slate-700">Chế độ xem hiện tại: {viewPresetLabel}</p>
        <p className="text-sm text-slate-700">Thời gian xuất: {new Date().toLocaleString('vi-VN')}</p>
        <p className="mt-2 text-sm font-semibold text-slate-800">Nguồn dữ liệu</p>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>BIWASE_HIEN TRANG.dwg</li>
          <li>HTCN PMV.dwg</li>
          <li>Ban do khu tuoi duc hoa cap nhat moi 19 7 2014.dwg</li>
          <li>Quy trình: DWG → ODA DXF → QGIS → GeoJSON → CAD Vector WebGIS</li>
        </ul>
      </div>

      <div className="cad-print-map-frame hidden">
        <svg
          className="cad-print-svg-map"
          viewBox={`0 0 ${PRINT_SVG_WIDTH} ${PRINT_SVG_HEIGHT}`}
          role="img"
          aria-label="Bản đồ WebGIS hệ thống cấp nước"
        >
          <rect width={PRINT_SVG_WIDTH} height={PRINT_SVG_HEIGHT} fill={getPrintBackgroundFill(visualMode)} />
          {printSvgShapes.map((shape) =>
            shape.kind === 'circle' ? (
              <circle
                key={shape.key}
                cx={shape.cx}
                cy={shape.cy}
                r={shape.r}
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth}
                fill={shape.fill}
                opacity={shape.opacity}
                fillOpacity={shape.fillOpacity}
              />
            ) : (
              <path
                key={shape.key}
                d={shape.d}
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={shape.dashArray}
                fill={shape.fill}
                opacity={shape.opacity}
                fillOpacity={shape.fillOpacity}
              />
            ),
          )}
          {printSvgLabels.map((label) => (
            <text
              key={label.key}
              x={label.x}
              y={label.y}
              fontSize="18"
              fontWeight="700"
              fill="#334155"
              stroke="#ffffff"
              strokeWidth="4"
              paintOrder="stroke"
            >
              {label.text}
            </text>
          ))}
        </svg>
        <div className="cad-print-legend">
          <span><i style={{ backgroundColor: '#f97316' }} /> Nhà máy nước</span>
          <span><i style={{ backgroundColor: '#8b5cf6' }} /> Hồ nước thô</span>
          <span><b style={{ backgroundColor: '#2563eb' }} /> Tuyến ống cấp nước</span>
          <span><b style={{ backgroundColor: '#16a34a' }} /> Kênh/thủy lợi</span>
          <span><b style={{ backgroundColor: '#64748b' }} /> Nền CAD gốc</span>
        </div>
      </div>

      <div className="cad-no-print absolute left-4 top-4 z-[1100] flex flex-wrap gap-2">
        <button type="button" onClick={() => setResetVersion((value) => value + 1)} className="ghost-btn h-9 px-3">
          <Maximize2 className="mr-2 size-4" />
          Fit bản đồ CAD
        </button>
        <button
          type="button"
          onClick={() => selectedFeature && setSelectedZoomVersion((value) => value + 1)}
          disabled={!selectedFeature}
          className="ghost-btn h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LocateFixed className="mr-2 size-4" />
          Zoom tới đối tượng
        </button>
        <button type="button" onClick={handlePrintPdf} className="ghost-btn h-9 px-3">
          Xuất PDF
        </button>
        <div className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white/95 px-2 text-xs font-semibold text-slate-700 shadow-sm">
          <Layers2 className="size-4 text-water-700" />
          <span className="hidden sm:inline">Nền</span>
          {CAD_VISUAL_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              title={mode.description}
              onClick={() => setVisualMode(mode.key)}
              className={`rounded-md px-2 py-1 transition ${
                visualMode === mode.key
                  ? 'bg-water-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-water-50 hover:text-water-800'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {positionUpdateTargetLabel && (
        <div className="cad-no-print absolute left-1/2 top-16 z-[1100] max-w-md -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg">
          Đang cập nhật vị trí: {positionUpdateTargetLabel}. Click lên bản đồ CAD để lưu tọa độ.
        </div>
      )}

      <div className="cad-no-print absolute right-4 top-4 z-[800] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
        CAD Vector: dữ liệu thật từ QGIS | {data.metadata?.totalFeatures ?? 0} feature | {data.layerIndex.length} layer
      </div>

      <div className="cad-no-print absolute bottom-4 left-4 z-[800] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm">
        Đang hiển thị {renderedCount.toLocaleString('vi-VN')} feature
        {!labelOptions.showAllLabels && !labelOptions.showDiameterLabels && !labelOptions.showLocationLabels && (
          <span className="ml-2 text-slate-400">Nhãn CAD đang tắt</span>
        )}
      </div>

      {renderedCount === 0 && (
        <div className="cad-no-print pointer-events-none absolute left-1/2 top-1/2 z-[900] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm text-amber-900 shadow-lg">
          Chế độ xem hiện tại chưa có dữ liệu hiển thị. Hãy bật thêm nền CAD hoặc đổi chế độ xem.
        </div>
      )}

      <CadLegend
        visible={showLegend}
        visibleLayers={visibleLayers}
        labelOptions={labelOptions}
        visualMode={visualMode}
        onToggle={() => setShowLegend((value) => !value)}
      />

      <MapContainer
        crs={CRS.Simple}
        center={[0, 0]}
        zoom={-4}
        minZoom={-8}
        maxZoom={5}
        scrollWheelZoom
        preferCanvas
        attributionControl={false}
        className={`cad-vector-leaflet cad-visual-${visualMode} h-full w-full`}
      >
        <GeoJSON
          key={`cad-base-bg-${geoJsonRenderKey}`}
          data={cadBaseBackground as never}
          style={(feature) =>
            getFeatureStyle(
              feature as CadVectorFeature,
              feature?.properties?.id === selectedFeatureId,
              viewPresetKey,
              visualMode,
              selectedFeatureRenderGroup,
            )
          }
          interactive={false}
        />
        <GeoJSON
          key={`pipeline-halo-${geoJsonRenderKey}`}
          data={pipelineHalo as never}
          style={() => getPipelineHaloStyle(visualMode)}
          interactive={false}
        />
        <GeoJSON
          key={`cad-base-main-${geoJsonRenderKey}`}
          data={cadBaseMain as never}
          style={(feature) =>
            getFeatureStyle(
              feature as CadVectorFeature,
              feature?.properties?.id === selectedFeatureId,
              viewPresetKey,
              visualMode,
              selectedFeatureRenderGroup,
            )
          }
          pointToLayer={pointToLayer}
          onEachFeature={(feature, layer) => onEachFeature(feature as CadVectorFeature, layer)}
        />
        <GeoJSON
          key={`irrigation-halo-${geoJsonRenderKey}`}
          data={irrigationHalo as never}
          style={() => getIrrigationHaloStyle(visualMode)}
          interactive={false}
        />
        <GeoJSON
          key={`irrigation-${geoJsonRenderKey}`}
          data={irrigation as never}
          style={(feature) =>
            getFeatureStyle(
              feature as CadVectorFeature,
              feature?.properties?.id === selectedFeatureId,
              viewPresetKey,
              visualMode,
              selectedFeatureRenderGroup,
            )
          }
          pointToLayer={pointToLayer}
          onEachFeature={(feature, layer) => onEachFeature(feature as CadVectorFeature, layer)}
        />
        <GeoJSON
          key={`main-works-${geoJsonRenderKey}`}
          data={mainWorks as never}
          style={(feature) =>
            getFeatureStyle(
              feature as CadVectorFeature,
              feature?.properties?.id === selectedFeatureId,
              viewPresetKey,
              visualMode,
              selectedFeatureRenderGroup,
            )
          }
          pointToLayer={pointToLayer}
          interactive={false}
        />
        <GeoJSON
          key={`selected-halo-${geoJsonRenderKey}-${selectedFeatureId ?? 'none'}`}
          data={selectedHighlight as never}
          style={(feature) => getSelectedHaloStyle(feature as CadVectorFeature, visualMode)}
          pointToLayer={selectedHaloPointToLayer}
          interactive={false}
        />
        <GeoJSON
          key={`curated-main-works-${geoJsonRenderKey}`}
          data={curatedMainWorks as never}
          style={(feature) =>
            getFeatureStyle(
              feature as CadVectorFeature,
              feature?.properties?.id === selectedFeatureId,
              viewPresetKey,
              visualMode,
              selectedFeatureRenderGroup,
            )
          }
          pointToLayer={pointToLayer}
          onEachFeature={(feature, layer) => onEachFeature(feature as CadVectorFeature, layer)}
        />
        <CadVectorController
          bounds={bounds}
          selectedFeature={selectedFeature}
          focusVersion={focusVersion + selectedZoomVersion}
          resetVersion={resetVersion + fitVersion}
          printVersion={printVersion}
          viewPresetKey={viewPresetKey}
        />
        <CadVectorClickController
          enabled={Boolean(positionUpdateTargetLabel)}
          onCadCoordinateClick={onCadCoordinateClick}
        />
      </MapContainer>

      <FloatingFeatureTooltip
        feature={tooltipState.feature}
        mousePosition={tooltipState.mousePosition}
        mapContainerRect={tooltipState.mapContainerRect}
        visible={tooltipState.visible}
      />
    </div>
  )
}

import { useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  Droplets,
  Eye,
  Factory,
  FileImage,
  Filter,
  FolderTree,
  Globe,
  Layers,
  MapPin,
  Route,
  SlidersHorizontal,
  Tag,
  Waves,
} from 'lucide-react'
import type {
  AssetStatus,
  CadVectorData,
  CadVectorLayerIndexItem,
  CadVectorType,
  DataSourceState,
  LayerKey,
  MapMode,
} from '../../types/gis'
import type { CuratedMainWork } from '../../data/curatedMainWorks'
import { CAD_LAYOUT_OPTIONS } from '../../data/cadLayoutOptions'
import { LAYER_COLORS, LAYER_LABELS } from '../../utils/asset'
import { ASSET_STATUS_META } from '../../utils/status'
import { cadVectorTypeLabelForUi, type CadLabelVisibilityOptions } from '../../utils/textUtils'

export type CadVectorGroupKey =
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

export type CadVectorViewPresetKey =
  | 'overview'
  | 'water_plants'
  | 'raw_water_lakes'
  | 'irrigation_system'

export interface CadVectorLayerGroup {
  key: CadVectorGroupKey
  label: string
  description: string
  featureCount: number
  layers: CadVectorLayerIndexItem[]
  defaultExpanded: boolean
}

export interface LayerVisibilityState {
  waterPlant: boolean
  rawWaterLakes: boolean
  pipelines: boolean
  canals: boolean
  supplyZones: boolean
  boundaries: boolean
  labels: boolean
  incidents: boolean
}

export interface CadViewPresetSummary {
  key: CadVectorViewPresetKey
  label: string
  description: string
}

export interface LayerSidebarProps {
  collapsed: boolean
  onToggle: () => void
  visibleLayers: LayerVisibilityState
  onToggleLayer: (key: LayerKey) => void
  onSetAllLayers?: (visible: boolean) => void
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
  cadVectorViewPresets: CadViewPresetSummary[]
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
  cadBaseLayerKey: string
  cadCuratedMainWorksLayerKey: string
  cadTypeFilters: Array<{ value: CadVectorType | 'all'; label: string }>
}

type SidebarTab = 'layers' | 'cadGroups' | 'advanced'

const CAD_LAYER_KEYS: Array<Exclude<LayerKey, 'incidents'>> = [
  'waterPlant',
  'rawWaterLakes',
  'pipelines',
  'canals',
  'supplyZones',
  'boundaries',
  'labels',
]

const STATUS_FILTER_PILLS: Array<{
  value: 'all' | AssetStatus
  label: string
  dotClass: string
}> = [
  { value: 'all', label: 'Tất cả', dotClass: 'bg-water-500' },
  { value: 'active', label: ASSET_STATUS_META.active.label, dotClass: 'bg-emerald-500' },
  { value: 'maintenance', label: ASSET_STATUS_META.maintenance.label, dotClass: 'bg-amber-500' },
  { value: 'need_inspection', label: ASSET_STATUS_META.need_inspection.label, dotClass: 'bg-orange-500' },
  { value: 'pending_data', label: ASSET_STATUS_META.pending_data.label, dotClass: 'bg-slate-400' },
]

const PRESET_META: Record<
  CadVectorViewPresetKey,
  { icon: typeof Compass; dotClass: string; activeClass: string }
> = {
  overview: {
    icon: Compass,
    dotClass: 'bg-sky-500',
    activeClass: 'border-sky-400 bg-sky-50 text-sky-900 ring-1 ring-sky-200',
  },
  water_plants: {
    icon: Factory,
    dotClass: 'bg-orange-500',
    activeClass: 'border-orange-300 bg-orange-50 text-orange-900 ring-1 ring-orange-200',
  },
  raw_water_lakes: {
    icon: Waves,
    dotClass: 'bg-violet-500',
    activeClass: 'border-violet-300 bg-violet-50 text-violet-900 ring-1 ring-violet-200',
  },
  irrigation_system: {
    icon: Droplets,
    dotClass: 'bg-emerald-500',
    activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200',
  },
}

const GROUP_ACCENT_STYLE: Record<
  CadVectorGroupKey,
  { dotClass: string; borderClass: string; badgeClass: string }
> = {
  curatedMainWorks: {
    dotClass: 'bg-emerald-500',
    borderClass: 'border-l-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700',
  },
  waterPlants: {
    dotClass: 'bg-orange-500',
    borderClass: 'border-l-orange-500',
    badgeClass: 'bg-orange-50 text-orange-700',
  },
  rawWaterLakes: {
    dotClass: 'bg-violet-500',
    borderClass: 'border-l-violet-500',
    badgeClass: 'bg-violet-50 text-violet-700',
  },
  pipeline: {
    dotClass: 'bg-blue-600',
    borderClass: 'border-l-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700',
  },
  irrigation: {
    dotClass: 'bg-teal-600',
    borderClass: 'border-l-teal-600',
    badgeClass: 'bg-teal-50 text-teal-700',
  },
  diameterLabels: {
    dotClass: 'bg-indigo-500',
    borderClass: 'border-l-indigo-500',
    badgeClass: 'bg-indigo-50 text-indigo-700',
  },
  boundary: {
    dotClass: 'bg-slate-600',
    borderClass: 'border-l-slate-500',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
  background: {
    dotClass: 'bg-slate-400',
    borderClass: 'border-l-slate-400',
    badgeClass: 'bg-slate-100 text-slate-600',
  },
  htcnContext: {
    dotClass: 'bg-amber-500',
    borderClass: 'border-l-amber-400',
    badgeClass: 'bg-amber-50 text-amber-700',
  },
  layoutArtifact: {
    dotClass: 'bg-zinc-400',
    borderClass: 'border-l-zinc-400',
    badgeClass: 'bg-zinc-100 text-zinc-600',
  },
  unclassified: {
    dotClass: 'bg-slate-300',
    borderClass: 'border-l-slate-300',
    badgeClass: 'bg-slate-100 text-slate-600',
  },
}

function ToggleSwitch({
  checked,
  disabled = false,
  accentClass = 'bg-water-600',
  onChange,
  ariaLabel,
}: {
  checked: boolean
  disabled?: boolean
  accentClass?: string
  onChange: (next: boolean) => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onChange(!checked)
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-water-400 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? `${accentClass} border-transparent`
          : 'border-slate-300 bg-slate-200'
      }`}
    >
      <span
        className={`inline-block size-3.5 transform rounded-full bg-white shadow-sm transition ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function getLayerSourceBadge(
  dataSource: DataSourceState | null,
  layerKey: Exclude<LayerKey, 'incidents'>,
  cadImageLoaded: boolean,
): { text: string; dotClass: string; badgeClass: string } {
  const meta = dataSource?.layers[layerKey]

  if (meta?.status === 'cad_loaded' || meta?.status === 'api_loaded') {
    return {
      text: `${meta.featureCount} đối tượng`,
      dotClass: 'bg-emerald-500',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  if (cadImageLoaded) {
    return {
      text: 'Overlay ảnh CAD',
      dotClass: 'bg-sky-500',
      badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    }
  }

  if (meta?.status === 'cad_error' || meta?.status === 'api_error') {
    return {
      text: 'Dữ liệu dự phòng',
      dotClass: 'bg-amber-500',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  return {
    text: meta ? `${meta.featureCount} mẫu` : 'Chờ dữ liệu',
    dotClass: 'bg-slate-400',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
  }
}

export function LayerSidebar({
  collapsed,
  onToggle,
  visibleLayers,
  onToggleLayer,
  onSetAllLayers,
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
  cadVectorViewPresets,
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
  cadBaseLayerKey,
  cadCuratedMainWorksLayerKey,
  cadTypeFilters,
}: LayerSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('layers')

  const hasCadVectorData = Boolean(cadVectorData?.hasCadVectorData)
  const effectiveTab: SidebarTab =
    mapMode !== 'cadVector' && activeTab === 'cadGroups' ? 'layers' : activeTab

  const getCadVectorGroupLayerNames = (groupKey: CadVectorGroupKey) =>
    cadVectorLayerGroups
      .find((group) => group.key === groupKey)
      ?.layers.map((layer) => layer.layerKey ?? layer.layerName) ?? []

  const isCadVectorGroupVisible = (groupKey: CadVectorGroupKey) => {
    const layerNames = getCadVectorGroupLayerNames(groupKey)
    return layerNames.length > 0 && layerNames.some((layerName) => cadVectorVisibleLayers[layerName] !== false)
  }

  const primaryLayerKeys: LayerKey[] = [
    'incidents',
    'waterPlant',
    'rawWaterLakes',
    'pipelines',
    'canals',
    'supplyZones',
  ]
  const secondaryLayerKeys: LayerKey[] = ['boundaries', 'labels']

  const visiblePrimaryCount = primaryLayerKeys.filter((key) => visibleLayers[key]).length
  const visibleCadMainCount = [
    cadVectorVisibleLayers[cadBaseLayerKey] !== false,
    cadVectorVisibleLayers[cadCuratedMainWorksLayerKey] !== false,
    isCadVectorGroupVisible('pipeline'),
    isCadVectorGroupVisible('irrigation'),
  ].filter(Boolean).length

  const mapModeBadge =
    mapMode === 'cadVector'
      ? { label: 'CAD Vector', className: 'border-sky-200 bg-sky-50 text-sky-800' }
      : mapMode === 'osm'
        ? { label: 'Bản đồ số', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
        : { label: 'Tham chiếu', className: 'border-amber-200 bg-amber-50 text-amber-800' }

  const handleQuickJumpTab = (tab: SidebarTab) => {
    setActiveTab(tab)
    if (collapsed) onToggle()
  }

  const renderOsmLayerRow = (key: LayerKey) => {
    const isIncident = key === 'incidents'
    const active = visibleLayers[key]
    return (
      <div
        key={key}
        onClick={() => onToggleLayer(key)}
        className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium transition ${
          isIncident
            ? active
              ? 'border-rose-200 bg-rose-50/75 text-rose-900 shadow-sm'
              : 'border-rose-100 bg-rose-50/25 text-slate-600 hover:bg-rose-50/50'
            : active
              ? 'border-slate-200/90 bg-white text-slate-800 shadow-sm'
              : 'border-transparent bg-slate-50/70 text-slate-500 hover:border-slate-200 hover:bg-white'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`size-2.5 shrink-0 rounded-full ring-2 ring-white ${isIncident && active ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: LAYER_COLORS[key] }}
          />
          <span className="truncate font-semibold">{LAYER_LABELS[key]}</span>
          {isIncident && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
              <AlertTriangle className="size-2.5" />
              Ưu tiên
            </span>
          )}
        </span>
        <ToggleSwitch
          checked={active}
          accentClass={isIncident ? 'bg-rose-600' : 'bg-water-600'}
          onChange={() => onToggleLayer(key)}
          ariaLabel={`Bật tắt lớp ${LAYER_LABELS[key]}`}
        />
      </div>
    )
  }

  return (
    <aside
      aria-label="Lớp bản đồ"
      className={`${mapMode === 'cadVector' ? `cad-layer-sidebar${collapsed ? ' cad-sidebar-collapsed' : ''} ` : ''}fixed bottom-[68px] left-3 top-[92px] z-[1200] max-w-[calc(100vw-1.5rem)] shrink-0 md:bottom-3 lg:relative lg:inset-auto lg:z-auto lg:max-w-none ${
        collapsed ? 'w-[52px]' : 'w-[308px] xl:w-[316px]'
      }`}
    >
      <div className="panel flex h-full flex-col overflow-hidden border-slate-200/90 shadow-sm">
        {/* Sidebar Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-gradient-to-r from-water-50/85 via-white to-slate-50 px-3 py-2.5">
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-water-600 text-white shadow-sm">
                <Layers className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">Lớp bản đồ</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${mapModeBadge.className}`}>
                {mapModeBadge.label}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Mở lớp bản đồ' : 'Thu gọn lớp bản đồ'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Mở bảng lớp bản đồ' : 'Thu gọn bảng lớp bản đồ'}
            className="ghost-btn !h-8 !w-8 !rounded-lg !p-0"
          >
            {collapsed ? <Layers className="size-4 text-water-700" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>

        {/* Collapsed Mini Rail */}
        {collapsed && (
          <div className="flex flex-1 flex-col items-center gap-2 py-3">
            <button
              type="button"
              onClick={() => handleQuickJumpTab('layers')}
              title="Lớp & Bộ lọc"
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-water-700 shadow-sm hover:bg-water-50"
            >
              <Filter className="size-4" />
            </button>
            {mapMode === 'cadVector' && (
              <button
                type="button"
                onClick={() => handleQuickJumpTab('cadGroups')}
                title="Nhóm lớp CAD"
                className="flex size-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100"
              >
                <FolderTree className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleQuickJumpTab('advanced')}
              title="Cấu hình nâng cao"
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
        )}

        {/* Expanded Body */}
        {!collapsed && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Pinned Top Section: Chế độ xem */}
            <div className="shrink-0 space-y-2.5 border-b border-slate-200/80 bg-gradient-to-b from-water-50/40 to-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-water-800">
                  Chế độ xem
                </span>
                {mapMode !== 'cadVector' && <span className="text-[11px] font-medium text-slate-400">Chuyển đổi nhanh</span>}
              </div>

              {/* 3 Main Map Modes */}
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200/90 bg-slate-100/80 p-1">
                <button
                  type="button"
                  onClick={onOpenCadVectorMap}
                  className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                    mapMode === 'cadVector'
                      ? 'bg-water-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  <Compass className="size-3.5" />
                  <span>CAD</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenOsm}
                  className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                    mapMode === 'osm'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  <Globe className="size-3.5" />
                  <span>Bản đồ số</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenCadImage}
                  className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                    mapMode === 'cadImage' || mapMode === 'layoutPreview'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  <FileImage className="size-3.5" />
                  <span>Tham chiếu</span>
                </button>
              </div>

              {/* CAD Presets when in cadVector */}
              {mapMode === 'cadVector' && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    {cadVectorViewPresets.map((preset) => {
                      const meta = PRESET_META[preset.key]
                      const PresetIcon = meta.icon
                      const active = cadVectorViewPreset === preset.key
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => onCadVectorViewPresetChange(preset.key)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs font-semibold transition ${
                            active
                              ? meta.activeClass
                              : 'border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`size-2 shrink-0 rounded-full ${meta.dotClass}`} />
                          <PresetIcon className="size-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{preset.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Quick reference switcher when in cadImage / layoutPreview */}
              {(mapMode === 'cadImage' || mapMode === 'layoutPreview') && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={onOpenCadImage}
                    className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                      mapMode === 'cadImage'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Ảnh CAD tham chiếu</span>
                    <span className="text-[10px] font-medium opacity-75">PNG</span>
                  </button>
                  {CAD_LAYOUT_OPTIONS.map((layout) => (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => onSelectLayoutPreview(layout.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                        mapMode === 'layoutPreview' && selectedLayoutId === layout.id
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{layout.label}</span>
                      <span className="shrink-0 text-[10px] font-medium opacity-75">Layout</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Section Tabs */}
            <div
              role="tablist"
              aria-label="Phân mục điều khiển lớp bản đồ"
              className={`grid shrink-0 border-b border-slate-200 bg-slate-50/70 px-2 pt-1.5 ${
                mapMode === 'cadVector' ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={effectiveTab === 'layers'}
                onClick={() => setActiveTab('layers')}
                className={`border-b-2 px-1.5 py-2 text-xs font-bold transition ${
                  effectiveTab === 'layers'
                    ? 'border-water-600 text-water-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {mapMode === 'cadVector' ? 'Lớp & Nhãn' : 'Lớp & Lọc'}
              </button>
              {mapMode === 'cadVector' && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={effectiveTab === 'cadGroups'}
                  onClick={() => setActiveTab('cadGroups')}
                  className={`border-b-2 px-1.5 py-2 text-xs font-bold transition ${
                    effectiveTab === 'cadGroups'
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Nhóm CAD
                </button>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={effectiveTab === 'advanced'}
                onClick={() => setActiveTab('advanced')}
                className={`border-b-2 px-1.5 py-2 text-xs font-bold transition ${
                  effectiveTab === 'advanced'
                    ? 'border-slate-700 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Nâng cao
              </button>
            </div>

            {/* Scrollable Tab Content */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {/* TAB 1: LỚP, BỘ LỌC & NHÃN */}
              {effectiveTab === 'layers' && (
                <>
                  {mapMode === 'cadVector' ? (
                    <>
                      {/* Bật/tắt lớp chính CAD */}
                      <section className="cad-layer-section space-y-2 rounded-xl border border-slate-200/80 bg-white p-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            Lớp dữ liệu
                          </span>
                          <span className="rounded-full bg-water-50 px-2 py-0.5 text-[10px] font-bold text-water-800">
                            {visibleCadMainCount}/4 lớp
                          </span>
                        </div>

                        {!hasCadVectorData && (
                          <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                            Chưa có dữ liệu CAD Vector.
                          </p>
                        )}

                        <div className="space-y-1.5">
                          {/* Công trình chính - highlighted */}
                          <div
                            onClick={() => onToggleCadVectorLayer(cadCuratedMainWorksLayerKey)}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                              cadVectorVisibleLayers[cadCuratedMainWorksLayerKey] !== false
                                ? 'border-emerald-200 bg-emerald-50/75 text-emerald-900 shadow-sm'
                                : 'border-slate-200 bg-slate-50/60 text-slate-500'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="size-2.5 rounded-full bg-emerald-600" />
                              <span>Công trình chính</span>
                            </span>
                            <ToggleSwitch
                              checked={cadVectorVisibleLayers[cadCuratedMainWorksLayerKey] !== false}
                              accentClass="bg-emerald-600"
                              onChange={() => onToggleCadVectorLayer(cadCuratedMainWorksLayerKey)}
                              ariaLabel="Bật tắt lớp Công trình chính"
                            />
                          </div>

                          {/* Tuyến ống & Kênh thủy lợi */}
                          {(
                            [
                              ['pipeline', 'Tuyến ống cấp nước', 'bg-blue-600', 'bg-blue-600'],
                              ['irrigation', 'Kênh/thủy lợi', 'bg-teal-600', 'bg-teal-600'],
                            ] as const
                          ).map(([key, label, dotClass, switchClass]) => {
                            const layerNames = getCadVectorGroupLayerNames(key)
                            const checked = isCadVectorGroupVisible(key)
                            return (
                              <div
                                key={key}
                                onClick={() => {
                                  if (layerNames.length > 0) onSetCadVectorLayers(layerNames, !checked)
                                }}
                                className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                                  checked
                                    ? 'border-slate-200 bg-white text-slate-800 shadow-sm'
                                    : 'border-transparent bg-slate-50/70 text-slate-500 hover:border-slate-200'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={`size-2.5 rounded-full ${dotClass}`} />
                                  <span>{label}</span>
                                </span>
                                <ToggleSwitch
                                  checked={checked}
                                  disabled={layerNames.length === 0}
                                  accentClass={switchClass}
                                  onChange={(next) => onSetCadVectorLayers(layerNames, next)}
                                  ariaLabel={`Bật tắt lớp ${label}`}
                                />
                              </div>
                            )
                          })}

                          {/* Nền CAD - muted secondary */}
                          <div
                            onClick={() => onToggleCadVectorLayer(cadBaseLayerKey)}
                            className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-200"
                          >
                            <span className="flex items-center gap-2">
                              <span className="size-2.5 rounded-full bg-slate-400" />
                              <span>Nền CAD tham chiếu</span>
                            </span>
                            <ToggleSwitch
                              checked={cadVectorVisibleLayers[cadBaseLayerKey] !== false}
                              accentClass="bg-slate-600"
                              onChange={() => onToggleCadVectorLayer(cadBaseLayerKey)}
                              ariaLabel="Bật tắt lớp Nền CAD"
                            />
                          </div>
                        </div>
                      </section>

                      {/* Nhãn hiển thị - Violet accent */}
                      <section className="cad-layer-section space-y-2 rounded-xl border border-violet-200/80 bg-violet-50/35 p-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-900">
                            <Tag className="size-3.5 text-violet-600" />
                            Nhãn hiển thị
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {(
                            [
                              ['showMainWorkLabels', 'Nhãn công trình chính'],
                              ['showDiameterLabels', 'Nhãn đường kính ống'],
                              ['hideCorruptedText', 'Ẩn text lỗi font'],
                            ] as const
                          ).map(([key, label]) => {
                            const checked = cadVectorLabelOptions[key]
                            return (
                              <div
                                key={key}
                                onClick={() => onCadVectorLabelOptionChange(key, !checked)}
                                className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-violet-200"
                              >
                                <span>{label}</span>
                                <ToggleSwitch
                                  checked={checked}
                                  accentClass="bg-violet-600"
                                  onChange={(next) => onCadVectorLabelOptionChange(key, next)}
                                  ariaLabel={label}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </section>

                      {/* Bộ lọc nhanh theo loại CAD */}
                      <section className="cad-layer-section space-y-2 rounded-xl border border-amber-200/70 bg-amber-50/30 p-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                            <Filter className="size-3.5 text-amber-600" />
                            Loại đối tượng
                          </span>
                          {cadVectorTypeFilter !== 'all' && (
                            <button
                              type="button"
                              onClick={() => onCadVectorTypeFilterChange('all')}
                              className="text-[11px] font-semibold text-amber-700 hover:underline"
                            >
                              Xóa lọc
                            </button>
                          )}
                        </div>
                        <select className="field-input !text-xs" aria-label="Loại đối tượng CAD" value={cadVectorTypeFilter} onChange={(event) => onCadVectorTypeFilterChange(event.target.value as CadVectorType | 'all')}>
                          {cadTypeFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                        </select>
                      </section>
                    </>
                  ) : mapMode === 'layoutPreview' ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs leading-relaxed text-slate-500">
                      Đang xem bản vẽ Layout gốc. Chuyển sang <strong className="text-slate-700">CAD</strong> hoặc{' '}
                      <strong className="text-slate-700">Bản đồ số</strong> ở mục Chế độ xem để bật/tắt các lớp GIS.
                    </div>
                  ) : (
                    <>
                      {/* Bật/tắt lớp nghiệp vụ (OSM / CAD Image) */}
                      <section className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            Lớp nghiệp vụ chính
                          </span>
                          <div className="flex items-center gap-1.5">
                            {onSetAllLayers && visiblePrimaryCount < primaryLayerKeys.length && (
                              <button
                                type="button"
                                onClick={() => onSetAllLayers(true)}
                                className="text-[11px] font-semibold text-water-700 hover:underline"
                              >
                                Bật hết
                              </button>
                            )}
                            <span className="rounded-full bg-water-50 px-2 py-0.5 text-[10px] font-bold text-water-800">
                              {visiblePrimaryCount}/{primaryLayerKeys.length}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {primaryLayerKeys.map(renderOsmLayerRow)}
                        </div>
                      </section>

                      {/* Lớp phụ trợ: Ranh giới & Nhãn */}
                      <section className="space-y-1.5 rounded-xl border border-slate-200/70 bg-slate-50/60 p-2.5">
                        <span className="block px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Lớp phụ trợ &amp; Nhãn
                        </span>
                        {secondaryLayerKeys.map(renderOsmLayerRow)}
                      </section>

                      {/* Bộ lọc trạng thái */}
                      <section className="space-y-2 rounded-xl border border-amber-200/70 bg-amber-50/25 p-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                            <Filter className="size-3.5 text-amber-600" />
                            Bộ lọc trạng thái
                          </span>
                          {statusFilter !== 'all' && (
                            <button
                              type="button"
                              onClick={() => onStatusFilterChange('all')}
                              className="text-[11px] font-semibold text-amber-700 hover:underline"
                            >
                              Tất cả
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_FILTER_PILLS.map((pill) => {
                            const active = statusFilter === pill.value
                            return (
                              <button
                                key={pill.value}
                                type="button"
                                onClick={() => onStatusFilterChange(pill.value)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                  active
                                    ? 'border-water-500 bg-water-600 text-white shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <span
                                  className={`size-1.5 rounded-full ${active ? 'bg-white' : pill.dotClass}`}
                                />
                                <span>{pill.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    </>
                  )}
                </>
              )}

              {/* TAB 2: NHÓM LỚP CAD & CÔNG TRÌNH CHÍNH */}
              {effectiveTab === 'cadGroups' && mapMode === 'cadVector' && (
                <>
                  {/* Công trình chính chuẩn hóa */}
                  <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Công trình chính ({curatedMainWorks.length})
                      </span>
                      <button
                        type="button"
                        onClick={onExportCuratedMainWorks}
                        className="rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
                      >
                        Xuất JSON
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {curatedMainWorks.map((work) => {
                        const isUpdating = positionUpdateTargetId === work.id
                        return (
                          <div
                            key={work.id}
                            className="rounded-xl border border-emerald-100 bg-white p-2 shadow-sm transition hover:border-water-200"
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${
                                  work.type === 'water_plant' ? 'bg-orange-500' : 'bg-violet-500'
                                }`}
                              >
                                {work.type === 'water_plant' ? (
                                  <Factory className="size-3.5" />
                                ) : (
                                  <Waves className="size-3.5" />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-slate-800">
                                  {work.displayName}
                                </p>
                                <p className="text-[10px] font-medium text-slate-500">
                                  {work.type === 'water_plant' ? 'Nhà máy nước' : 'Hồ nước thô'} ·{' '}
                                  {work.cadPosition
                                    ? `[${work.cadPosition[0].toFixed(1)}, ${work.cadPosition[1].toFixed(1)}]`
                                    : 'Chưa có tọa độ'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectCuratedMainWork(work.id)}
                                className="inline-flex h-6 items-center gap-1 rounded-md border border-water-200 bg-water-50 px-2 text-[11px] font-semibold text-water-800 hover:bg-water-100"
                              >
                                <Eye className="size-3" />
                                Xem
                              </button>
                              <button
                                type="button"
                                onClick={() => onStartCuratedMainWorkPositionUpdate(work.id)}
                                className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold ${
                                  isUpdating
                                    ? 'border-emerald-400 bg-emerald-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <MapPin className="size-3" />
                                {isUpdating ? 'Đang chờ click…' : 'Đổi vị trí'}
                              </button>
                              {isUpdating && (
                                <button
                                  type="button"
                                  onClick={onCancelCuratedMainWorkPositionUpdate}
                                  className="h-6 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Hủy
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  {/* Nhóm lớp CAD phân màu */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <FolderTree className="size-3.5 text-slate-500" />
                        Nhóm lớp CAD ({cadVectorLayerGroups.length})
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {cadVectorLayerGroups.map((group) => {
                        const groupLayerNames = group.layers.map(
                          (layer) => layer.layerKey ?? layer.layerName,
                        )
                        const visibleCount = group.layers.filter(
                          (layer) => cadVectorVisibleLayers[layer.layerKey ?? layer.layerName] !== false,
                        ).length
                        const allVisible =
                          group.layers.length > 0 && visibleCount === group.layers.length
                        const someVisible = visibleCount > 0 && visibleCount < group.layers.length
                        const expanded = expandedCadVectorGroups[group.key] ?? group.defaultExpanded
                        const style = GROUP_ACCENT_STYLE[group.key]

                        return (
                          <div
                            key={group.key}
                            className={`overflow-hidden rounded-xl border border-slate-200/90 border-l-4 bg-white ${style.borderClass}`}
                          >
                            <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                              <button
                                type="button"
                                onClick={() => onToggleCadVectorGroupExpanded(group.key)}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                {expanded ? (
                                  <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
                                ) : (
                                  <ChevronRight className="size-3.5 shrink-0 text-slate-400" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-bold text-slate-800">
                                    {group.label}
                                  </span>
                                  <div className="mt-0.5 flex items-center gap-1.5">
                                    <span
                                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                        allVisible
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : someVisible
                                            ? 'bg-amber-50 text-amber-700'
                                            : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {visibleCount}/{group.layers.length} bật
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {group.featureCount.toLocaleString('vi-VN')} đối tượng
                                    </span>
                                  </div>
                                </div>
                              </button>

                              <ToggleSwitch
                                checked={allVisible || someVisible}
                                disabled={group.layers.length === 0}
                                accentClass={someVisible ? 'bg-amber-500' : 'bg-water-600'}
                                onChange={(next) => onSetCadVectorLayers(groupLayerNames, next)}
                                ariaLabel={`Bật tắt nhóm ${group.label}`}
                              />
                            </div>

                            {expanded && group.layers.length > 0 && (
                              <div className="max-h-48 space-y-1 overflow-y-auto border-t border-slate-100 bg-slate-50/70 px-2 py-1.5">
                                {group.layers.map((layer) => {
                                  const layerKey = layer.layerKey ?? layer.layerName
                                  const layerChecked = cadVectorVisibleLayers[layerKey] !== false
                                  return (
                                    <div
                                      key={layer.layerKey ?? `${group.key}-${layer.layerName}`}
                                      onClick={() => onToggleCadVectorLayer(layerKey)}
                                      className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-transparent bg-white px-2 py-1.5 transition hover:border-slate-200"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-[11px] font-semibold text-slate-700">
                                          {layer.layerName}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          {cadVectorTypeLabelForUi(layer.inferredType)} ·{' '}
                                          {layer.featureCount}
                                        </p>
                                      </div>
                                      <ToggleSwitch
                                        checked={layerChecked}
                                        accentClass="bg-water-600"
                                        onChange={() => onToggleCadVectorLayer(layerKey)}
                                        ariaLabel={`Bật tắt layer ${layer.layerName}`}
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </>
              )}

              {/* TAB 3: CẤU HÌNH NÂNG CAO */}
              {effectiveTab === 'advanced' && (
                <>
                  {mapMode === 'cadVector' ? (
                    <section className="space-y-2 rounded-xl border border-violet-200/80 bg-violet-50/30 p-2.5">
                      <span className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-violet-900">
                        <Tag className="size-3.5 text-violet-600" />
                        Nhãn CAD mở rộng
                      </span>
                      <div className="space-y-1.5">
                        {(
                          [
                            ['showIrrigationLabels', 'Hiện nhãn kênh thủy lợi'],
                            ['showLocationLabels', 'Hiện nhãn địa danh'],
                            ['showAllLabels', 'Hiện toàn bộ nhãn text'],
                          ] as const
                        ).map(([key, label]) => {
                          const checked = cadVectorLabelOptions[key]
                          return (
                            <div
                              key={key}
                              onClick={() => onCadVectorLabelOptionChange(key, !checked)}
                              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                            >
                              <span>{label}</span>
                              <ToggleSwitch
                                checked={checked}
                                accentClass="bg-violet-600"
                                onChange={(next) => onCadVectorLabelOptionChange(key, next)}
                                ariaLabel={label}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          <Database className="size-3.5 text-slate-500" />
                          Nguồn dữ liệu lớp
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {dataSource?.mode?.toUpperCase() ?? 'DEMO'}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {CAD_LAYER_KEYS.map((key) => {
                          const status = getLayerSourceBadge(dataSource, key, cadImageLoaded)
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-xs"
                            >
                              <span className="truncate font-medium text-slate-700">
                                {LAYER_LABELS[key]}
                              </span>
                              <span
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.badgeClass}`}
                              >
                                <span className={`size-1.5 rounded-full ${status.dotClass}`} />
                                {status.text}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )}

                  {/* Bản vẽ tham chiếu */}
                  <section className="space-y-2 rounded-xl border border-amber-200/70 bg-amber-50/25 p-2.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                        <Route className="size-3.5 text-amber-600" />
                        Bản vẽ &amp; Ảnh tham chiếu
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Tham khảo
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {CAD_LAYOUT_OPTIONS.map((layout) => {
                        const active = mapMode === 'layoutPreview' && selectedLayoutId === layout.id
                        return (
                          <button
                            key={layout.id}
                            type="button"
                            onClick={() => onSelectLayoutPreview(layout.id)}
                            className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                              active
                                ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/40'
                            }`}
                          >
                            <span className="block text-xs font-bold">{layout.label}</span>
                            <span className="block truncate text-[11px] text-slate-500">
                              {layout.fileName}
                            </span>
                          </button>
                        )
                      })}

                      <button
                        type="button"
                        onClick={onOpenCadImage}
                        className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                          mapMode === 'cadImage'
                            ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/40'
                        }`}
                      >
                        <span className="block text-xs font-bold">Ảnh CAD tham chiếu</span>
                        <span className="block text-[11px] text-slate-500">
                          PNG bản vẽ gốc, dùng đối chiếu trực quan
                        </span>
                      </button>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

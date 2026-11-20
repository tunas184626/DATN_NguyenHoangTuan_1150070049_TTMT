import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Code2,
  Copy,
  Droplets,
  Factory,
  FileSpreadsheet,
  Info,
  Layers,
  MapPin,
  Move,
  Ruler,
  Search,
  Sparkles,
  Tag,
  Waves,
  X,
} from 'lucide-react'
import type { CadVectorFeature, CadVectorSourceGroup, CadVectorType } from '../../types/gis'
import {
  cadVectorTypeLabelForUi,
  getCadFeatureText,
  getFeatureDisplayName,
  isLikelyMojibake,
  isPipeDiameterText,
} from '../../utils/textUtils'

interface CadVectorDetailPanelProps {
  feature: CadVectorFeature
  positionUpdateTargetId: string | null
  onStartPositionUpdate: (feature: CadVectorFeature) => void
  onCancelPositionUpdate?: () => void
  onReportIncident: (feature: CadVectorFeature) => void
}

type CadDetailTab = 'business' | 'raw'

const SOURCE_GROUP_STYLE: Record<
  CadVectorSourceGroup,
  {
    headerGradient: string
    iconBg: string
    groupChip: string
    label: string
  }
> = {
  main_works: {
    headerGradient: 'from-emerald-50/85 via-white to-water-50/45',
    iconBg: 'bg-emerald-600',
    groupChip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    label: 'Công trình chính',
  },
  irrigation: {
    headerGradient: 'from-sky-50/85 via-white to-cyan-50/45',
    iconBg: 'bg-sky-600',
    groupChip: 'border-sky-200 bg-sky-50 text-sky-800',
    label: 'Hệ thống thủy lợi',
  },
  cad_base: {
    headerGradient: 'from-indigo-50/75 via-white to-slate-50',
    iconBg: 'bg-indigo-600',
    groupChip: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    label: 'Nền bản vẽ CAD',
  },
  unknown: {
    headerGradient: 'from-slate-100/80 via-white to-slate-50',
    iconBg: 'bg-slate-600',
    groupChip: 'border-slate-200 bg-slate-100 text-slate-700',
    label: 'Dữ liệu CAD',
  },
}

const HIGHLIGHT_RAW_KEYS = new Set([
  'id',
  'name',
  'displayName',
  'type',
  'sourceGroup',
  'businessGroup',
  'cadLayer',
  'cadEntityType',
  'geometryType',
  'diameterText',
  'Text',
  'originalText',
  'normalizedText',
  'EntityHandle',
  'curatedMainWork',
])

const CAD_TYPE_ICONS: Partial<Record<CadVectorType, typeof Layers>> = {
  water_plant: Factory,
  main_work_candidate: Factory,
  raw_water_lake: Waves,
  irrigation_area: Waves,
  supply_zone: Waves,
  irrigation_canal: Droplets,
  canal: Droplets,
  pipeline: Droplets,
  pipe_diameter_label: Ruler,
  location_label: Tag,
  irrigation_label: Tag,
  irrigation_point: MapPin,
  cad_point: MapPin,
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

export function CadVectorDetailPanel({
  feature,
  positionUpdateTargetId,
  onStartPositionUpdate,
  onCancelPositionUpdate,
  onReportIncident,
}: CadVectorDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<CadDetailTab>('business')
  const [rawFilter, setRawFilter] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [copiedRowKey, setCopiedRowKey] = useState<string | null>(null)

  const props = feature.properties
  const rawText = getCadFeatureText(feature)
  const displayName = getFeatureDisplayName(feature)
  const isTextCorrupted = Boolean(props.corruptedText) || isLikelyMojibake(rawText)
  const diameterText = props.diameterText || (isPipeDiameterText(rawText) ? rawText : '')
  const isCurated = props.curatedMainWork === true
  const positionKey = String(props.curatedMainWorkId ?? props.id)
  const isPositionUpdating = positionUpdateTargetId === positionKey
  const sourceStyle = SOURCE_GROUP_STYLE[props.sourceGroup] ?? SOURCE_GROUP_STYLE.unknown
  const TypeIcon = CAD_TYPE_ICONS[props.type] ?? Layers
  const notes = props.notes ?? []

  const rawEntries = useMemo(
    () => Object.entries(props).map(([key, value]) => ({
      key,
      valueText: formatCadRawValue(value),
      isNull: value === null || value === undefined || value === '',
      isImportant: HIGHLIGHT_RAW_KEYS.has(key),
    })),
    [props],
  )

  const filteredRawEntries = useMemo(() => {
    const query = rawFilter.trim().toLowerCase()
    if (!query) return rawEntries
    return rawEntries.filter(
      (entry) =>
        entry.key.toLowerCase().includes(query) ||
        entry.valueText.toLowerCase().includes(query),
    )
  }, [rawEntries, rawFilter])

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(props, null, 2))
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 1500)
    }
  }

  const handleCopyRow = async (key: string, valueText: string) => {
    try {
      await navigator.clipboard.writeText(valueText)
      setCopiedRowKey(key)
      window.setTimeout(() => setCopiedRowKey(null), 1200)
    } catch {
      // Clipboard unavailable in restricted contexts.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Semantic Header Card */}
      <div className={`shrink-0 border-b border-slate-200/80 bg-gradient-to-br ${sourceStyle.headerGradient} px-4 pb-3 pt-3.5`}>
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${sourceStyle.iconBg}`}
          >
            <TypeIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-slate-900">{displayName}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {cadVectorBusinessTypeLabel(feature)}
              {props.cadLayer ? ` · ${props.cadLayer}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className={`status-chip ${sourceStyle.groupChip}`}>
            {props.businessGroup || props.status || sourceStyle.label}
          </span>
          {isCurated && (
            <span className="status-chip border-amber-200 bg-amber-50 text-amber-800">
              <Sparkles className="mr-1 size-3 text-amber-600" />
              Công trình trọng điểm
            </span>
          )}
          {props.manuallyPositioned && (
            <span className="status-chip border-water-200 bg-water-50 text-water-800">
              <MapPin className="mr-1 size-3 text-water-600" />
              Đã định vị tay
            </span>
          )}
          {props.cadSpace && (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-500">
              {props.cadSpace}
            </span>
          )}
        </div>
      </div>

      {/* Segmented Tabs */}
      <div className="shrink-0 border-b border-slate-200/80 bg-slate-50/80 px-3 py-2">
        <div
          className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1"
          role="tablist"
          aria-label="Chi tiết đối tượng CAD Vector"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'business'}
            onClick={() => setActiveTab('business')}
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'business'
                ? 'bg-white text-water-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Info className="size-3.5" />
            Nghiệp vụ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'raw'}
            onClick={() => setActiveTab('raw')}
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'raw'
                ? 'bg-white text-water-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="size-3.5" />
            Thuộc tính gốc
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeTab === 'raw' ? 'bg-water-100 text-water-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {rawEntries.length}
            </span>
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5" role="tabpanel">
        {activeTab === 'business' ? (
          <div className="space-y-3.5">
            {isPositionUpdating && (
              <div className="flex items-start justify-between gap-2 rounded-xl border border-water-300 bg-water-50 px-3 py-2.5 text-xs text-water-900 shadow-sm">
                <div className="min-w-0">
                  <p className="font-bold text-water-900">Đang chọn vị trí mới trên bản đồ</p>
                  <p className="mt-0.5 leading-relaxed text-water-700">
                    Click trực tiếp vào vị trí mong muốn trên bản đồ để lưu tọa độ công trình.
                  </p>
                </div>
                {onCancelPositionUpdate && (
                  <button
                    type="button"
                    onClick={onCancelPositionUpdate}
                    className="shrink-0 rounded-lg border border-water-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                )}
              </div>
            )}

            {isTextCorrupted && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                Tên đối tượng này chưa đọc được đầy đủ từ font CAD gốc. Dữ liệu thuộc tính gốc vẫn được hệ thống lưu giữ nguyên vẹn.
              </div>
            )}

            {/* Business Information Table */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <Layers className="size-3.5 text-water-600" />
                  Thông tin nghiệp vụ
                </span>
                <span className="font-mono text-[10px] font-semibold text-slate-400">#{props.id}</span>
              </div>

              <dl className="divide-y divide-slate-100 text-xs">
                <div className="grid grid-cols-[118px_1fr] items-center gap-2 px-3 py-2.5">
                  <dt className="font-medium text-slate-500">Loại đối tượng</dt>
                  <dd className="font-bold text-slate-800">{cadVectorTypeLabelForUi(props.type)}</dd>
                </div>

                {(props.businessGroup || props.sourceName) && (
                  <div className="grid grid-cols-[118px_1fr] items-center gap-2 px-3 py-2.5">
                    <dt className="font-medium text-slate-500">Nhóm nghiệp vụ</dt>
                    <dd>
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${sourceStyle.groupChip}`}>
                        {props.businessGroup || props.sourceName}
                      </span>
                    </dd>
                  </div>
                )}

                {diameterText && (
                  <div className="grid grid-cols-[118px_1fr] items-center gap-2 bg-water-50/55 px-3 py-2.5">
                    <dt className="flex items-center gap-1 font-semibold text-water-800">
                      <Ruler className="size-3.5 text-water-600" />
                      Đường kính
                    </dt>
                    <dd className="font-bold text-water-900">{diameterText}</dd>
                  </div>
                )}

                {rawText && rawText !== displayName && (
                  <div className="grid grid-cols-[118px_1fr] items-start gap-2 px-3 py-2.5">
                    <dt className="font-medium text-slate-500">Nhãn chữ gốc</dt>
                    <dd className="break-words font-mono text-[11px] text-slate-700">{rawText}</dd>
                  </div>
                )}

                {props.description && (
                  <div className="px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mô tả</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                      {props.description}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {/* CAD Metadata Grid Card */}
            <section className="overflow-hidden rounded-xl border border-indigo-200/70 bg-gradient-to-b from-indigo-50/45 to-white">
              <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50/70 px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                  <FileSpreadsheet className="size-3.5 text-indigo-600" />
                  Định danh bản vẽ CAD
                </span>
                <span className="text-[11px] font-semibold text-indigo-600">{props.sourceFormat || 'DXF/CAD'}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 text-xs">
                <div className="rounded-lg border border-indigo-100 bg-white px-2.5 py-2">
                  <p className="text-[11px] font-medium text-slate-500">Lớp CAD (Layer)</p>
                  <p className="mt-0.5 truncate font-mono font-bold text-indigo-900" title={props.cadLayer}>
                    {props.cadLayer || 'Không rõ'}
                  </p>
                </div>

                <div className="rounded-lg border border-teal-100 bg-white px-2.5 py-2">
                  <p className="text-[11px] font-medium text-slate-500">Hình học</p>
                  <p className="mt-0.5 truncate font-semibold text-teal-800">
                    {props.geometryType || feature.geometry.type}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-2">
                  <p className="text-[11px] font-medium text-slate-500">Thực thể CAD</p>
                  <p className="mt-0.5 truncate font-mono font-semibold text-slate-700">
                    {props.cadEntityType || 'Không rõ'}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-2">
                  <p className="text-[11px] font-medium text-slate-500">Tệp nguồn</p>
                  <p className="mt-0.5 truncate font-medium text-slate-700" title={props.originalFile}>
                    {props.originalFile || props.source || 'CAD Vector'}
                  </p>
                </div>
              </div>
            </section>

            {/* Optional Notes */}
            {notes.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/45">
                <div className="border-b border-amber-200/60 bg-amber-50/90 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                  Ghi chú đối tượng ({notes.length})
                </div>
                <ul className="space-y-1.5 p-2.5">
                  {notes.map((note, index) => (
                    <li
                      key={`${props.id}-note-${index}`}
                      className="rounded-lg border border-amber-200/60 bg-white/90 px-2.5 py-2 text-xs text-slate-700"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-water-300 hover:bg-water-50/60 hover:text-water-900"
            >
              <span className="inline-flex items-center gap-1.5">
                <Code2 className="size-3.5 text-indigo-600" />
                Xem &amp; sao chép toàn bộ {rawEntries.length} thuộc tính gốc
              </span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Search & Copy All Bar */}
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={rawFilter}
                  onChange={(event) => setRawFilter(event.target.value)}
                  placeholder="Lọc tên trường hoặc giá trị…"
                  className="field-input h-9 pl-8 pr-7 text-xs"
                />
                {rawFilter && (
                  <button
                    type="button"
                    onClick={() => setRawFilter('')}
                    aria-label="Xóa bộ lọc thuộc tính"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleCopyAll()}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
                  copyState === 'copied'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : copyState === 'error'
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-water-200 bg-water-50 text-water-800 hover:bg-water-100'
                }`}
              >
                {copyState === 'copied' ? (
                  <>
                    <Check className="size-3.5" />
                    Đã copy
                  </>
                ) : copyState === 'error' ? (
                  <>Không copy được</>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy thuộc tính
                  </>
                )}
              </button>
            </div>

            {/* Raw Properties Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-[118px_1fr_auto] items-center gap-2 border-b border-slate-200 bg-slate-100/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Thuộc tính</span>
                <span>Giá trị</span>
                <span className="sr-only">Sao chép</span>
              </div>

              {filteredRawEntries.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-500">
                  Không có thuộc tính nào khớp bộ lọc.
                </p>
              ) : (
                <dl className="divide-y divide-slate-100 text-xs">
                  {filteredRawEntries.map((entry, idx) => (
                    <div
                      key={entry.key}
                      className={`group grid grid-cols-[118px_1fr_auto] items-start gap-2 px-3 py-2 ${
                        entry.isImportant
                          ? 'bg-water-50/35'
                          : idx % 2 === 1
                            ? 'bg-slate-50/50'
                            : 'bg-white'
                      }`}
                    >
                      <dt
                        className={`truncate pt-0.5 font-mono text-[11px] ${
                          entry.isImportant ? 'font-bold text-water-900' : 'font-semibold text-slate-500'
                        }`}
                        title={entry.key}
                      >
                        {entry.key}
                      </dt>
                      <dd
                        className={`break-words pt-0.5 ${
                          entry.isNull
                            ? 'italic text-slate-400'
                            : entry.isImportant
                              ? 'font-semibold text-slate-900'
                              : 'text-slate-700'
                        }`}
                      >
                        {entry.valueText}
                      </dd>
                      <button
                        type="button"
                        onClick={() => void handleCopyRow(entry.key, entry.valueText)}
                        aria-label={`Sao chép giá trị ${entry.key}`}
                        title="Sao chép giá trị"
                        className="rounded p-1 text-slate-400 opacity-70 transition hover:bg-slate-200/70 hover:text-slate-800 group-hover:opacity-100"
                      >
                        {copiedRowKey === entry.key ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pinned Footer Actions */}
      <div className="shrink-0 border-t border-slate-200/80 bg-slate-50/95 px-4 py-3">
        <div className={`grid gap-2 ${isCurated ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {isCurated && (
            <button
              type="button"
              onClick={() => {
                if (isPositionUpdating && onCancelPositionUpdate) {
                  onCancelPositionUpdate()
                } else {
                  onStartPositionUpdate(feature)
                }
              }}
              className={
                isPositionUpdating
                  ? 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100'
                  : 'primary-btn min-h-10 w-full justify-center gap-1.5 text-xs font-bold'
              }
            >
              <Move className="size-3.5 shrink-0" />
              <span className="truncate">
                {isPositionUpdating ? 'Đang chọn vị trí…' : 'Cập nhật vị trí'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onReportIncident(feature)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            Báo sự cố
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarPlus,
  Check,
  Clock3,
  Droplets,
  ExternalLink,
  Factory,
  Image as ImageIcon,
  Layers,
  LoaderCircle,
  Lock,
  Map as MapIcon,
  MapPin,
  Pentagon,
  Plus,
  Route,
  Sparkles,
  Tag,
  Waves,
  X,
} from 'lucide-react'
import type {
  AssetFeature,
  AssetStatus,
  AssetType,
  GeometryInputType,
  NewAssetInput,
  UpdateAssetInput,
} from '../../types/gis'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard'
import { ASSET_TYPE_LABELS, assetTypeToLayerKey, LAYER_COLORS } from '../../utils/asset'
import { ASSET_STATUS_META, getAssetStatusMeta } from '../../utils/status'
import { calculateLineLengthKm, parseCoordinatePairs, type LngLat } from '../../utils/geo'
import { AssetGeometryPicker } from '../map/AssetGeometryPicker'

export interface AssetFormModalProps {
  mode: 'create' | 'update'
  feature: AssetFeature | null
  onClose: () => void
  onSubmit: (payload: NewAssetInput | UpdateAssetInput) => Promise<void>
}

interface AssetTypeOptionMeta {
  value: AssetType
  label: string
  shortLabel: string
  defaultGeometry: GeometryInputType
  icon: typeof Factory
}

const ASSET_TYPE_OPTIONS: AssetTypeOptionMeta[] = [
  {
    value: 'water_plant',
    label: 'Nhà máy nước',
    shortLabel: 'Nhà máy',
    defaultGeometry: 'Point',
    icon: Factory,
  },
  {
    value: 'raw_water_lake',
    label: 'Hồ chứa nước thô',
    shortLabel: 'Hồ chứa',
    defaultGeometry: 'Polygon',
    icon: Waves,
  },
  {
    value: 'pipeline',
    label: 'Tuyến ống cấp nước',
    shortLabel: 'Tuyến ống',
    defaultGeometry: 'LineString',
    icon: Route,
  },
  {
    value: 'canal',
    label: 'Kênh/thủy lợi',
    shortLabel: 'Kênh thủy lợi',
    defaultGeometry: 'LineString',
    icon: Droplets,
  },
  {
    value: 'supply_zone',
    label: 'Khu vực cấp nước',
    shortLabel: 'Vùng cấp nước',
    defaultGeometry: 'Polygon',
    icon: Layers,
  },
  {
    value: 'boundary',
    label: 'Ranh giới khu vực',
    shortLabel: 'Ranh giới',
    defaultGeometry: 'Polygon',
    icon: MapIcon,
  },
  {
    value: 'label',
    label: 'Điểm/nhãn CAD',
    shortLabel: 'Nhãn CAD',
    defaultGeometry: 'Point',
    icon: Tag,
  },
]

const STATUS_OPTIONS: Array<{ value: AssetStatus; dotClass: string }> = [
  { value: 'active', dotClass: 'bg-emerald-500' },
  { value: 'maintenance', dotClass: 'bg-amber-500' },
  { value: 'need_inspection', dotClass: 'bg-orange-500' },
  { value: 'pending_data', dotClass: 'bg-slate-400' },
]

const GEOMETRY_OPTIONS: Array<{
  value: GeometryInputType
  label: string
  hint: string
  minPoints: number
  icon: typeof MapPin
}> = [
  { value: 'Point', label: 'Điểm', hint: '1 điểm', minPoints: 1, icon: MapPin },
  { value: 'LineString', label: 'Tuyến', hint: '≥ 2 đỉnh', minPoints: 2, icon: Route },
  { value: 'Polygon', label: 'Vùng', hint: '≥ 3 đỉnh', minPoints: 3, icon: Pentagon },
]

const DEFAULT_COORDS_TEXT = '106.4232,10.8815'

function parseNotes(input: string): string[] {
  return input
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatCoordinateList(coords: LngLat[]): string {
  return coords.map(([lng, lat]) => `${lng},${lat}`).join(';')
}

function parseCoordinatesSafe(raw: string): {
  coords: LngLat[]
  valid: boolean
  looksSwappedLatLng: boolean
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { coords: [], valid: false, looksSwappedLatLng: false }
  }

  const segments = trimmed
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    return { coords: [], valid: false, looksSwappedLatLng: false }
  }

  const coords: LngLat[] = []
  let looksSwappedLatLng = false

  for (const segment of segments) {
    const parts = segment.split(',').map((item) => item.trim())
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { coords: [], valid: false, looksSwappedLatLng: false }
    }
    const lng = Number(parts[0])
    const lat = Number(parts[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return { coords: [], valid: false, looksSwappedLatLng: false }
    }
    if (lng >= 5 && lng <= 25 && lat >= 100 && lat <= 115) {
      looksSwappedLatLng = true
    }
    coords.push([lng, lat])
  }

  return { coords, valid: true, looksSwappedLatLng }
}

function getFeatureRepresentativeLatLng(feature: AssetFeature | null): [number, number] | null {
  if (!feature) return null
  const { geometry } = feature
  if (geometry.type === 'Point') {
    return [geometry.coordinates[1], geometry.coordinates[0]]
  }
  if (geometry.type === 'LineString' && geometry.coordinates[0]) {
    return [geometry.coordinates[0][1], geometry.coordinates[0][0]]
  }
  if (geometry.type === 'Polygon' && geometry.coordinates[0]?.[0]) {
    return [geometry.coordinates[0][0][1], geometry.coordinates[0][0][0]]
  }
  if (geometry.type === 'MultiLineString' && geometry.coordinates[0]?.[0]) {
    return [geometry.coordinates[0][0][1], geometry.coordinates[0][0][0]]
  }
  if (geometry.type === 'MultiPolygon' && geometry.coordinates[0]?.[0]?.[0]) {
    return [geometry.coordinates[0][0][0][1], geometry.coordinates[0][0][0][0]]
  }
  return null
}

function formatLastUpdatedLabel(value: string | undefined): string {
  if (!value) return 'Vừa mở'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function AssetFormModal({ mode, feature, onClose, onSubmit }: AssetFormModalProps) {
  const isUpdate = mode === 'update'
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
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const [googleMapsUrl, setGoogleMapsUrl] = useState(feature?.properties.googleMapsUrl ?? '')
  const [notesRaw, setNotesRaw] = useState((feature?.properties.notes ?? []).join('\n'))
  const [geometryType, setGeometryType] = useState<GeometryInputType>('Point')
  const [geometryTouched, setGeometryTouched] = useState(false)
  const [coordinatesRaw, setCoordinatesRaw] = useState(DEFAULT_COORDS_TEXT)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dirty, setDirty] = useState(false)

  const titleId = useId()
  const dialogRef = useRef<HTMLFormElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const requestClose = useUnsavedChangesGuard(dirty && !submitting, onClose)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  const accentColor = LAYER_COLORS[assetTypeToLayerKey(type)]
  const selectedTypeMeta = ASSET_TYPE_OPTIONS.find((item) => item.value === type)
  const TypeIcon = selectedTypeMeta?.icon ?? Layers
  const statusMeta = getAssetStatusMeta(status)
  const submitLabel = isUpdate ? 'Lưu cập nhật' : 'Thêm mới đối tượng'
  const title = isUpdate ? `Cập nhật: ${feature?.properties.name ?? ''}` : 'Thêm đối tượng hạ tầng mới'

  const parsedCoords = useMemo(() => parseCoordinatesSafe(coordinatesRaw), [coordinatesRaw])
  const geometryMeta = GEOMETRY_OPTIONS.find((item) => item.value === geometryType) ?? GEOMETRY_OPTIONS[0]
  const hasEnoughPoints = parsedCoords.valid && parsedCoords.coords.length >= geometryMeta.minPoints

  const measuredLengthLabel = useMemo(() => {
    if (isUpdate || geometryType !== 'LineString' || parsedCoords.coords.length < 2) return null
    const km = calculateLineLengthKm(parsedCoords.coords)
    if (km <= 0) return null
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`
  }, [geometryType, isUpdate, parsedCoords.coords])

  const notesCount = useMemo(() => parseNotes(notesRaw).length, [notesRaw])
  const trimmedImageUrl = imageUrl.trim()
  const showImagePreview = Boolean(trimmedImageUrl && isSafeHttpUrl(trimmedImageUrl) && failedImageUrl !== trimmedImageUrl)
  const validGoogleMapsUrl = isSafeHttpUrl(googleMapsUrl)

  const technicalFields = useMemo(() => {
    switch (type) {
      case 'pipeline':
        return [
          { key: 'diameter', label: 'Đường kính', placeholder: 'VD: D400, DN300', value: diameter, onChange: setDiameter },
          { key: 'material', label: 'Vật liệu', placeholder: 'VD: HDPE, Gang dẻo', value: material, onChange: setMaterial },
          { key: 'length', label: 'Chiều dài', placeholder: 'VD: 2.4 km', value: length, onChange: setLength },
        ]
      case 'water_plant':
        return [
          { key: 'capacity', label: 'Công suất thiết kế', placeholder: 'VD: 45.000 m³/ngày đêm', value: capacity, onChange: setCapacity },
        ]
      case 'raw_water_lake':
        return [
          { key: 'area', label: 'Diện tích mặt hồ', placeholder: 'VD: 12.5 ha', value: area, onChange: setArea },
          { key: 'volume', label: 'Dung tích hữu ích', placeholder: 'VD: 1.200.000 m³', value: volume, onChange: setVolume },
        ]
      case 'canal':
        return [
          { key: 'length', label: 'Chiều dài tuyến kênh', placeholder: 'VD: 3.8 km', value: length, onChange: setLength },
        ]
      case 'supply_zone':
        return [
          { key: 'area', label: 'Diện tích vùng cấp', placeholder: 'VD: 850 ha', value: area, onChange: setArea },
        ]
      default:
        return []
    }
  }, [area, capacity, diameter, length, material, type, volume])

  const handleSelectType = (nextType: AssetType) => {
    if (isUpdate || submitting) return
    setType(nextType)
    setDirty(true)
    if (!geometryTouched) {
      const nextMeta = ASSET_TYPE_OPTIONS.find((item) => item.value === nextType)
      if (nextMeta) {
        setGeometryType(nextMeta.defaultGeometry)
      }
    }
  }

  const handleSelectGeometry = (nextGeo: GeometryInputType) => {
    if (isUpdate || submitting) return
    setGeometryType(nextGeo)
    setGeometryTouched(true)
    setDirty(true)
    if (nextGeo === 'Point' && parsedCoords.coords.length > 1) {
      setCoordinatesRaw(formatCoordinateList([parsedCoords.coords[0]]))
    }
  }

  const handleMapCoordsChange = (coords: LngLat[]) => {
    setCoordinatesRaw(formatCoordinateList(coords))
    setDirty(true)
    setError('')
  }

  const handleSwapLatLng = () => {
    if (!parsedCoords.valid || parsedCoords.coords.length === 0) return
    const swapped = parsedCoords.coords.map(([lng, lat]) => [lat, lng] as LngLat)
    setCoordinatesRaw(formatCoordinateList(swapped))
    setDirty(true)
    setError('')
  }

  const handleGenerateGoogleMapsUrl = () => {
    let targetLatLng: [number, number] | null = null
    if (!isUpdate && parsedCoords.coords.length > 0) {
      const avgLng = parsedCoords.coords.reduce((sum, [lng]) => sum + lng, 0) / parsedCoords.coords.length
      const avgLat = parsedCoords.coords.reduce((sum, [, lat]) => sum + lat, 0) / parsedCoords.coords.length
      targetLatLng = [avgLat, avgLng]
    } else if (isUpdate) {
      targetLatLng = getFeatureRepresentativeLatLng(feature)
    }

    if (!targetLatLng) return
    setGoogleMapsUrl(`https://www.google.com/maps?q=${targetLatLng[0].toFixed(6)},${targetLatLng[1].toFixed(6)}`)
    setDirty(true)
  }

  const handleInsertDateNote = () => {
    const today = new Date().toLocaleDateString('vi-VN')
    const prefix = `[${today}] `
    setNotesRaw((current) => {
      const trimmed = current.trimEnd()
      return trimmed ? `${trimmed}\n${prefix}` : prefix
    })
    setDirty(true)
    window.requestAnimationFrame(() => {
      const el = notesRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  const canGenerateGoogleMaps =
    (!isUpdate && parsedCoords.coords.length > 0) ||
    (isUpdate && getFeatureRepresentativeLatLng(feature) !== null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return

    if (!name.trim() || !address.trim() || !description.trim()) {
      setError('Vui lòng nhập đầy đủ Tên đối tượng, Địa chỉ và Mô tả.')
      return
    }

    const technicalAttributes = isUpdate
      ? { capacity, area, volume, material, diameter, length }
      : Object.fromEntries(technicalFields.map((field) => [field.key, field.value]))

    let payload: NewAssetInput | UpdateAssetInput
    if (isUpdate) {
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
      if (!parsedCoords.valid) {
        setError('Định dạng tọa độ không hợp lệ. Ví dụ: 106.4232,10.8815;106.425,10.883')
        return
      }
      if (parsedCoords.coords.length < geometryMeta.minPoints) {
        setError(`Kiểu ${geometryMeta.label} (${geometryType}) cần tối thiểu ${geometryMeta.minPoints} điểm tọa độ.`)
        return
      }

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
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Định dạng tọa độ không hợp lệ. Ví dụ: 106.4232,10.8815;106.425,10.883',
        )
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

  const readinessItems = [
    { label: 'Tên', done: Boolean(name.trim()) },
    { label: 'Địa chỉ', done: Boolean(address.trim()) },
    { label: 'Mô tả', done: Boolean(description.trim()) },
    ...(!isUpdate ? [{ label: 'Tọa độ', done: hasEnoughPoints }] : []),
  ]

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-[2px] sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={handleSubmit}
        onChangeCapture={() => setDirty(true)}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const controls = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
            ) ?? [],
          ).filter((item) => item.getClientRects().length > 0)
          const first = controls[0]
          const last = controls.at(-1)
          if (!first) {
            event.preventDefault()
            return
          }
          if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
            event.preventDefault()
            first.focus()
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={submitting}
        className={`flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/25 outline-none sm:max-h-[calc(100dvh-2rem)] ${
          isUpdate ? 'max-w-[1160px]' : 'max-w-[1320px]'
        }`}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-water-50/70 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/80 text-white shadow-sm"
              style={{ backgroundColor: accentColor }}
            >
              <TypeIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={titleId} className="truncate text-base font-bold text-slate-900 sm:text-lg">
                  {title}
                </h2>
                <span className="hidden items-center gap-1 rounded-full border border-water-200 bg-water-50 px-2.5 py-0.5 text-[11px] font-semibold text-water-800 sm:inline-flex">
                  {isUpdate && <Lock className="size-3 text-water-600" />}
                  {ASSET_TYPE_LABELS[type]}
                </span>
              </div>
              <p className="truncate text-xs text-slate-500">
                {isUpdate
                  ? 'Chỉnh sửa thuộc tính, thông số kỹ thuật, hình ảnh và ghi chú vận hành (giữ nguyên loại & hình học)'
                  : 'Khai báo thông tin vận hành, thông số kỹ thuật và định vị trực tiếp trên bản đồ'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isUpdate && feature?.properties.lastUpdated && (
              <span className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 lg:inline-flex">
                <Clock3 className="size-3 text-slate-400" />
                Cập nhật {formatLastUpdatedLabel(feature.properties.lastUpdated)}
              </span>
            )}
            <span className={`status-chip hidden md:inline-flex ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="ghost-btn !h-9 !w-9 !rounded-xl !p-0"
              aria-label="Đóng form"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Inline error alert */}
        {error && (
          <div
            role="alert"
            className="flex shrink-0 items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-800 sm:px-5"
          >
            <AlertTriangle className="size-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Horizontal Body: 3 columns on Create, 2 wide columns on Update */}
        <fieldset
          disabled={submitting}
          className="min-h-0 flex-1 overflow-y-auto p-4 lg:px-5 lg:py-4"
        >
          <div
            className={`grid grid-cols-1 gap-4 lg:h-full lg:items-stretch ${
              isUpdate
                ? 'lg:grid-cols-[1.02fr_1.08fr]'
                : 'lg:grid-cols-[1.12fr_1fr_1.06fr]'
            }`}
          >
            {/* COLUMN 1: Định danh & Phân loại */}
            <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  1. Định danh &amp; Phân loại
                </span>
                {isUpdate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    <Lock className="size-3" /> Loại cố định
                  </span>
                )}
              </div>

              {/* Loại đối tượng: interactive tile grid on Create, sleek locked card on Update */}
              {isUpdate ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                      style={{ backgroundColor: accentColor }}
                    >
                      <TypeIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-medium text-slate-400">Loại đối tượng</span>
                      <span className="block truncate text-sm font-bold text-slate-800">
                        {ASSET_TYPE_LABELS[type]}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    <Lock className="size-3" />
                    Đã khóa
                  </div>
                </div>
              ) : (
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Loại đối tượng <span className="text-rose-500">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ASSET_TYPE_OPTIONS.map((option) => {
                      const OptionIcon = option.icon
                      const active = type === option.value
                      const color = LAYER_COLORS[assetTypeToLayerKey(option.value)]
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSelectType(option.value)}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition ${
                            active
                              ? 'border-water-500 bg-white font-semibold text-slate-900 shadow-sm ring-2 ring-water-100'
                              : 'border-slate-200/90 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          <span
                            className="flex size-5 shrink-0 items-center justify-center rounded-md text-white"
                            style={{ backgroundColor: color }}
                          >
                            <OptionIcon className="size-3" />
                          </span>
                          <span className="truncate">{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tên đối tượng */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  Tên đối tượng <span className="text-rose-500">*</span>
                </span>
                <input
                  className="field-input !py-1.5 !text-sm"
                  placeholder="VD: Trạm bơm tăng áp Hòa Lợi"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              {/* Địa chỉ */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  Địa chỉ / Vị trí hành chính <span className="text-rose-500">*</span>
                </span>
                <input
                  className="field-input !py-1.5 !text-sm"
                  placeholder="VD: Đường ĐT741, P. Hòa Lợi, Bến Cát"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </label>

              {/* Trạng thái */}
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Trạng thái vận hành</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {STATUS_OPTIONS.map((option) => {
                    const meta = ASSET_STATUS_META[option.value]
                    const active = status === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setStatus(option.value)
                          setDirty(true)
                        }}
                        className={`flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                          active
                            ? `${meta.className} shadow-sm ring-1 ring-current/20`
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={`size-2 shrink-0 rounded-full ${option.dotClass}`} />
                          <span className="truncate">{meta.label}</span>
                        </span>
                        {active && <Check className="size-3.5 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mô tả */}
              <label className="flex min-h-0 flex-1 flex-col">
                <span className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>
                    Mô tả chi tiết <span className="text-rose-500">*</span>
                  </span>
                  <span className="font-normal text-slate-400">{description.length} ký tự</span>
                </span>
                <textarea
                  className={`field-input flex-1 resize-none !py-2 !text-sm leading-relaxed ${
                    isUpdate ? 'min-h-[112px]' : 'min-h-[68px]'
                  }`}
                  placeholder="Mô tả chức năng, phạm vi phục vụ, hiện trạng công trình..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </section>

            {/* COLUMN 2: Thông số kỹ thuật, Hình ảnh & Ghi chú */}
            <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  2. Thông số, Media &amp; Ghi chú
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
                  {selectedTypeMeta?.shortLabel ?? ASSET_TYPE_LABELS[type]}
                </span>
              </div>

              {/* Thông số kỹ thuật theo loại */}
              <div className="rounded-xl border border-water-200/80 bg-gradient-to-br from-water-50/70 to-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-water-900">Thông số kỹ thuật theo loại</span>
                  {measuredLengthLabel && (type === 'pipeline' || type === 'canal') && (
                    <button
                      type="button"
                      onClick={() => {
                        setLength(measuredLengthLabel)
                        setDirty(true)
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-water-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-water-700 transition hover:bg-water-50"
                      title="Lấy chiều dài ước tính từ tuyến đang vẽ trên bản đồ"
                    >
                      <Sparkles className="size-3" />
                      Dùng {measuredLengthLabel}
                    </button>
                  )}
                </div>

                {technicalFields.length > 0 ? (
                  <div className={`grid gap-2 ${technicalFields.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {technicalFields.map((field, index) => (
                      <label
                        key={field.key}
                        className={technicalFields.length === 3 && index === 2 ? 'col-span-2' : ''}
                      >
                        <span className="mb-1 block text-[11px] font-semibold text-slate-600">{field.label}</span>
                        <input
                          className="field-input !py-1.5 !text-sm"
                          placeholder={field.placeholder}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-white/80 px-3 py-2.5 text-xs text-slate-500">
                    Loại <span className="font-semibold text-slate-700">{ASSET_TYPE_LABELS[type]}</span> không yêu cầu thông số kỹ thuật riêng.
                  </p>
                )}
              </div>

              {/* Ảnh URL + Live Thumbnail */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
                <div className="flex items-stretch gap-3">
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Ảnh minh họa (URL)</span>
                      <div className="flex items-center gap-2">
                        {showImagePreview && (
                          <a
                            href={trimmedImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-water-700 hover:underline"
                          >
                            Xem ảnh <ExternalLink className="size-2.5" />
                          </a>
                        )}
                        {trimmedImageUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setImageUrl('')
                              setDirty(true)
                            }}
                            className="text-[11px] font-medium text-slate-400 hover:text-rose-600"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </span>
                    <input
                      className="field-input !py-1.5 !text-xs"
                      placeholder="https://example.com/cong-trinh.jpg"
                      value={imageUrl}
                      onChange={(event) => setImageUrl(event.target.value)}
                    />
                  </label>

                  <div
                    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${
                      isUpdate ? 'h-[66px] w-[108px]' : 'h-[58px] w-[86px]'
                    }`}
                  >
                    {showImagePreview ? (
                      <a
                        href={trimmedImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Mở ảnh kích thước đầy đủ"
                        className="group relative block h-full w-full"
                      >
                        <img
                          src={trimmedImageUrl}
                          alt={name || 'Xem trước ảnh đối tượng'}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          onError={() => setFailedImageUrl(trimmedImageUrl)}
                        />
                      </a>
                    ) : (
                      <div className="flex flex-col items-center justify-center px-1 text-center text-slate-400">
                        <ImageIcon className="size-4" />
                        <span className="mt-0.5 text-[10px] leading-tight">
                          {trimmedImageUrl && failedImageUrl === trimmedImageUrl ? 'Lỗi ảnh' : 'Xem trước'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Google Maps URL */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">Liên kết Google Maps</span>
                  <div className="flex items-center gap-1.5">
                    {canGenerateGoogleMaps && (
                      <button
                        type="button"
                        onClick={handleGenerateGoogleMapsUrl}
                        className="inline-flex items-center gap-1 rounded-md bg-water-50 px-2 py-0.5 text-[11px] font-semibold text-water-700 transition hover:bg-water-100"
                      >
                        <Sparkles className="size-3" />
                        {isUpdate ? 'Lấy từ vị trí' : 'Từ tọa độ'}
                      </button>
                    )}
                    {validGoogleMapsUrl && (
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Mở
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
                <input
                  className="field-input !py-1.5 !text-xs"
                  placeholder="https://www.google.com/maps?q=10.8815,106.4232"
                  value={googleMapsUrl}
                  onChange={(event) => setGoogleMapsUrl(event.target.value)}
                />
              </div>

              {/* Ghi chú */}
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor={`${titleId}-notes`} className="text-xs font-semibold text-slate-700">
                    Ghi chú vận hành <span className="font-normal text-slate-400">(mỗi dòng 1 mục)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleInsertDateNote}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:border-water-300 hover:bg-water-50 hover:text-water-800"
                      title="Chèn dòng ghi chú mới kèm ngày hôm nay"
                    >
                      <CalendarPlus className="size-3" />
                      Thêm ngày
                    </button>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/80">
                      {notesCount} mục
                    </span>
                  </div>
                </div>
                <textarea
                  ref={notesRef}
                  id={`${titleId}-notes`}
                  className={`field-input flex-1 resize-none !py-2 !text-sm leading-relaxed ${
                    isUpdate ? 'min-h-[108px]' : 'min-h-[78px]'
                  }`}
                  placeholder="VD: Kiểm tra van định kỳ hàng tháng&#10;Đã thay đồng hồ áp lực 10/2026"
                  value={notesRaw}
                  onChange={(event) => setNotesRaw(event.target.value)}
                />
              </div>
            </section>

            {/* COLUMN 3: Kiểu hình học & Bản đồ tọa độ (Create mode only) */}
            {!isUpdate && (
              <section className="flex min-h-0 flex-col gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    3. Hình học &amp; Tọa độ GIS
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      hasEnoughPoints
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    }`}
                  >
                    {parsedCoords.valid
                      ? `${parsedCoords.coords.length} điểm${hasEnoughPoints ? ' · Hợp lệ' : ` · Cần ${geometryMeta.minPoints}+`}`
                      : 'Chưa hợp lệ'}
                  </span>
                </div>

                {/* Kiểu hình học */}
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Kiểu hình học</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {GEOMETRY_OPTIONS.map((option) => {
                      const GeoIcon = option.icon
                      const active = geometryType === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSelectGeometry(option.value)}
                          className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center transition ${
                            active
                              ? 'border-water-500 bg-white text-water-800 shadow-sm ring-2 ring-water-100'
                              : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-1 text-xs font-semibold">
                            <GeoIcon className="size-3.5" />
                            <span>{option.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{option.hint}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Interactive Mini-Map */}
                <AssetGeometryPicker
                  mode="create"
                  geometryType={geometryType}
                  coordinates={parsedCoords.coords}
                  accentColor={accentColor}
                  onChangeCoordinates={handleMapCoordsChange}
                  onResetDefault={() => {
                    setCoordinatesRaw(DEFAULT_COORDS_TEXT)
                    setDirty(true)
                  }}
                  className="min-h-[210px] flex-1"
                />

                {/* Tọa độ input */}
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Tọa độ WGS84 <span className="font-normal text-slate-400">(lng,lat;lng,lat)</span>
                    </span>
                    <button
                      type="button"
                      disabled={!parsedCoords.valid || parsedCoords.coords.length === 0}
                      onClick={handleSwapLatLng}
                      title="Đảo thứ tự Vĩ độ ↔ Kinh độ cho toàn bộ điểm"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowLeftRight className="size-3" />
                      Đảo lat↔lng
                    </button>
                  </div>

                  <input
                    className={`field-input !py-1.5 font-mono !text-xs ${
                      !parsedCoords.valid && coordinatesRaw.trim()
                        ? '!border-rose-300 focus:!border-rose-500 focus:!ring-rose-200'
                        : ''
                    }`}
                    value={coordinatesRaw}
                    onChange={(event) => setCoordinatesRaw(event.target.value)}
                    placeholder="106.4232,10.8815;106.4258,10.8828"
                  />

                  {parsedCoords.looksSwappedLatLng ? (
                    <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800">
                      <span>Có vẻ bạn nhập Vĩ độ trước Kinh độ?</span>
                      <button
                        type="button"
                        onClick={handleSwapLatLng}
                        className="shrink-0 font-bold text-amber-900 underline hover:no-underline"
                      >
                        Đảo ngay
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      Bấm bản đồ để chọn nhanh hoặc dán chuỗi <code className="text-slate-700">lng,lat</code> ngăn cách bằng <code className="text-slate-700">;</code>
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        </fieldset>

        {/* Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/90 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="mr-1 font-medium text-slate-600">Kiểm tra nhanh:</span>
            {readinessItems.map((item) => (
              <span
                key={item.label}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                  item.done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                <Check className={`size-3 ${item.done ? 'opacity-100' : 'opacity-30'}`} />
                {item.label}
              </span>
            ))}
            {isUpdate && dirty && (
              <span className="ml-1 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Có thay đổi chưa lưu
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={requestClose} disabled={submitting} className="ghost-btn">
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="primary-btn shadow-sm shadow-water-600/20 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? (
                <LoaderCircle className="mr-1.5 size-4 animate-spin" />
              ) : isUpdate ? (
                <Check className="mr-1.5 size-4" />
              ) : (
                <Plus className="mr-1.5 size-4" />
              )}
              {submitting ? 'Đang lưu...' : submitLabel}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}

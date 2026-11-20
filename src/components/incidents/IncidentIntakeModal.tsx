import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Droplets,
  ExternalLink,
  Gauge,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Search,
  ShieldAlert,
  Trash2,
  Waves,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import type {
  AssetFeature,
  IncidentAnchor,
  IncidentIntake,
  IncidentSeverity,
  IncidentType,
  NewIncidentInput,
} from '../../types/gis'
import { IncidentLocationPicker } from '../map/IncidentLocationPicker'
import { parseIncidentPosition } from '../../utils/coordinates'
import { formatAssetType } from '../../utils/asset'
import { formatIncidentType, getIncidentSeverityMeta } from '../../utils/status'
import {
  DETECTION_CHANNEL_LABELS,
  parseDetectedAt,
  SERVICE_IMPACT_LABELS,
  toLocalDateTimeInput,
  validateIncidentDetails,
  validateIncidentPhotos,
} from '../../utils/incidentIntake'

interface IncidentIntakeModalProps {
  anchor: IncidentAnchor | null
  availableAssets: AssetFeature[]
  online: boolean
  onClose: () => void
  onSubmit: (input: NewIncidentInput) => Promise<void>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SEVERITY_META_UI: Record<
  IncidentSeverity,
  { hint: string; dotClass: string; activeClass: string }
> = {
  low: {
    hint: 'Dấu hiệu nhỏ, cần kiểm tra',
    dotClass: 'bg-sky-500',
    activeClass: 'border-sky-500 bg-sky-50/80 text-sky-900 ring-2 ring-sky-100',
  },
  medium: {
    hint: 'Có nguy cơ ảnh hưởng vận hành',
    dotClass: 'bg-orange-500',
    activeClass: 'border-orange-500 bg-orange-50/80 text-orange-900 ring-2 ring-orange-100',
  },
  high: {
    hint: 'Sự cố nghiêm trọng, cần ưu tiên',
    dotClass: 'bg-rose-600',
    activeClass: 'border-rose-500 bg-rose-50/85 text-rose-900 ring-2 ring-rose-100',
  },
}

const INCIDENT_TYPE_OPTIONS: Array<{
  value: IncidentType
  label: string
  icon: typeof Droplets
  accentClass: string
}> = [
  { value: 'leak', label: 'Rò rỉ', icon: Droplets, accentClass: 'text-sky-600 bg-sky-50' },
  { value: 'pressure_loss', label: 'Mất áp', icon: Gauge, accentClass: 'text-amber-600 bg-amber-50' },
  { value: 'pipe_burst', label: 'Vỡ ống', icon: Zap, accentClass: 'text-rose-600 bg-rose-50' },
  { value: 'turbid_water', label: 'Nước đục', icon: Waves, accentClass: 'text-teal-700 bg-teal-50' },
  { value: 'need_inspection', label: 'Cần kiểm tra', icon: Search, accentClass: 'text-indigo-600 bg-indigo-50' },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function IncidentIntakeModal({
  anchor,
  availableAssets,
  online,
  onClose,
  onSubmit,
}: IncidentIntakeModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [incidentType, setIncidentType] = useState<IncidentType>('leak')
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')
  const [address, setAddress] = useState(anchor?.address ?? '')
  const [latitude, setLatitude] = useState(anchor?.position?.[0].toFixed(6) ?? '')
  const [longitude, setLongitude] = useState(anchor?.position?.[1].toFixed(6) ?? '')
  const [locationEdited, setLocationEdited] = useState(false)
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const [description, setDescription] = useState('')
  const [detectionChannel, setDetectionChannel] =
    useState<IncidentIntake['detectionChannel']>('site_inspection')
  const [serviceImpact, setServiceImpact] =
    useState<IncidentIntake['serviceImpact']>('unknown')
  const [initialResponse, setInitialResponse] = useState('')
  const [detectedAt, setDetectedAt] = useState(() => toLocalDateTimeInput())
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [assetIds, setAssetIds] = useState<string[]>(
    anchor?.assetId && (!online || UUID.test(anchor.assetId)) ? [anchor.assetId] : [],
  )
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const titleId = useId()
  const dialogRef = useRef<HTMLFormElement>(null)
  const stepTitleRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const position = parseIncidentPosition(latitude, longitude)
  const linkableAssets = availableAssets.filter((asset) => !online || UUID.test(asset.properties.id))

  const photoPreviews = useMemo(
    () =>
      imageFiles.map((file) => ({
        file,
        key: `${file.name}-${file.size}-${file.lastModified}`,
        url: URL.createObjectURL(file),
      })),
    [imageFiles],
  )

  useEffect(() => {
    return () => {
      for (const item of photoPreviews) {
        URL.revokeObjectURL(item.url)
      }
    }
  }, [photoPreviews])

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

  useEffect(() => {
    if (step === 2) stepTitleRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (!dirty && !submitting) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty, submitting])

  const requestClose = () => {
    if (submitting) return
    if (!dirty || window.confirm('Thông tin sự cố chưa được lưu. Bạn muốn đóng và bỏ các thay đổi?')) {
      onClose()
    }
  }

  const changePosition = (lat: string, lng: string) => {
    setLatitude(lat)
    setLongitude(lng)
    setLocationEdited(true)
    setLocationConfirmed(false)
    setDirty(true)
    setError('')
  }

  const validateLocation = () => {
    if (!position) {
      return 'Bấm trên bản đồ hoặc nhập tọa độ WGS84 hợp lệ để xác định điểm xảy ra sự cố.'
    }
    if (address.trim().length < 3) {
      return 'Bổ sung địa chỉ hoặc mốc hiện trường để đội xử lý tìm được vị trí.'
    }
    if (address.trim().length > 1000) {
      return 'Địa chỉ hoặc mốc hiện trường tối đa 1.000 ký tự.'
    }
    if (!locationConfirmed) {
      return 'Xác nhận điểm trên bản đồ đúng với vị trí sự cố trước khi tiếp tục.'
    }
    return null
  }

  const nextStep = () => {
    const message = validateLocation()
    setError(message ?? '')
    if (!message) setStep(2)
  }

  const handlePhotoSelection = (incoming: File[]) => {
    if (incoming.length === 0) return
    const combined = [...imageFiles, ...incoming].slice(0, 3)
    const message = validateIncidentPhotos(combined)
    if (message) {
      setError(message)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setImageFiles(combined)
    setDirty(true)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemovePhoto = (indexToRemove: number) => {
    setImageFiles((current) => current.filter((_, index) => index !== indexToRemove))
    setDirty(true)
    setError('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (step === 1) {
      nextStep()
      return
    }

    const locationError = validateLocation()
    if (locationError) {
      setStep(1)
      setError(locationError)
      return
    }

    const message =
      validateIncidentDetails(description, detectedAt, initialResponse) ??
      validateIncidentPhotos(imageFiles)
    if (message) {
      setError(message)
      return
    }

    const timestamp = parseDetectedAt(detectedAt)
    if (!timestamp || !position) return

    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        name: `${formatIncidentType(incidentType)} tại ${(anchor?.origin.featureName || address.trim()).slice(0, 160)}`,
        incidentCode: `SC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        incidentType,
        severity,
        status: 'new',
        description: description.trim(),
        address: address.trim(),
        reportedDate: detectedAt.slice(0, 10),
        reportedAt: timestamp,
        latitude: position[0],
        longitude: position[1],
        imageFiles: online ? imageFiles : [],
        notes: [],
        assetIds,
        googleMapsUrl: `https://www.google.com/maps?q=${position[0]},${position[1]}`,
        origin: anchor
          ? {
              ...anchor.origin,
              coordinateMethod: locationEdited ? 'manual' : anchor.origin.coordinateMethod,
            }
          : undefined,
        intake: {
          detectionChannel,
          serviceImpact,
          initialResponse: initialResponse.trim(),
          detectedAt: timestamp,
          locationConfirmed: true,
        },
      })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Chưa thể ghi nhận sự cố. Dữ liệu trong form vẫn được giữ để bạn thử lại.',
      )
      setSubmitting(false)
    }
  }

  const severityMeta = getIncidentSeverityMeta(severity)
  const step1Checks = [
    { label: 'Tọa độ', done: Boolean(position) },
    { label: 'Địa chỉ', done: address.trim().length >= 3 },
    { label: 'Xác nhận vị trí', done: locationConfirmed },
  ]
  const step2Checks = [
    { label: 'Mô tả ≥ 10 ký tự', done: description.trim().length >= 10 },
    { label: 'Thời điểm hợp lệ', done: Boolean(parseDetectedAt(detectedAt)) },
    { label: 'Vị trí đã chốt', done: Boolean(position && locationConfirmed) },
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={submitting}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-[1300px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/25 outline-none sm:max-h-[calc(100dvh-2rem)]"
        onSubmit={handleSubmit}
        onChangeCapture={() => setDirty(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            requestClose()
          }
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
          if (
            event.shiftKey &&
            (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))
          ) {
            event.preventDefault()
            last?.focus()
          } else if (
            !event.shiftKey &&
            (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))
          ) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        {/* Compact Header with Integrated Stepper */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-teal-50/70 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-600 text-white shadow-sm">
              <ShieldAlert className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="truncate text-base font-bold text-slate-900 sm:text-lg">
                  Ghi nhận sự cố
                </h2>
                <span className="hidden rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 sm:inline-flex">
                  Tiếp nhận hiện trường
                </span>
              </div>
              <p className="truncate text-xs text-slate-500">
                {formatIncidentType(incidentType)} · Ưu tiên {severityMeta.label.toLowerCase()}
              </p>
            </div>
          </div>

          {/* Horizontal Stepper */}
          <ol
            aria-label="Các bước ghi nhận"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 p-1 shadow-sm"
          >
            <li>
              <button
                type="button"
                onClick={() => {
                  if (step === 2 && !submitting) {
                    setStep(1)
                    setError('')
                  }
                }}
                aria-current={step === 1 ? 'step' : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  step === 1
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-teal-800 hover:bg-teal-50'
                }`}
              >
                <span
                  className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    step === 1 ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
                  }`}
                >
                  {step === 2 ? <Check className="size-3" /> : '1'}
                </span>
                <span>Vị trí &amp; phân loại</span>
              </button>
            </li>
            <span aria-hidden="true" className="h-3.5 w-px bg-slate-200" />
            <li>
              <button
                type="button"
                disabled={step === 1}
                aria-current={step === 2 ? 'step' : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  step === 2
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'cursor-default text-slate-400'
                }`}
              >
                <span
                  className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    step === 2 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  2
                </span>
                <span>Hồ sơ tiếp nhận</span>
              </button>
            </li>
          </ol>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold lg:inline-flex ${
                online
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
              {online ? 'Kết nối máy chủ' : 'Lưu trên thiết bị'}
            </span>
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="ghost-btn !h-9 !w-9 !rounded-xl !p-0 disabled:opacity-40"
              aria-label="Đóng ghi nhận sự cố"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Inline Error */}
        {error && (
          <div
            ref={errorRef}
            role="alert"
            className="flex shrink-0 items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-800 sm:px-5"
          >
            <AlertTriangle className="size-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <fieldset disabled={submitting} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 lg:px-5 lg:py-4">
          {step === 1 ? (
            <div className="grid grid-cols-1 gap-4 lg:h-full lg:grid-cols-[1.3fr_1fr] lg:items-stretch">
              {/* STEP 1 LEFT: Interactive Map & Always-visible WGS84 Coordinates */}
              <section
                aria-label="Chọn điểm sự cố"
                className="flex min-h-0 min-w-0 flex-col gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-teal-700" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      1. Định vị sự cố trên bản đồ
                    </h3>
                  </div>
                  {position && (
                    <a
                      href={`https://www.google.com/maps?q=${position[0]},${position[1]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Google Maps
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>

                <IncidentLocationPicker
                  className="min-h-[270px] flex-1"
                  position={position}
                  onChange={([lat, lng]) => changePosition(lat.toFixed(6), lng.toFixed(6))}
                />

                {/* Direct Coordinate Bar (always accessible without scrolling) */}
                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200/90 bg-white p-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                      Vĩ độ (Latitude · WGS84)
                    </span>
                    <input
                      aria-label="Vĩ độ sự cố"
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      placeholder="VD: 10.884500"
                      value={latitude}
                      onChange={(event) => changePosition(event.target.value, longitude)}
                      className="field-input !py-1.5 font-mono !text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                      Kinh độ (Longitude · WGS84)
                    </span>
                    <input
                      aria-label="Kinh độ sự cố"
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      placeholder="VD: 106.425500"
                      value={longitude}
                      onChange={(event) => changePosition(latitude, event.target.value)}
                      className="field-input !py-1.5 font-mono !text-xs"
                    />
                  </label>
                  <div
                    className={`inline-flex h-[34px] items-center justify-center rounded-lg border px-2.5 text-[11px] font-semibold ${
                      position
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {position ? 'WGS84 · Hợp lệ' : 'Chưa chọn điểm'}
                  </div>
                </div>
              </section>

              {/* STEP 1 RIGHT: Classification, Severity, Address & Confirmation */}
              <section
                aria-label="Phân loại sự cố"
                className="flex min-h-0 min-w-0 flex-col gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    2. Phân loại &amp; Mốc hiện trường
                  </h3>
                  {anchor && (
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                      Từ đối tượng nguồn
                    </span>
                  )}
                </div>

                {anchor && (
                  <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-slate-800">
                        {anchor.origin.featureName}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Nguồn
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {locationEdited ? 'Điểm đã được điều chỉnh thủ công trên bản đồ.' : anchor.locationMessage}
                    </p>
                  </div>
                )}

                {/* Loại sự cố */}
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Loại sự cố <span className="text-rose-600">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {INCIDENT_TYPE_OPTIONS.map((option) => {
                      const TypeIcon = option.icon
                      const active = incidentType === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setIncidentType(option.value)
                            setDirty(true)
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                            active
                              ? 'border-teal-600 bg-white text-teal-900 shadow-sm ring-2 ring-teal-100'
                              : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-md ${option.accentClass}`}
                          >
                            <TypeIcon className="size-3.5" />
                          </span>
                          <span className="truncate">{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Mức độ ưu tiên */}
                <fieldset>
                  <legend className="mb-1.5 flex w-full items-center justify-between text-xs font-semibold text-slate-700">
                    <span>
                      Mức độ ưu tiên <span className="text-rose-600">*</span>
                    </span>
                    <span className="text-[11px] font-normal text-slate-500">
                      {SEVERITY_META_UI[severity].hint}
                    </span>
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map((value) => {
                      const active = severity === value
                      const ui = SEVERITY_META_UI[value]
                      return (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                            active
                              ? ui.activeClass
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="incidentSeverity"
                            value={value}
                            checked={active}
                            onChange={() => {
                              setSeverity(value)
                              setDirty(true)
                            }}
                            className="sr-only"
                          />
                          <span className={`size-2 shrink-0 rounded-full ${ui.dotClass}`} />
                          <span>{getIncidentSeverityMeta(value).label}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                {/* Địa chỉ / mốc hiện trường */}
                <label className="flex min-h-0 flex-1 flex-col">
                  <span className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>
                      Địa chỉ / mốc hiện trường <span className="text-rose-600">*</span>
                    </span>
                    <span className="font-normal text-slate-400">{address.length}/1.000</span>
                  </span>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="VD: trước cổng nhà máy, ngã ba đường ĐT741…"
                    className="field-input min-h-[68px] flex-1 resize-none !py-2 !text-sm leading-snug"
                  />
                </label>

                {/* Xác nhận điểm bản đồ */}
                <label
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs font-medium leading-relaxed transition ${
                    !position
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100/70 text-slate-400'
                      : locationConfirmed
                        ? 'border-teal-400 bg-teal-50/80 text-teal-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={locationConfirmed}
                    disabled={!position}
                    onChange={(event) => {
                      setLocationConfirmed(event.target.checked)
                      setDirty(true)
                      setError('')
                    }}
                    className="mt-0.5 size-4 shrink-0 accent-teal-700"
                  />
                  <span>
                    {position
                      ? 'Tôi đã kiểm tra và xác nhận điểm trên bản đồ đúng vị trí sự cố.'
                      : 'Hãy chọn vị trí sự cố trên bản đồ trước khi đánh dấu xác nhận.'}
                  </span>
                </label>
              </section>
            </div>
          ) : (
            /* STEP 2: Wide Horizontal 3-Column Layout */
            <div className="grid grid-cols-1 gap-4 lg:h-full lg:grid-cols-[1.12fr_1.05fr_0.93fr] lg:items-stretch">
              {/* STEP 2 COL 1: Hiện trường & Thời điểm */}
              <section className="flex min-h-0 min-w-0 flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5">
                <h3
                  ref={stepTitleRef}
                  tabIndex={-1}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 outline-none"
                >
                  <ClipboardList className="size-4 text-teal-700" />
                  1. Thông tin hiện trường
                </h3>

                <label className="flex min-h-0 flex-1 flex-col">
                  <span className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>
                      Dấu hiệu và tình trạng hiện trường <span className="text-rose-600">*</span>
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        description.trim().length >= 10 ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {description.trim().length >= 10 ? 'Đạt chuẩn' : 'Ít nhất 10 ký tự'} ·{' '}
                      {description.length}/5.000
                    </span>
                  </span>
                  <textarea
                    value={description}
                    maxLength={5000}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Mô tả dấu hiệu quan sát, phạm vi ảnh hưởng, lưu lượng rò rỉ và rủi ro hiện tại…"
                    className="field-input min-h-[132px] flex-1 resize-none !py-2 !text-sm leading-relaxed"
                  />
                </label>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">Kênh tiếp nhận</span>
                    <select
                      value={detectionChannel}
                      onChange={(event) =>
                        setDetectionChannel(event.target.value as IncidentIntake['detectionChannel'])
                      }
                      className="field-input !py-1.5 !text-sm"
                    >
                      {Object.entries(DETECTION_CHANNEL_LABELS).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      Ảnh hưởng cấp nước
                    </span>
                    <select
                      value={serviceImpact}
                      onChange={(event) =>
                        setServiceImpact(event.target.value as IncidentIntake['serviceImpact'])
                      }
                      className="field-input !py-1.5 !text-sm"
                    >
                      {Object.entries(SERVICE_IMPACT_LABELS).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label
                      htmlFor={`${titleId}-detectedAt`}
                      className="text-xs font-semibold text-slate-700"
                    >
                      Thời điểm phát hiện <span className="text-rose-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setDetectedAt(toLocalDateTimeInput())
                        setDirty(true)
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 transition hover:bg-teal-100"
                    >
                      <Clock className="size-3" />
                      Bây giờ
                    </button>
                  </div>
                  <input
                    id={`${titleId}-detectedAt`}
                    type="datetime-local"
                    value={detectedAt}
                    max={toLocalDateTimeInput()}
                    onChange={(event) => setDetectedAt(event.target.value)}
                    className="field-input !py-1.5 !text-sm"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Theo giờ địa phương trên thiết bị, không chọn thời điểm tương lai.
                  </p>
                </div>
              </section>

              {/* STEP 2 COL 2: Biện pháp, Ảnh & Tài sản liên quan */}
              <section className="flex min-h-0 min-w-0 flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  2. Ứng phó, Ảnh &amp; Tài sản
                </h3>

                <label className="block">
                  <span className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>
                      Biện pháp đã thực hiện{' '}
                      <span className="font-normal text-slate-400">· nếu có</span>
                    </span>
                    <span className="font-normal text-slate-400">{initialResponse.length}/2.000</span>
                  </span>
                  <textarea
                    value={initialResponse}
                    maxLength={2000}
                    onChange={(event) => setInitialResponse(event.target.value)}
                    rows={3}
                    placeholder="VD: đặt rào cảnh báo, khóa van nhánh, thông báo trực vận hành…"
                    className="field-input h-[78px] resize-none !py-1.5 !text-sm leading-snug"
                  />
                </label>

                {/* Ảnh hiện trường với Live Previews */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <ImagePlus className="size-4 text-teal-700" />
                      Ảnh hiện trường ({imageFiles.length}/3)
                    </span>
                    {online && imageFiles.length < 3 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 transition hover:bg-teal-100"
                      >
                        + Chọn ảnh
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!online || submitting || imageFiles.length >= 3}
                    className="sr-only"
                    onChange={(event) => handlePhotoSelection(Array.from(event.target.files ?? []))}
                  />

                  {photoPreviews.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {photoPreviews.map((item, index) => (
                        <div
                          key={item.key}
                          className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <img
                            src={item.url}
                            alt={item.file.name}
                            className="h-16 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            aria-label={`Bỏ ảnh ${item.file.name}`}
                            className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-slate-900/75 text-white transition hover:bg-rose-600"
                          >
                            <Trash2 className="size-3" />
                          </button>
                          <div className="truncate px-1.5 py-1 text-[10px] text-slate-600">
                            {formatFileSize(item.file.size)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!online}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-3 py-3 text-xs text-slate-500 transition hover:border-teal-400 hover:bg-teal-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ImagePlus className="size-4 text-slate-400" />
                      <span>
                        {online
                          ? 'Chọn tối đa 3 ảnh JPG, PNG, WebP (≤ 8 MB/ảnh)'
                          : 'Chế độ thiết bị chưa hỗ trợ đính kèm ảnh'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Tài sản liên quan */}
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor={`${titleId}-assets`} className="text-xs font-semibold text-slate-700">
                      Tài sản liên quan <span className="font-normal text-slate-400">· nếu xác định</span>
                    </label>
                    <span className="text-[11px] font-medium text-slate-500">{assetIds.length} đã chọn</span>
                  </div>
                  <select
                    id={`${titleId}-assets`}
                    value=""
                    className="field-input !py-1.5 !text-sm"
                    disabled={assetIds.length >= 50}
                    onChange={(event) => {
                      const id = event.target.value
                      if (id) {
                        setAssetIds((current) => (current.includes(id) ? current : [...current, id]))
                        setDirty(true)
                      }
                    }}
                  >
                    <option value="">Chọn tài sản hạ tầng để liên kết…</option>
                    {linkableAssets
                      .filter((asset) => !assetIds.includes(asset.properties.id))
                      .map((asset) => (
                        <option key={asset.properties.id} value={asset.properties.id}>
                          {asset.properties.name} · {formatAssetType(asset.properties.type)}
                        </option>
                      ))}
                  </select>

                  <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                    {assetIds.map((id) => {
                      const matched = availableAssets.find((asset) => asset.properties.id === id)
                      const label = matched?.properties.name ?? id
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                        >
                          <span className="min-w-0 truncate font-medium">{label}</span>
                          <button
                            type="button"
                            aria-label={`Bỏ tài sản ${label}`}
                            onClick={() => {
                              setAssetIds((current) => current.filter((value) => value !== id))
                              setDirty(true)
                            }}
                            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      )
                    })}
                    {online && anchor && !anchor.assetId && (
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        Đối tượng CAD được giữ trong thông tin nguồn. Chỉ liên kết tài sản đã có hồ sơ trên máy chủ.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* STEP 2 COL 3: Summary & Pre-submit Verification */}
              <aside className="flex min-h-0 min-w-0 flex-col gap-3 rounded-xl border border-teal-200/80 bg-gradient-to-br from-teal-50/55 via-white to-slate-50 p-3.5">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900">
                  <CheckCircle2 className="size-4 text-teal-700" />
                  3. Kiểm tra trước khi ghi nhận
                </h3>

                <dl className="space-y-2.5 rounded-xl border border-slate-200/80 bg-white p-3 text-xs shadow-sm">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <dt className="text-[11px] text-slate-400">Phân loại</dt>
                      <dd className="mt-0.5 font-bold text-slate-800">
                        {formatIncidentType(incidentType)}
                      </dd>
                    </div>
                    <span className={`status-chip ${severityMeta.className}`}>
                      Ưu tiên {severityMeta.label}
                    </span>
                  </div>

                  {anchor && (
                    <div>
                      <dt className="text-[11px] text-slate-400">Đối tượng nguồn</dt>
                      <dd className="mt-0.5 break-words font-medium text-slate-700">
                        {anchor.origin.featureName}
                      </dd>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[11px] text-slate-400">Địa điểm đã xác nhận</dt>
                      <button
                        type="button"
                        onClick={() => {
                          setStep(1)
                          setError('')
                        }}
                        className="text-[11px] font-semibold text-teal-700 hover:underline"
                      >
                        Sửa vị trí
                      </button>
                    </div>
                    <dd className="mt-0.5 line-clamp-2 font-medium text-slate-700">{address}</dd>
                    <dd className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {latitude}, {longitude} · WGS84
                    </dd>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                    <div>
                      <dt className="text-[11px] text-slate-400">Ảnh hưởng</dt>
                      <dd className="mt-0.5 font-medium text-slate-700">
                        {SERVICE_IMPACT_LABELS[serviceImpact]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Trạng thái sau lưu</dt>
                      <dd className="mt-0.5 font-semibold text-teal-800">Mới ghi nhận</dd>
                    </div>
                  </div>
                </dl>

                {/* Readiness Checklist */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Điều kiện gửi hồ sơ
                  </p>
                  <ul className="space-y-1.5">
                    {step2Checks.map((check) => (
                      <li key={check.label} className="flex items-center gap-2 text-xs">
                        <span
                          className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                            check.done
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Check className="size-3" />
                        </span>
                        <span className={check.done ? 'font-semibold text-slate-700' : 'text-slate-500'}>
                          {check.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="mt-auto rounded-xl border border-slate-200/80 bg-white/80 p-3 text-[11px] leading-relaxed text-slate-500">
                  {online
                    ? 'Máy chủ sẽ tự động cấp mã hồ sơ và xác định hạn SLA theo mức độ ưu tiên để điều phối xử lý.'
                    : 'Hồ sơ được lưu tạm trên thiết bị, chưa đồng bộ lên máy chủ (chưa có mã chính thức và hạn SLA).'}
                </p>
              </aside>
            </div>
          )}
        </fieldset>

        {/* Compact Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/90 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={step === 1 ? requestClose : () => {
                setStep(1)
                setError('')
              }}
              className="ghost-btn disabled:opacity-50"
            >
              {step === 1 ? (
                'Hủy'
              ) : (
                <>
                  <ArrowLeft className="mr-1.5 size-4" />
                  Quay lại
                </>
              )}
            </button>

            <div className="hidden items-center gap-1.5 sm:flex">
              {(step === 1 ? step1Checks : step2Checks).map((item) => (
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
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {step === 1 ? (
              <button
                key="continue"
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  nextStep()
                }}
                className="primary-btn !bg-teal-700 shadow-sm shadow-teal-700/20 hover:!bg-teal-800"
              >
                Tiếp tục
                <ArrowRight className="ml-1.5 size-4" />
              </button>
            ) : (
              <button
                key="save"
                type="submit"
                disabled={submitting}
                className="primary-btn !bg-teal-700 shadow-sm shadow-teal-700/20 hover:!bg-teal-800 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? (
                  <LoaderCircle className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 size-4" />
                )}
                {submitting ? 'Đang ghi nhận…' : online ? 'Ghi nhận sự cố' : 'Lưu trên thiết bị'}
              </button>
            )}
          </div>
        </footer>
      </form>
    </div>
  )
}

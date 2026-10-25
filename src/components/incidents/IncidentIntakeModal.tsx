import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, ImagePlus, LoaderCircle, MapPin, X } from 'lucide-react'
import type { AssetFeature, IncidentAnchor, IncidentIntake, IncidentSeverity, IncidentType, NewIncidentInput } from '../../types/gis'
import { IncidentLocationPicker } from '../map/IncidentLocationPicker'
import { parseIncidentPosition } from '../../utils/coordinates'
import { formatAssetType } from '../../utils/asset'
import { formatIncidentType, getIncidentSeverityMeta, INCIDENT_TYPE_LABELS } from '../../utils/status'
import { DETECTION_CHANNEL_LABELS, parseDetectedAt, SERVICE_IMPACT_LABELS, toLocalDateTimeInput, validateIncidentDetails, validateIncidentPhotos } from '../../utils/incidentIntake'

interface IncidentIntakeModalProps {
  anchor: IncidentAnchor | null
  availableAssets: AssetFeature[]
  online: boolean
  onClose: () => void
  onSubmit: (input: NewIncidentInput) => Promise<void>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SEVERITY_HINTS: Record<IncidentSeverity, string> = {
  low: 'Dấu hiệu nhỏ, cần kiểm tra',
  medium: 'Có nguy cơ ảnh hưởng vận hành',
  high: 'Sự cố nghiêm trọng, cần ưu tiên',
}

export function IncidentIntakeModal({ anchor, availableAssets, online, onClose, onSubmit }: IncidentIntakeModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [incidentType, setIncidentType] = useState<IncidentType>('leak')
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')
  const [address, setAddress] = useState(anchor?.address ?? '')
  const [latitude, setLatitude] = useState(anchor?.position?.[0].toFixed(6) ?? '')
  const [longitude, setLongitude] = useState(anchor?.position?.[1].toFixed(6) ?? '')
  const [locationEdited, setLocationEdited] = useState(false)
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const [description, setDescription] = useState('')
  const [detectionChannel, setDetectionChannel] = useState<IncidentIntake['detectionChannel']>('site_inspection')
  const [serviceImpact, setServiceImpact] = useState<IncidentIntake['serviceImpact']>('unknown')
  const [initialResponse, setInitialResponse] = useState('')
  const [detectedAt, setDetectedAt] = useState(() => toLocalDateTimeInput())
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [assetIds, setAssetIds] = useState<string[]>(anchor?.assetId && (!online || UUID.test(anchor.assetId)) ? [anchor.assetId] : [])
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const titleId = useId()
  const dialogRef = useRef<HTMLFormElement>(null)
  const stepTitleRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const position = parseIncidentPosition(latitude, longitude)
  const linkableAssets = availableAssets.filter((asset) => !online || UUID.test(asset.properties.id))

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
    if (!dirty || window.confirm('Thông tin sự cố chưa được lưu. Bạn muốn đóng và bỏ các thay đổi?')) onClose()
  }

  const changePosition = (lat: string, lng: string) => {
    setLatitude(lat)
    setLongitude(lng)
    setLocationEdited(true)
    setLocationConfirmed(false)
    setDirty(true)
  }

  const validateLocation = () => {
    if (!position) return 'Bấm trên bản đồ hoặc nhập tọa độ WGS84 hợp lệ để xác định điểm xảy ra sự cố.'
    if (address.trim().length < 3) return 'Bổ sung địa chỉ hoặc mốc hiện trường để đội xử lý tìm được vị trí.'
    if (address.trim().length > 1000) return 'Địa chỉ hoặc mốc hiện trường tối đa 1.000 ký tự.'
    if (!locationConfirmed) return 'Xác nhận điểm trên bản đồ đúng với vị trí sự cố trước khi tiếp tục.'
    return null
  }

  const nextStep = () => {
    const message = validateLocation()
    setError(message ?? '')
    if (!message) setStep(2)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (step === 1) { nextStep(); return }
    const locationError = validateLocation()
    if (locationError) { setStep(1); setError(locationError); return }
    const message = validateIncidentDetails(description, detectedAt, initialResponse) ?? validateIncidentPhotos(imageFiles)
    if (message) { setError(message); return }
    const timestamp = parseDetectedAt(detectedAt)
    if (!timestamp || !position) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        name: `${formatIncidentType(incidentType)} tại ${(anchor?.origin.featureName || address.trim()).slice(0, 160)}`,
        incidentCode: `SC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        incidentType, severity, status: 'new', description: description.trim(), address: address.trim(),
        reportedDate: detectedAt.slice(0, 10), reportedAt: timestamp,
        latitude: position[0], longitude: position[1],
        imageFiles: online ? imageFiles : [], notes: [], assetIds,
        googleMapsUrl: `https://www.google.com/maps?q=${position[0]},${position[1]}`,
        origin: anchor ? { ...anchor.origin, coordinateMethod: locationEdited ? 'manual' : anchor.origin.coordinateMethod } : undefined,
        intake: { detectionChannel, serviceImpact, initialResponse: initialResponse.trim(), detectedAt: timestamp, locationConfirmed: true },
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa thể ghi nhận sự cố. Dữ liệu trong form vẫn được giữ để bạn thử lại.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-900/45 p-2 sm:p-5">
      <form ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={submitting}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl outline-none sm:max-h-[calc(100dvh-2.5rem)]"
        onSubmit={handleSubmit} onChangeCapture={() => setDirty(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); requestClose() }
          if (event.key !== 'Tab') return
          const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"], summary') ?? []).filter((item) => item.getClientRects().length > 0)
          const first = controls[0]
          const last = controls.at(-1)
          if (!first) { event.preventDefault(); return }
          if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus() }
        }}>
        <header className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal-700">Tiếp nhận hiện trường</p><h2 id={titleId} className="text-xl font-bold text-slate-900">Ghi nhận sự cố</h2></div>
            <button type="button" onClick={requestClose} disabled={submitting} className="ghost-btn !h-9 !w-9 !p-0 disabled:opacity-40" aria-label="Đóng ghi nhận sự cố"><X className="size-5" /></button>
          </div>
          <ol aria-label="Các bước ghi nhận" className="mt-4 flex items-center gap-3 text-sm">
            <li className={`flex items-center gap-2 font-semibold ${step === 1 ? 'text-teal-800' : 'text-slate-500'}`} aria-current={step === 1 ? 'step' : undefined}><span className="flex size-6 items-center justify-center rounded-full bg-teal-50 text-xs text-teal-800">{step === 2 ? <Check className="size-4" /> : '1'}</span> Vị trí & phân loại</li>
            <span aria-hidden="true" className="h-px w-8 bg-slate-200" />
            <li className={`flex items-center gap-2 font-semibold ${step === 2 ? 'text-teal-800' : 'text-slate-400'}`} aria-current={step === 2 ? 'step' : undefined}><span className={`flex size-6 items-center justify-center rounded-full text-xs ${step === 2 ? 'bg-teal-50 text-teal-800' : 'bg-slate-100'}`}>2</span> Hồ sơ tiếp nhận</li>
          </ol>
        </header>

        <fieldset disabled={submitting} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {error && <div ref={errorRef} role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}
          {step === 1 ? (
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <section aria-label="Chọn điểm sự cố" className="min-w-0">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-800"><MapPin className="size-4 text-teal-700" /> Xác định vị trí trên bản đồ</h3>
                <p className="mb-3 text-xs leading-5 text-slate-500">Bấm vào đúng điểm xảy ra sự cố. Phóng to để đối chiếu đường và mốc hiện trường.</p>
                <div>
                  <IncidentLocationPicker className="h-[300px] sm:h-[380px]" position={position} onChange={([lat, lng]) => changePosition(lat.toFixed(6), lng.toFixed(6))} />
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><MapPin className="size-3.5 shrink-0" />{position ? `${position[0].toFixed(6)}, ${position[1].toFixed(6)} · WGS84` : 'Chưa chọn điểm sự cố'}</div>
                <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer font-medium">Nhập tọa độ chính xác</summary><div className="mt-2 grid grid-cols-2 gap-2"><label>Vĩ độ<input aria-label="Vĩ độ sự cố" type="number" step="any" min={-90} max={90} value={latitude} onChange={(event) => changePosition(event.target.value, longitude)} className="field-input mt-1" /></label><label>Kinh độ<input aria-label="Kinh độ sự cố" type="number" step="any" min={-180} max={180} value={longitude} onChange={(event) => changePosition(latitude, event.target.value)} className="field-input mt-1" /></label></div></details>
              </section>
              <section className="min-w-0 space-y-4" aria-label="Phân loại sự cố">
                {anchor && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">Đối tượng đang báo sự cố</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{anchor.origin.featureName}</p><p className="mt-1 text-xs leading-5 text-slate-500">{locationEdited ? 'Điểm đã được chọn thủ công trên bản đồ.' : anchor.locationMessage}</p></div>}
                <label className="block"><span className="field-label">Loại sự cố <span className="text-rose-600">*</span></span><select value={incidentType} onChange={(event) => setIncidentType(event.target.value as IncidentType)} className="field-input">{Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <fieldset><legend className="field-label">Mức độ ưu tiên <span className="text-rose-600">*</span></legend><div className="grid grid-cols-3 gap-2">{(['low', 'medium', 'high'] as const).map((value) => <label key={value} className={`cursor-pointer rounded-lg border px-2 py-2.5 text-center text-sm font-semibold ${severity === value ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 text-slate-500'}`}><input type="radio" name="incidentSeverity" value={value} checked={severity === value} onChange={() => setSeverity(value)} className="sr-only peer" /><span className="rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-teal-700">{getIncidentSeverityMeta(value).label}</span></label>)}</div><p className="mt-1.5 text-xs text-slate-500">{SEVERITY_HINTS[severity]}</p></fieldset>
                <label className="block"><span className="field-label">Địa chỉ / mốc hiện trường <span className="text-rose-600">*</span></span><textarea rows={2} maxLength={1000} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="VD: trước cổng nhà máy, ngã ba đường…" className="field-textarea !min-h-[72px]" /></label>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm leading-5 ${locationConfirmed ? 'border-teal-300 bg-teal-50 text-teal-900' : 'border-slate-200 text-slate-600'}`}><input type="checkbox" checked={locationConfirmed} disabled={!position} onChange={(event) => setLocationConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-teal-700" /><span>Tôi đã kiểm tra và xác nhận điểm trên bản đồ đúng vị trí sự cố.</span></label>
              </section>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <section className="min-w-0 space-y-4">
                <h3 ref={stepTitleRef} tabIndex={-1} className="flex items-center gap-2 text-base font-bold text-slate-800 outline-none"><ClipboardList className="size-4 text-teal-700" /> Thông tin hiện trường</h3>
                <label className="block"><span className="field-label">Dấu hiệu và tình trạng hiện trường <span className="text-rose-600">*</span></span><textarea value={description} maxLength={5000} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Mô tả dấu hiệu quan sát, phạm vi ảnh hưởng và rủi ro hiện tại…" className="field-textarea" /><span className="mt-1 block text-xs text-slate-400">Ít nhất 10 ký tự · {description.length}/5.000</span></label>
                <div className="grid gap-3 sm:grid-cols-2"><label><span className="field-label">Kênh tiếp nhận</span><select value={detectionChannel} onChange={(event) => setDetectionChannel(event.target.value as IncidentIntake['detectionChannel'])} className="field-input">{Object.entries(DETECTION_CHANNEL_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span className="field-label">Ảnh hưởng cấp nước</span><select value={serviceImpact} onChange={(event) => setServiceImpact(event.target.value as IncidentIntake['serviceImpact'])} className="field-input">{Object.entries(SERVICE_IMPACT_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
                <label className="block"><span className="field-label">Thời điểm phát hiện <span className="text-rose-600">*</span></span><input type="datetime-local" value={detectedAt} max={toLocalDateTimeInput()} onChange={(event) => setDetectedAt(event.target.value)} className="field-input" /><span className="mt-1 block text-xs text-slate-500">Theo giờ địa phương trên thiết bị. Chọn thời điểm thực tế, không chọn ngày tương lai.</span></label>
                <label className="block"><span className="field-label">Biện pháp đã thực hiện <span className="font-normal text-slate-400">· nếu có</span></span><textarea value={initialResponse} maxLength={2000} onChange={(event) => setInitialResponse(event.target.value)} rows={2} placeholder="VD: đặt cảnh báo, thông báo trực vận hành, kiểm tra van…" className="field-textarea !min-h-[72px]" /></label>
                <div className="rounded-lg border border-slate-200 p-3"><label className="block"><span className="field-label flex items-center gap-2"><ImagePlus className="size-4" />Ảnh hiện trường</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={!online || submitting} className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold file:text-slate-700 disabled:opacity-50" onChange={(event) => { const files = Array.from(event.target.files ?? []); const message = validateIncidentPhotos(files); if (message) { setError(message); event.currentTarget.value = ''; setImageFiles([]); return }; setImageFiles(files); setError('') }} /></label><p className="mt-2 text-xs text-slate-500">{online ? 'Tối đa 3 ảnh JPG, PNG, WebP; mỗi ảnh tối đa 8 MB. Ảnh tải lên sau khi tạo hồ sơ.' : 'Đang lưu trên thiết bị: ảnh chưa được hỗ trợ. Bạn có thể bổ sung ảnh sau khi hồ sơ được lưu lên máy chủ.'}</p>{imageFiles.map((file) => <p key={`${file.name}-${file.size}`} className="mt-1 truncate text-xs text-teal-700">{file.name}</p>)}</div>
              </section>
              <aside className="min-w-0 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800"><CheckCircle2 className="size-4 text-teal-700" /> Kiểm tra trước khi ghi nhận</h3><dl className="space-y-3 text-sm"><div><dt className="text-xs text-slate-500">Phân loại · ưu tiên</dt><dd className="mt-1 font-semibold text-slate-800">{formatIncidentType(incidentType)} · {getIncidentSeverityMeta(severity).label}</dd></div>{anchor && <div><dt className="text-xs text-slate-500">Đối tượng nguồn</dt><dd className="mt-1 break-words text-slate-700">{anchor.origin.featureName}</dd></div>}<div><dt className="text-xs text-slate-500">Địa điểm đã xác nhận</dt><dd className="mt-1 text-slate-700">{address}</dd><dd className="mt-1 text-xs text-slate-500">{latitude}, {longitude}</dd></div><div><dt className="text-xs text-slate-500">Trạng thái sau khi lưu</dt><dd className="mt-1 font-medium text-slate-700">Mới ghi nhận · chờ điều phối</dd></div></dl><p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">{online ? 'Máy chủ cấp mã hồ sơ và xác định hạn SLA theo chính sách hiện hành. Người có quyền điều phối phân công sau khi tiếp nhận.' : 'Hồ sơ được lưu trên thiết bị, chưa đồng bộ lên máy chủ. Chưa có mã chính thức, hạn SLA và phân công xử lý.'}</p></div>
                <div><label className="field-label" htmlFor={`${titleId}-assets`}>Tài sản liên quan <span className="font-normal text-slate-400">· nếu đã xác định</span></label><select id={`${titleId}-assets`} value="" className="field-input" disabled={assetIds.length >= 50} onChange={(event) => { const id = event.target.value; if (id) setAssetIds((current) => current.includes(id) ? current : [...current, id]) }}><option value="">Chọn tài sản…</option>{linkableAssets.filter((asset) => !assetIds.includes(asset.properties.id)).map((asset) => <option key={asset.properties.id} value={asset.properties.id}>{asset.properties.name} · {formatAssetType(asset.properties.type)}</option>)}</select><div className="mt-2 space-y-2">{assetIds.map((id) => <div key={id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700"><span className="min-w-0 break-words">{availableAssets.find((asset) => asset.properties.id === id)?.properties.name ?? id}</span><button type="button" aria-label={`Bỏ tài sản ${availableAssets.find((asset) => asset.properties.id === id)?.properties.name ?? id}`} onClick={() => setAssetIds((current) => current.filter((value) => value !== id))} className="shrink-0 rounded p-1 hover:bg-slate-100"><X className="size-3.5" /></button></div>)}</div>{online && anchor && !anchor.assetId && <p className="mt-2 text-xs leading-5 text-slate-500">Đối tượng CAD được giữ trong thông tin nguồn. Chỉ liên kết tài sản đã có hồ sơ trên máy chủ.</p>}</div>
              </aside>
            </div>
          )}
        </fieldset>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button type="button" disabled={submitting} onClick={step === 1 ? requestClose : () => { setStep(1); setError('') }} className="ghost-btn disabled:opacity-50">{step === 1 ? 'Hủy' : <><ArrowLeft className="mr-1.5 size-4" />Quay lại</>}</button>
          {step === 1 ? <button key="continue" type="button" onClick={(event) => { event.preventDefault(); nextStep() }} className="primary-btn !bg-teal-700 hover:!bg-teal-800">Tiếp tục<ArrowRight className="ml-1.5 size-4" /></button> : <button key="save" type="submit" disabled={submitting} className="primary-btn !bg-teal-700 hover:!bg-teal-800 disabled:cursor-wait disabled:opacity-60">{submitting ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}{submitting ? 'Đang ghi nhận…' : online ? 'Ghi nhận sự cố' : 'Lưu trên thiết bị'}</button>}
        </footer>
      </form>
    </div>
  )
}

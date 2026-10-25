import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, MapPinned, MessageSquareText, RefreshCw, UserRoundCheck, X } from 'lucide-react'
import type { AnyMapFeature, AssetFeature, IncidentAssignee, IncidentFeature, IncidentWorkflowStatus } from '../../types/gis'
import { isLocalDraft } from '../../services/localDraftStore'
import { formatAssetType } from '../../utils/asset'
import { formatIncidentType, getIncidentSeverityMeta, getIncidentStatusMeta } from '../../utils/status'
import { assetChecklist } from './assetQuality'

export interface WorkRecordActions {
  onTransitionIncident?: (id: string, status: IncidentWorkflowStatus, note: string) => Promise<IncidentFeature | null>
  onAssignIncident?: (id: string, assigneeId: string, note: string) => Promise<IncidentFeature | null>
  onLoadIncidentAssignees?: () => Promise<IncidentAssignee[]>
  onAddIncidentComment?: (id: string, content: string) => Promise<unknown>
  canAssignIncident?: boolean
  onEditAsset?: (asset: AssetFeature) => void
  onReportAsset?: (asset: AssetFeature) => void
}

interface Props extends WorkRecordActions {
  feature: AnyMapFeature
  isSynchronized: boolean
  onOpenFeature: (feature: AnyMapFeature) => void
  onUpdated: (incident: IncidentFeature) => void
  onClose: () => void
  onReloadFeature?: () => Promise<void>
}

function dateTime(value?: string): string {
  if (!value) return 'Chưa ghi nhận'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa ghi nhận' : date.toLocaleString('vi-VN')
}

const IMPACT_LABELS = { none: 'Chưa ảnh hưởng cấp nước', reduced: 'Giảm áp / giảm lưu lượng', interrupted: 'Gián đoạn cấp nước', unknown: 'Chưa xác định' }
const CHANNEL_LABELS = { site_inspection: 'Kiểm tra hiện trường', phone: 'Điện thoại phản ánh', field_report: 'Nhân viên báo về' }

export function WorkRecordPanel({ feature, isSynchronized, onOpenFeature, onUpdated, onClose, onReloadFeature, onTransitionIncident, onAssignIncident, onLoadIncidentAssignees, onAddIncidentComment, canAssignIncident, onEditAsset, onReportAsset }: Props) {
  const [assignees, setAssignees] = useState<IncidentAssignee[]>([])
  const [assignee, setAssignee] = useState('')
  const [assigneeLoading, setAssigneeLoading] = useState(false)
  const [assigneeError, setAssigneeError] = useState('')
  const [assigneeRefresh, setAssigneeRefresh] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const incident = feature.properties.type === 'incident' ? feature as IncidentFeature : null
  const asset = !incident ? feature as AssetFeature : null
  const canLoadAssignees = Boolean(incident && isSynchronized && !isLocalDraft(feature) && canAssignIncident)

  useEffect(() => {
    if (!canLoadAssignees || !onLoadIncidentAssignees) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setAssigneeLoading(true)
      setAssigneeError('')
      onLoadIncidentAssignees().then((items) => {
        if (!cancelled) setAssignees(items)
      }).catch((reason: unknown) => {
        if (!cancelled) setAssigneeError(reason instanceof Error ? reason.message : 'Không tải được danh sách người xử lý')
      }).finally(() => { if (!cancelled) setAssigneeLoading(false) })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [canLoadAssignees, onLoadIncidentAssignees, assigneeRefresh])

  async function run(action: string, callback: () => Promise<unknown>, message: string) {
    if (busy) return
    setBusy(action)
    setError('')
    setSuccess('')
    try {
      await callback()
      if (action !== 'reload') setNote('')
      setSuccess(message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu thay đổi. Vui lòng thử lại.')
    } finally {
      setBusy('')
    }
  }

  async function transition(status: IncidentWorkflowStatus) {
    if (!incident || !onTransitionIncident) return
    const updated = await onTransitionIncident(incident.properties.id, status, note.trim())
    if (!updated) throw new Error('Thay đổi chưa được lưu. Vui lòng tải lại và thử lại.')
    onUpdated(updated)
  }

  return <aside className="panel flex min-h-0 flex-col overflow-hidden xl:w-[390px] xl:shrink-0" aria-label="Hồ sơ công việc">
    <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
      <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-water-700">{incident ? 'Hồ sơ xử lý sự cố' : 'Hồ sơ tài sản'}</p><h2 className="mt-1 break-words text-base font-bold text-slate-900">{incident?.properties.incidentCode ?? feature.properties.assetCode ?? formatAssetType((feature as AssetFeature).properties.type)}</h2><p className="mt-1 break-words text-sm text-slate-600">{feature.properties.name}</p></div>
      <button type="button" className="ghost-btn shrink-0 !p-2" aria-label="Đóng hồ sơ công việc" onClick={onClose}><X className="size-4" /></button>
    </header>
    <div className="min-h-0 space-y-4 overflow-auto p-4">
      {isLocalDraft(feature) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Hồ sơ lưu trên thiết bị. Thao tác được lưu tại đây, chưa gửi lên máy chủ.</p>}
      <button type="button" onClick={() => onOpenFeature(feature)} className="ghost-btn w-full"><MapPinned className="mr-2 size-4" />Xem trên bản đồ</button>
      {isSynchronized && !isLocalDraft(feature) && onReloadFeature && <button type="button" className="ghost-btn w-full" disabled={Boolean(busy)} onClick={() => void run('reload', onReloadFeature, 'Đã tải phiên bản mới nhất. Nhật ký đang nhập được giữ lại.')}><RefreshCw className={`mr-2 size-4 ${busy === 'reload' ? 'animate-spin' : ''}`} />Tải lại hồ sơ</button>}
      {incident ? <>
        <div className="flex flex-wrap gap-2"><span className={`status-chip ${getIncidentStatusMeta(incident.properties.status).className}`}>{getIncidentStatusMeta(incident.properties.status).label}</span><span className={`status-chip ${getIncidentSeverityMeta(incident.properties.severity).className}`}>Mức {getIncidentSeverityMeta(incident.properties.severity).label}</span></div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-slate-500">Loại sự cố</dt><dd className="mt-1 font-semibold text-slate-800">{formatIncidentType(incident.properties.incidentType)}</dd></div>
          <div><dt className="text-xs text-slate-500">Người phụ trách</dt><dd className="mt-1 font-semibold text-slate-800">{incident.properties.assignedTo || 'Chưa phân công'}</dd></div>
          <div className="col-span-2 rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Hạn xử lý SLA</dt><dd className={`mt-1 font-bold ${incident.properties.overdue && incident.properties.status !== 'resolved' ? 'text-rose-700' : 'text-slate-800'}`}>{dateTime(incident.properties.dueAt)}{incident.properties.overdue && incident.properties.status !== 'resolved' && ' · Quá hạn'}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-slate-500">Vị trí hiện trường</dt><dd className="mt-1 text-slate-700">{incident.properties.address || incident.properties.origin?.featureName || 'Theo tọa độ đã ghi nhận'}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-slate-500">Hiện trạng</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700">{incident.properties.description}</dd></div>
        </dl>
        {incident.properties.intake && <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm"><h3 className="font-bold text-slate-800">Thông tin tiếp nhận</h3><p className="text-slate-600">{CHANNEL_LABELS[incident.properties.intake.detectionChannel]} · {dateTime(incident.properties.intake.detectedAt)}</p><p className="font-semibold text-slate-700">{IMPACT_LABELS[incident.properties.intake.serviceImpact]}</p>{incident.properties.intake.initialResponse && <p className="whitespace-pre-wrap text-slate-600">Xử lý ban đầu: {incident.properties.intake.initialResponse}</p>}</div>}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><ClipboardList className="size-4" />Điều phối và xử lý</h3>
          {canAssignIncident && incident.properties.status !== 'resolved' && <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600" htmlFor="work-assignee">Phân công người phụ trách</label>
            {canLoadAssignees ? <><select id="work-assignee" className="field-input" value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={assigneeLoading || Boolean(busy)}><option value="">{assigneeLoading ? 'Đang tải danh bạ...' : 'Chọn người xử lý'}</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select>{assigneeError && <p role="alert" className="text-xs text-rose-700">{assigneeError} <button type="button" onClick={() => setAssigneeRefresh((value) => value + 1)} className="font-semibold underline">Thử lại</button></p>}{!assigneeLoading && !assigneeError && assignees.length === 0 && <p className="text-xs text-slate-500">Chưa có nhân sự hoạt động trong danh bạ máy chủ.</p>}<button type="button" className="ghost-btn w-full" disabled={!assignee || Boolean(busy) || !onAssignIncident} onClick={() => void run('assign', async () => { const updated = await onAssignIncident?.(incident.properties.id, assignee, note.trim()); if (!updated) throw new Error('Phân công chưa được lưu'); onUpdated(updated) }, 'Đã lưu phân công người xử lý.')}><UserRoundCheck className="mr-2 size-4" />Lưu phân công</button></> : <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Phân công nhân sự cần hồ sơ được lưu trên máy chủ và danh bạ đang hoạt động.</p>}
          </div>}
          <label className="block text-xs font-semibold text-slate-600" htmlFor="work-note">Nhật ký / kết quả xử lý</label>
          <textarea id="work-note" className="field-input min-h-24 resize-y" maxLength={2000} placeholder="Mô tả kiểm tra, biện pháp đã thực hiện và kết quả khắc phục..." value={note} onChange={(event) => setNote(event.target.value)} disabled={Boolean(busy)} />
          {onAddIncidentComment && <button type="button" className="ghost-btn w-full" disabled={!note.trim() || Boolean(busy)} onClick={() => void run('comment', () => onAddIncidentComment(incident.properties.id, note.trim()), 'Đã lưu nhật ký vào hồ sơ sự cố.')}><MessageSquareText className="mr-2 size-4" />Lưu nhật ký</button>}
          {incident.properties.status === 'new' && onTransitionIncident && <button type="button" className="primary-btn w-full" disabled={Boolean(busy) || (isSynchronized && !isLocalDraft(feature) && !incident.properties.assignedUserId && !incident.properties.assignedTo?.trim())} onClick={() => void run('start', () => transition('in_progress'), 'Đã chuyển sang đang xử lý.')}><RefreshCw className="mr-2 size-4" />Bắt đầu xử lý</button>}
          {incident.properties.status === 'new' && isSynchronized && !isLocalDraft(feature) && !incident.properties.assignedUserId && !incident.properties.assignedTo?.trim() && <p className="text-xs text-slate-500">Phân công người phụ trách trước khi bắt đầu xử lý.</p>}
          {incident.properties.status === 'in_progress' && onTransitionIncident && <><button type="button" className="primary-btn w-full" disabled={Boolean(busy) || !note.trim()} onClick={() => void run('resolve', () => transition('resolved'), 'Đã đóng sự cố và lưu kết quả khắc phục.')}><CheckCircle2 className="mr-2 size-4" />Hoàn tất xử lý</button><p className="text-xs text-slate-500">Bắt buộc ghi kết quả khắc phục trước khi hoàn tất.</p></>}
          {incident.properties.status === 'resolved' && onTransitionIncident && <button type="button" className="ghost-btn w-full" disabled={Boolean(busy) || !note.trim()} onClick={() => void run('reopen', () => transition('in_progress'), 'Đã mở lại sự cố.')}><AlertTriangle className="mr-2 size-4" />Mở lại sự cố (cần lý do)</button>}
        </div>
      </> : <>
        {asset && <div className="rounded-lg border border-slate-200 p-3"><h3 className="text-sm font-bold text-slate-800">Rà soát thông tin hồ sơ</h3><ul className="mt-3 space-y-2">{assetChecklist(asset).map((check) => <li key={check.label} className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-600">{check.label}</span><span className={`font-semibold ${check.present ? 'text-emerald-700' : 'text-amber-700'}`}>{check.present ? 'Đã có' : 'Cần bổ sung'}</span></li>)}</ul><p className="mt-3 text-[11px] leading-5 text-slate-500">Bổ sung thông số → kiểm tra hiện trường → cập nhật trạng thái trong hồ sơ. Danh sách này kiểm tra việc điền thông tin, chưa xác nhận độ chính xác hoặc việc hoàn tất bảo trì.</p></div>}
        <dl className="space-y-3 text-sm"><div><dt className="text-xs text-slate-500">Loại tài sản</dt><dd className="mt-1 font-semibold text-slate-800">{formatAssetType((feature as AssetFeature).properties.type)}</dd></div><div><dt className="text-xs text-slate-500">Địa chỉ</dt><dd className="mt-1 text-slate-700">{feature.properties.address || 'Cần bổ sung vị trí mô tả'}</dd></div><div><dt className="text-xs text-slate-500">Mô tả hồ sơ</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700">{feature.properties.description || 'Chưa có mô tả'}</dd></div>{[['Đường kính', asset?.properties.diameter], ['Vật liệu', asset?.properties.material], ['Chiều dài', asset?.properties.length], ['Công suất', asset?.properties.capacity], ['Diện tích', asset?.properties.area], ['Dung tích', asset?.properties.volume]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-700">{value}</dd></div>)}</dl>
        <div className="space-y-2 border-t border-slate-100 pt-4">{onEditAsset && <button type="button" className="primary-btn w-full" onClick={() => onEditAsset(feature as AssetFeature)}>Cập nhật hồ sơ</button>}{onReportAsset && <button type="button" className="ghost-btn w-full" onClick={() => onReportAsset(feature as AssetFeature)}><AlertTriangle className="mr-2 size-4" />Ghi nhận sự cố tài sản này</button>}</div>
      </>}
      {busy && <p role="status" className="text-xs text-water-700">Đang xử lý...</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}{isSynchronized && !isLocalDraft(feature) && ' · Nếu hồ sơ đã đổi ở nơi khác, bấm Tải lại hồ sơ rồi thực hiện lại.'}</p>}
      {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{success}</p>}
    </div>
  </aside>
}

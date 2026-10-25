import { useEffect, useState } from 'react'
import { AlertOctagon, CheckCircle2, Clock3, ImagePlus, Link2, MessageSquareText, UserRoundCheck, X } from 'lucide-react'
import type {
  AssetFeature,
  IncidentAttachment,
  IncidentAssignee,
  IncidentFeature,
  IncidentHistoryItem,
  IncidentLinkedAsset,
  IncidentWorkflowStatus,
} from '../../types/gis'
import { getIncidentStatusMeta } from '../../utils/status'
import { Skeleton } from '../ui/Feedback'
import { isServerFeature } from '../../services/localDraftStore'

interface Props {
  incident: IncidentFeature
  onTransition: (status: IncidentWorkflowStatus, note: string) => Promise<void>
  onAssign: (assignee: string, note: string) => Promise<void>
  onEscalate: (note: string) => Promise<void>
  onComment: (content: string) => Promise<void>
  onLoadAssignees: () => Promise<IncidentAssignee[]>
  onLoadLinkedAssets: (id: string) => Promise<IncidentLinkedAsset[]>
  onUpdateLinkedAssets: (assetIds: string[], note: string) => Promise<void>
  onLoadHistory: (id: string) => Promise<IncidentHistoryItem[]>
  onLoadAttachments: (id: string) => Promise<IncidentAttachment[]>
  onUpload: (id: string, file: File) => Promise<IncidentAttachment>
  canAssign: boolean
  availableAssets: AssetFeature[]
}

const NEXT_ACTIONS: Record<IncidentWorkflowStatus, Array<{ status: IncidentWorkflowStatus; label: string }>> = {
  new: [{ status: 'in_progress', label: 'Bắt đầu xử lý' }],
  in_progress: [
    { status: 'resolved', label: 'Đánh dấu đã xử lý' },
    { status: 'new', label: 'Đưa về chờ xử lý' },
  ],
  resolved: [{ status: 'in_progress', label: 'Mở lại sự cố' }],
}

function historyLabel(item: IncidentHistoryItem): string {
  if (item.eventType === 'created') return 'Đã ghi nhận sự cố'
  if (item.eventType === 'assignment_changed') return 'Đã phân công người xử lý'
  if (item.eventType === 'attachment_added') return 'Đã thêm hình ảnh hiện trường'
  if (item.eventType === 'comment') return 'Đã thêm trao đổi'
  if (item.eventType === 'escalated') return 'Đã nâng mức cảnh báo SLA'
  if (item.eventType === 'assets_linked') return 'Đã cập nhật tài sản liên quan'
  return `${item.fromStatus ? getIncidentStatusMeta(item.fromStatus).label : 'Khởi tạo'} → ${getIncidentStatusMeta(item.toStatus).label}`
}

export function IncidentWorkflowPanel({
  incident,
  onTransition,
  onAssign,
  onEscalate,
  onComment,
  onLoadAssignees,
  onLoadLinkedAssets,
  onUpdateLinkedAssets,
  onLoadHistory,
  onLoadAttachments,
  onUpload,
  canAssign,
  availableAssets,
}: Props) {
  const [history, setHistory] = useState<IncidentHistoryItem[]>([])
  const [attachments, setAttachments] = useState<IncidentAttachment[]>(incident.properties.attachments ?? [])
  const [note, setNote] = useState('')
  const [assignee, setAssignee] = useState(incident.properties.assignedUserId ?? '')
  const [assignees, setAssignees] = useState<IncidentAssignee[]>([])
  const [linkedAssets, setLinkedAssets] = useState<IncidentLinkedAsset[]>([])
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(incident.properties.assetIds ?? [])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [loadedKey, setLoadedKey] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const loadKey = `${incident.properties.id}:${incident.properties.version ?? 0}`

  const refreshHistory = async () => {
    const items = await onLoadHistory(incident.properties.id)
    setHistory(items)
  }

  useEffect(() => {
    let active = true
    void Promise.allSettled([
      onLoadHistory(incident.properties.id),
      onLoadAttachments(incident.properties.id),
      onLoadAssignees(),
      onLoadLinkedAssets(incident.properties.id),
    ])
      .then(([historyResult, attachmentResult, assigneeResult, assetResult]) => {
        if (!active) return
        if (historyResult.status === 'fulfilled') setHistory(historyResult.value)
        if (attachmentResult.status === 'fulfilled') setAttachments(attachmentResult.value)
        if (assigneeResult.status === 'fulfilled') setAssignees(assigneeResult.value)
        if (assetResult.status === 'fulfilled') {
          setLinkedAssets(assetResult.value)
          setSelectedAssetIds(assetResult.value.map((asset) => asset.id))
        }
        setAssignee(incident.properties.assignedUserId ?? '')
        setLoadedKey(loadKey)
        if ([historyResult, attachmentResult, assigneeResult, assetResult].some((result) => result.status === 'rejected')) {
          setError('Một phần dữ liệu xử lý chưa tải được; bạn vẫn có thể dùng các khu vực còn lại.')
        }
      })
    return () => { active = false }
  }, [incident.properties.assignedUserId, incident.properties.id, incident.properties.version, loadKey, onLoadAssignees, onLoadAttachments, onLoadHistory, onLoadLinkedAssets])

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0)
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => {
      window.clearTimeout(initialUpdate)
      window.clearInterval(interval)
    }
  }, [])

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    setError('')
    try {
      await action()
      await refreshHistory()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể thực hiện thao tác')
    } finally {
      setBusy('')
    }
  }

  const dueTime = incident.properties.dueAt ? new Date(incident.properties.dueAt).getTime() : null
  const remainingMinutes = dueTime ? Math.ceil((dueTime - now) / 60_000) : null
  const isOverdue = incident.properties.status !== 'resolved' && remainingMinutes !== null && remainingMinutes < 0
  const slaLabel = incident.properties.status === 'resolved' ? 'Đã hoàn tất xử lý' : remainingMinutes === null
    ? 'Chưa xác định hạn xử lý'
    : remainingMinutes < 0
      ? `Quá hạn ${Math.abs(remainingMinutes)} phút`
      : remainingMinutes < 60
        ? `Còn ${remainingMinutes} phút`
        : `Còn ${Math.ceil(remainingMinutes / 60)} giờ`

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <div className={`rounded-xl border p-3 ${isOverdue ? 'border-rose-200 bg-rose-50' : 'border-sky-200 bg-sky-50'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">SLA xử lý</p>
            <p className={`mt-1 text-sm font-bold ${isOverdue ? 'text-rose-700' : 'text-sky-800'}`}>{slaLabel}</p>
            {incident.properties.dueAt && <p className="mt-0.5 text-xs text-slate-500">Hạn: {new Date(incident.properties.dueAt).toLocaleString('vi-VN')}</p>}
          </div>
          <span className="status-chip bg-white text-slate-700">Cấp {incident.properties.escalationLevel ?? 0}</span>
        </div>
        {canAssign && incident.properties.status !== 'resolved' && (
          <button
            type="button"
            className="ghost-btn mt-3 border-rose-200 text-rose-700"
            disabled={!note.trim() || Boolean(busy) || (incident.properties.escalationLevel ?? 0) >= 3}
            title={(incident.properties.escalationLevel ?? 0) >= 3
              ? 'Sự cố đã ở mức cảnh báo cao nhất'
              : !note.trim() ? 'Nhập ghi chú trước khi escalation' : undefined}
            onClick={() => void run('escalate', () => onEscalate(note.trim()))}
          >
            <AlertOctagon className="mr-1 size-4" /> {busy === 'escalate'
              ? 'Đang gửi...'
              : (incident.properties.escalationLevel ?? 0) >= 3 ? 'Đã ở mức cao nhất' : 'Nâng mức cảnh báo'}
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Clock3 className="size-4" /> Quy trình xử lý
        </p>
        <textarea
          className="field-textarea min-h-20"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          placeholder="Ghi kết quả khắc phục hoặc lý do chuyển trạng thái…"
        />
        <p className="mt-1 text-xs text-slate-500">Cần ghi kết quả khi hoàn tất và lý do khi mở lại sự cố.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {NEXT_ACTIONS[incident.properties.status].map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={Boolean(busy) || ((action.status === 'resolved' || incident.properties.status === 'resolved') && !note.trim())
                || (action.status === 'in_progress' && incident.properties.status === 'new' && isServerFeature(incident) && !incident.properties.assignedUserId && !incident.properties.assignedTo?.trim())}
              title={action.status === 'in_progress' && incident.properties.status === 'new' && isServerFeature(incident) && !incident.properties.assignedUserId && !incident.properties.assignedTo?.trim() ? 'Phân công người phụ trách trước khi bắt đầu xử lý' : undefined}
              className={action.status === 'resolved' ? 'primary-btn' : 'ghost-btn'}
              onClick={() => void run(`status-${action.status}`, async () => {
                await onTransition(action.status, note)
                setNote('')
              })}
            >
              <CheckCircle2 className="mr-1 size-4" />
              {busy === `status-${action.status}` ? 'Đang cập nhật...' : action.label}
            </button>
          ))}
        </div>
      </div>

      {canAssign && <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <UserRoundCheck className="size-4" /> Người xử lý
        </p>
        <div className="flex gap-2">
          <select
            className="field-input min-w-0 flex-1"
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option value="">Chọn người xử lý...</option>
            {assignees.map((item) => (
              <option key={item.id} value={item.id}>{item.displayName} · {item.role === 'technician' ? 'Kỹ thuật viên' : item.role === 'manager' ? 'Quản lý' : 'Quản trị'}</option>
            ))}
          </select>
          <button
            type="button"
            className="ghost-btn shrink-0"
            disabled={!assignee.trim() || Boolean(busy)}
            onClick={() => void run('assign', () => onAssign(assignee.trim(), note))}
          >
            {busy === 'assign' ? 'Đang lưu...' : 'Phân công'}
          </button>
        </div>
      </div>}

      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Link2 className="size-4" /> Tài sản liên quan
        </p>
        {canAssign && (
          <select
            className="field-input"
            value=""
            onChange={(event) => {
              const id = event.target.value
              if (id) setSelectedAssetIds((current) => current.includes(id) ? current : [...current, id])
            }}
          >
            <option value="">Chọn thêm tài sản...</option>
            {availableAssets.filter((asset) => !selectedAssetIds.includes(asset.properties.id)).map((asset) => (
              <option key={asset.properties.id} value={asset.properties.id}>{asset.properties.name}</option>
            ))}
          </select>
        )}
        <div className="mt-2 space-y-2">
          {selectedAssetIds.map((id) => {
            const asset = availableAssets.find((item) => item.properties.id === id)
            const linked = linkedAssets.find((item) => item.id === id)
            return (
              <div key={id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <div className="min-w-0"><p className="truncate font-semibold text-slate-700">{asset?.properties.name ?? linked?.name ?? id}</p><p className="truncate text-xs text-slate-400">{linked?.assetCode ?? asset?.properties.id}</p></div>
                {canAssign && <button type="button" onClick={() => setSelectedAssetIds((current) => current.filter((value) => value !== id))} className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Bỏ liên kết"><X className="size-4" /></button>}
              </div>
            )
          })}
          {selectedAssetIds.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">Chưa liên kết tài sản.</p>}
        </div>
        {canAssign && (
          <button
            type="button"
            className="ghost-btn mt-2"
            disabled={Boolean(busy) || JSON.stringify([...selectedAssetIds].sort()) === JSON.stringify(linkedAssets.map((asset) => asset.id).sort())}
            onClick={() => void run('assets', async () => {
              await onUpdateLinkedAssets(selectedAssetIds, note)
              const items = await onLoadLinkedAssets(incident.properties.id)
              setLinkedAssets(items)
            })}
          >
            {busy === 'assets' ? 'Đang lưu...' : 'Lưu liên kết'}
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ImagePlus className="size-4" /> Hình ảnh hiện trường
        </p>
        <label className="ghost-btn inline-flex cursor-pointer">
          <ImagePlus className="mr-1 size-4" /> {busy === 'upload' ? 'Đang tải...' : 'Thêm ảnh'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={Boolean(busy)}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.currentTarget.value = ''
              if (!file) return
              void run('upload', async () => {
                const uploaded = await onUpload(incident.properties.id, file)
                setAttachments((current) => [uploaded, ...current])
              })
            }}
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG hoặc WebP; tối đa 8 MB mỗi ảnh.</p>
        {attachments.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {attachments.map((attachment) => attachment.url ? (
              <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-slate-200">
                <img src={attachment.url} alt={attachment.name} className="h-24 w-full object-cover transition group-hover:scale-105" />
                <p className="truncate px-2 py-1 text-xs text-slate-600">{attachment.name}</p>
              </a>
            ) : (
              <div key={attachment.id} className="rounded-lg border border-slate-200 p-2 text-xs text-slate-500">{attachment.name}</div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <MessageSquareText className="size-4" /> Trao đổi
        </p>
        <div className="flex gap-2">
          <input className="field-input min-w-0 flex-1" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Thêm nội dung trao đổi" />
          <button
            type="button"
            className="ghost-btn shrink-0"
            disabled={!comment.trim() || Boolean(busy)}
            onClick={() => void run('comment', async () => {
              await onComment(comment.trim())
              setComment('')
            })}
          >
            {busy === 'comment' ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Lịch sử hoạt động</p>
        {loadedKey !== loadKey ? (
          <div className="space-y-2" role="status" aria-label="Đang tải lịch sử hoạt động">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có hoạt động.</p>
        ) : (
          <ol className="space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-700">{historyLabel(item)}</p>
                {item.note && <p className="mt-0.5 text-slate-600">{item.note}</p>}
                <p className="mt-1 text-xs text-slate-400">{new Date(item.changedAt).toLocaleString('vi-VN')}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

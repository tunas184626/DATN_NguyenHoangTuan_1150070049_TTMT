import { useEffect, useState } from 'react'
import {
  AlertOctagon,
  CheckCircle2,
  Clock3,
  History,
  ImagePlus,
  Link2,
  MessageSquareText,
  Send,
  ShieldAlert,
  UserRoundCheck,
  X,
} from 'lucide-react'
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

const WORKFLOW_STEPS: Array<{ status: IncidentWorkflowStatus; label: string }> = [
  { status: 'new', label: 'Mới' },
  { status: 'in_progress', label: 'Đang xử lý' },
  { status: 'resolved', label: 'Hoàn tất' },
]

function historyLabel(item: IncidentHistoryItem): string {
  if (item.eventType === 'created') return 'Đã ghi nhận sự cố'
  if (item.eventType === 'assignment_changed') return 'Đã phân công người xử lý'
  if (item.eventType === 'attachment_added') return 'Đã thêm hình ảnh hiện trường'
  if (item.eventType === 'comment') return 'Đã thêm trao đổi'
  if (item.eventType === 'escalated') return 'Đã nâng mức cảnh báo SLA'
  if (item.eventType === 'assets_linked') return 'Đã cập nhật tài sản liên quan'
  return `${item.fromStatus ? getIncidentStatusMeta(item.fromStatus).label : 'Khởi tạo'} → ${getIncidentStatusMeta(item.toStatus).label}`
}

function historyDotClass(item: IncidentHistoryItem): string {
  if (item.eventType === 'escalated') return 'ring-rose-300 bg-rose-500'
  if (item.eventType === 'assignment_changed') return 'ring-sky-300 bg-sky-500'
  if (item.eventType === 'comment') return 'ring-indigo-300 bg-indigo-500'
  if (item.eventType === 'attachment_added') return 'ring-teal-300 bg-teal-500'
  if (item.eventType === 'assets_linked') return 'ring-water-300 bg-water-600'
  if (item.toStatus === 'resolved') return 'ring-emerald-300 bg-emerald-500'
  if (item.toStatus === 'in_progress') return 'ring-amber-300 bg-amber-500'
  return 'ring-slate-300 bg-slate-400'
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
  const isResolved = incident.properties.status === 'resolved'
  const isOverdue = !isResolved && remainingMinutes !== null && remainingMinutes < 0
  const slaLabel = isResolved
    ? 'Đã hoàn tất xử lý'
    : remainingMinutes === null
      ? 'Chưa xác định hạn xử lý'
      : remainingMinutes < 0
        ? `Quá hạn ${Math.abs(remainingMinutes)} phút`
        : remainingMinutes < 60
          ? `Còn ${remainingMinutes} phút`
          : `Còn ${Math.ceil(remainingMinutes / 60)} giờ`

  const escalationLevel = incident.properties.escalationLevel ?? 0
  const currentStepIndex = WORKFLOW_STEPS.findIndex((step) => step.status === incident.properties.status)
  const needsAssigneeBeforeStart = incident.properties.status === 'new'
    && isServerFeature(incident)
    && !incident.properties.assignedUserId
    && !incident.properties.assignedTo?.trim()
  const assetsDirty = JSON.stringify([...selectedAssetIds].sort()) !== JSON.stringify(linkedAssets.map((asset) => asset.id).sort())

  return (
    <div className="space-y-3.5">
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* 1. SLA & Escalation Card */}
      <section
        className={`overflow-hidden rounded-xl border p-3 shadow-sm ${
          isResolved
            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white'
            : isOverdue
              ? 'border-rose-300 bg-gradient-to-br from-rose-50 to-orange-50/60'
              : 'border-sky-200 bg-gradient-to-br from-sky-50/90 to-water-50/40'
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <Clock3 className={`size-3.5 ${isOverdue ? 'text-rose-600' : isResolved ? 'text-emerald-600' : 'text-sky-600'}`} />
              SLA xử lý
            </p>
            <p
              className={`mt-1 text-sm font-bold ${
                isOverdue ? 'text-rose-700' : isResolved ? 'text-emerald-800' : 'text-sky-900'
              }`}
            >
              {slaLabel}
            </p>
            {incident.properties.dueAt && (
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Hạn: {new Date(incident.properties.dueAt).toLocaleString('vi-VN')}
              </p>
            )}
          </div>
          <span
            className={`status-chip shrink-0 ${
              escalationLevel > 0
                ? 'border-orange-300 bg-orange-100 text-orange-800'
                : 'border-slate-200 bg-white/90 text-slate-700'
            }`}
          >
            <ShieldAlert className="mr-1 size-3" />
            Cấp {escalationLevel}
          </span>
        </div>

        {canAssign && !isResolved && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-2.5">
            <span className="text-[11px] text-slate-500">
              {escalationLevel >= 3
                ? 'Đã ở mức cảnh báo tối đa'
                : !note.trim()
                  ? 'Nhập ghi chú bên dưới để nâng cảnh báo'
                  : 'Sẵn sàng gửi cảnh báo SLA'}
            </span>
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!note.trim() || Boolean(busy) || escalationLevel >= 3}
              title={escalationLevel >= 3
                ? 'Sự cố đã ở mức cảnh báo cao nhất'
                : !note.trim() ? 'Nhập ghi chú trước khi escalation' : undefined}
              onClick={() => void run('escalate', () => onEscalate(note.trim()))}
            >
              <AlertOctagon className="size-3.5" />
              {busy === 'escalate'
                ? 'Đang gửi...'
                : escalationLevel >= 3 ? 'Mức cao nhất' : 'Nâng mức cảnh báo'}
            </button>
          </div>
        )}
      </section>

      {/* 2. Workflow State & Transition Card */}
      <section className="overflow-hidden rounded-xl border border-water-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-water-100 bg-water-50/70 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-water-900">
            <CheckCircle2 className="size-3.5 text-water-600" />
            Quy trình xử lý
          </span>
          <span className="text-[11px] font-semibold text-water-700">
            Bước {currentStepIndex + 1}/{WORKFLOW_STEPS.length}
          </span>
        </div>

        <div className="space-y-3 p-3">
          {/* 3-Step Visual Lifecycle Indicator */}
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-slate-50 p-1.5">
            {WORKFLOW_STEPS.map((step, index) => {
              const isCurrent = step.status === incident.properties.status
              const isDone = index < currentStepIndex
              const pillClass = isCurrent
                ? step.status === 'resolved'
                  ? 'border-emerald-300 bg-emerald-600 text-white shadow-sm'
                  : step.status === 'in_progress'
                    ? 'border-amber-300 bg-amber-500 text-white shadow-sm'
                    : 'border-rose-300 bg-rose-600 text-white shadow-sm'
                : isDone
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-transparent bg-transparent text-slate-400'
              return (
                <div
                  key={step.status}
                  className={`flex items-center justify-center rounded-md border px-1.5 py-1 text-[11px] font-bold transition ${pillClass}`}
                >
                  {step.label}
                </div>
              )
            })}
          </div>

          <div>
            <textarea
              className="field-textarea min-h-20 text-xs"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              placeholder="Ghi kết quả khắc phục, lý do chuyển trạng thái hoặc cảnh báo…"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Bắt buộc ghi kết quả khi hoàn tất, lý do khi mở lại hoặc nâng mức cảnh báo.
            </p>
          </div>

          {needsAssigneeBeforeStart && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
              Cần phân công người phụ trách trước khi chuyển sang Đang xử lý.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {NEXT_ACTIONS[incident.properties.status].map((action) => {
              const disabled = Boolean(busy)
                || ((action.status === 'resolved' || incident.properties.status === 'resolved') && !note.trim())
                || (action.status === 'in_progress' && needsAssigneeBeforeStart)

              const buttonClass = action.status === 'resolved'
                ? 'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
                : action.status === 'in_progress' && incident.properties.status === 'new'
                  ? 'primary-btn min-h-9 flex-1 justify-center text-xs font-bold'
                  : 'ghost-btn min-h-9 flex-1 justify-center text-xs font-semibold'

              return (
                <button
                  key={action.status}
                  type="button"
                  disabled={disabled}
                  title={action.status === 'in_progress' && needsAssigneeBeforeStart
                    ? 'Phân công người phụ trách trước khi bắt đầu xử lý'
                    : undefined}
                  className={buttonClass}
                  onClick={() => void run(`status-${action.status}`, async () => {
                    await onTransition(action.status, note)
                    setNote('')
                  })}
                >
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  {busy === `status-${action.status}` ? 'Đang cập nhật...' : action.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* 3. Assignee Card */}
      {canAssign && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <UserRoundCheck className="size-3.5 text-emerald-600" />
              Phân công xử lý
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                incident.properties.assignedTo
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {incident.properties.assignedTo || 'Chưa phân công'}
            </span>
          </div>
          <div className="flex gap-2 p-3">
            <select
              className="field-input min-w-0 flex-1 text-xs"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Chọn người xử lý...</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName} · {item.role === 'technician' ? 'Kỹ thuật viên' : item.role === 'manager' ? 'Quản lý' : 'Quản trị'}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ghost-btn shrink-0 px-3 text-xs font-bold"
              disabled={!assignee.trim() || Boolean(busy)}
              onClick={() => void run('assign', () => onAssign(assignee.trim(), note))}
            >
              {busy === 'assign' ? 'Đang lưu...' : 'Phân công'}
            </button>
          </div>
        </section>
      )}

      {/* 4. Linked Assets Card */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <Link2 className="size-3.5 text-water-600" />
            Tài sản liên quan
          </span>
          <span className="rounded-full bg-water-50 px-2 py-0.5 text-[10px] font-bold text-water-800">
            {selectedAssetIds.length} tài sản
          </span>
        </div>

        <div className="space-y-2.5 p-3">
          {canAssign && (
            <select
              className="field-input text-xs"
              value=""
              onChange={(event) => {
                const id = event.target.value
                if (id) setSelectedAssetIds((current) => current.includes(id) ? current : [...current, id])
              }}
            >
              <option value="">Chọn thêm tài sản liên quan...</option>
              {availableAssets.filter((asset) => !selectedAssetIds.includes(asset.properties.id)).map((asset) => (
                <option key={asset.properties.id} value={asset.properties.id}>{asset.properties.name}</option>
              ))}
            </select>
          )}

          <div className="space-y-1.5">
            {selectedAssetIds.map((id) => {
              const asset = availableAssets.find((item) => item.properties.id === id)
              const linked = linkedAssets.find((item) => item.id === id)
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 px-2.5 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{asset?.properties.name ?? linked?.name ?? id}</p>
                    <p className="truncate font-mono text-[11px] text-slate-400">{linked?.assetCode ?? asset?.properties.id}</p>
                  </div>
                  {canAssign && (
                    <button
                      type="button"
                      onClick={() => setSelectedAssetIds((current) => current.filter((value) => value !== id))}
                      className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Bỏ liên kết"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
            {selectedAssetIds.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-2.5 text-center text-xs text-slate-500">
                Chưa liên kết tài sản nào.
              </p>
            )}
          </div>

          {canAssign && (
            <div className="flex items-center justify-between gap-2">
              {assetsDirty ? (
                <span className="text-[11px] font-semibold text-amber-700">Có thay đổi chưa lưu</span>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="ghost-btn px-3 text-xs font-bold"
                disabled={Boolean(busy) || !assetsDirty}
                onClick={() => void run('assets', async () => {
                  await onUpdateLinkedAssets(selectedAssetIds, note)
                  const items = await onLoadLinkedAssets(incident.properties.id)
                  setLinkedAssets(items)
                })}
              >
                {busy === 'assets' ? 'Đang lưu...' : 'Lưu liên kết'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 5. Field Photos Card */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <ImagePlus className="size-3.5 text-teal-600" />
            Hình ảnh hiện trường
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            {attachments.length} ảnh
          </span>
        </div>

        <div className="space-y-2.5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="ghost-btn inline-flex cursor-pointer px-3 text-xs font-bold">
              <ImagePlus className="mr-1.5 size-3.5" />
              {busy === 'upload' ? 'Đang tải...' : 'Thêm ảnh hiện trường'}
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
            <span className="text-[11px] text-slate-400">JPG, PNG, WebP · ≤ 8 MB</span>
          </div>

          {attachments.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {attachments.map((attachment) => attachment.url ? (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-water-300"
                >
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-24 w-full object-cover transition group-hover:scale-105"
                  />
                  <p className="truncate bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                    {attachment.name}
                  </p>
                </a>
              ) : (
                <div key={attachment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500">
                  {attachment.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 6. Comments & Activity Timeline Card */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <History className="size-3.5 text-indigo-600" />
            Trao đổi &amp; Nhật ký hoạt động
          </span>
          {loadedKey === loadKey && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              {history.length} mục
            </span>
          )}
        </div>

        <div className="space-y-3 p-3">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <MessageSquareText className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="field-input pl-8 text-xs"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Thêm nội dung trao đổi…"
              />
            </div>
            <button
              type="button"
              className="primary-btn shrink-0 px-3 text-xs font-bold"
              disabled={!comment.trim() || Boolean(busy)}
              onClick={() => void run('comment', async () => {
                await onComment(comment.trim())
                setComment('')
              })}
            >
              <Send className="mr-1 size-3.5" />
              {busy === 'comment' ? 'Gửi...' : 'Gửi'}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-3">
            {loadedKey !== loadKey ? (
              <div className="space-y-2" role="status" aria-label="Đang tải lịch sử hoạt động">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : history.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-3 text-center text-xs text-slate-500">
                Chưa có hoạt động nào được ghi nhận.
              </p>
            ) : (
              <ol className="relative space-y-2.5 border-l-2 border-slate-200 pl-3.5">
                {history.map((item) => (
                  <li key={item.id} className="relative rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-xs">
                    <span
                      className={`absolute -left-[21px] top-3 size-2.5 rounded-full border-2 border-white ring-1 ${historyDotClass(item)}`}
                      aria-hidden="true"
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <p className="font-bold text-slate-800">{historyLabel(item)}</p>
                      <span className="text-[10px] font-medium text-slate-400">
                        {new Date(item.changedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    {item.note && (
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-600">{item.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

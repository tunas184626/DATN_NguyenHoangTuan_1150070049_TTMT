import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, ImagePlus, MessageSquareText, UserRoundCheck } from 'lucide-react'
import type {
  IncidentAttachment,
  IncidentFeature,
  IncidentHistoryItem,
  IncidentWorkflowStatus,
} from '../../types/gis'
import { getIncidentStatusMeta } from '../../utils/status'

interface Props {
  incident: IncidentFeature
  onTransition: (status: IncidentWorkflowStatus, note: string) => Promise<void>
  onAssign: (assignee: string, note: string) => Promise<void>
  onComment: (content: string) => Promise<void>
  onLoadHistory: (id: string) => Promise<IncidentHistoryItem[]>
  onLoadAttachments: (id: string) => Promise<IncidentAttachment[]>
  onUpload: (id: string, file: File) => Promise<IncidentAttachment>
  canAssign: boolean
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
  return `${item.fromStatus ? getIncidentStatusMeta(item.fromStatus).label : 'Khởi tạo'} → ${getIncidentStatusMeta(item.toStatus).label}`
}

export function IncidentWorkflowPanel({
  incident,
  onTransition,
  onAssign,
  onComment,
  onLoadHistory,
  onLoadAttachments,
  onUpload,
  canAssign,
}: Props) {
  const [history, setHistory] = useState<IncidentHistoryItem[]>([])
  const [attachments, setAttachments] = useState<IncidentAttachment[]>(incident.properties.attachments ?? [])
  const [note, setNote] = useState('')
  const [assignee, setAssignee] = useState(incident.properties.assignedTo ?? '')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const refreshHistory = async () => {
    const items = await onLoadHistory(incident.properties.id)
    setHistory(items)
  }

  useEffect(() => {
    let active = true
    void Promise.all([
      onLoadHistory(incident.properties.id),
      onLoadAttachments(incident.properties.id),
    ])
      .then(([historyItems, attachmentItems]) => {
        if (!active) return
        setHistory(historyItems)
        setAttachments(attachmentItems)
      })
      .catch(() => {
        if (active) setError('Chưa tải được lịch sử hoặc hình ảnh')
      })
    return () => { active = false }
  }, [incident.properties.id, incident.properties.version, onLoadAttachments, onLoadHistory])

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

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Clock3 className="size-4" /> Quy trình xử lý
        </p>
        <textarea
          className="field-textarea min-h-20"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ghi chú cho lần chuyển trạng thái"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {NEXT_ACTIONS[incident.properties.status].map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={Boolean(busy)}
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
          <input
            className="field-input min-w-0 flex-1"
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            placeholder="Tên hoặc email người xử lý"
          />
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
        {history.length === 0 ? (
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

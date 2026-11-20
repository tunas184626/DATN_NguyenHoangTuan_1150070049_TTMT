import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Link2,
  MapPin,
  Radio,
  ShieldAlert,
  UserRound,
  Waves,
  Wrench,
} from 'lucide-react'
import type {
  AssetFeature,
  IncidentAttachment,
  IncidentAssignee,
  IncidentFeature,
  IncidentHistoryItem,
  IncidentIntake,
  IncidentLinkedAsset,
  IncidentWorkflowStatus,
} from '../../types/gis'
import {
  formatIncidentType,
  getIncidentSeverityMeta,
  getIncidentStatusMeta,
} from '../../utils/status'
import { IncidentWorkflowPanel } from './IncidentWorkflowPanel'
import { isLocalDraft } from '../../services/localDraftStore'
import {
  DETECTION_CHANNEL_LABELS,
  readIncidentIntake,
  SERVICE_IMPACT_LABELS,
} from '../../utils/incidentIntake'

interface IncidentDetailTabsProps {
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

const SERVICE_IMPACT_BADGE: Record<IncidentIntake['serviceImpact'], string> = {
  unknown: 'border-slate-200 bg-slate-100 text-slate-700',
  none: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  reduced: 'border-amber-200 bg-amber-50 text-amber-800',
  interrupted: 'border-rose-200 bg-rose-50 text-rose-700',
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: value.includes('T') ? '2-digit' : undefined,
    minute: value.includes('T') ? '2-digit' : undefined,
  }).format(date)
}

function formatSlaSummary(dueAt?: string, status?: IncidentWorkflowStatus, overdue?: boolean): {
  label: string
  toneClass: string
  valueClass: string
} {
  if (status === 'resolved') {
    return {
      label: 'Đã hoàn tất xử lý',
      toneClass: 'border-emerald-200/90 bg-emerald-50/75',
      valueClass: 'text-emerald-800',
    }
  }
  if (!dueAt) {
    return {
      label: 'Chưa xác định',
      toneClass: 'border-slate-200 bg-slate-50/70',
      valueClass: 'text-slate-700',
    }
  }
  if (overdue) {
    return {
      label: formatDateTime(dueAt),
      toneClass: 'border-rose-200 bg-rose-50/85',
      valueClass: 'text-rose-700',
    }
  }
  return {
    label: formatDateTime(dueAt),
    toneClass: 'border-sky-200 bg-sky-50/75',
    valueClass: 'text-sky-900',
  }
}

export function IncidentDetailTabs({
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
}: IncidentDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'workflow'>('overview')
  const [copiedCode, setCopiedCode] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)

  const props = incident.properties
  const statusMeta = getIncidentStatusMeta(props.status)
  const severityMeta = getIncidentSeverityMeta(props.severity)
  const intake = readIncidentIntake(props.intake)
  const notes = props.notes ?? []
  const isResolved = props.status === 'resolved'
  const isOverdue = Boolean(props.overdue && !isResolved)
  const isHighUrgency = isOverdue || (!isResolved && props.severity === 'high')

  const headerGradientClass = isResolved
    ? 'from-emerald-50/75 via-white to-slate-50'
    : isHighUrgency
      ? 'from-rose-50/85 via-white to-orange-50/45'
      : 'from-amber-50/75 via-white to-water-50/45'

  const HeaderIcon = isResolved ? CheckCircle2 : props.status === 'in_progress' ? Wrench : AlertTriangle
  const headerBadgeClass = isResolved
    ? 'bg-emerald-600'
    : isHighUrgency
      ? 'bg-rose-600'
      : 'bg-amber-500'

  const slaSummary = formatSlaSummary(props.dueAt, props.status, props.overdue)
  const imageUrl = props.imageUrl?.trim() || ''
  const showImage = Boolean(imageUrl && failedImageUrl !== imageUrl)
  const reportedDisplay = props.reportedAt
    ? formatDateTime(props.reportedAt)
    : formatDateTime(props.reportedDate)

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(props.incidentCode || props.id)
      setCopiedCode(true)
      window.setTimeout(() => setCopiedCode(false), 1500)
    } catch {
      // Clipboard unavailable in restricted contexts.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Colored Incident Summary Header */}
      <div className={`shrink-0 border-b border-slate-200/80 bg-gradient-to-br ${headerGradientClass} px-4 pb-3 pt-3.5`}>
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${headerBadgeClass}`}
          >
            <HeaderIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-slate-900">{props.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                title="Sao chép mã sự cố"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 transition hover:border-water-300 hover:text-water-800"
              >
                {props.incidentCode}
                {copiedCode ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-slate-400" />}
              </button>
              <span className="font-semibold text-slate-500">· {formatIncidentType(props.incidentType)}</span>
            </div>
            {props.origin?.featureName && (
              <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md border border-water-200/80 bg-water-50/80 px-2 py-0.5 text-[11px] font-semibold text-water-800">
                <Layers className="size-3 shrink-0 text-water-600" />
                <span className="truncate">Đối tượng gốc: {props.origin.featureName}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className={`status-chip ${statusMeta.className}`}>{statusMeta.label}</span>
          <span className={`status-chip ${severityMeta.className}`}>
            Mức {severityMeta.label.toLocaleLowerCase('vi')}
          </span>
          {isOverdue && (
            <span className="status-chip border-rose-300 bg-rose-100 text-rose-800">
              <span className="mr-1 size-1.5 animate-pulse rounded-full bg-rose-600" />
              Quá hạn SLA
            </span>
          )}
          {(props.escalationLevel ?? 0) > 0 && (
            <span className="status-chip border-orange-300 bg-orange-50 text-orange-800">
              <ShieldAlert className="mr-1 size-3" />
              Cảnh báo cấp {props.escalationLevel}
            </span>
          )}
          {isLocalDraft(incident) && (
            <span className="status-chip border-amber-200 bg-amber-50 text-amber-700">
              Lưu trên thiết bị
            </span>
          )}
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="shrink-0 border-b border-slate-200/80 bg-slate-50/80 px-3 py-2">
        <div
          className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1"
          role="tablist"
          aria-label="Chi tiết sự cố"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'overview'
                ? 'bg-white text-water-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="size-3.5" />
            Thông tin
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'workflow'}
            onClick={() => setActiveTab('workflow')}
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'workflow'
                ? 'bg-white text-water-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="size-3.5" />
            Xử lý
            {!isResolved ? (
              <span
                className={`size-2 rounded-full ${
                  isOverdue || props.status === 'new' ? 'bg-rose-500' : 'bg-amber-500'
                }`}
              />
            ) : (
              <span className="size-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5" role="tabpanel">
        {activeTab === 'overview' ? (
          <div className="space-y-3.5">
            {/* KPI / Schedule Table Card */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <CalendarClock className="size-3.5 text-water-600" />
                  Theo dõi &amp; Phân công
                </span>
                <span className="text-[11px] font-semibold text-slate-400">Tóm tắt SLA</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-2.5">
                <div className={`rounded-lg border px-2.5 py-2 ${slaSummary.toneClass}`}>
                  <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Clock3 className="size-3 text-slate-400" />
                    Hạn xử lý
                  </p>
                  <p className={`mt-0.5 text-xs font-bold leading-snug ${slaSummary.valueClass}`}>
                    {slaSummary.label}
                  </p>
                </div>

                <div
                  className={`rounded-lg border px-2.5 py-2 ${
                    props.assignedTo
                      ? 'border-emerald-200/80 bg-emerald-50/60'
                      : 'border-amber-200/80 bg-amber-50/60'
                  }`}
                >
                  <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <UserRound className="size-3 text-slate-400" />
                    Người xử lý
                  </p>
                  <p
                    className={`mt-0.5 truncate text-xs font-bold ${
                      props.assignedTo ? 'text-emerald-800' : 'text-amber-800'
                    }`}
                  >
                    {props.assignedTo || 'Chưa phân công'}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-2.5 py-2">
                  <p className="text-[11px] font-medium text-slate-500">Ngày ghi nhận</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-800">{reportedDisplay}</p>
                </div>

                <div className="rounded-lg border border-water-200/80 bg-water-50/60 px-2.5 py-2">
                  <p className="flex items-center gap-1 text-[11px] font-medium text-water-700">
                    <Link2 className="size-3 text-water-600" />
                    Tài sản liên quan
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-water-900">
                    {props.assetIds?.length ?? 0} tài sản
                  </p>
                </div>
              </div>
            </section>

            {/* Scene Photo */}
            {showImage && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <ImageIcon className="size-3.5 text-water-600" />
                    Ảnh hiện trường
                  </span>
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-water-700 hover:underline"
                  >
                    Xem ảnh <ExternalLink className="size-3" />
                  </a>
                </div>
                <img
                  src={imageUrl}
                  alt={props.name}
                  onError={() => setFailedImageUrl(imageUrl)}
                  className="h-40 w-full object-cover"
                />
              </div>
            )}

            {/* Location & Description Table Card */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <MapPin className="size-3.5 text-rose-500" />
                  Vị trí &amp; Diễn biến
                </span>
                {props.googleMapsUrl && (
                  <a
                    href={props.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-water-200 bg-water-50 px-2 py-0.5 text-[11px] font-semibold text-water-800 transition hover:bg-water-100"
                  >
                    Google Maps <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <div className="divide-y divide-slate-100 text-sm">
                <div className="px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Địa chỉ / Khu vực</p>
                  <p className="mt-0.5 text-[13px] font-medium text-slate-800">
                    {props.address || 'Chưa có địa chỉ cụ thể'}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mô tả hiện trường</p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                    {props.description || 'Chưa có mô tả chi tiết.'}
                  </p>
                </div>
              </div>
            </section>

            {/* Field Intake Card */}
            {intake && (
              <section className="overflow-hidden rounded-xl border border-water-200/80 bg-gradient-to-b from-water-50/60 to-white">
                <div className="flex items-center justify-between border-b border-water-200/70 bg-water-50/90 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-water-900">
                    <Radio className="size-3.5 text-water-600" />
                    Hồ sơ tiếp nhận
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="size-3" />
                    Đã xác nhận vị trí
                  </span>
                </div>
                <div className="space-y-2.5 p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/90 bg-white/90 px-2.5 py-2 shadow-sm">
                      <p className="text-[11px] font-medium text-slate-500">Kênh tiếp nhận</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-800">
                        {DETECTION_CHANNEL_LABELS[intake.detectionChannel]}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/90 bg-white/90 px-2.5 py-2 shadow-sm">
                      <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <Waves className="size-3 text-water-500" />
                        Ảnh hưởng nước
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${SERVICE_IMPACT_BADGE[intake.serviceImpact]}`}
                      >
                        {SERVICE_IMPACT_LABELS[intake.serviceImpact]}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-water-100 bg-white/90 px-2.5 py-2">
                    <p className="text-[11px] font-medium text-slate-500">Thời điểm phát hiện</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-800">
                      {formatDateTime(intake.detectedAt)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-amber-200/70 bg-amber-50/55 px-2.5 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Biện pháp ban đầu</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                      {intake.initialResponse || 'Chưa ghi nhận biện pháp ban đầu'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Initial Notes Card */}
            {notes.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/45">
                <div className="flex items-center justify-between border-b border-amber-200/60 bg-amber-50/90 px-3 py-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                    Ghi chú ban đầu
                  </span>
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {notes.length} mục
                  </span>
                </div>
                <ul className="space-y-1.5 p-2.5">
                  {notes.map((note, index) => (
                    <li
                      key={`${props.id}-note-${index}`}
                      className="flex items-start gap-2 rounded-lg border border-amber-200/60 bg-white/90 px-2.5 py-2 text-xs leading-relaxed text-slate-700"
                    >
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">{note}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <IncidentWorkflowPanel
            incident={incident}
            onTransition={onTransition}
            onAssign={onAssign}
            onEscalate={onEscalate}
            onComment={onComment}
            onLoadAssignees={onLoadAssignees}
            onLoadLinkedAssets={onLoadLinkedAssets}
            onUpdateLinkedAssets={onUpdateLinkedAssets}
            onLoadHistory={onLoadHistory}
            onLoadAttachments={onLoadAttachments}
            onUpload={onUpload}
            canAssign={canAssign}
            availableAssets={availableAssets}
          />
        )}
      </div>

      {/* Pinned Quick Action Footer on Overview Tab */}
      {activeTab === 'overview' && (
        <div className="shrink-0 border-t border-slate-200/80 bg-slate-50/95 px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className="primary-btn w-full min-h-10 justify-between px-4 text-sm font-bold"
          >
            <span className="inline-flex items-center gap-2">
              <Wrench className="size-4" />
              {isResolved ? 'Xem lịch sử & hồ sơ xử lý' : 'Mở quy trình xử lý sự cố'}
            </span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

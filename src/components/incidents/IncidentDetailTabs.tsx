import { useState } from 'react'
import { AlertTriangle, ClipboardList, Clock3, Link2, MapPin, Wrench } from 'lucide-react'
import type {
  AssetFeature,
  IncidentAttachment,
  IncidentAssignee,
  IncidentFeature,
  IncidentHistoryItem,
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
import { DETECTION_CHANNEL_LABELS, readIncidentIntake, SERVICE_IMPACT_LABELS } from '../../utils/incidentIntake'

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

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
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
  const statusMeta = getIncidentStatusMeta(incident.properties.status)
  const severityMeta = getIncidentSeverityMeta(incident.properties.severity)
  const intake = readIncidentIntake(incident.properties.intake)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-slate-100 p-4 pb-3">
        <div>
          <p className="text-lg font-bold text-slate-800">{incident.properties.name}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-500">{incident.properties.incidentCode}</p>
          {incident.properties.origin?.featureName && <p className="mt-1 text-xs text-slate-500">Đối tượng báo sự cố: {incident.properties.origin.featureName}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`status-chip ${statusMeta.className}`}>{statusMeta.label}</span>
          {isLocalDraft(incident) && <span className="status-chip border-amber-200 bg-amber-50 text-amber-700">Lưu trên thiết bị</span>}
          <span className={`status-chip ${severityMeta.className}`}>Mức {severityMeta.label.toLocaleLowerCase('vi')}</span>
          {incident.properties.overdue && incident.properties.status !== 'resolved' && (
            <span className="status-chip border-rose-200 bg-rose-50 text-rose-700">Quá hạn SLA</span>
          )}
          {(incident.properties.escalationLevel ?? 0) > 0 && (
            <span className="status-chip border-amber-200 bg-amber-50 text-amber-800">Cảnh báo cấp {incident.properties.escalationLevel}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-slate-100 bg-slate-50/70 p-1.5" role="tablist" aria-label="Chi tiết sự cố">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${activeTab === 'overview' ? 'bg-white text-water-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <ClipboardList className="size-4" /> Thông tin
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'workflow'}
          onClick={() => setActiveTab('workflow')}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${activeTab === 'workflow' ? 'bg-white text-water-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Wrench className="size-4" /> Xử lý
          {incident.properties.status !== 'resolved' && <span className="size-1.5 rounded-full bg-rose-500" />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4" role="tabpanel">
        {activeTab === 'overview' ? (
          <div className="space-y-4">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Loại sự cố</dt>
                <dd className="mt-1 font-semibold text-slate-700">{formatIncidentType(incident.properties.incidentType)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Vị trí</dt>
                <dd className="mt-1 text-slate-700">{incident.properties.address || 'Chưa có địa chỉ'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Mô tả</dt>
                <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">{incident.properties.description || 'Chưa có mô tả'}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Ngày ghi nhận</dt>
                  <dd className="mt-1 text-slate-700">{incident.properties.reportedAt ? new Date(incident.properties.reportedAt).toLocaleString('vi-VN') : formatDate(incident.properties.reportedDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Người xử lý</dt>
                  <dd className="mt-1 truncate text-slate-700">{incident.properties.assignedTo || 'Chưa phân công'}</dd>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-400"><Clock3 className="size-3.5" /> Hạn xử lý</dt>
                  <dd className={`mt-1 font-semibold ${incident.properties.overdue && incident.properties.status !== 'resolved' ? 'text-rose-700' : 'text-slate-700'}`}>
                    {incident.properties.dueAt ? new Date(incident.properties.dueAt).toLocaleString('vi-VN') : 'Chưa xác định'}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-400"><Link2 className="size-3.5" /> Tài sản liên quan</dt>
                  <dd className="mt-1 font-semibold text-slate-700">{incident.properties.assetIds?.length ?? 0} tài sản</dd>
                </div>
              </div>
            </dl>

            {intake && (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-3 text-sm font-bold text-slate-800">Hồ sơ tiếp nhận hiện trường</h3>
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-xs text-slate-500">Kênh tiếp nhận</dt><dd className="mt-1 text-slate-700">{DETECTION_CHANNEL_LABELS[intake.detectionChannel]}</dd></div>
                  <div><dt className="text-xs text-slate-500">Ảnh hưởng cấp nước</dt><dd className="mt-1 text-slate-700">{SERVICE_IMPACT_LABELS[intake.serviceImpact]}</dd></div>
                  <div><dt className="text-xs text-slate-500">Biện pháp ban đầu</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700">{intake.initialResponse || 'Chưa ghi nhận biện pháp'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Vị trí hiện trường</dt><dd className="mt-1 text-slate-700">Đã xác nhận khi tiếp nhận</dd></div>
                </dl>
              </section>
            )}

            {incident.properties.imageUrl && (
              <img src={incident.properties.imageUrl} alt={incident.properties.name} className="h-44 w-full rounded-xl object-cover" />
            )}

            {incident.properties.googleMapsUrl && (
              <a href={incident.properties.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-sm font-semibold text-water-700 hover:underline">
                <MapPin className="mr-1.5 size-4" /> Mở vị trí trên bản đồ
              </a>
            )}

            {incident.properties.notes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Ghi chú ban đầu</p>
                <ul className="space-y-2">
                  {incident.properties.notes.map((note, index) => (
                    <li key={`${incident.properties.id}-note-${index}`} className="rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700">{note}</li>
                  ))}
                </ul>
              </div>
            )}

            <button type="button" onClick={() => setActiveTab('workflow')} className="primary-btn w-full min-h-11">
              <AlertTriangle className="mr-1.5 size-4" /> Mở quy trình xử lý
            </button>
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
    </div>
  )
}

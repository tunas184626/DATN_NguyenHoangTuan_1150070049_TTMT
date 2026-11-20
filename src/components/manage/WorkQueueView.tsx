import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import {
  AlarmClock, ArrowRight, Check, ChevronLeft, ChevronRight, CircleAlert,
  Clock3, Database, Flame, Inbox, Laptop, MapPin, Plus, RefreshCw,
  Search, UserRound, UserRoundPlus, Wrench, X,
} from 'lucide-react'
import type { AnyMapFeature, IncidentFeature } from '../../types/gis'
import type { IncidentWorkQueue, OperationsSummary } from '../../types/operations'
import { formatIncidentType, getIncidentSeverityMeta } from '../../utils/status'
import { isLocalDraft } from '../../services/localDraftStore'
import { matchesWorkQueue, WORK_QUEUES } from './workQueues'
import './work-queue.css'

type ManagementTab = 'work' | 'assets' | 'incidents' | 'quality'
type QueueSummary = Pick<OperationsSummary, 'unassignedIncidents' | 'overdueIncidents' | 'highPriorityIncidents' | 'inProgressIncidents'>

interface WorkQueueViewProps {
  queue: IncidentWorkQueue
  onQueueChange: (queue: IncidentWorkQueue) => void
  summary: QueueSummary | null
  isSynchronized: boolean
  onTabChange: (tab: ManagementTab) => void
  query: string
  onQueryChange: (query: string) => void
  features: AnyMapFeature[]
  drafts: AnyMapFeature[]
  loading: boolean
  error: string
  total: number | null
  page: number
  pageCount: number
  pageSize: number
  onPageChange: (page: number) => void
  onRefresh: () => void
  onAddIncident: () => void
  selectedId?: string
  onSelect: (feature: IncidentFeature) => void
  onCloseRecord: () => void
  recordPanel: ReactNode
}

const QUEUE_ICONS = { unassigned: UserRoundPlus, overdue: AlarmClock, high_priority: Flame, in_progress: Wrench }
const TABS: Array<{ key: ManagementTab; label: string }> = [
  { key: 'work', label: 'Hàng đợi' }, { key: 'assets', label: 'Tài sản' },
  { key: 'incidents', label: 'Sự cố' }, { key: 'quality', label: 'Chất lượng hồ sơ' },
]

function compactSnapshot() { return window.matchMedia('(max-width: 1023px)').matches }
function subscribeCompact(callback: () => void) {
  const media = window.matchMedia('(max-width: 1023px)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function deadlineLabel(value?: string) {
  if (!value) return 'Chưa có SLA'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có SLA'
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function QueueRow({ feature, selected, onSelect }: { feature: IncidentFeature; selected: boolean; onSelect: () => void }) {
  const p = feature.properties
  const overdue = matchesWorkQueue(feature, 'overdue')
  const priority = getIncidentSeverityMeta(p.severity)
  const assigned = p.assignedTo?.trim()
  return (
    <li>
      <button type="button" className={`wq-row${selected ? ' is-selected' : ''}`} aria-label={`Mở hồ sơ ${p.incidentCode}: ${p.name}`} aria-pressed={selected} onClick={onSelect}>
        <span className="wq-row-identity">
          <span className={`wq-incident-icon wq-severity-${p.severity}`} aria-hidden="true">{p.incidentType === 'need_inspection' ? <Search size={17} /> : <Wrench size={17} />}</span>
          <span className="wq-identity-copy">
            <span className="wq-record-code">{p.incidentCode}{isLocalDraft(feature) && <span className="wq-draft-tag">Chưa đồng bộ</span>}</span>
            <strong title={p.name}>{p.name}</strong>
            <span className="wq-location"><MapPin size={11} aria-hidden="true" /><span title={p.address}>{p.address || formatIncidentType(p.incidentType)}</span></span>
          </span>
        </span>
        <span className={`wq-priority wq-severity-${p.severity}`}><span aria-hidden="true" />{priority.label}</span>
        <span className={`wq-row-deadline${overdue ? ' is-overdue' : ''}`}>
          <span><Clock3 size={12} aria-hidden="true" /><time dateTime={p.dueAt && !Number.isNaN(Date.parse(p.dueAt)) ? p.dueAt : undefined}>{deadlineLabel(p.dueAt)}</time></span>
          {overdue && <small>Quá hạn</small>}
        </span>
        <span className="wq-row-assignee"><span className={`wq-avatar${assigned ? ' is-assigned' : ''}`} aria-hidden="true">{assigned ? assigned.split(/\s+/).map((part) => part[0]).slice(-2).join('').toLocaleUpperCase('vi') : <UserRound size={13} />}</span><span title={assigned || 'Chưa phân công'}>{assigned || 'Chưa phân công'}</span></span>
        <ArrowRight size={15} className="wq-row-arrow" aria-hidden="true" />
      </button>
    </li>
  )
}

export function WorkQueueView({
  queue, onQueueChange, summary, isSynchronized, onTabChange, query, onQueryChange,
  features, drafts, loading, error, total, page, pageCount, pageSize, onPageChange,
  onRefresh, onAddIncident, selectedId, onSelect, onCloseRecord, recordPanel,
}: WorkQueueViewProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const compact = useSyncExternalStore(subscribeCompact, compactSnapshot, () => false)
  const activeQueue = WORK_QUEUES.find((item) => item.key === queue)!
  const rows = features.filter((feature): feature is IncidentFeature => feature.properties.type === 'incident')
  const draftRows = drafts.filter((feature): feature is IncidentFeature => feature.properties.type === 'incident')
  const hasSearch = query.trim().length > 0
  const hasRecord = Boolean(recordPanel)

  useEffect(() => {
    if (!selectedId || !panelRef.current) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const searchInput = searchRef.current
    panelRef.current.focus({ preventScroll: true })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRecord(); return }
      if (!compact || event.key !== 'Tab') return
      const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0)
      if (!controls.length) { event.preventDefault(); return }
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
      else if (searchInput?.isConnected) searchInput.focus({ preventScroll: true })
    }
  }, [selectedId, compact, onCloseRecord])

  const renderRow = (feature: IncidentFeature) => <QueueRow key={feature.properties.id} feature={feature} selected={selectedId === feature.properties.id} onSelect={() => onSelect(feature)} />

  return (
    <section className="wq-shell" aria-labelledby="work-queue-title">
      <header className="wq-header">
        <div className="wq-heading"><span className="wq-heading-icon" aria-hidden="true"><Inbox size={23} strokeWidth={1.6} /></span><h1 id="work-queue-title">Hàng đợi công việc</h1></div>
        <button type="button" className="wq-primary" aria-label="Ghi nhận sự cố" onClick={onAddIncident}><Plus size={17} aria-hidden="true" /><span>Ghi nhận sự cố</span></button>
      </header>

      <nav className="wq-tabs" aria-label="Phân mục quản lý">{TABS.map(({ key, label }) => <button key={key} type="button" aria-current={key === 'work' ? 'page' : undefined} onClick={() => onTabChange(key)}>{label}</button>)}</nav>

      <div className="wq-cards" role="group" aria-label="Nhóm công việc">
        {WORK_QUEUES.map((item) => {
          const Icon = QUEUE_ICONS[item.key]
          const count = summary?.[item.countKey]
          return <button key={item.key} type="button" className={`wq-card${queue === item.key ? ' is-active' : ''}`} data-queue={item.key} aria-pressed={queue === item.key} aria-label={`${item.label}: ${count?.toLocaleString('vi-VN') ?? 'đang tải'} hồ sơ`} title={item.hint} onClick={() => onQueueChange(item.key)}>
            <span className="wq-card-top"><span className="wq-card-icon"><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>{queue === item.key ? <Check size={15} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}</span>
            <span className="wq-card-bottom"><span className="wq-card-label">{item.label}</span><strong>{count?.toLocaleString('vi-VN') ?? '—'}</strong></span>
          </button>
        })}
      </div>

      <div className={`wq-body${hasRecord ? ' has-record' : ''}`}>
        <section className="wq-list" aria-label="Danh sách hồ sơ công việc">
          <div className="wq-list-toolbar">
            <div className="wq-list-title"><h2>{activeQueue.label}</h2><span>{total?.toLocaleString('vi-VN') ?? '—'}</span></div>
            <div className="wq-search-tools">
              <label className="wq-search"><Search size={16} aria-hidden="true" /><input ref={searchRef} aria-label="Tìm hồ sơ công việc" type="search" maxLength={100} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Tìm mã, tên, vị trí…" />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => onQueryChange('')}><X size={14} aria-hidden="true" /></button>}</label>
              <button type="button" className="wq-icon-button" aria-label="Làm mới hàng đợi" title="Làm mới" disabled={loading} onClick={onRefresh}><RefreshCw size={16} className={loading ? 'wq-spin' : ''} aria-hidden="true" /></button>
            </div>
          </div>

          {isSynchronized && draftRows.length > 0 && <details className="wq-local-drafts"><summary>Bản lưu trên thiết bị ({draftRows.length})</summary><ul>{draftRows.map(renderRow)}</ul></details>}

          <div className="wq-column-head" aria-hidden="true"><span>Hồ sơ</span><span>Mức độ</span><span>Hạn xử lý</span><span>Phụ trách</span><span /></div>
          <div className="wq-results" aria-busy={loading}>
            {loading ? <div className="wq-skeletons" role="status" aria-label="Đang tải hồ sơ">{Array.from({ length: 5 }, (_, index) => <div key={index} className="wq-skeleton-row" aria-hidden="true"><span /><div><i /><i /></div><span /></div>)}</div>
              : error ? <div className="wq-empty wq-error" role="alert"><span className="wq-empty-icon"><CircleAlert size={25} strokeWidth={1.5} aria-hidden="true" /></span><h3>Chưa tải được hồ sơ</h3><details><summary>Chi tiết lỗi</summary><p>{error}</p></details><button type="button" className="wq-secondary" onClick={onRefresh}><RefreshCw size={14} aria-hidden="true" />Thử lại</button></div>
              : rows.length > 0 ? <ul key={queue} className="wq-rows">{rows.map(renderRow)}</ul>
                : <div className="wq-empty"><span className="wq-empty-icon">{hasSearch ? <Search size={25} strokeWidth={1.5} aria-hidden="true" /> : <Inbox size={25} strokeWidth={1.5} aria-hidden="true" />}</span><h3>{hasSearch ? 'Không có kết quả' : 'Chưa có hồ sơ'}</h3>{hasSearch ? <button type="button" className="wq-secondary" onClick={() => onQueryChange('')}>Xóa tìm kiếm</button> : <p>Chọn nhóm khác để xem hồ sơ.</p>}</div>}
          </div>

          <footer className="wq-list-footer">
            <span className="wq-result-count" role="status">{loading ? 'Đang tải…' : total === null ? '— hồ sơ' : `${rows.length ? ((page - 1) * pageSize + 1).toLocaleString('vi-VN') : 0}–${((page - 1) * pageSize + rows.length).toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')} hồ sơ`}</span>
            {pageCount > 1 && <div className="wq-pagination"><button type="button" className="wq-icon-button" aria-label="Trang trước" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} aria-hidden="true" /></button><span>{page} / {pageCount}</span><button type="button" className="wq-icon-button" aria-label="Trang sau" disabled={loading || page >= pageCount} onClick={() => onPageChange(page + 1)}><ChevronRight size={16} aria-hidden="true" /></button></div>}
          </footer>
        </section>

        {hasRecord && <>
          {compact && <div className="wq-backdrop" aria-hidden="true" onClick={onCloseRecord} />}
          <div ref={panelRef} className="wq-record" tabIndex={-1} role={compact ? 'dialog' : 'region'} aria-modal={compact ? true : undefined} aria-label="Chi tiết hồ sơ công việc">{recordPanel}</div>
        </>}
      </div>

      <footer className="wq-scope"><details><summary>{isSynchronized ? <Database size={12} aria-hidden="true" /> : <Laptop size={12} aria-hidden="true" />}{isSynchronized ? 'Dữ liệu máy chủ' : 'Dữ liệu trên thiết bị'}</summary><p>{isSynchronized ? 'Số tổng từ máy chủ, không gồm bản nháp.' : 'Số lượng chỉ tính hồ sơ đang có trên thiết bị.'} Một hồ sơ có thể thuộc nhiều nhóm.</p></details></footer>
    </section>
  )
}

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react'
import type {
  AnyMapFeature,
  AssetFeature,
  AssetStatus,
  AssetType,
  DataSourceState,
  IncidentFeature,
  IncidentWorkflowStatus,
  LayerDataState,
} from '../../types/gis'
import { ASSET_TYPE_LABELS, formatAssetType } from '../../utils/asset'
import { loadOperationsFeature, loadOperationsPage, loadOperationsSummary } from '../../services/operationsService'
import type { FeaturePage, IncidentWorkQueue, OperationsSummary } from '../../types/operations'
import { WorkRecordPanel, type WorkRecordActions } from './WorkRecordPanel'
import { AssetQualityWorkspace } from './AssetQualityWorkspace'
import { matchesWorkQueue, WORK_QUEUES } from './workQueues'
import { isLocalDraft } from '../../services/localDraftStore'
import { flattenAssets, flattenIncidents } from '../../utils/metrics'
import {
  formatIncidentType,
  getAssetStatusMeta,
  getIncidentSeverityMeta,
  getIncidentStatusMeta,
} from '../../utils/status'

type WorkspaceTab = 'work' | 'assets' | 'incidents' | 'quality'
type WorkspaceStatus = 'all' | AssetStatus | IncidentWorkflowStatus

interface OperationsWorkspaceProps extends WorkRecordActions {
  data: LayerDataState
  dataSource: DataSourceState | null
  onAddAsset: () => void
  onAddIncident: () => void
  onOpenFeature: (feature: AnyMapFeature) => void
  onSelectFeature?: (feature: AnyMapFeature) => void
}

const PAGE_SIZE = 20

const ASSET_STATUS_OPTIONS: Array<{ value: WorkspaceStatus; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'need_inspection', label: 'Cần kiểm tra' },
  { value: 'pending_data', label: 'Chờ bổ sung' },
]

const INCIDENT_STATUS_OPTIONS: Array<{ value: WorkspaceStatus; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'new', label: 'Mới ghi nhận' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
]

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('vi')
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function matchesSearch(feature: AnyMapFeature, query: string): boolean {
  if (!query) return true
  const properties = feature.properties
  const values = [properties.id, properties.name, properties.address, properties.description]
  if (properties.type === 'incident') {
    values.push(properties.incidentCode, formatIncidentType(properties.incidentType))
  } else {
    values.push(formatAssetType(properties.type))
  }
  return values.some((value) => normalizeSearchValue(value ?? '').includes(query))
}

function priorityForIncident(incident: IncidentFeature): number {
  if (incident.properties.status === 'resolved') return 10
  if (incident.properties.overdue) return 0
  if (incident.properties.severity === 'high') return 1
  if (incident.properties.status === 'new') return 2
  return 3
}

function StatusBadge({ feature }: { feature: AnyMapFeature }) {
  const meta = feature.properties.type === 'incident'
    ? getIncidentStatusMeta(feature.properties.status)
    : getAssetStatusMeta(feature.properties.status)
  return <span className={`status-chip whitespace-nowrap ${meta.className}`}>{meta.label}</span>
}

function WorkspaceRow({ feature, onOpen, selected = false }: { feature: AnyMapFeature; onOpen: () => void; selected?: boolean }) {
  const incident = feature.properties.type === 'incident' ? feature as IncidentFeature : null
  const title = incident
    ? `${incident.properties.incidentCode} · ${incident.properties.name}`
    : feature.properties.name
  const typeLabel = incident
    ? formatIncidentType(incident.properties.incidentType)
    : formatAssetType((feature as AssetFeature).properties.type)
  const dateValue = incident?.properties.reportedDate ?? feature.properties.lastUpdated

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-water-50/70 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-water-400 sm:grid-cols-[minmax(0,1fr)_160px_140px_44px] ${selected ? 'bg-water-50' : ''}`}
      aria-label={`Mở hồ sơ ${title}`}
      aria-pressed={selected}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-800 group-hover:text-water-800">{title}</p>
        {isLocalDraft(feature) && <p className="mt-1 text-xs font-semibold text-amber-700">Lưu trên thiết bị · chưa lưu lên máy chủ</p>}
        <p className="mt-1 truncate text-xs text-slate-500">
          {typeLabel}{feature.properties.address ? ` · ${feature.properties.address}` : ''}
        </p>
      </div>

      <div className="hidden sm:block">
        <StatusBadge feature={feature} />
      </div>

      <div className="hidden text-xs text-slate-500 sm:block">
        {incident && (
          <div className="mb-1 flex flex-wrap gap-1">
            <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${getIncidentSeverityMeta(incident.properties.severity).className}`}>
              Mức {getIncidentSeverityMeta(incident.properties.severity).label.toLocaleLowerCase('vi')}
            </span>
            {incident.properties.overdue && <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">Quá hạn</span>}
          </div>
        )}
        <p>{formatDate(dateValue)}</p>
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <div className="sm:hidden"><StatusBadge feature={feature} /></div>
        <span className="hidden size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition group-hover:border-water-300 group-hover:text-water-700 sm:inline-flex">
          <ClipboardList className="size-4" />
        </span>
      </div>
    </button>
  )
}

export function OperationsWorkspace({
  data,
  dataSource,
  onAddAsset,
  onAddIncident,
  onOpenFeature,
  onSelectFeature,
  ...recordActions
}: OperationsWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>('work')
  const [queue, setQueue] = useState<IncidentWorkQueue>('unassigned')
  const [selectedRecord, setSelectedRecord] = useState<AnyMapFeature | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<WorkspaceStatus>('all')
  const [page, setPage] = useState(1)
  const deferredQuery = useDeferredValue(query)
  const [assetType, setAssetType] = useState<'all' | AssetType>('all')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [remote, setRemote] = useState<{ key: string; page: FeaturePage; summary: OperationsSummary } | null>(null)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState('')
  const isSynchronized = dataSource?.mode === 'api'
  const requestKey = JSON.stringify([tab, queue, deferredQuery.trim(), status, assetType, page, refreshVersion])

  useEffect(() => {
    if (!isSynchronized) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setRemoteLoading(true)
      setRemoteError('')
      void Promise.all([
        tab === 'quality'
          ? Promise.resolve<FeaturePage>({ type: 'FeatureCollection', features: [], meta: { total: 0, limit: PAGE_SIZE, offset: 0 } })
          : loadOperationsPage({ tab: tab === 'work' ? 'incidents' : tab, search: deferredQuery, status: tab === 'work' ? 'all' : status, type: assetType, page, pageSize: PAGE_SIZE, queue: tab === 'work' ? queue : undefined }, controller.signal),
        loadOperationsSummary(controller.signal),
      ]).then(([nextPage, summary]) => {
        if (controller.signal.aborted) return
        setRemote({ key: requestKey, page: nextPage, summary })
        const lastPage = Math.max(1, Math.ceil(nextPage.meta.total / PAGE_SIZE))
        if (page > lastPage) setPage(lastPage)
      }).catch((reason) => {
        if (!controller.signal.aborted) setRemoteError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu máy chủ')
      }).finally(() => {
        if (!controller.signal.aborted) setRemoteLoading(false)
      })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [isSynchronized, tab, queue, deferredQuery, status, assetType, page, requestKey, data])

  const assets = useMemo(() => flattenAssets(data), [data])
  const incidents = useMemo(() => flattenIncidents(data), [data])
  const openIncidents = useMemo(
    () => incidents.filter((incident) => incident.properties.status !== 'resolved'),
    [incidents],
  )
  const highPriorityCount = useMemo(
    () => openIncidents.filter((incident) => incident.properties.severity === 'high').length,
    [openIncidents],
  )
  const overdueCount = useMemo(
    () => openIncidents.filter((incident) => matchesWorkQueue(incident, 'overdue')).length,
    [openIncidents],
  )

  const filteredFeatures = useMemo<AnyMapFeature[]>(() => {
    const normalizedQuery = normalizeSearchValue(deferredQuery)
    const source: AnyMapFeature[] = tab === 'assets' || tab === 'quality' ? assets : incidents
    return source
      .filter((feature) => tab === 'work' ? matchesWorkQueue(feature as IncidentFeature, queue) : status === 'all' || feature.properties.status === status)
      .filter((feature) => tab !== 'assets' || assetType === 'all' || feature.properties.type === assetType)
      .filter((feature) => matchesSearch(feature, normalizedQuery))
      .sort((left, right) => {
        if (left.properties.type === 'incident' && right.properties.type === 'incident') {
          const priority = priorityForIncident(left as IncidentFeature) - priorityForIncident(right as IncidentFeature)
          if (priority !== 0) return priority
        }
        return left.properties.name.localeCompare(right.properties.name, 'vi')
      })
  }, [assets, assetType, deferredQuery, incidents, status, tab, queue])

  const matchesRequest = remote?.key === requestKey
  const totalResults = isSynchronized ? matchesRequest ? remote.page.meta.total : 0 : filteredFeatures.length
  const pageCount = Math.max(1, Math.ceil(totalResults / PAGE_SIZE))
  const activePage = isSynchronized ? page : Math.min(page, pageCount)
  const draftById = new Map([...assets, ...incidents].filter(isLocalDraft).map((feature) => [feature.properties.id, feature]))
  const pageFeatures = isSynchronized
    ? matchesRequest ? remote.page.features.map((feature) => draftById.get(feature.properties.id) ?? feature) : []
    : filteredFeatures.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)
  const statusOptions = tab === 'assets' ? ASSET_STATUS_OPTIONS : INCIDENT_STATUS_OPTIONS
  const localDraftCount = draftById.size
  const draftFeatures = filteredFeatures.filter(isLocalDraft)
  const loadingPage = tab !== 'quality' && isSynchronized && (remoteLoading || (!remoteError && !matchesRequest))
  const totals = isSynchronized ? remote?.summary ?? null : {
    assets: assets.length, incidents: incidents.length, openIncidents: openIncidents.length,
    overdueIncidents: overdueCount, highPriorityIncidents: highPriorityCount,
    unassignedIncidents: incidents.filter((incident) => matchesWorkQueue(incident, 'unassigned')).length,
    inProgressIncidents: incidents.filter((incident) => matchesWorkQueue(incident, 'in_progress')).length,
  }
  const cachedRecord = selectedRecord && [...assets, ...incidents].find((feature) => feature.properties.id === selectedRecord.properties.id)
  const activeRecord = cachedRecord && (cachedRecord.properties.version ?? 0) >= (selectedRecord?.properties.version ?? 0) ? cachedRecord : selectedRecord
  const selectRecord = (feature: AnyMapFeature) => { setSelectedRecord(feature); onSelectFeature?.(feature) }

  const changeTab = (nextTab: WorkspaceTab) => {
    setTab(nextTab)
    setStatus('all')
    setAssetType('all')
    setPage(1)
    setSelectedRecord(null)
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-1" aria-labelledby="operations-title">
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className={`size-2 rounded-full ${isSynchronized ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className={`text-xs font-bold ${isSynchronized ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isSynchronized ? 'Đã kết nối máy chủ' : 'Đang dùng CAD/dữ liệu dự phòng'}
              </span>
            </div>
            <h1 id="operations-title" className="text-xl font-extrabold tracking-tight text-slate-900">
              Trung tâm vận hành
            </h1>
            <p className="mt-1 text-sm text-slate-500">Theo dõi tài sản và xử lý sự cố trong một màn hình.</p>
            {!isSynchronized && <p className="mt-2 text-xs text-amber-700">Hàng đợi và số lượng chỉ tính trên dữ liệu đang có trên thiết bị.</p>}
            {localDraftCount > 0 && <p className="mt-2 text-xs font-semibold text-amber-700">{localDraftCount} bản ghi lưu trên thiết bị, chưa lưu lên máy chủ.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={onAddAsset} className="ghost-btn min-h-11">
              <Plus className="mr-1.5 size-4" /> Thêm tài sản
            </button>
            <button type="button" onClick={onAddIncident} className="primary-btn min-h-11">
              <AlertTriangle className="mr-1.5 size-4" /> Ghi nhận sự cố
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
          {[
            { label: 'Tổng tài sản', value: totals?.assets, icon: ClipboardList, tone: 'text-slate-600 bg-slate-100' },
            { label: 'Sự cố đang mở', value: totals?.openIncidents, icon: Wrench, tone: 'text-amber-700 bg-amber-50' },
            { label: 'Quá hạn SLA', value: totals?.overdueIncidents, icon: AlertTriangle, tone: 'text-rose-700 bg-rose-50' },
            { label: 'Ưu tiên cao', value: totals?.highPriorityIncidents, icon: CircleCheckBig, tone: 'text-rose-700 bg-rose-50' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 p-4">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></span>
              <div>
                <p className="text-2xl font-black leading-none text-slate-900">{value?.toLocaleString('vi-VN') ?? '—'}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isSynchronized && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <p>Số tổng lấy từ máy chủ; bản ghi lưu trên thiết bị được hiển thị riêng.</p>
        <button type="button" className="ghost-btn h-8" disabled={loadingPage} onClick={() => setRefreshVersion((value) => value + 1)}>
          <RefreshCw className={`mr-1.5 size-3.5 ${loadingPage ? 'animate-spin' : ''}`} />Làm mới
        </button>
      </div>}
      {isSynchronized && remoteError && tab !== 'quality' && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        {remoteError}. <button type="button" className="font-semibold underline" onClick={() => setRefreshVersion((value) => value + 1)}>Thử lại</button>
      </div>}
      {isSynchronized && localDraftCount > 0 && tab !== 'quality' && <details className="panel p-3">
        <summary className="cursor-pointer text-sm font-semibold text-amber-700">Lưu trên thiết bị ({draftFeatures.length})</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          {draftFeatures.map((feature) => <WorkspaceRow key={feature.properties.id} feature={feature} onOpen={() => selectRecord(feature)} selected={activeRecord?.properties.id === feature.properties.id} />)}
          {draftFeatures.length === 0 && <p className="p-3 text-xs text-slate-500">Không có bản lưu tạm khớp tab và bộ lọc này.</p>}
        </div>
      </details>}

      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
      <div className="panel flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Loại dữ liệu quản lý">
              <button type="button" role="tab" aria-selected={tab === 'work'} onClick={() => changeTab('work')} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${tab === 'work' ? 'bg-white text-water-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Hàng đợi công việc</button>
              <button type="button" role="tab" aria-selected={tab === 'quality'} onClick={() => changeTab('quality')} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${tab === 'quality' ? 'bg-white text-water-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Chất lượng hồ sơ</button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'assets'}
                onClick={() => changeTab('assets')}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${tab === 'assets' ? 'bg-white text-water-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Tài sản <span className="ml-1 text-xs opacity-70">{totals?.assets ?? '—'}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'incidents'}
                onClick={() => changeTab('incidents')}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${tab === 'incidents' ? 'bg-white text-water-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Sự cố <span className="ml-1 text-xs opacity-70">{totals?.incidents ?? '—'}</span>
              </button>
            </div>
          </div>

          {tab !== 'quality' && <>{tab === 'work' && <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {WORK_QUEUES.map((item) => <button key={item.key} type="button" aria-pressed={queue === item.key} className={`rounded-lg border p-3 text-left transition ${queue === item.key ? 'border-water-500 bg-water-50 text-water-900' : 'border-slate-200 bg-white text-slate-600 hover:border-water-300'}`} onClick={() => { setQueue(item.key); setPage(1); setSelectedRecord(null) }}><span className="block text-xs font-semibold">{item.label}</span><span className="mt-1 block text-2xl font-bold">{totals?.[item.countKey]?.toLocaleString('vi-VN') ?? '—'}</span></button>)}
            </div>
            <p className="text-xs text-slate-500">{WORK_QUEUES.find((item) => item.key === queue)?.hint}. Một sự cố có thể nằm trong nhiều hàng đợi.</p>
          </>}

          {tab === 'assets' && <div className="flex flex-wrap items-center gap-2" aria-label="Công việc hồ sơ tài sản">
            <span className="text-xs font-semibold text-slate-500">Cần thực hiện:</span>
            {ASSET_STATUS_OPTIONS.filter((option) => ['need_inspection', 'maintenance', 'pending_data'].includes(option.value)).map((option) => <button key={option.value} type="button" aria-pressed={status === option.value} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${status === option.value ? 'border-water-400 bg-water-50 text-water-800' : 'border-slate-200 text-slate-600'}`} onClick={() => { setStatus(option.value); setPage(1); setSelectedRecord(null) }}>{option.label}</button>)}
          </div>}

          <div className={`grid gap-2 ${tab === 'assets' ? 'lg:grid-cols-[minmax(0,1fr)_190px_190px]' : tab === 'incidents' ? 'sm:grid-cols-[minmax(0,1fr)_210px]' : ''}`}>
            <label className="relative block">
              <span className="sr-only">Tìm trong danh sách</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                maxLength={100}
                onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                className="field-input min-h-11 pl-9"
                placeholder={tab === 'assets' ? 'Tìm tên, mã hoặc địa chỉ tài sản...' : 'Tìm mã, loại hoặc vị trí sự cố...'}
              />
            </label>
            {tab === 'assets' && <label>
              <span className="sr-only">Lọc loại tài sản</span>
              <select aria-label="Loại tài sản" value={assetType} onChange={(event) => { setAssetType(event.target.value as 'all' | AssetType); setPage(1) }} className="field-input min-h-11">
                <option value="all">Tất cả loại tài sản</option>
                {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>}
            {tab !== 'work' && <label className="relative block">
              <span className="sr-only">Lọc theo trạng thái</span>
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <select
                value={status}
                onChange={(event) => { setStatus(event.target.value as WorkspaceStatus); setPage(1) }}
                className="field-input min-h-11 appearance-none pl-9"
              >
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>}
          </div>
          </>}
        </div>

        {tab === 'quality' ? <AssetQualityWorkspace assets={assets} isSynchronized={isSynchronized} selectedId={activeRecord?.properties.id} onSelect={selectRecord} refreshVersion={refreshVersion} /> : <>
        <div className="hidden grid-cols-[minmax(0,1fr)_160px_140px_44px] gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
          <span>Đối tượng</span><span>Trạng thái</span><span>Cập nhật</span><span />
        </div>

        <div className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-busy={loadingPage}>
          {loadingPage ? <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin" />Đang tải danh sách...</div>
            : isSynchronized && remoteError && !matchesRequest ? <p className="p-6 text-center text-sm text-slate-500">Danh sách chưa tải được. Bấm Thử lại để tải lại.</p>
            : pageFeatures.length > 0 ? pageFeatures.map((feature) => (
            <WorkspaceRow key={feature.properties.id} feature={feature} onOpen={() => selectRecord(feature)} selected={activeRecord?.properties.id === feature.properties.id} />
          )) : (
            <div className="flex h-full min-h-56 flex-col items-center justify-center px-6 text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Search className="size-5" /></span>
              <p className="font-bold text-slate-700">Không tìm thấy kết quả</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">Thử đổi từ khóa hoặc chọn trạng thái khác.</p>
              <button type="button" className="mt-3 text-sm font-bold text-water-700" onClick={() => { setQuery(''); setStatus('all'); setAssetType('all'); setPage(1) }}>
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-white px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Hiển thị <span className="font-bold text-slate-700">{pageFeatures.length}</span> trong{' '}
            <span className="font-bold text-slate-700">{loadingPage || (isSynchronized && !matchesRequest) ? '—' : totalResults.toLocaleString('vi-VN')}</span> kết quả
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <button type="button" className="ghost-btn min-h-9 !px-2.5" disabled={loadingPage || activePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Trang trước">
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-20 text-center font-semibold text-slate-600">Trang {activePage}/{pageCount}</span>
              <button type="button" className="ghost-btn min-h-9 !px-2.5" disabled={loadingPage || activePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Trang sau">
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
        </>}
      </div>
      {activeRecord && <WorkRecordPanel key={activeRecord.properties.id} feature={activeRecord} isSynchronized={isSynchronized} onOpenFeature={onOpenFeature} onClose={() => setSelectedRecord(null)} onReloadFeature={async () => { const updated = await loadOperationsFeature(activeRecord); setSelectedRecord(updated); onSelectFeature?.(updated); setRefreshVersion((value) => value + 1) }} onUpdated={(updated) => { setSelectedRecord(updated); onSelectFeature?.(updated); setRefreshVersion((value) => value + 1) }} {...recordActions} />}
      </div>
    </section>
  )
}

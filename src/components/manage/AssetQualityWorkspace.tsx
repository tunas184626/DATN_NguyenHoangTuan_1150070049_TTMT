import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, ClipboardCheck, FilePenLine, MapPin, RefreshCw, Search, Wrench } from 'lucide-react'
import type { AssetFeature, AssetType } from '../../types/gis'
import type { AssetQualityFilter, AssetQualitySummary, FeaturePage } from '../../types/operations'
import { loadAssetQualitySummary, loadOperationsPage } from '../../services/operationsService'
import { isLocalDraft } from '../../services/localDraftStore'
import { ASSET_TYPE_LABELS, formatAssetType } from '../../utils/asset'
import { getAssetStatusMeta } from '../../utils/status'
import { assetChecklist, matchesAssetQuality, QUALITY_GROUPS, summarizeAssetQuality } from './assetQuality'

interface Props {
  assets: AssetFeature[]
  isSynchronized: boolean
  selectedId?: string
  onSelect: (asset: AssetFeature) => void
  refreshVersion: number
}
const PAGE_SIZE = 20
const GROUP_ICONS = { technical: FilePenLine, address: MapPin, inspection: ClipboardCheck, maintenance: Wrench }

function QualityRow({ asset, onSelect, selected }: { asset: AssetFeature; onSelect: () => void; selected: boolean }) {
  const checks = assetChecklist(asset)
  const missing = checks.filter((check) => !check.present)
  const status = getAssetStatusMeta(asset.properties.status)
  return <button type="button" onClick={onSelect} aria-pressed={selected} className={`grid w-full gap-3 border-b border-slate-100 px-4 py-4 text-left last:border-b-0 hover:bg-water-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-water-400 md:grid-cols-[minmax(0,1fr)_180px_130px] ${selected ? 'bg-water-50' : ''}`}>
    <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{asset.properties.name}</p><p className="mt-1 truncate text-xs text-slate-500">{asset.properties.assetCode || formatAssetType(asset.properties.type)} · {formatAssetType(asset.properties.type)}</p><div className="mt-2 flex flex-wrap gap-1">{missing.length ? missing.map((check) => <span key={check.label} className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">Thiếu {check.label.toLocaleLowerCase('vi')}</span>) : <span className="text-xs text-emerald-700">Đã có đủ các trường được kiểm tra</span>}</div>{isLocalDraft(asset) && <p className="mt-2 text-xs font-semibold text-amber-700">Bản chỉnh sửa trên thiết bị · chưa lưu lên máy chủ</p>}</div>
    <div className="self-center"><div className="flex justify-between text-xs"><span className="text-slate-500">Thông tin đã có</span><span className="font-bold text-slate-700">{checks.length - missing.length}/{checks.length}</span></div><div className="mt-2 flex gap-1" aria-hidden="true">{checks.map((check) => <span key={check.label} className={`h-1.5 flex-1 rounded-full ${check.present ? 'bg-water-500' : 'bg-slate-200'}`} />)}</div></div>
    <div className="flex items-center justify-between gap-2 md:flex-col md:items-end"><span className={`status-chip ${status.className}`}>{status.label}</span><span className="inline-flex items-center gap-1 text-xs font-bold text-water-700">Mở hồ sơ <ArrowRight className="size-3.5" /></span></div>
  </button>
}

export function AssetQualityWorkspace({ assets, isSynchronized, selectedId, onSelect, refreshVersion }: Props) {
  const [filter, setFilter] = useState<AssetQualityFilter>('technical')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [type, setType] = useState<'all' | AssetType>('all')
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [remote, setRemote] = useState<{ key: string; page: FeaturePage; summary: AssetQualitySummary } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const requestKey = JSON.stringify([filter, deferredQuery.trim(), type, page, refreshVersion, reload])
  useEffect(() => {
    if (!isSynchronized) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setBusy(true); setError('')
      void Promise.all([
        loadOperationsPage({ tab: 'assets', quality: filter, status: 'all', type, search: deferredQuery, page, pageSize: PAGE_SIZE }, controller.signal),
        loadAssetQualitySummary(controller.signal),
      ]).then(([nextPage, summary]) => {
        if (controller.signal.aborted) return
        setRemote({ key: requestKey, page: nextPage, summary })
        const lastPage = Math.max(1, Math.ceil(nextPage.meta.total / PAGE_SIZE))
        if (page > lastPage) setPage(lastPage)
      }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được hồ sơ tài sản') })
        .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [isSynchronized, filter, deferredQuery, type, page, refreshVersion, reload, requestKey, assets])

  const localFiltered = useMemo(() => assets.filter((asset) => matchesAssetQuality(asset, filter))
    .filter((asset) => type === 'all' || asset.properties.type === type)
    .filter((asset) => [asset.properties.name, asset.properties.assetCode, asset.properties.address].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(deferredQuery.trim().toLocaleLowerCase('vi'))))
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'vi')), [assets, filter, type, deferredQuery])
  const localSummary = useMemo(() => summarizeAssetQuality(assets), [assets])
  const summary = isSynchronized ? remote?.summary : localSummary
  const matches = remote?.key === requestKey
  const loading = isSynchronized && (busy || (!error && !matches))
  const total = isSynchronized ? matches ? remote.page.meta.total : 0 : localFiltered.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const activePage = isSynchronized ? page : Math.min(page, pageCount)
  const drafts = localFiltered.filter(isLocalDraft)
  const draftMap = new Map(assets.filter(isLocalDraft).map((asset) => [asset.properties.id, asset]))
  const rows = isSynchronized ? matches ? remote.page.features.filter((feature): feature is AssetFeature => feature.properties.type !== 'incident').map((asset) => draftMap.get(asset.properties.id) ?? asset) : [] : localFiltered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)
  const group = QUALITY_GROUPS.find((item) => item.key === filter)!
  const chooseFilter = (value: AssetQualityFilter) => { setFilter(value); setPage(1) }

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="space-y-4 border-b border-slate-100 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold text-slate-900">Chất lượng hồ sơ tài sản</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Tìm hồ sơ cần bổ sung, kiểm tra tại hiện trường và cập nhật kết quả. Số trường đã có chỉ phản ánh mức điền thông tin, chưa xác nhận độ chính xác kỹ thuật.</p></div><button type="button" className="ghost-btn shrink-0" disabled={loading} onClick={() => setReload((value) => value + 1)}><RefreshCw className={`mr-1.5 size-4 ${loading ? 'animate-spin' : ''}`} />Làm mới</button></div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{QUALITY_GROUPS.map((item) => { const Icon = GROUP_ICONS[item.key]; return <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => chooseFilter(item.key)} className={`rounded-xl border p-3 text-left transition ${filter === item.key ? 'border-water-500 bg-white ring-1 ring-water-500' : 'border-slate-200 bg-white hover:border-water-300'}`}><div className="flex items-center justify-between gap-2"><Icon className={`size-4 ${filter === item.key ? 'text-water-700' : 'text-slate-400'}`} /><span className="text-xl font-extrabold text-slate-900">{summary?.[item.key].toLocaleString('vi-VN') ?? '—'}</span></div><p className="mt-2 text-xs font-bold text-slate-700">{item.label}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{item.action} <span aria-hidden="true">→</span></p></button> })}</div>
      <p className="text-[11px] leading-5 text-slate-500">{isSynchronized ? `Thống kê toàn bộ ${summary?.total.toLocaleString('vi-VN') ?? '—'} tài sản trên máy chủ, chưa áp dụng bộ lọc phía dưới. Bản nháp không được cộng vào số tổng.` : `Thống kê ${assets.length.toLocaleString('vi-VN')} tài sản đang có trên thiết bị.`} Một tài sản có thể nằm trong nhiều nhóm. Bảo trì và cần kiểm tra dựa trên trạng thái đã ghi nhận, chưa phải lịch đến hạn.</p>
    </div>
    <div className="space-y-3 border-b border-slate-100 p-4"><div><h3 className="text-sm font-bold text-slate-800">{group.label}</h3><p className="mt-1 text-xs text-slate-500">{group.hint}. Chọn hồ sơ để cập nhật hoặc ghi nhận sự cố khi phát hiện bất thường.</p></div><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_210px]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input aria-label="Tìm hồ sơ cần hoàn thiện" className="field-input min-h-10 pl-9" placeholder="Tìm tên, mã hoặc địa chỉ tài sản..." maxLength={100} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></label><select aria-label="Loại tài sản cần hoàn thiện" className="field-input min-h-10" value={type} onChange={(event) => { setType(event.target.value as typeof type); setPage(1) }}><option value="all">Tất cả loại tài sản</option>{Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
    {isSynchronized && error && <p role="alert" className="m-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{error}. <button type="button" className="font-bold underline" onClick={() => setReload((value) => value + 1)}>Thử lại</button></p>}
    {isSynchronized && drafts.length > 0 && <details className="mx-4 mt-3 rounded-lg border border-amber-200 p-3"><summary className="cursor-pointer text-xs font-semibold text-amber-800">{drafts.length} bản lưu trên thiết bị khớp bộ lọc · chưa lưu lên máy chủ</summary>{drafts.map((asset) => <QualityRow key={asset.properties.id} asset={asset} selected={selectedId === asset.properties.id} onSelect={() => onSelect(asset)} />)}</details>}
    <div className="min-h-56 flex-1 overflow-auto" aria-busy={loading}>{loading ? <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin" />Đang rà soát hồ sơ...</div> : error && !matches ? null : rows.length ? rows.map((asset) => <QualityRow key={asset.properties.id} asset={asset} selected={selectedId === asset.properties.id} onSelect={() => onSelect(asset)} />) : <div className="flex min-h-56 flex-col items-center justify-center gap-2 px-6 text-center"><span className="rounded-full bg-emerald-50 p-3 text-emerald-600"><Check className="size-5" /></span><p className="text-sm font-bold text-slate-700">Không có hồ sơ khớp bộ lọc</p><p className="max-w-md text-xs text-slate-500">Chọn nhóm khác hoặc bỏ từ khóa để tiếp tục rà soát. Kết quả này chưa thay thế kiểm tra chất lượng ngoài hiện trường.</p></div>}</div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-4 text-xs text-slate-500"><p>{rows.length} / {loading || (isSynchronized && !matches) ? '—' : total.toLocaleString('vi-VN')} hồ sơ khớp bộ lọc</p>{pageCount > 1 && <div className="flex items-center gap-2"><button type="button" aria-label="Trang hồ sơ trước" className="ghost-btn !p-2" disabled={loading || activePage <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="size-4" /></button><span>Trang {activePage}/{pageCount}</span><button type="button" aria-label="Trang hồ sơ sau" className="ghost-btn !p-2" disabled={loading || activePage >= pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight className="size-4" /></button></div>}</footer>
  </div>
}

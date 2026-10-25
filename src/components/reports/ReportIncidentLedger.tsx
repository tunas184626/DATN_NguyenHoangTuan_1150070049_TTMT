import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react'
import type { LayerDataState } from '../../types/gis'
import type { ReportFilters, ReportIncidentPage } from '../../types/reports'
import { loadAllReportIncidents, loadReportIncidents } from '../../services/reportService'
import { buildIncidentReportCsv, buildLocalReportIncidents, REPORT_INCIDENT_LABELS } from '../../utils/reports'

interface Props { data: LayerDataState; filters: ReportFilters; database: boolean }
const PAGE_SIZE = 20
const label = (key: string) => REPORT_INCIDENT_LABELS[key] ?? key
const formatTime = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa xác định'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
}

export default function ReportIncidentLedger({ data, filters, database }: Props) {
  const [page, setPage] = useState(1)
  const [serverPage, setServerPage] = useState<ReportIncidentPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState('')
  const [retry, setRetry] = useState(0)
  const [snapshotTime] = useState(() => Date.now())
  const exportController = useRef<AbortController | null>(null)
  const localRows = useMemo(() => buildLocalReportIncidents(data, filters), [data, filters])
  useEffect(() => {
    if (!database) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true); setServerPage(null); setError('')
      try {
        const next = await loadReportIncidents(filters, (page - 1) * PAGE_SIZE, PAGE_SIZE, controller.signal)
        if (!controller.signal.aborted) {
          if (page > Math.max(1, Math.ceil(next.meta.total / PAGE_SIZE))) setPage(Math.max(1, Math.ceil(next.meta.total / PAGE_SIZE)))
          else setServerPage(next)
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không thể tải sổ sự cố')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [database, filters, page, retry])
  useEffect(() => () => exportController.current?.abort(), [])
  const rows = database ? serverPage?.rows ?? [] : localRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = database ? serverPage?.meta.total : localRows.length
  const pages = total === undefined ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE))

  const exportCsv = async () => {
    setExporting(true); setExportNote('')
    const controller = new AbortController()
    exportController.current = controller
    try {
      const allRows = database ? await loadAllReportIncidents(filters, controller.signal) : localRows
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(new Blob([buildIncidentReportCsv(allRows)], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `So-su-co-${database ? 'API' : 'du-lieu-thiet-bi'}-${filters.from}-${filters.to}.csv`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportNote(`Đã xuất ${allRows.length} hồ sơ ${database ? 'từ API' : 'hiện có trên thiết bị'} theo bộ lọc.`)
    } catch (reason) {
      if (!controller.signal.aborted) setExportNote(reason instanceof Error ? reason.message : 'Xuất thất bại. Chưa tạo tệp CSV.')
    } finally { if (!controller.signal.aborted) setExporting(false) }
  }

  return <section className="report-no-print panel overflow-hidden">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
      <div><h3 className="text-sm font-bold text-slate-800">Sổ theo dõi sự cố</h3><p className="mt-1 text-xs text-slate-500">{database ? 'Toàn bộ hồ sơ API khớp bộ lọc; phân trang phía máy chủ.' : 'Chỉ hồ sơ đang có trên thiết bị; có thể chưa đầy đủ.'} Giờ hiển thị theo Việt Nam (UTC+7), CSV theo UTC; hồ sơ cũ có thể chỉ có ngày.</p></div>
      <button className="ghost-btn disabled:opacity-50" type="button" disabled={exporting || loading} onClick={() => void exportCsv()}>{exporting ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}{exporting ? 'Đang tổng hợp…' : 'Xuất CSV toàn bộ kết quả'}</button>
    </header>
    {exportNote && <p role="status" className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">{exportNote}</p>}
    {error ? <div className="p-6 text-sm text-red-700">{error}<button className="ghost-btn ml-3" onClick={() => setRetry((current) => current + 1)}>Thử lại</button></div>
      : loading ? <p className="p-8 text-center text-sm text-slate-500">Đang tải hồ sơ…</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr>{['Hồ sơ / khu vực', 'Loại / mức độ', 'Trạng thái', 'Phụ trách', 'Ghi nhận', 'Hạn xử lý', 'Hoàn tất', 'Ảnh hưởng'].map((title) => <th key={title} className="px-4 py-3 font-semibold">{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="align-top hover:bg-slate-50">
            <td className="max-w-[250px] px-4 py-3"><p className="font-semibold text-water-700">{row.code}</p><p className="mt-1 font-medium text-slate-800">{row.name}</p><p className="mt-1 text-slate-500">{row.address || 'Chưa có địa chỉ'}</p></td>
            <td className="px-4 py-3 text-slate-600"><p>{label(row.incidentType)}</p><p className={`mt-1 ${row.severity === 'high' ? 'font-semibold text-red-700' : ''}`}>{label(row.severity)}</p></td>
            <td className="px-4 py-3"><span className={`whitespace-nowrap rounded px-2 py-1 ${row.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : row.status === 'new' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-700'}`}>{label(row.status)}</span></td>
            <td className="px-4 py-3 text-slate-600">{row.assignedTo || 'Chưa phân công'}</td>
            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(row.reportedAt)}</td>
            <td className={`whitespace-nowrap px-4 py-3 ${row.status !== 'resolved' && row.dueAt && new Date(row.dueAt).getTime() < snapshotTime ? 'text-red-700' : 'text-slate-600'}`}>{formatTime(row.dueAt)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(row.resolvedAt)}</td>
            <td className="px-4 py-3 text-slate-600">{label(row.serviceImpact)}</td>
          </tr>)}</tbody>
        </table>{rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Không có hồ sơ phù hợp.</p>}</div>}
    <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <span>{total === undefined ? 'Chưa có tổng số' : `${total} hồ sơ · Trang ${page}/${pages}`}</span><div className="flex gap-2">
        <button aria-label="Trang trước" className="ghost-btn disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="size-4" /></button>
        <button aria-label="Trang sau" className="ghost-btn disabled:opacity-40" disabled={page >= pages || loading || total === undefined} onClick={() => setPage((current) => current + 1)}><ChevronRight className="size-4" /></button>
      </div>
    </footer>
  </section>
}

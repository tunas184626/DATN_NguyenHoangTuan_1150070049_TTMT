import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, Download, Filter, MapPin, RefreshCw } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DataSourceMode, LayerDataState } from '../../types/gis'
import type { ReportFilters, ReportSummaryData } from '../../types/reports'
import { loadReportSummary } from '../../services/reportService'
import { buildLocalReport } from '../../utils/reports'
import { flattenAllFeatures } from '../../utils/metrics'
import ReportBusiness from './ReportBusiness'
import ReportIncidentLedger from './ReportIncidentLedger'

interface ReportsViewProps {
  data: LayerDataState
  dataSourceMode: DataSourceMode
  preparedBy: string
}

const ASSET_STATUS_LABELS: Record<string, string> = {
  active: 'Đang hoạt động', maintenance: 'Bảo trì', need_inspection: 'Cần kiểm tra', pending_data: 'Chờ dữ liệu',
}
const INCIDENT_SEVERITY_LABELS: Record<string, string> = {
  low: 'Thấp', medium: 'Trung bình', high: 'Cao',
}
const PIE_COLORS = ['#0ea5e9', '#f59e0b', '#ef4444', '#94a3b8']

function inputDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-')
}

function defaultFilters(): ReportFilters {
  const to = inputDate(new Date())
  const calendar = new Date(`${to}T00:00:00Z`)
  const from = new Date(Date.UTC(calendar.getUTCFullYear(), calendar.getUTCMonth() - 5, 1))
  return { from: inputDate(from), to, region: '' }
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Không có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN').format(date)
}

function hashReport(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

function getReportCode(report: ReportSummaryData, issuedAt: string): string {
  const stamp = issuedAt.replace(/\D/g, '').slice(0, 12)
  const fingerprint = hashReport(JSON.stringify({
    filters: report.filters,
    summary: report.summary,
    assetStatus: report.assetStatus,
    incidentSeverity: report.incidentSeverity,
    trend: report.trend,
    business: report.business,
    incidentType: report.incidentType,
    serviceImpact: report.serviceImpact,
    snapshot: report.generatedAt,
  })).slice(0, 8)
  return `BC-${stamp}-${fingerprint}`
}

function hasValues(items: Array<{ value: number }>): boolean {
  return items.some((item) => item.value > 0)
}

export default function ReportsView({ data, dataSourceMode, preparedBy }: ReportsViewProps) {
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() => ({ ...draftFilters }))
  const [serverReport, setServerReport] = useState<ReportSummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString())
  const [view, setView] = useState<'summary' | 'ledger'>('summary')
  const requestVersion = useRef(0)
  const initialFilters = useRef(appliedFilters)

  const localReport = useMemo(() => buildLocalReport(data, appliedFilters), [appliedFilters, data])
  const report = serverReport ?? localReport
  const code = useMemo(() => getReportCode(report, issuedAt), [issuedAt, report])
  const assetChart = useMemo(() => report.assetStatus.map((item) => ({
    ...item, label: ASSET_STATUS_LABELS[item.key] ?? item.key,
  })), [report.assetStatus])
  const severityChart = useMemo(() => report.incidentSeverity.map((item) => ({
    ...item, label: INCIDENT_SEVERITY_LABELS[item.key] ?? item.key,
  })), [report.incidentSeverity])
  const trendChart = useMemo(() => report.trend.map((item) => ({
    ...item, label: `T${Number(item.month.slice(5, 7))}/${item.month.slice(2, 4)}`,
  })), [report.trend])
  const regionSuggestions = useMemo(() => Array.from(new Set(
    flattenAllFeatures(data).map((feature) => feature.properties.address).filter(Boolean),
  )).sort((left, right) => left.localeCompare(right, 'vi')), [data])

  const fetchReport = useCallback(async (filters: ReportFilters) => {
    const version = ++requestVersion.current
    setAppliedFilters(filters)
    setServerReport(null)
    setError('')
    if (dataSourceMode !== 'api') return

    setLoading(true)
    try {
      const next = await loadReportSummary(filters)
      if (requestVersion.current === version) setServerReport(next)
    } catch (reason) {
      if (requestVersion.current === version) {
        setError(reason instanceof Error
          ? `${reason.message}. Báo cáo đang dùng dữ liệu đã tải trên thiết bị.`
          : 'Không thể tải báo cáo đồng bộ. Báo cáo đang dùng dữ liệu đã tải trên thiết bị.')
      }
    } finally {
      if (requestVersion.current === version) setLoading(false)
    }
  }, [dataSourceMode])

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchReport(initialFilters.current) }, 0)
    // Chỉ tự tải một lần khi mở màn hình; các lần sau do người dùng áp dụng bộ lọc.
    return () => window.clearTimeout(timer)
  }, [fetchReport])

  const handleApply = () => {
    if (!draftFilters.from || !draftFilters.to) {
      setError('Vui lòng chọn đầy đủ khoảng thời gian.')
      return
    }
    if (draftFilters.from > draftFilters.to) {
      setError('Ngày kết thúc phải từ ngày bắt đầu trở đi.')
      return
    }
    const from = new Date(draftFilters.from)
    const to = new Date(draftFilters.to)
    if ((to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() >= 120) {
      setError('Mỗi báo cáo hỗ trợ tối đa 120 tháng. Vui lòng thu hẹp khoảng thời gian.')
      return
    }
    void fetchReport({ ...draftFilters, region: draftFilters.region.trim() })
  }

  const handleReset = () => {
    const next = defaultFilters()
    setDraftFilters(next)
    void fetchReport(next)
  }

  const handlePrint = () => {
    const nextIssuedAt = new Date().toISOString()
    setIssuedAt(nextIssuedAt)
    const previousTitle = document.title
    document.title = `Bao-cao-WebGIS-${getReportCode(report, nextIssuedAt)}`
    window.addEventListener('afterprint', () => { document.title = previousTitle }, { once: true })
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()))
  }

  const sourceLabel = report.trace.source === 'database' ? 'Dữ liệu đã đồng bộ' : 'Dữ liệu hiện có trên thiết bị'

  return (
    <div className="report-print-root h-full overflow-y-auto">
      <section className="report-no-print panel mb-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-800">Báo cáo vận hành</h1>
            <p className="mt-0.5 text-xs text-slate-500">Theo dõi SLA, ảnh hưởng cấp nước và đối soát hồ sơ theo kỳ.</p>
          </div>
          <button type="button" onClick={handlePrint} disabled={loading} className="primary-btn disabled:opacity-50">
            <Download className="mr-2 size-4" /> Xuất PDF
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1.4fr_auto_auto]">
          <label>
            <span className="field-label"><CalendarRange className="mr-1 inline size-3.5" />Từ ngày</span>
            <input type="date" className="field-input" value={draftFilters.from} onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))} />
          </label>
          <label>
            <span className="field-label">Đến ngày</span>
            <input type="date" className="field-input" value={draftFilters.to} onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))} />
          </label>
          <label>
            <span className="field-label"><MapPin className="mr-1 inline size-3.5" />Khu vực</span>
            <input className="field-input" list="report-region-suggestions" value={draftFilters.region} placeholder="Nhập xã, huyện hoặc địa chỉ..." onChange={(event) => setDraftFilters((current) => ({ ...current, region: event.target.value }))} />
            <datalist id="report-region-suggestions">
              {regionSuggestions.map((region) => <option key={region} value={region} />)}
            </datalist>
          </label>
          <button type="button" onClick={handleApply} disabled={loading} className="primary-btn self-end disabled:cursor-wait disabled:opacity-60">
            {loading ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Filter className="mr-2 size-4" />}
            {loading ? 'Đang tải' : 'Áp dụng'}
          </button>
          <button type="button" onClick={handleReset} disabled={loading} className="ghost-btn self-end">Đặt lại</button>
        </div>
        {error && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>}
        {report.trace.source === 'local' && !loading && <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">Phạm vi thiết bị: chỉ tổng hợp dữ liệu hiện đã tải và bản nháp; không đại diện toàn bộ database. Hồ sơ thiếu ngày hoàn tất không được đưa vào mẫu SLA.</p>}
      </section>

      <div className="report-print-sheet space-y-3">
        <header className="report-print-header panel flex flex-wrap items-start justify-between gap-4 p-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-water-700">WebGIS hệ thống cấp nước</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">Báo cáo tổng hợp hạ tầng và sự cố</h2>
            <p className="mt-1 text-sm text-slate-500">{formatDate(report.filters.from)} – {formatDate(report.filters.to)} · {report.filters.region || 'Tất cả khu vực'}</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-600">
            <dt className="font-semibold">Mã báo cáo</dt><dd className="font-mono font-bold text-slate-800">{code}</dd>
            <dt className="font-semibold">Người lập</dt><dd>{preparedBy}</dd>
            <dt className="font-semibold">Thời điểm lập</dt><dd>{formatDateTime(issuedAt)}</dd>
            <dt className="font-semibold">Nguồn</dt><dd>{sourceLabel}</dd>
          </dl>
        </header>

        <section className="report-kpis grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Tài sản cập nhật', report.summary.assets, 'text-slate-800'],
            ['Sự cố ghi nhận', report.summary.incidents, 'text-slate-800'],
            ['Sự cố đang mở', report.summary.openIncidents, 'text-amber-600'],
            ['Sự cố đã giải quyết', report.summary.resolvedIncidents, 'text-emerald-600'],
          ].map(([label, value, color]) => (
            <article key={String(label)} className="panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className={`mt-2 text-3xl font-extrabold ${color}`}>{value}</p>
            </article>
          ))}
        </section>

        <ReportBusiness report={report} />

        <nav className="report-no-print flex gap-1 rounded-lg border border-slate-200 bg-white p-1" aria-label="Nội dung báo cáo">
          {([['summary', 'Tổng quan & xu hướng'], ['ledger', 'Sổ chi tiết & CSV']] as const).map(([key, title]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`rounded-md px-4 py-2 text-sm font-semibold ${view === key ? 'bg-water-50 text-water-800' : 'text-slate-500 hover:bg-slate-50'}`}>{title}</button>)}
        </nav>

        {view === 'ledger' && <ReportIncidentLedger key={`${JSON.stringify(appliedFilters)}-${report.trace.source}`} data={data} filters={appliedFilters} database={report.trace.source === 'database'} />}

        <section className={`report-charts grid grid-cols-1 gap-3 lg:grid-cols-2 ${view === 'ledger' ? 'hidden print:grid' : ''}`}>
          <article className="panel p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Trạng thái tài sản được cập nhật</p>
            <div className="h-[250px]">
              {hasValues(assetChart) ? <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={assetChart} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={78} label>
                  {assetChart.map((item, index) => <Cell key={item.key} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                </Pie><Tooltip /><Legend /></PieChart>
              </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Không có dữ liệu trong kỳ</div>}
            </div>
          </article>

          <article className="panel p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Mức độ sự cố</p>
            <div className="h-[250px]">
              {hasValues(severityChart) ? <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityChart}><CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" name="Số sự cố" fill="#ef4444" radius={[6, 6, 0, 0]} /></BarChart>
              </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Không có dữ liệu trong kỳ</div>}
            </div>
          </article>

          <article className="panel p-4 lg:col-span-2">
            <p className="mb-3 text-sm font-semibold text-slate-800">Sự cố theo thời gian</p>
            <div className="h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChart}><CartesianGrid strokeDasharray="4 4" stroke="#dbeafe" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="incidents" name="Sự cố thực tế" stroke="#dc2626" strokeWidth={3} dot={{ r: 3 }} /></LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <footer className="report-print-footer panel grid gap-2 p-3 text-[11px] text-slate-500 md:grid-cols-2">
          <p><strong className="text-slate-700">Truy vết dữ liệu:</strong> chốt lúc {formatDateTime(report.generatedAt)}; tài sản mới nhất {formatDateTime(report.trace.latestAssetUpdate)}; sự cố mới nhất {formatDateTime(report.trace.latestIncidentUpdate)}.</p>
          <p className="md:text-right"><strong className="text-slate-700">Mã kiểm chứng:</strong> {code}. {sourceLabel}. {report.trace.source === 'local' ? 'Phạm vi dữ liệu đã tải; có thể chưa đầy đủ.' : 'Tổng hợp toàn bộ database theo bộ lọc, không gồm bản nháp local.'} PDF là báo cáo tổng hợp; sổ chi tiết được xuất riêng bằng CSV.</p>
        </footer>
      </div>
    </div>
  )
}

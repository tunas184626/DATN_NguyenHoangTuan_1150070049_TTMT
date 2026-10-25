import type { ReportFilters, ReportIncidentPage, ReportIncidentRow, ReportSummaryData } from '../types/reports'
import { apiGet } from './apiClient'

export function loadReportSummary(filters: ReportFilters): Promise<ReportSummaryData> {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
  })
  if (filters.region.trim()) params.set('region', filters.region.trim())
  return apiGet<ReportSummaryData>(`/reports/summary?${params.toString()}`, 10_000)
}

export function loadReportIncidents(filters: ReportFilters, offset = 0, limit = 20, signal?: AbortSignal): Promise<ReportIncidentPage> {
  const params = new URLSearchParams({ from: filters.from, to: filters.to, region: filters.region.trim(), limit: String(limit), offset: String(offset) })
  return apiGet<ReportIncidentPage>(`/reports/incidents?${params}`, 15_000, signal)
}

export async function loadAllReportIncidents(filters: ReportFilters, signal?: AbortSignal): Promise<ReportIncidentRow[]> {
  const rows: ReportIncidentRow[] = []
  const seen = new Set<string>()
  let total: number | undefined
  do {
    const page = await loadReportIncidents(filters, rows.length, 500, signal)
    if (!Number.isSafeInteger(page.meta.total) || page.meta.total < 0 || (total !== undefined && page.meta.total !== total)) {
      throw new Error('Dữ liệu đã thay đổi trong lúc xuất. Vui lòng áp dụng bộ lọc và xuất lại.')
    }
    total = page.meta.total
    if ((page.rows.length === 0 && rows.length < total) || page.rows.some((row) => seen.has(row.id)) || rows.length + page.rows.length > total) {
      throw new Error('Danh sách xuất chưa đầy đủ. Không tạo tệp CSV; vui lòng thử lại.')
    }
    for (const row of page.rows) {
      if (seen.has(row.id)) throw new Error('Danh sách xuất bị trùng. Vui lòng thử lại.')
      seen.add(row.id)
      rows.push(row)
    }
  } while (rows.length < total)
  return rows
}

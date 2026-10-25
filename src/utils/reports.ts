import type { LayerDataState } from '../types/gis'
import type { ReportBusinessMetrics, ReportFilters, ReportIncidentRow, ReportSummaryData } from '../types/reports'
import { flattenAssets, flattenIncidents } from './metrics'

const REPORT_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
})

function reportDay(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  // Legacy date-only records represent the recorded calendar day, not midnight UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return date.toISOString().slice(0, 10) === value ? value : null
  const parts = REPORT_DAY_FORMAT.formatToParts(date)
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-')
}

function isInPeriod(value: string, filters: ReportFilters): boolean {
  const day = reportDay(value)
  return day !== null && day >= filters.from && day <= filters.to
}

function isInRegion(address: string, region: string): boolean {
  const query = region.trim().toLocaleLowerCase('vi-VN')
  return !query || address.toLocaleLowerCase('vi-VN').includes(query)
}

function latest(values: string[]): string | null {
  const valid = values
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())
  return valid[0]?.toISOString() ?? null
}

function buildMonths(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T00:00:00.000Z`)
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  const months: string[] = []

  while (cursor <= last && months.length < 120) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

export function buildLocalReport(data: LayerDataState, filters: ReportFilters): ReportSummaryData {
  const assets = flattenAssets(data).filter((feature) =>
    isInPeriod(feature.properties.lastUpdated, filters) && isInRegion(feature.properties.address, filters.region),
  )
  const incidents = flattenIncidents(data).filter((feature) =>
    isInPeriod(feature.properties.reportedAt ?? feature.properties.reportedDate, filters) && isInRegion(feature.properties.address, filters.region),
  )

  const assetStatus = ['active', 'maintenance', 'need_inspection', 'pending_data'].map((key) => ({
    key,
    value: assets.filter((feature) => feature.properties.status === key).length,
  }))
  const incidentSeverity = ['low', 'medium', 'high'].map((key) => ({
    key,
    value: incidents.filter((feature) => feature.properties.severity === key).length,
  }))
  const trend = buildMonths(filters.from, filters.to).map((month) => ({
    month,
    incidents: incidents.filter((feature) => reportDay(feature.properties.reportedAt ?? feature.properties.reportedDate)?.startsWith(month)).length,
  }))

  return {
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      assets: assets.length,
      incidents: incidents.length,
      openIncidents: incidents.filter((feature) => feature.properties.status !== 'resolved').length,
      resolvedIncidents: incidents.filter((feature) => feature.properties.status === 'resolved').length,
    },
    assetStatus,
    incidentSeverity,
    trend,
    business: buildReportBusiness(buildLocalReportIncidents(data, filters)),
    incidentType: countBy(incidents.map((feature) => feature.properties.incidentType)),
    serviceImpact: countBy(incidents.map((feature) => feature.properties.intake?.serviceImpact ?? 'unknown')),
    trace: {
      source: 'local',
      latestAssetUpdate: latest(assets.map((feature) => feature.properties.lastUpdated)),
      latestIncidentUpdate: latest(incidents.map((feature) => feature.properties.lastUpdated)),
    },
  }
}

function countBy(keys: string[]): Array<{ key: string; value: number }> {
  const counts = new Map<string, number>()
  keys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1))
  return Array.from(counts, ([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
}

export function buildLocalReportIncidents(data: LayerDataState, filters: ReportFilters): ReportIncidentRow[] {
  return flattenIncidents(data).filter((feature) => isInPeriod(feature.properties.reportedAt ?? feature.properties.reportedDate, filters)
    && isInRegion(feature.properties.address, filters.region)).map(({ properties: p }) => ({
    id: p.id, code: p.incidentCode, name: p.name, incidentType: p.incidentType, severity: p.severity,
    status: p.status, address: p.address, assignedTo: p.assignedTo || p.assignedUserId || null,
    reportedAt: p.reportedAt ?? p.reportedDate, dueAt: p.dueAt ?? null,
    // lastUpdated also changes for comments/assignments, so it cannot stand in for resolution time.
    resolvedAt: p.resolvedAt ?? null,
    serviceImpact: p.intake?.serviceImpact ?? 'unknown',
  })).sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime() || a.id.localeCompare(b.id))
}

export function buildReportBusiness(rows: ReportIncidentRow[], now = Date.now()): ReportBusinessMetrics {
  const open = rows.filter((row) => row.status !== 'resolved')
  const resolved = rows.filter((row) => row.status === 'resolved')
  const timestamp = (value: string | null) => value ? new Date(value).getTime() : NaN
  const hasTime = (value: string | null) => Boolean(value?.includes('T')) && Number.isFinite(timestamp(value))
  const timed = resolved.filter((row) => hasTime(row.resolvedAt)
    && hasTime(row.reportedAt) && timestamp(row.resolvedAt) >= timestamp(row.reportedAt))
  const eligible = timed.filter((row) => hasTime(row.dueAt))
  const onTime = eligible.filter((row) => timestamp(row.resolvedAt) <= timestamp(row.dueAt)).length
  return {
    overdueOpen: open.filter((row) => timestamp(row.dueAt) < now).length,
    unassignedOpen: open.filter((row) => !row.assignedTo?.trim()).length,
    highPriorityOpen: open.filter((row) => row.severity === 'high').length,
    openMissingDeadline: open.filter((row) => !Number.isFinite(timestamp(row.dueAt))).length,
    resolvedOnTime: onTime, resolvedLate: eligible.length - onTime,
    resolvedSlaEligible: eligible.length, resolvedMissingTiming: resolved.length - eligible.length,
    resolutionSample: timed.length,
    averageResolutionMinutes: timed.length > 0
      ? timed.reduce((sum, row) => sum + (timestamp(row.resolvedAt) - timestamp(row.reportedAt)) / 60_000, 0) / timed.length : null,
    slaOnTimeRate: eligible.length > 0 ? onTime / eligible.length * 100 : null,
  }
}

export const REPORT_INCIDENT_LABELS: Record<string, string> = {
  leak: 'Rò rỉ', pressure_loss: 'Giảm áp', pipe_burst: 'Vỡ ống', turbid_water: 'Nước đục', need_inspection: 'Cần kiểm tra',
  new: 'Mới ghi nhận', in_progress: 'Đang xử lý', resolved: 'Hoàn tất',
  low: 'Thấp', medium: 'Trung bình', high: 'Cao',
  none: 'Không ảnh hưởng', reduced: 'Giảm cấp nước', interrupted: 'Ngừng cấp nước', unknown: 'Chưa xác định',
}

export function buildReportRecommendations(report: ReportSummaryData): string[] {
  const metrics = report.business
  const actions: string[] = []
  if (metrics.overdueOpen) actions.push(`Rà soát ${metrics.overdueOpen} sự cố quá hạn; cập nhật tiến độ và phương án khôi phục cấp nước.`)
  if (metrics.unassignedOpen) actions.push(`Phân công người phụ trách cho ${metrics.unassignedOpen} sự cố đang mở chưa có người nhận.`)
  const interrupted = report.serviceImpact.find((item) => item.key === 'interrupted')?.value ?? 0
  if (interrupted) actions.push(`Đối soát ${interrupted} hồ sơ có ngừng cấp nước trong kỳ; xác nhận phạm vi ảnh hưởng và kết quả khôi phục.`)
  if (metrics.resolvedMissingTiming || metrics.openMissingDeadline) actions.push(`Bổ sung dữ liệu thời gian: ${metrics.resolvedMissingTiming} hồ sơ hoàn tất chưa đủ để tính SLA, ${metrics.openMissingDeadline} hồ sơ mở thiếu hạn xử lý.`)
  if (metrics.resolvedLate) actions.push(`Phân tích nguyên nhân ${metrics.resolvedLate} sự cố hoàn tất trễ hạn để điều chỉnh điều phối và vật tư.`)
  return actions
}

// Protect spreadsheet users from formula injection and keep Vietnamese readable in Excel.
export function reportCsvCell(value: string): string {
  let index = 0
  while (index < value.length && (value.charCodeAt(index) <= 32 || /\s/.test(value[index]))) index += 1
  const safe = /^[=+\-@]/.test(value.slice(index)) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function buildIncidentReportCsv(rows: ReportIncidentRow[]): string {
  const header = ['Mã sự cố', 'Tên', 'Loại', 'Mức độ', 'Trạng thái', 'Địa chỉ', 'Phụ trách', 'Ghi nhận (UTC)', 'Hạn xử lý (UTC)', 'Hoàn tất (UTC)', 'Ảnh hưởng cấp nước']
  const label = (value: string) => REPORT_INCIDENT_LABELS[value] ?? value
  const utc = (value: string | null) => {
    if (!value) return ''
    const date = new Date(value)
    return value.includes('T') && !Number.isNaN(date.getTime()) ? date.toISOString() : value
  }
  return '\uFEFF' + [header, ...rows.map((row) => [row.code, row.name, label(row.incidentType), label(row.severity), label(row.status), row.address,
    row.assignedTo ?? '', utc(row.reportedAt), utc(row.dueAt), utc(row.resolvedAt), label(row.serviceImpact)])]
    .map((cells) => cells.map(reportCsvCell).join(',')).join('\r\n')
}

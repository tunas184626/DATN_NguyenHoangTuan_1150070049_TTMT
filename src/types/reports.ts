export interface ReportFilters {
  from: string
  to: string
  region: string
}

export interface ReportBusinessMetrics {
  overdueOpen: number
  unassignedOpen: number
  highPriorityOpen: number
  openMissingDeadline: number
  resolvedOnTime: number
  resolvedLate: number
  resolvedSlaEligible: number
  resolvedMissingTiming: number
  resolutionSample: number
  averageResolutionMinutes: number | null
  slaOnTimeRate: number | null
}

export interface ReportIncidentRow {
  id: string
  code: string
  name: string
  incidentType: string
  severity: string
  status: string
  address: string
  assignedTo: string | null
  reportedAt: string
  dueAt: string | null
  resolvedAt: string | null
  serviceImpact: string
}

export interface ReportIncidentPage {
  rows: ReportIncidentRow[]
  meta: { total: number; limit: number; offset: number }
}

export interface ReportSummaryData {
  generatedAt: string
  filters: ReportFilters
  summary: {
    assets: number
    incidents: number
    openIncidents: number
    resolvedIncidents: number
  }
  assetStatus: Array<{ key: string; value: number }>
  incidentSeverity: Array<{ key: string; value: number }>
  trend: Array<{ month: string; incidents: number }>
  business: ReportBusinessMetrics
  incidentType: Array<{ key: string; value: number }>
  serviceImpact: Array<{ key: string; value: number }>
  trace: {
    source: 'database' | 'local'
    latestAssetUpdate: string | null
    latestIncidentUpdate: string | null
  }
}

import type { QueryResultRow } from 'pg'
import { getPool } from '../../db/pool.js'
import type { ReportIncidentsQuery, ReportSummaryQuery } from './schemas.js'

interface GroupRow extends QueryResultRow {
  key: string
  value: string
}

interface TrendRow extends QueryResultRow {
  month: string
  incidents: string
}

interface TotalsRow extends QueryResultRow {
  assets: string
  incidents: string
  open_incidents: string
  resolved_incidents: string
  latest_asset_update: Date | null
  latest_incident_update: Date | null
}

interface BusinessRow extends QueryResultRow {
  overdue_open: string
  unassigned_open: string
  high_priority_open: string
  open_missing_deadline: string
  resolved_on_time: string
  resolved_late: string
  resolved_sla_eligible: string
  resolved_missing_timing: string
  resolution_sample: string
  average_resolution_minutes: string | null
}

// Report periods follow the local business calendar, including near-midnight records.
function periodWhere(dateColumn: 'updated_at' | 'reported_at'): string {
  return `deleted_at is null
    and ${dateColumn} >= ($1::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
    and ${dateColumn} < (($2::date + interval '1 day') at time zone 'Asia/Ho_Chi_Minh')
    and ($3 = '' or address ilike '%' || $3 || '%')`
}

function filterValues(query: ReportSummaryQuery): string[] {
  return [query.from, query.to, query.region.replace(/[\\%_]/g, '\\$&')]
}

export async function getReportSummary(query: ReportSummaryQuery) {
  const values = filterValues(query)
  const assetWhere = periodWhere('updated_at')
  const incidentWhere = periodWhere('reported_at')

  const [assetStatus, incidentSeverity, trend, totals, business, incidentType, serviceImpact] = await Promise.all([
    getPool().query<GroupRow>(
      `select status as key, count(*)::text as value from assets where ${assetWhere} group by status order by status`,
      values,
    ),
    getPool().query<GroupRow>(
      `select severity as key, count(*)::text as value from incidents where ${incidentWhere} group by severity order by severity`,
      values,
    ),
    getPool().query<TrendRow>(
      `with months as (
         select generate_series(date_trunc('month', $1::date::timestamp), date_trunc('month', $2::date::timestamp), interval '1 month') as month
       ), incident_counts as (
         select date_trunc('month', reported_at at time zone 'Asia/Ho_Chi_Minh') as month, count(*)::text as incidents
         from incidents where ${incidentWhere} group by 1
       )
       select to_char(months.month, 'YYYY-MM') as month, coalesce(incident_counts.incidents, '0') as incidents
       from months left join incident_counts using (month) order by months.month`,
      values,
    ),
    getPool().query<TotalsRow>(
      `select
        (select count(*) from assets where ${assetWhere})::text as assets,
        (select count(*) from incidents where ${incidentWhere})::text as incidents,
        (select count(*) from incidents where ${incidentWhere} and status <> 'resolved')::text as open_incidents,
        (select count(*) from incidents where ${incidentWhere} and status = 'resolved')::text as resolved_incidents,
        (select max(updated_at) from assets where ${assetWhere}) as latest_asset_update,
        (select max(updated_at) from incidents where ${incidentWhere}) as latest_incident_update`,
      values,
    ),
    getPool().query<BusinessRow>(
      `select
        count(*) filter (where status <> 'resolved' and due_at < now())::text as overdue_open,
        count(*) filter (where status <> 'resolved' and assigned_user_id is null and nullif(trim(assigned_to), '') is null)::text as unassigned_open,
        count(*) filter (where status <> 'resolved' and severity='high')::text as high_priority_open,
        count(*) filter (where status <> 'resolved' and due_at is null)::text as open_missing_deadline,
        count(*) filter (where status='resolved' and resolved_at >= reported_at and due_at is not null and resolved_at <= due_at)::text as resolved_on_time,
        count(*) filter (where status='resolved' and resolved_at >= reported_at and due_at is not null and resolved_at > due_at)::text as resolved_late,
        count(*) filter (where status='resolved' and resolved_at >= reported_at and due_at is not null)::text as resolved_sla_eligible,
        count(*) filter (where status='resolved' and (resolved_at is null or resolved_at < reported_at or due_at is null))::text as resolved_missing_timing,
        count(*) filter (where status='resolved' and resolved_at >= reported_at)::text as resolution_sample,
        avg(extract(epoch from (resolved_at - reported_at))/60) filter (where status='resolved' and resolved_at >= reported_at)::text as average_resolution_minutes
       from incidents where ${incidentWhere}`, values,
    ),
    getPool().query<GroupRow>(
      `select incident_type as key, count(*)::text as value from incidents where ${incidentWhere} group by incident_type order by count(*) desc, incident_type`, values,
    ),
    getPool().query<GroupRow>(
      `select case when details #>> '{intake,serviceImpact}' in ('none','reduced','interrupted') then details #>> '{intake,serviceImpact}' else 'unknown' end as key,
       count(*)::text as value from incidents where ${incidentWhere} group by 1 order by 1`, values,
    ),
  ])

  const total = totals.rows[0]!
  const performance = business.rows[0]!
  const eligible = Number(performance.resolved_sla_eligible)
  return {
    generatedAt: new Date().toISOString(),
    filters: query,
    summary: {
      assets: Number(total.assets),
      incidents: Number(total.incidents),
      openIncidents: Number(total.open_incidents),
      resolvedIncidents: Number(total.resolved_incidents),
    },
    assetStatus: assetStatus.rows.map((row) => ({ key: row.key, value: Number(row.value) })),
    incidentSeverity: incidentSeverity.rows.map((row) => ({ key: row.key, value: Number(row.value) })),
    trend: trend.rows.map((row) => ({ month: row.month, incidents: Number(row.incidents) })),
    business: {
      overdueOpen: Number(performance.overdue_open),
      unassignedOpen: Number(performance.unassigned_open),
      highPriorityOpen: Number(performance.high_priority_open),
      openMissingDeadline: Number(performance.open_missing_deadline),
      resolvedOnTime: Number(performance.resolved_on_time),
      resolvedLate: Number(performance.resolved_late),
      resolvedSlaEligible: eligible,
      resolvedMissingTiming: Number(performance.resolved_missing_timing),
      resolutionSample: Number(performance.resolution_sample),
      averageResolutionMinutes: performance.average_resolution_minutes === null ? null : Number(performance.average_resolution_minutes),
      slaOnTimeRate: eligible === 0 ? null : Number(performance.resolved_on_time) / eligible * 100,
    },
    incidentType: incidentType.rows.map((row) => ({ key: row.key, value: Number(row.value) })),
    serviceImpact: serviceImpact.rows.map((row) => ({ key: row.key, value: Number(row.value) })),
    trace: {
      source: 'database' as const,
      latestAssetUpdate: total.latest_asset_update?.toISOString() ?? null,
      latestIncidentUpdate: total.latest_incident_update?.toISOString() ?? null,
    },
  }
}

interface ReportIncidentRow extends QueryResultRow {
  id: string; incident_code: string; name: string; incident_type: string; severity: string; status: string
  address: string; assigned_to: string | null; reported_at: Date; due_at: Date | null; resolved_at: Date | null
  service_impact: string; total_count: string
}

export async function getReportIncidents(query: ReportIncidentsQuery) {
  const values = filterValues(query)
  const where = periodWhere('reported_at')
  const result = await getPool().query<ReportIncidentRow>(
    `select id, incident_code, name, incident_type, severity, status, address, assigned_to, reported_at, due_at, resolved_at,
     case when details #>> '{intake,serviceImpact}' in ('none','reduced','interrupted') then details #>> '{intake,serviceImpact}' else 'unknown' end as service_impact,
     count(*) over()::text as total_count from incidents where ${where}
     order by reported_at desc, id asc limit $4 offset $5`, [...values, query.limit, query.offset],
  )
  const total = result.rows.length > 0 ? Number(result.rows[0]!.total_count)
    : Number((await getPool().query<{ total: string }>(`select count(*)::text as total from incidents where ${where}`, values)).rows[0]!.total)
  return {
    rows: result.rows.map((row) => ({
      id: row.id, code: row.incident_code, name: row.name, incidentType: row.incident_type,
      severity: row.severity, status: row.status, address: row.address, assignedTo: row.assigned_to,
      reportedAt: row.reported_at.toISOString(), dueAt: row.due_at?.toISOString() ?? null,
      resolvedAt: row.resolved_at?.toISOString() ?? null, serviceImpact: row.service_impact,
    })),
    meta: { total, limit: query.limit, offset: query.offset },
  }
}

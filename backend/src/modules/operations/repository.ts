import { getPool } from '../../db/pool.js'
import { assetQualityConditions } from './asset-quality.js'

export async function getAssetQualitySummary() {
  const result = await getPool().query<{ total: string; technical: string; address: string; inspection: string; maintenance: string }>(
    `select count(*)::text as total,
       count(*) filter (where ${assetQualityConditions.technical})::text as technical,
       count(*) filter (where ${assetQualityConditions.address})::text as address,
       count(*) filter (where ${assetQualityConditions.inspection})::text as inspection,
       count(*) filter (where ${assetQualityConditions.maintenance})::text as maintenance
     from assets where deleted_at is null`,
  )
  const row = result.rows[0]!
  return { total: Number(row.total), technical: Number(row.technical), address: Number(row.address), inspection: Number(row.inspection), maintenance: Number(row.maintenance), generatedAt: new Date().toISOString() }
}

interface TotalsRow {
  assets: string
  incidents: string
  open_incidents: string
  overdue_incidents: string
  high_priority_incidents: string
  unassigned_incidents: string
  in_progress_incidents: string
}

export async function getOperationsSummary() {
  const result = await getPool().query<TotalsRow>(
    `select
       (select count(*) from assets where deleted_at is null)::text as assets,
       count(*)::text as incidents,
       count(*) filter (where status <> 'resolved')::text as open_incidents,
       count(*) filter (where status <> 'resolved' and due_at < now())::text as overdue_incidents,
       count(*) filter (where status <> 'resolved' and severity = 'high')::text as high_priority_incidents,
       count(*) filter (where status = 'new' and assigned_user_id is null and nullif(trim(assigned_to), '') is null)::text as unassigned_incidents,
       count(*) filter (where status = 'in_progress')::text as in_progress_incidents
     from incidents where deleted_at is null`,
  )
  const row = result.rows[0]!
  return {
    assets: Number(row.assets),
    incidents: Number(row.incidents),
    openIncidents: Number(row.open_incidents),
    overdueIncidents: Number(row.overdue_incidents),
    highPriorityIncidents: Number(row.high_priority_incidents),
    unassignedIncidents: Number(row.unassigned_incidents),
    inProgressIncidents: Number(row.in_progress_incidents),
    generatedAt: new Date().toISOString(),
  }
}

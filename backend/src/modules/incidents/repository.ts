import type { PoolClient, QueryResultRow } from 'pg'
import { getPool } from '../../db/pool.js'
import { AppError } from '../../shared/errors.js'
import type { CreateIncidentInput, ListIncidentsQuery, TransitionIncidentInput } from './schemas.js'

interface IncidentRow extends QueryResultRow {
  id: string
  incident_code: string
  asset_id: string | null
  name: string
  incident_type: string
  severity: string
  status: string
  description: string
  address: string
  details: Record<string, unknown>
  geometry: object
  reported_at: Date
  updated_at: Date
  version: number
  total_count?: string
}

const columns = `id, incident_code, asset_id, name, incident_type, severity, status,
  description, address, details, ST_AsGeoJSON(geom)::json as geometry,
  reported_at, updated_at, version`

function rowToFeature(row: IncidentRow) {
  return {
    type: 'Feature' as const,
    geometry: row.geometry,
    properties: {
      id: row.id,
      incidentCode: row.incident_code,
      assetId: row.asset_id,
      name: row.name,
      type: 'incident' as const,
      incidentType: row.incident_type,
      severity: row.severity,
      status: row.status,
      description: row.description,
      address: row.address,
      ...row.details,
      reportedDate: row.reported_at.toISOString().slice(0, 10),
      lastUpdated: row.updated_at.toISOString(),
      version: row.version,
      notes: Array.isArray(row.details.notes) ? row.details.notes : [],
    },
  }
}

export async function listIncidents(query: ListIncidentsQuery) {
  const values: unknown[] = []
  const conditions = ['deleted_at is null']
  const add = (value: unknown) => { values.push(value); return `$${values.length}` }
  if (query.status) conditions.push(`status = ${add(query.status)}`)
  if (query.severity) conditions.push(`severity = ${add(query.severity)}`)
  const limit = add(query.limit)
  const offset = add(query.offset)
  const result = await getPool().query<IncidentRow>(
    `select ${columns}, count(*) over()::text as total_count from incidents
     where ${conditions.join(' and ')} order by reported_at desc limit ${limit} offset ${offset}`,
    values,
  )
  return {
    type: 'FeatureCollection' as const,
    features: result.rows.map(rowToFeature),
    meta: { total: Number(result.rows[0]?.total_count ?? 0), limit: query.limit, offset: query.offset, srid: 4326 },
  }
}

export async function createIncident(input: CreateIncidentInput, actorId: string) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const result = await client.query<IncidentRow>(
      `insert into incidents
       (asset_id, name, incident_type, severity, description, address, details, geom, reported_at, created_by, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_MakePoint($8,$9),4326),coalesce($10,now()),$11,$11)
       returning ${columns}`,
      [input.assetId ?? null, input.name, input.incidentType, input.severity, input.description,
        input.address, JSON.stringify(input.details), input.longitude, input.latitude,
        input.reportedAt ?? null, actorId],
    )
    const row = result.rows[0]!
    await client.query(
      `insert into incident_status_history (incident_id, from_status, to_status, note, changed_by)
       values ($1,null,'new','Ghi nhận sự cố',$2)`,
      [row.id, actorId],
    )
    await client.query('commit')
    return rowToFeature(row)
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

const allowedTransitions: Record<string, string[]> = {
  new: ['in_progress'],
  in_progress: ['resolved', 'new'],
  resolved: ['in_progress'],
}

export async function transitionIncident(id: string, input: TransitionIncidentInput, actorId: string) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const current = await client.query<{ status: string; version: number }>(
      'select status, version from incidents where id=$1 and deleted_at is null for update', [id],
    )
    const row = current.rows[0]
    if (!row) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Không tìm thấy sự cố')
    if (row.version !== input.version) throw new AppError(409, 'INCIDENT_VERSION_CONFLICT', 'Sự cố đã được cập nhật ở nơi khác')
    if (!allowedTransitions[row.status]?.includes(input.status)) {
      throw new AppError(422, 'INVALID_STATUS_TRANSITION', 'Không thể chuyển sang trạng thái đã chọn')
    }
    const updated = await client.query<IncidentRow>(
      `update incidents set status=$2, version=version+1, updated_by=$3, updated_at=now(),
       resolved_at=case when $2='resolved' then now() else null end where id=$1 returning ${columns}`,
      [id, input.status, actorId],
    )
    await insertHistory(client, id, row.status, input.status, input.note, actorId)
    await client.query('commit')
    return rowToFeature(updated.rows[0]!)
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

async function insertHistory(client: PoolClient, id: string, from: string, to: string, note: string, actor: string) {
  await client.query(
    `insert into incident_status_history (incident_id, from_status, to_status, note, changed_by) values ($1,$2,$3,$4,$5)`,
    [id, from, to, note, actor],
  )
}

export async function getIncidentHistory(id: string) {
  const result = await getPool().query(
    `select id, from_status as "fromStatus", to_status as "toStatus", note,
     changed_by as "changedBy", changed_at as "changedAt"
     from incident_status_history where incident_id=$1 order by changed_at desc`, [id],
  )
  return { items: result.rows }
}

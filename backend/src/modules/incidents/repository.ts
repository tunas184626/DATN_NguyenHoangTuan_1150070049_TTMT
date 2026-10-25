import type { PoolClient, QueryResultRow } from 'pg'
import { getPool } from '../../db/pool.js'
import { AppError } from '../../shared/errors.js'
import type {
  AssignIncidentInput,
  CommentIncidentInput,
  CreateIncidentInput,
  EscalateIncidentInput,
  ListIncidentsQuery,
  TransitionIncidentInput,
  UpdateIncidentAssetsInput,
} from './schemas.js'

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
  resolved_at: Date | null
  updated_at: Date
  version: number
  assigned_to: string | null
  assigned_user_id: string | null
  due_at: Date
  escalation_level: number
  sla_minutes: number | undefined
  asset_ids?: string[]
  total_count?: string
}

const columns = `id, incident_code, asset_id, name, incident_type, severity, status,
  description, address, details, ST_AsGeoJSON(geom)::json as geometry,
  reported_at, resolved_at, updated_at, version, assigned_to, assigned_user_id, due_at, escalation_level`

const listColumns = `i.id, i.incident_code, i.asset_id, i.name, i.incident_type, i.severity, i.status,
  i.description, i.address, i.details, ST_AsGeoJSON(i.geom)::json as geometry,
  i.reported_at, i.resolved_at, i.updated_at, i.version, i.assigned_to, i.assigned_user_id, i.due_at,
  i.escalation_level, policy.resolution_minutes as sla_minutes,
  coalesce(array(select link.asset_id::text from incident_assets link where link.incident_id=i.id order by link.linked_at), '{}') as asset_ids`

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
      reportedAt: row.reported_at.toISOString(),
      resolvedAt: row.resolved_at?.toISOString(),
      lastUpdated: row.updated_at.toISOString(),
      version: row.version,
      assignedTo: row.assigned_to,
      assignedUserId: row.assigned_user_id,
      dueAt: row.due_at.toISOString(),
      overdue: row.status !== 'resolved' && row.due_at.getTime() < Date.now(),
      escalationLevel: row.escalation_level,
      slaMinutes: row.sla_minutes,
      assetIds: row.asset_ids ?? (row.asset_id ? [row.asset_id] : []),
      notes: Array.isArray(row.details.notes) ? row.details.notes : [],
    },
  }
}

export async function refreshIncidentEscalations(): Promise<number> {
  const result = await getPool().query(
    `with candidates as (
       select incident.id, incident.status, incident.escalation_level as old_level,
         greatest(incident.escalation_level, case
           when now() >= incident.due_at + make_interval(mins => policy.escalation_after_minutes) then 2
           when now() >= incident.due_at then 1
           else 0
         end) as new_level
       from incidents incident
       join incident_sla_policies policy on policy.severity=incident.severity
       where incident.deleted_at is null and incident.status <> 'resolved'
     ), updated as (
       update incidents incident set escalation_level=candidate.new_level,
         escalated_at=case when candidate.new_level > 0 then coalesce(incident.escalated_at, now()) else null end,
         version=incident.version+1, updated_at=now(), updated_by='system:sla'
       from candidates candidate
       where incident.id=candidate.id and incident.escalation_level <> candidate.new_level
       returning incident.id, incident.status, candidate.old_level, incident.escalation_level as new_level
     )
     insert into incident_status_history
       (incident_id, from_status, to_status, note, changed_by, event_type, metadata)
     select id, status, status,
       case when new_level=1 then 'Sự cố đã quá hạn SLA' else 'Sự cố được nâng mức cảnh báo SLA' end,
       'system:sla', 'escalated', jsonb_build_object('fromLevel',old_level,'toLevel',new_level)
     from updated returning id`,
  )
  return result.rowCount ?? 0
}

export async function listIncidents(query: ListIncidentsQuery) {
  await refreshIncidentEscalations()
  const values: unknown[] = []
  const conditions = ['i.deleted_at is null']
  const add = (value: unknown) => { values.push(value); return `$${values.length}` }
  if (query.queue === 'unassigned') conditions.push("i.status = 'new' and i.assigned_user_id is null and nullif(trim(i.assigned_to), '') is null")
  if (query.queue === 'overdue') conditions.push("i.status <> 'resolved' and i.due_at < now()")
  if (query.queue === 'high_priority') conditions.push("i.status <> 'resolved' and i.severity = 'high'")
  if (query.queue === 'in_progress') conditions.push("i.status = 'in_progress'")
  if (query.status) conditions.push(`i.status = ${add(query.status)}`)
  if (query.severity) conditions.push(`i.severity = ${add(query.severity)}`)
  if (query.search) {
    const pattern = add(`%${query.search.replace(/[\\%_]/g, '\\$&')}%`)
    conditions.push(`(i.name ilike ${pattern} or i.incident_code ilike ${pattern} or i.address ilike ${pattern} or i.description ilike ${pattern} or i.id::text ilike ${pattern} or i.incident_type ilike ${pattern}
      or (case i.incident_type when 'leak' then 'Rò rỉ' when 'pressure_loss' then 'Mất áp' when 'pipe_burst' then 'Vỡ ống' when 'turbid_water' then 'Nước đục' else 'Cần kiểm tra' end) ilike ${pattern})`)
  }
  const countValues = [...values]
  const orderBy = query.sort === 'priority'
    ? `case when i.status='resolved' then 10 when i.due_at < now() then 0 when i.severity='high' then 1 when i.status='new' then 2 else 3 end, i.name asc, i.id asc`
    : 'i.reported_at desc, i.id asc'
  const limit = add(query.limit)
  const offset = add(query.offset)
  const result = await getPool().query<IncidentRow>(
    `select ${listColumns}, count(*) over()::text as total_count from incidents i
     join incident_sla_policies policy on policy.severity=i.severity
     where ${conditions.join(' and ')}
     order by ${orderBy} limit ${limit} offset ${offset}`,
    values,
  )
  const total = result.rows.length > 0 ? Number(result.rows[0]!.total_count) : Number((await getPool().query<{ total: string }>(
    `select count(*)::text as total from incidents i where ${conditions.join(' and ')}`, countValues,
  )).rows[0]?.total ?? 0)
  return {
    type: 'FeatureCollection' as const,
    features: result.rows.map(rowToFeature),
    meta: { total, limit: query.limit, offset: query.offset, srid: 4326 },
  }
}

export async function getIncident(id: string) {
  await refreshIncidentEscalations()
  const result = await getPool().query<IncidentRow>(
    `select ${listColumns} from incidents i
     join incident_sla_policies policy on policy.severity=i.severity
     where i.id=$1 and i.deleted_at is null`, [id],
  )
  if (!result.rows[0]) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Không tìm thấy sự cố')
  return rowToFeature(result.rows[0])
}

async function replaceIncidentAssets(
  client: PoolClient,
  incidentId: string,
  assetIds: string[],
  actorId: string,
) {
  const uniqueIds = [...new Set(assetIds)]
  if (uniqueIds.length > 0) {
    const existing = await client.query<{ id: string }>(
      'select id::text from assets where id=any($1::uuid[]) and deleted_at is null', [uniqueIds],
    )
    if (existing.rowCount !== uniqueIds.length) {
      throw new AppError(422, 'INCIDENT_ASSET_NOT_FOUND', 'Một hoặc nhiều tài sản liên kết không còn tồn tại')
    }
  }
  await client.query('delete from incident_assets where incident_id=$1', [incidentId])
  if (uniqueIds.length > 0) {
    await client.query(
      `insert into incident_assets (incident_id, asset_id, linked_by)
       select $1, asset_id, $3 from unnest($2::uuid[]) as asset_id`,
      [incidentId, uniqueIds, actorId],
    )
  }
  return uniqueIds
}

async function hydrateIncidentRow(client: PoolClient, row: IncidentRow) {
  row.asset_ids = (await client.query<{ asset_id: string }>(
    `select asset_id::text from incident_assets where incident_id=$1 order by linked_at`, [row.id],
  )).rows.map((item) => item.asset_id)
  row.sla_minutes = (await client.query<{ resolution_minutes: number }>(
    'select resolution_minutes from incident_sla_policies where severity=$1', [row.severity],
  )).rows[0]?.resolution_minutes
  return rowToFeature(row)
}

export async function createIncident(input: CreateIncidentInput, actorId: string) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const result = await client.query<IncidentRow>(
      `insert into incidents
       (asset_id, name, incident_type, severity, description, address, details, geom, reported_at, due_at, created_by, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_MakePoint($8,$9),4326),coalesce($10,now()),
         coalesce($10,now()) + make_interval(mins => (select resolution_minutes from incident_sla_policies where severity=$4)),
         $11,$11)
       returning ${columns}`,
      [input.assetIds[0] ?? input.assetId ?? null, input.name, input.incidentType, input.severity, input.description,
        input.address, JSON.stringify(input.details), input.longitude, input.latitude,
        input.reportedAt ?? null, actorId],
    )
    const row = result.rows[0]!
    const assetIds = await replaceIncidentAssets(
      client, row.id, [...input.assetIds, ...(input.assetId ? [input.assetId] : [])], actorId,
    )
    row.asset_ids = assetIds
    await client.query(
      `insert into incident_status_history (incident_id, from_status, to_status, note, changed_by, event_type)
       values ($1,null,'new','Ghi nhận sự cố',$2,'created')`,
      [row.id, actorId],
    )
    const feature = await hydrateIncidentRow(client, row)
    await client.query('commit')
    return feature
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
    const current = await client.query<{ status: string; version: number; assigned_to: string | null; assigned_user_id: string | null }>(
      'select status, version, assigned_to, assigned_user_id from incidents where id=$1 and deleted_at is null for update', [id],
    )
    const row = current.rows[0]
    if (!row) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Không tìm thấy sự cố')
    if (row.version !== input.version) throw new AppError(409, 'INCIDENT_VERSION_CONFLICT', 'Sự cố đã được cập nhật ở nơi khác')
    if (!allowedTransitions[row.status]?.includes(input.status)) {
      throw new AppError(422, 'INVALID_STATUS_TRANSITION', 'Không thể chuyển sang trạng thái đã chọn')
    }
    if (row.status === 'new' && input.status === 'in_progress' && !row.assigned_user_id && !row.assigned_to?.trim()) {
      throw new AppError(422, 'INCIDENT_ASSIGNEE_REQUIRED', 'Cần phân công người phụ trách trước khi bắt đầu xử lý')
    }
    if (row.status === 'resolved' && !input.note.trim()) {
      throw new AppError(422, 'INCIDENT_REOPEN_REASON_REQUIRED', 'Cần ghi lý do mở lại sự cố')
    }
    const updated = await client.query<IncidentRow>(
      `update incidents set status=$2, version=version+1, updated_by=$3, updated_at=now(),
       resolved_at=case when $2='resolved' then now() else null end where id=$1 returning ${columns}`,
      [id, input.status, actorId],
    )
    await insertHistory(client, id, row.status, input.status, input.note, actorId, 'status_changed')
    const feature = await hydrateIncidentRow(client, updated.rows[0]!)
    await client.query('commit')
    return feature
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

async function insertHistory(
  client: PoolClient,
  id: string,
  from: string,
  to: string,
  note: string,
  actor: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  await client.query(
    `insert into incident_status_history
     (incident_id, from_status, to_status, note, changed_by, event_type, metadata)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, from, to, note, actor, eventType, JSON.stringify(metadata)],
  )
}

export async function assignIncident(id: string, input: AssignIncidentInput, actorId: string) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const assignee = (await client.query<{ auth_user_id: string; display_name: string }>(
      `select auth_user_id::text, display_name from app_users
       where auth_user_id=$1 and active=true and role in ('admin','manager','technician')`,
      [input.assigneeId],
    )).rows[0]
    if (!assignee) throw new AppError(422, 'ASSIGNEE_NOT_AVAILABLE', 'Người xử lý không còn hoạt động')
    const current = await client.query<{ status: string; version: number; assigned_to: string | null }>(
      'select status, version, assigned_to from incidents where id=$1 and deleted_at is null for update', [id],
    )
    const row = current.rows[0]
    if (!row) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Không tìm thấy sự cố')
    if (row.version !== input.version) throw new AppError(409, 'INCIDENT_VERSION_CONFLICT', 'Sự cố đã được cập nhật ở nơi khác')
    const updated = await client.query<IncidentRow>(
      `update incidents set assigned_user_id=$2, assigned_to=$3, assigned_at=now(), version=version+1,
       updated_by=$4, updated_at=now() where id=$1 returning ${columns}`,
      [id, input.assigneeId, assignee.display_name, actorId],
    )
    await insertHistory(
      client, id, row.status, row.status,
      input.note || `Phân công cho ${assignee.display_name}`, actorId, 'assignment_changed',
      { from: row.assigned_to, to: assignee.display_name, assigneeId: assignee.auth_user_id },
    )
    const feature = await hydrateIncidentRow(client, updated.rows[0]!)
    await client.query('commit')
    return feature
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function addIncidentComment(id: string, input: CommentIncidentInput, actorId: string) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const current = await client.query<{ status: string }>(
      'select status from incidents where id=$1 and deleted_at is null for update', [id],
    )
    const row = current.rows[0]
    if (!row) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Không tìm thấy sự cố')
    await insertHistory(client, id, row.status, row.status, input.content, actorId, 'comment')
    await client.query('update incidents set updated_at=now(), updated_by=$2 where id=$1', [id, actorId])
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function getIncidentAssets(id: string) {
  const exists = await getPool().query('select 1 from incidents where id=$1 and deleted_at is null', [id])
  if (!exists.rows[0]) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Không tìm thấy sự cố')
  const result = await getPool().query(
    `select asset.id::text, asset.asset_code as "assetCode", asset.name, asset.type, asset.status
     from incident_assets link join assets asset on asset.id=link.asset_id
     where link.incident_id=$1 and asset.deleted_at is null order by link.linked_at, asset.name`, [id],
  )
  return { items: result.rows }
}

export async function updateIncidentAssets(id: string, input: UpdateIncidentAssetsInput, actorId: string) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const current = (await client.query<{ status: string; version: number; asset_ids: string[] }>(
      `select incident.status, incident.version,
       coalesce(array(select asset_id::text from incident_assets where incident_id=incident.id), '{}') as asset_ids
       from incidents incident where incident.id=$1 and incident.deleted_at is null for update`, [id],
    )).rows[0]
    if (!current) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Không tìm thấy sự cố')
    if (current.version !== input.version) throw new AppError(409, 'INCIDENT_VERSION_CONFLICT', 'Sự cố đã được cập nhật ở nơi khác')
    const assetIds = await replaceIncidentAssets(client, id, input.assetIds, actorId)
    const updated = await client.query<IncidentRow>(
      `update incidents set asset_id=$2, version=version+1, updated_by=$3, updated_at=now()
       where id=$1 returning ${columns}`,
      [id, assetIds[0] ?? null, actorId],
    )
    const row = updated.rows[0]!
    row.asset_ids = assetIds
    await insertHistory(
      client, id, current.status, current.status,
      input.note || 'Cập nhật tài sản liên quan', actorId, 'assets_linked',
      { from: current.asset_ids, to: assetIds },
    )
    const feature = await hydrateIncidentRow(client, row)
    await client.query('commit')
    return feature
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function escalateIncident(id: string, input: EscalateIncidentInput, actorId: string) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const current = (await client.query<{ status: string; version: number; escalation_level: number }>(
      `select status, version, escalation_level from incidents
       where id=$1 and deleted_at is null for update`, [id],
    )).rows[0]
    if (!current) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Không tìm thấy sự cố')
    if (current.version !== input.version) throw new AppError(409, 'INCIDENT_VERSION_CONFLICT', 'Sự cố đã được cập nhật ở nơi khác')
    if (current.status === 'resolved') throw new AppError(422, 'INCIDENT_ALREADY_RESOLVED', 'Không thể escalation sự cố đã xử lý')
    if (current.escalation_level >= 3) throw new AppError(422, 'INCIDENT_MAX_ESCALATION', 'Sự cố đã ở mức cảnh báo cao nhất')
    const nextLevel = Math.min(current.escalation_level + 1, 3)
    const updated = await client.query<IncidentRow>(
      `update incidents set escalation_level=$2, escalated_at=now(), version=version+1,
       updated_by=$3, updated_at=now() where id=$1 returning ${columns}`,
      [id, nextLevel, actorId],
    )
    await insertHistory(
      client, id, current.status, current.status, input.note, actorId, 'escalated',
      { fromLevel: current.escalation_level, toLevel: nextLevel, manual: true },
    )
    const feature = await hydrateIncidentRow(client, updated.rows[0]!)
    await client.query('commit')
    return feature
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function getIncidentHistory(id: string) {
  const result = await getPool().query(
    `select id, from_status as "fromStatus", to_status as "toStatus", note,
     changed_by as "changedBy", changed_at as "changedAt", event_type as "eventType", metadata
     from incident_status_history where incident_id=$1 order by changed_at desc`, [id],
  )
  return { items: result.rows }
}

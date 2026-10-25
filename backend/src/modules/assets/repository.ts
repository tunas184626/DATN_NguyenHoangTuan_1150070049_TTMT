import type { QueryResultRow } from 'pg'
import { getPool } from '../../db/pool.js'
import { AppError } from '../../shared/errors.js'
import type { CreateAssetInput, ListAssetsQuery, UpdateAssetInput } from './schemas.js'
import { assetQualityConditions } from '../operations/asset-quality.js'

interface AssetRow extends QueryResultRow {
  id: string
  asset_code: string
  name: string
  type: string
  status: string
  description: string
  address: string
  attributes: Record<string, unknown>
  geometry: object
  version: number
  updated_at: Date
  total_count?: string
}

function rowToFeature(row: AssetRow) {
  return {
    type: 'Feature' as const,
    geometry: row.geometry,
    properties: {
      id: row.id,
      assetCode: row.asset_code,
      name: row.name,
      type: row.type,
      status: row.status,
      description: row.description,
      address: row.address,
      ...row.attributes,
      version: row.version,
      lastUpdated: row.updated_at.toISOString(),
      notes: Array.isArray(row.attributes.notes) ? row.attributes.notes : [],
      source: String(row.attributes.source ?? 'Cơ sở dữ liệu nghiệp vụ'),
    },
  }
}

function selectColumns(geometryExpression = 'geom') {
  return `
  id, asset_code, name, type, status, description, address, attributes,
  ST_AsGeoJSON(${geometryExpression}, 6)::json as geometry, version, updated_at`
}

function simplificationTolerance(zoom?: number): number {
  if (zoom === undefined || zoom >= 15) return 0
  if (zoom <= 8) return 0.002
  if (zoom <= 10) return 0.0008
  if (zoom <= 12) return 0.0002
  return 0.00005
}

export async function listAssets(query: ListAssetsQuery) {
  const values: unknown[] = []
  const conditions = ['deleted_at is null']
  const addValue = (value: unknown) => { values.push(value); return `$${values.length}` }

  if (query.type) conditions.push(`type = ${addValue(query.type)}`)
  if (query.status) conditions.push(`status = ${addValue(query.status)}`)
  if (query.quality) conditions.push(`(${assetQualityConditions[query.quality]})`)
  if (query.search) {
    const placeholder = addValue(`%${query.search.replace(/[\\%_]/g, '\\$&')}%`)
    conditions.push(`(name ilike ${placeholder} or asset_code ilike ${placeholder} or address ilike ${placeholder} or description ilike ${placeholder} or id::text ilike ${placeholder})`)
  }
  if (query.bbox) {
    const [minLng, minLat, maxLng, maxLat] = query.bbox
    conditions.push(`geom && ST_MakeEnvelope(${addValue(minLng)}, ${addValue(minLat)}, ${addValue(maxLng)}, ${addValue(maxLat)}, 4326)`)
  }

  const countValues = [...values]
  const orderBy = query.sort === 'name' ? 'name asc, id asc' : 'updated_at desc, id asc'
  const tolerance = simplificationTolerance(query.zoom)
  const geometryExpression = tolerance > 0
    ? `ST_SimplifyPreserveTopology(geom, ${addValue(tolerance)})`
    : 'geom'
  const limit = addValue(query.limit)
  const offset = addValue(query.offset)
  const result = await getPool().query<AssetRow>(
    `select ${selectColumns(geometryExpression)}, count(*) over()::text as total_count from assets where ${conditions.join(' and ')} order by ${orderBy} limit ${limit} offset ${offset}`,
    values,
  )
  const total = result.rows.length > 0 ? Number(result.rows[0]!.total_count) : Number((await getPool().query<{ total: string }>(
    `select count(*)::text as total from assets where ${conditions.join(' and ')}`, countValues,
  )).rows[0]?.total ?? 0)
  return {
    type: 'FeatureCollection' as const,
    features: result.rows.map(rowToFeature),
    meta: {
      total,
      limit: query.limit,
      offset: query.offset,
      srid: 4326,
      zoom: query.zoom ?? null,
      simplified: tolerance > 0,
      tolerance,
    },
  }
}

export async function getAsset(id: string) {
  const result = await getPool().query<AssetRow>(
    `select ${selectColumns()} from assets where id = $1 and deleted_at is null`, [id],
  )
  if (!result.rows[0]) throw new AppError(404, 'ASSET_NOT_FOUND', 'Không tìm thấy tài sản')
  return rowToFeature(result.rows[0])
}

export async function createAsset(input: CreateAssetInput, actorId: string) {
  const result = await getPool().query<AssetRow>(
    `insert into assets (asset_code, name, type, status, description, address, attributes, geom, created_by, updated_by)
     values (coalesce($1, 'TS-' || to_char(current_date, 'YYYYMM') || '-' || lpad(nextval('asset_code_sequence')::text, 6, '0')),$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_GeomFromGeoJSON($8::json),4326),$9,$9)
     returning ${selectColumns()}`,
    [input.assetCode, input.name, input.type, input.status, input.description, input.address,
      JSON.stringify(input.attributes), JSON.stringify(input.geometry), actorId],
  )
  return rowToFeature(result.rows[0]!)
}

export async function updateAsset(id: string, input: UpdateAssetInput, actorId: string) {
  const result = await getPool().query<AssetRow>(
    `update assets set
      name = coalesce($2, name), status = coalesce($3, status),
      description = coalesce($4, description), address = coalesce($5, address),
      attributes = case when $6::jsonb is null then attributes else attributes || $6::jsonb end,
      geom = case when $7::jsonb is null then geom else ST_SetSRID(ST_GeomFromGeoJSON($7::json),4326) end,
      version = version + 1, updated_by = $8, updated_at = now()
     where id = $1 and version = $9 and deleted_at is null returning ${selectColumns()}`,
    [id, input.name ?? null, input.status ?? null, input.description ?? null, input.address ?? null,
      input.attributes ? JSON.stringify(input.attributes) : null,
      input.geometry ? JSON.stringify(input.geometry) : null, actorId, input.version],
  )
  if (!result.rows[0]) throw new AppError(409, 'ASSET_VERSION_CONFLICT', 'Tài sản đã được cập nhật ở nơi khác')
  return rowToFeature(result.rows[0])
}

// These checks identify missing metadata, not engineering accuracy or scheduled maintenance.
export const ASSET_REQUIRED_FIELDS = {
  pipeline: ['diameter', 'material', 'length'],
  water_plant: ['capacity'],
  raw_water_lake: ['area', 'volume'],
  canal: ['length'],
  supply_zone: ['area'],
} as const

function missingValue(expression: string): string {
  return `coalesce(lower(regexp_replace(${expression}, '^[[:space:]]+|[[:space:]]+$', '', 'g')), '') in ('', '-', '—', 'n/a', 'na', 'null', 'unknown', 'chưa cập nhật', 'chưa có')`
}

export const missingTechnicalSql = `(${Object.entries(ASSET_REQUIRED_FIELDS).map(([type, fields]) =>
  `(type = '${type}' and (${fields.map((field) => missingValue(`attributes->>'${field}'`)).join(' or ')}))`,
).join(' or ')})`

export const assetQualityConditions = {
  technical: missingTechnicalSql,
  address: missingValue('address'),
  inspection: "status = 'need_inspection'",
  maintenance: "status = 'maintenance'",
} as const

import { z } from 'zod'

export const assetTypes = [
  'water_plant', 'raw_water_lake', 'pipeline', 'canal',
  'supply_zone', 'boundary', 'label', 'pending_data',
] as const

export const assetStatuses = ['active', 'maintenance', 'need_inspection', 'pending_data'] as const

const bboxSchema = z.string().transform((value, context) => {
  const numbers = value.split(',').map(Number)
  if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) {
    context.addIssue({ code: 'custom', message: 'bbox phải có dạng minLng,minLat,maxLng,maxLat' })
    return z.NEVER
  }
  const [minLng, minLat, maxLng, maxLat] = numbers as [number, number, number, number]
  if (minLng >= maxLng || minLat >= maxLat || minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
    context.addIssue({ code: 'custom', message: 'bbox nằm ngoài phạm vi hợp lệ' })
    return z.NEVER
  }
  return [minLng, minLat, maxLng, maxLat] as const
})

export const listAssetsQuerySchema = z.object({
  type: z.enum(assetTypes).optional(),
  status: z.enum(assetStatuses).optional(),
  quality: z.enum(['technical', 'address', 'inspection', 'maintenance']).optional(),
  bbox: bboxSchema.optional(),
  search: z.string().trim().max(100).optional(),
  zoom: z.coerce.number().int().min(0).max(22).optional(),
  sort: z.enum(['updated', 'name']).default('updated'),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  offset: z.coerce.number().int().min(0).default(0),
})

const geometrySchema = z.object({
  type: z.enum(['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon']),
  coordinates: z.unknown(),
})

export const createAssetSchema = z.object({
  assetCode: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(255),
  type: z.enum(assetTypes),
  status: z.enum(assetStatuses).default('pending_data'),
  description: z.string().max(5000).default(''),
  address: z.string().max(1000).default(''),
  attributes: z.record(z.string(), z.unknown()).default({}),
  geometry: geometrySchema,
})

export const updateAssetSchema = createAssetSchema.omit({ assetCode: true, type: true }).partial().extend({
  version: z.number().int().positive(),
})

export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>
export type CreateAssetInput = z.infer<typeof createAssetSchema>
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>

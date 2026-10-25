import { z } from 'zod'

export const incidentTypes = ['leak', 'pressure_loss', 'pipe_burst', 'turbid_water', 'need_inspection'] as const
export const incidentSeverities = ['low', 'medium', 'high'] as const
export const incidentStatuses = ['new', 'in_progress', 'resolved'] as const

export const listIncidentsQuerySchema = z.object({
  queue: z.enum(['unassigned', 'overdue', 'high_priority', 'in_progress']).optional(),
  status: z.enum(incidentStatuses).optional(),
  severity: z.enum(incidentSeverities).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['reported', 'priority']).default('reported'),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})

export const createIncidentSchema = z.object({
  assetId: z.uuid().nullable().optional(),
  assetIds: z.array(z.uuid()).max(50).default([]).transform((values) => [...new Set(values)]),
  name: z.string().trim().min(1).max(255).default('Sự cố mới'),
  incidentType: z.enum(incidentTypes),
  severity: z.enum(incidentSeverities),
  description: z.string().trim().min(1).max(5000),
  address: z.string().trim().max(1000).default(''),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  reportedAt: z.iso.datetime().refine((value) => Date.parse(value) <= Date.now() + 60_000, 'Thời điểm phát hiện không được nằm trong tương lai').optional(),
  details: z.record(z.string(), z.unknown()).default({}),
})

export const transitionIncidentSchema = z.object({
  status: z.enum(incidentStatuses),
  version: z.number().int().positive(),
  note: z.string().trim().max(2000).default(''),
}).refine((input) => input.status !== 'resolved' || input.note.length > 0, {
  path: ['note'], message: 'Cần ghi kết quả khắc phục trước khi hoàn tất sự cố',
})

export const assignIncidentSchema = z.object({
  assigneeId: z.uuid(),
  version: z.number().int().positive(),
  note: z.string().trim().max(2000).default(''),
})

export const updateIncidentAssetsSchema = z.object({
  assetIds: z.array(z.uuid()).max(50).transform((values) => [...new Set(values)]),
  version: z.number().int().positive(),
  note: z.string().trim().max(2000).default(''),
})

export const escalateIncidentSchema = z.object({
  version: z.number().int().positive(),
  note: z.string().trim().min(1).max(2000),
})

export const commentIncidentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
})

export type ListIncidentsQuery = z.infer<typeof listIncidentsQuerySchema>
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
export type TransitionIncidentInput = z.infer<typeof transitionIncidentSchema>
export type AssignIncidentInput = z.infer<typeof assignIncidentSchema>
export type UpdateIncidentAssetsInput = z.infer<typeof updateIncidentAssetsSchema>
export type EscalateIncidentInput = z.infer<typeof escalateIncidentSchema>
export type CommentIncidentInput = z.infer<typeof commentIncidentSchema>

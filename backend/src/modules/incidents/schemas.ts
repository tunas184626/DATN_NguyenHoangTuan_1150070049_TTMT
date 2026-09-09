import { z } from 'zod'

export const incidentTypes = ['leak', 'pressure_loss', 'pipe_burst', 'turbid_water', 'need_inspection'] as const
export const incidentSeverities = ['low', 'medium', 'high'] as const
export const incidentStatuses = ['new', 'in_progress', 'resolved'] as const

export const listIncidentsQuerySchema = z.object({
  status: z.enum(incidentStatuses).optional(),
  severity: z.enum(incidentSeverities).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})

export const createIncidentSchema = z.object({
  assetId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1).max(255).default('Sự cố mới'),
  incidentType: z.enum(incidentTypes),
  severity: z.enum(incidentSeverities),
  description: z.string().trim().min(1).max(5000),
  address: z.string().trim().max(1000).default(''),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  reportedAt: z.iso.datetime().optional(),
  details: z.record(z.string(), z.unknown()).default({}),
})

export const transitionIncidentSchema = z.object({
  status: z.enum(incidentStatuses),
  version: z.number().int().positive(),
  note: z.string().trim().max(2000).default(''),
})

export const assignIncidentSchema = z.object({
  assignee: z.string().trim().min(1).max(255),
  version: z.number().int().positive(),
  note: z.string().trim().max(2000).default(''),
})

export const commentIncidentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
})

export type ListIncidentsQuery = z.infer<typeof listIncidentsQuerySchema>
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
export type TransitionIncidentInput = z.infer<typeof transitionIncidentSchema>
export type AssignIncidentInput = z.infer<typeof assignIncidentSchema>
export type CommentIncidentInput = z.infer<typeof commentIncidentSchema>

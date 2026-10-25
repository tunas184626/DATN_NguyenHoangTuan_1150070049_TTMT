import { Router } from 'express'
import { authenticate } from '../../middleware/auth.js'
import { authorizeRoles } from '../../middleware/authorization.js'
import { asyncHandler } from '../../shared/async-handler.js'
import {
  addIncidentAttachment,
  deleteIncidentAttachment,
  listIncidentAttachments,
  receiveIncidentImage,
} from './attachments.js'
import {
  addIncidentComment,
  assignIncident,
  createIncident,
  escalateIncident,
  getIncident,
  getIncidentAssets,
  getIncidentHistory,
  listIncidents,
  refreshIncidentEscalations,
  transitionIncident,
  updateIncidentAssets,
} from './repository.js'
import {
  assignIncidentSchema,
  commentIncidentSchema,
  createIncidentSchema,
  escalateIncidentSchema,
  listIncidentsQuerySchema,
  transitionIncidentSchema,
  updateIncidentAssetsSchema,
} from './schemas.js'

export const incidentsRouter = Router()

incidentsRouter.use(authenticate, authorizeRoles('admin', 'manager', 'technician'))

incidentsRouter.get('/', asyncHandler(async (request, response) => {
  response.json(await listIncidents(listIncidentsQuerySchema.parse(request.query)))
}))

incidentsRouter.post('/', asyncHandler(async (request, response) => {
  response.status(201).json(await createIncident(createIncidentSchema.parse(request.body), String(response.locals.user.id)))
}))

incidentsRouter.post('/escalations/run', authorizeRoles('admin', 'manager'), asyncHandler(async (_request, response) => {
  response.json({ updated: await refreshIncidentEscalations() })
}))

incidentsRouter.get('/:id', asyncHandler(async (request, response) => {
  response.json(await getIncident(String(request.params.id)))
}))

incidentsRouter.get('/:id/history', asyncHandler(async (request, response) => {
  response.json(await getIncidentHistory(String(request.params.id)))
}))

incidentsRouter.get('/:id/assets', asyncHandler(async (request, response) => {
  response.json(await getIncidentAssets(String(request.params.id)))
}))

incidentsRouter.put('/:id/assets', asyncHandler(async (request, response) => {
  response.json(await updateIncidentAssets(
    String(request.params.id), updateIncidentAssetsSchema.parse(request.body), String(response.locals.user.id),
  ))
}))

incidentsRouter.get('/:id/attachments', asyncHandler(async (request, response) => {
  response.json(await listIncidentAttachments(String(request.params.id)))
}))

incidentsRouter.post('/:id/attachments', receiveIncidentImage, asyncHandler(async (request, response) => {
  response.status(201).json(await addIncidentAttachment(
    String(request.params.id), request.file, String(response.locals.user.id),
  ))
}))

incidentsRouter.delete('/:id/attachments/:attachmentId', authorizeRoles('admin', 'manager'), asyncHandler(async (request, response) => {
  await deleteIncidentAttachment(String(request.params.id), String(request.params.attachmentId))
  response.status(204).end()
}))

incidentsRouter.patch('/:id/status', asyncHandler(async (request, response) => {
  response.json(await transitionIncident(
    String(request.params.id), transitionIncidentSchema.parse(request.body), String(response.locals.user.id),
  ))
}))

incidentsRouter.patch('/:id/assignment', authorizeRoles('admin', 'manager'), asyncHandler(async (request, response) => {
  response.json(await assignIncident(
    String(request.params.id), assignIncidentSchema.parse(request.body), String(response.locals.user.id),
  ))
}))

incidentsRouter.post('/:id/escalate', authorizeRoles('admin', 'manager'), asyncHandler(async (request, response) => {
  response.json(await escalateIncident(
    String(request.params.id), escalateIncidentSchema.parse(request.body), String(response.locals.user.id),
  ))
}))

incidentsRouter.post('/:id/comments', asyncHandler(async (request, response) => {
  await addIncidentComment(
    String(request.params.id), commentIncidentSchema.parse(request.body), String(response.locals.user.id),
  )
  response.status(201).json({ ok: true })
}))

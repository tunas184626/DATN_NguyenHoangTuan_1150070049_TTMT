import { Router } from 'express'
import { authenticate } from '../../middleware/auth.js'
import { authorizeRoles } from '../../middleware/authorization.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { createIncident, getIncidentHistory, listIncidents, transitionIncident } from './repository.js'
import { createIncidentSchema, listIncidentsQuerySchema, transitionIncidentSchema } from './schemas.js'

export const incidentsRouter = Router()

incidentsRouter.get('/', asyncHandler(async (request, response) => {
  response.json(await listIncidents(listIncidentsQuerySchema.parse(request.query)))
}))

incidentsRouter.post('/', authenticate, authorizeRoles('admin', 'manager', 'technician'), asyncHandler(async (request, response) => {
  response.status(201).json(await createIncident(createIncidentSchema.parse(request.body), String(response.locals.user.id)))
}))

incidentsRouter.get('/:id/history', asyncHandler(async (request, response) => {
  response.json(await getIncidentHistory(String(request.params.id)))
}))

incidentsRouter.patch('/:id/status', authenticate, authorizeRoles('admin', 'manager', 'technician'), asyncHandler(async (request, response) => {
  response.json(await transitionIncident(
    String(request.params.id), transitionIncidentSchema.parse(request.body), String(response.locals.user.id),
  ))
}))

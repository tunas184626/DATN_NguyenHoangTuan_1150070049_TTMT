import { Router } from 'express'
import { authenticate } from '../../middleware/auth.js'
import { authorizeRoles } from '../../middleware/authorization.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { getReportIncidents, getReportSummary } from './repository.js'
import { reportIncidentsQuerySchema, reportSummaryQuerySchema } from './schemas.js'

export const reportsRouter = Router()

reportsRouter.use(authenticate, authorizeRoles('admin', 'manager', 'technician'))

reportsRouter.get('/summary', asyncHandler(async (request, response) => {
  response.json(await getReportSummary(reportSummaryQuerySchema.parse(request.query)))
}))

reportsRouter.get('/incidents', asyncHandler(async (request, response) => {
  response.json(await getReportIncidents(reportIncidentsQuerySchema.parse(request.query)))
}))

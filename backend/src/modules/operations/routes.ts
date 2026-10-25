import { Router } from 'express'
import { authenticate } from '../../middleware/auth.js'
import { authorizeRoles } from '../../middleware/authorization.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { getAssetQualitySummary, getOperationsSummary } from './repository.js'

export const operationsRouter = Router()
operationsRouter.use(authenticate, authorizeRoles('admin', 'manager', 'technician'))
operationsRouter.get('/summary', asyncHandler(async (_request, response) => {
  response.json(await getOperationsSummary())
}))
operationsRouter.get('/asset-quality', asyncHandler(async (_request, response) => {
  response.json(await getAssetQualitySummary())
}))

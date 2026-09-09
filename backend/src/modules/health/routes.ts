import { Router } from 'express'
import { checkDatabase } from '../../db/pool.js'
import { asyncHandler } from '../../shared/async-handler.js'

export const healthRouter = Router()

healthRouter.get('/live', (_request, response) => {
  response.json({ status: 'ok', service: 'webgis-api', timestamp: new Date().toISOString() })
})

healthRouter.get(
  '/ready',
  asyncHandler(async (_request, response) => {
    const database = await checkDatabase()
    response.json({ status: 'ready', database })
  }),
)

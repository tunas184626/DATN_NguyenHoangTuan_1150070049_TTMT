import compression from 'compression'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { requestContext } from './middleware/request-context.js'
import { authenticate } from './middleware/auth.js'
import { authorizeRoles } from './middleware/authorization.js'
import { assetsRouter } from './modules/assets/routes.js'
import { healthRouter } from './modules/health/routes.js'
import { incidentsRouter } from './modules/incidents/routes.js'
import { reportsRouter } from './modules/reports/routes.js'
import { usersRouter } from './modules/users/routes.js'
import { operationsRouter } from './modules/operations/routes.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(requestContext)
  app.use(helmet())
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || env.corsOrigins.includes(origin))
    },
    credentials: true,
  }))
  app.use(compression())
  app.use(express.json({ limit: '2mb' }))
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }))

  app.use('/api/health', healthRouter)
  app.get('/api/auth/me', authenticate, authorizeRoles('admin', 'manager', 'technician'), (_request, response) => {
    response.json({ user: response.locals.user, profile: response.locals.profile })
  })
  app.use('/api/assets', assetsRouter)
  app.use('/api/incidents', incidentsRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/operations', operationsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.js'
import { authorizeRoles } from '../../middleware/authorization.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { listAssignees } from './repository.js'

export const usersRouter = Router()

usersRouter.use(authenticate, authorizeRoles('admin', 'manager', 'technician'))
usersRouter.get('/assignees', asyncHandler(async (_request, response) => {
  response.json(await listAssignees())
}))

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { createAsset, getAsset, listAssets, updateAsset } from './repository.js'
import { createAssetSchema, listAssetsQuerySchema, updateAssetSchema } from './schemas.js'

export const assetsRouter = Router()

assetsRouter.get('/', asyncHandler(async (request, response) => {
  response.json(await listAssets(listAssetsQuerySchema.parse(request.query)))
}))

assetsRouter.get('/:id', asyncHandler(async (request, response) => {
  response.json(await getAsset(String(request.params.id)))
}))

assetsRouter.post('/', authenticate, asyncHandler(async (request, response) => {
  const actorId = String(response.locals.user.id)
  response.status(201).json(await createAsset(createAssetSchema.parse(request.body), actorId))
}))

assetsRouter.patch('/:id', authenticate, asyncHandler(async (request, response) => {
  const actorId = String(response.locals.user.id)
  response.json(await updateAsset(String(request.params.id), updateAssetSchema.parse(request.body), actorId))
}))

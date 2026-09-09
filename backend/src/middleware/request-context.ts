import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  const requestId = request.header('x-request-id')?.slice(0, 100) || randomUUID()
  response.setHeader('x-request-id', requestId)
  response.locals.requestId = requestId
  next()
}

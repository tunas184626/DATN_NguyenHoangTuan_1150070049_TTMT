import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../shared/errors.js'

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy API' } })
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next
  const requestId = String(response.locals.requestId ?? '')

  if (error instanceof ZodError) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: error.issues, requestId },
    })
    return
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details, requestId },
    })
    return
  }

  console.error(`[${requestId}] Unhandled error`, error)
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Hệ thống đang bận, vui lòng thử lại', requestId },
  })
}

import type { NextFunction, Request, Response } from 'express'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { env } from '../config/env.js'
import { AppError } from '../shared/errors.js'

const jwks = env.SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null

export async function authenticate(request: Request, response: Response, next: NextFunction): Promise<void> {
  if (env.AUTH_MODE === 'disabled') {
    response.locals.user = { id: 'development-user', role: 'admin' }
    next()
    return
  }

  const token = request.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token || !jwks || !env.SUPABASE_URL) {
    next(new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập'))
    return
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
      audience: env.SUPABASE_JWT_AUDIENCE,
    })
    response.locals.user = { id: payload.sub, role: payload.role ?? 'authenticated' }
    next()
  } catch {
    next(new AppError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'))
  }
}

import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { env } from '../config/env.js'
import { getPool } from '../db/pool.js'
import { AppError } from '../shared/errors.js'

export type AppRole = 'admin' | 'manager' | 'technician'

export function authorizeRoles(...allowedRoles: AppRole[]): RequestHandler {
  return async (_request: Request, response: Response, next: NextFunction) => {
    if (env.AUTH_MODE === 'disabled') {
      response.locals.profile = { displayName: 'Local Admin', role: 'admin' satisfies AppRole }
      next()
      return
    }

    try {
      const authUserId = String(response.locals.user?.id ?? '')
      const result = await getPool().query<{ display_name: string; role: AppRole }>(
        `select display_name, role from app_users where auth_user_id=$1 and active=true`,
        [authUserId],
      )
      const profile = result.rows[0]
      if (!profile) {
        next(new AppError(403, 'USER_NOT_PROVISIONED', 'Tài khoản chưa được cấp quyền sử dụng hệ thống'))
        return
      }
      if (!allowedRoles.includes(profile.role)) {
        next(new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này'))
        return
      }
      response.locals.profile = { displayName: profile.display_name, role: profile.role }
      next()
    } catch (error) {
      next(error)
    }
  }
}

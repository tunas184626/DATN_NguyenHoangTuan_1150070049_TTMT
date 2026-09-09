import 'dotenv/config'
import { z } from 'zod'

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    DATABASE_URL: z.string().trim().optional(),
    DATABASE_SSL: booleanString,
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    AUTH_MODE: z.enum(['disabled', 'supabase']).default('disabled'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_JWT_AUDIENCE: z.string().default('authenticated'),
  })
  .superRefine((value, context) => {
    if (value.AUTH_MODE === 'supabase' && !value.SUPABASE_URL) {
      context.addIssue({
        code: 'custom',
        path: ['SUPABASE_URL'],
        message: 'SUPABASE_URL bắt buộc khi AUTH_MODE=supabase',
      })
    }
  })

const result = schema.safeParse(process.env)

if (!result.success) {
  const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  throw new Error(`Cấu hình backend không hợp lệ: ${details}`)
}

export const env = {
  ...result.data,
  corsOrigins: result.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
}

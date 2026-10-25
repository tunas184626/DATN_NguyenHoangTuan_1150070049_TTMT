import pg from 'pg'
import { env } from '../config/env.js'
import { DatabaseNotConfiguredError } from '../shared/errors.js'

let pool: pg.Pool | undefined

export function getPool(): pg.Pool {
  if (!env.DATABASE_URL) throw new DatabaseNotConfiguredError()

  if (!pool) {
    pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    })

    pool.on('error', (error) => {
      console.error('PostgreSQL pool error', error)
    })
  }

  return pool
}

export async function closePool(): Promise<void> {
  if (!pool) return
  await pool.end()
  pool = undefined
}

export async function checkDatabase(): Promise<{ database: string; postgis: string }> {
  const result = await getPool().query<{ database: string; postgis: string }>(
    `select current_database() as database, postgis_lib_version() as postgis`,
  )
  return result.rows[0]!
}

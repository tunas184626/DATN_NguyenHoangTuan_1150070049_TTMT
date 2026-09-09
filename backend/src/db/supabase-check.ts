import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'
import { closePool, getPool } from './pool.js'

function getSupabaseConfiguration() {
  const missing = [
    !env.DATABASE_URL && 'DATABASE_URL',
    env.AUTH_MODE !== 'supabase' && 'AUTH_MODE=supabase',
    !env.SUPABASE_URL && 'SUPABASE_URL',
    !env.SUPABASE_SECRET_KEY && 'SUPABASE_SECRET_KEY',
  ].filter(Boolean)
  if (missing.length) throw new Error(`Thiếu cấu hình: ${missing.join(', ')}`)
  return {
    url: env.SUPABASE_URL!,
    secretKey: env.SUPABASE_SECRET_KEY!,
  }
}

async function main(): Promise<void> {
  const config = getSupabaseConfiguration()
  const database = await getPool().query<{
    postgis: string
    assets: string
    pipelines: string
  }>(`select postgis_version() as postgis,
      (select count(*)::text from assets where deleted_at is null) as assets,
      (select count(*)::text from assets where type='pipeline' and deleted_at is null) as pipelines`)

  const jwks = await fetch(`${config.url}/auth/v1/.well-known/jwks.json`)
  if (!jwks.ok) throw new Error(`Không đọc được Auth JWKS (${jwks.status})`)

  const client = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const bucket = await client.storage.getBucket(env.SUPABASE_STORAGE_BUCKET)
  if (bucket.error && Number((bucket.error as { statusCode?: string | number }).statusCode) !== 404) {
    throw new Error('Secret key không truy cập được Supabase Storage')
  }

  const row = database.rows[0]!
  console.log(`Supabase check PASS: PostGIS ${row.postgis}; assets=${row.assets}; pipelines=${row.pipelines}; Auth JWKS=OK; Storage=${bucket.data ? 'ready' : 'bucket will be created on first upload'}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}).finally(closePool)

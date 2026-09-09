import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closePool, getPool } from './pool.js'

const migrationDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations')

async function migrate(): Promise<void> {
  const database = getPool()
  await database.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`)
  const applied = new Set((await database.query<{ name: string }>('select name from schema_migrations')).rows.map((row) => row.name))
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith('.sql')).sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(path.join(migrationDirectory, file), 'utf8')
    const client = await database.connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into schema_migrations(name) values ($1)', [file])
      await client.query('commit')
      console.log(`Applied ${file}`)
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }
}

migrate().then(closePool).catch(async (error) => {
  console.error(error)
  await closePool()
  process.exitCode = 1
})

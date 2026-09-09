import { z } from 'zod'
import { closePool, getPool } from './pool.js'

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const input = z.object({
  user: z.uuid(),
  name: z.string().trim().min(1).max(255),
  role: z.enum(['admin', 'manager', 'technician']),
}).parse({ user: argument('user'), name: argument('name'), role: argument('role') })

async function bootstrap(): Promise<void> {
  await getPool().query(
    `insert into app_users (auth_user_id, display_name, role)
     values ($1,$2,$3)
     on conflict (auth_user_id) do update set display_name=excluded.display_name, role=excluded.role, active=true, updated_at=now()`,
    [input.user, input.name, input.role],
  )
  console.log(`Provisioned ${input.user} as ${input.role}`)
}

bootstrap().then(closePool).catch(async (error) => {
  console.error(error)
  await closePool()
  process.exitCode = 1
})

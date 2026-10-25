import { getPool } from '../../db/pool.js'

export async function listAssignees() {
  const result = await getPool().query(
    `select auth_user_id::text as id, display_name as "displayName", role
     from app_users where active=true and role in ('admin','manager','technician')
     order by case role when 'technician' then 0 when 'manager' then 1 else 2 end, display_name`,
  )
  return { items: result.rows }
}

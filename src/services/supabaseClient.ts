import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()

export const isAuthConfigured = Boolean(supabaseUrl && publishableKey)

let clientPromise: Promise<SupabaseClient | null> | undefined

export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!isAuthConfigured) return Promise.resolve(null)
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  )
  return clientPromise
}

export async function getAccessToken(): Promise<string | null> {
  const client = await getSupabaseClient()
  if (!client) return null
  const { data } = await client.auth.getSession()
  return data.session?.access_token ?? null
}

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { AuthContext } from './AuthContext'
import { getSupabaseClient, isAuthConfigured } from '../services/supabaseClient'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isAuthConfigured)

  useEffect(() => {
    if (!isAuthConfigured) return
    let active = true
    let unsubscribe: (() => void) | undefined

    void getSupabaseClient()
      .then(async (client) => {
        if (!client || !active) return
        const { data } = await client.auth.getSession()
        if (!active) return
        setUser(data.session?.user ?? null)
        setLoading(false)
        const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
          if (!active) return
          setUser(session?.user ?? null)
          setLoading(false)
        })
        unsubscribe = () => listener.subscription.unsubscribe()
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setLoading(false)
      })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const value = useMemo(() => ({
    configured: isAuthConfigured,
    loading,
    user,
    async signIn(email: string, password: string) {
      const client = await getSupabaseClient()
      if (!client) throw new Error('Đăng nhập chưa được cấu hình')
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    },
    async signOut() {
      const client = await getSupabaseClient()
      if (!client) return
      const { error } = await client.auth.signOut()
      if (error) throw new Error(error.message)
    },
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

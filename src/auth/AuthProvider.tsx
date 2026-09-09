import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { AuthContext } from './AuthContext'
import { getSupabaseClient, isAuthConfigured } from '../services/supabaseClient'
import { apiRequest } from '../services/apiClient'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isAuthConfigured)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profile, setProfile] = useState<{ displayName: string; role: 'admin' | 'manager' | 'technician' } | null>(
    isAuthConfigured ? null : { displayName: 'Local Admin', role: 'admin' },
  )
  const [profileError, setProfileError] = useState<string | null>(null)

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
        setProfileLoading(Boolean(data.session?.user))
        setLoading(false)
        const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
          if (!active) return
          setUser(session?.user ?? null)
          setProfileLoading(Boolean(session?.user))
          if (!session?.user) {
            setProfile(null)
            setProfileError(null)
          }
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

  useEffect(() => {
    if (!isAuthConfigured || !user) return
    let active = true
    void apiRequest<{ profile: { displayName: string; role: 'admin' | 'manager' | 'technician' } }>(
      '/auth/me', { method: 'GET' },
    )
      .then((response) => {
        if (!active) return
        setProfile(response.profile)
        setProfileError(null)
      })
      .catch((reason) => {
        if (!active) return
        setProfile(null)
        setProfileError(reason instanceof Error ? reason.message : 'Tài khoản chưa được cấp quyền')
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })
    return () => { active = false }
  }, [user])

  const value = useMemo(() => ({
    configured: isAuthConfigured,
    loading: loading || profileLoading,
    user,
    profile,
    profileError,
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
  }), [loading, profile, profileError, profileLoading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

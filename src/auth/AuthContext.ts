import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export interface AuthContextValue {
  configured: boolean
  loading: boolean
  user: User | null
  profile: { displayName: string; role: 'admin' | 'manager' | 'technician' } | null
  profileError: string | null
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider')
  return value
}

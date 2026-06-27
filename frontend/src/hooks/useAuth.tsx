import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './useSupabase'
import type { Profile } from '../types/database'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<unknown>
  signIn: (email: string, password: string) => Promise<unknown>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoadingUser(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      setLoadingUser(false)
      if (!session?.user) {
        queryClient.removeQueries({ queryKey: ['profile'] })
      }
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  const { data: profile = null, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async (): Promise<Profile | null> => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        // PGRST116 = "no rows found" — auto-create a profile row
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: insertErr } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
              skills: [],
              preferred_roles: [],
              preferred_locations: [],
            })
            .select('*')
            .single()

          if (insertErr) {
            console.warn('Failed to auto-create profile:', insertErr)
            return null // Don't block the app
          }
          return newProfile
        }
        console.warn('Profile fetch error:', error)
        return null // Don't throw — just return null so app doesn't hang
      }
      return data
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    retry: 1, // Don't retry infinitely on errors
  })

  const loading = loadingUser || (!!user && loadingProfile)

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })
    if (error) throw error
    return data
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    queryClient.removeQueries({ queryKey: ['profile'] })
  }, [queryClient])

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

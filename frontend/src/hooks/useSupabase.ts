import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Whether the Supabase client is pointed at a real project. When env vars
 * are missing at BUILD time (Vite inlines VITE_* at build, not runtime),
 * the client below falls back to a placeholder host and every request
 * fails in a way browsers report as an opaque CORS/network error. Callers
 * (e.g. useAuth) check this to surface a clear message instead.
 */
export const isSupabaseConfigured = (() => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false
  try {
    const u = new URL(SUPABASE_URL)
    // Reject the placeholder and obviously wrong values (must be an https host).
    return u.protocol === 'https:' && u.hostname !== 'placeholder.supabase.co'
  } catch {
    return false // not a valid URL at all
  }
})()

if (!isSupabaseConfigured) {
  console.error(
    '❌ Supabase is not configured.\n' +
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing or invalid at build time.\n' +
      'Set them in your host (e.g. Vercel → Project → Settings → Environment Variables) ' +
      'and REDEPLOY — Vite inlines these at build time, so a redeploy is required after ' +
      'changing them. VITE_SUPABASE_URL must be the API URL, e.g. https://<ref>.supabase.co ' +
      '(no trailing slash, not the dashboard URL).',
  )
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_KEY || 'placeholder',
)

export function useSupabase() {
  return supabase
}

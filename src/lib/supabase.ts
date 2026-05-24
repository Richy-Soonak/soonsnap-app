import { createClient } from '@supabase/supabase-js'

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Use the local API proxy to avoid mixed-content (HTTP from HTTPS) issues.
// The proxy at /api/supabase/* forwards to the actual Supabase instance server-side.
const supabaseUrl = typeof window !== 'undefined'
  ? `${window.location.origin}/api/supabase`
  : (process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://173.249.36.76:8000')

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem(key)
        }
        return null
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value)
          // Also set a simple cookie so middleware can detect auth
          // Use the actual Supabase key name (e.g., sb-173-auth-token)
          document.cookie = `${key}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
        }
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key)
          document.cookie = `${key}=; path=/; max-age=0`
        }
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

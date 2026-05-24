import { createClient } from '@supabase/supabase-js'

// The Supabase anon key is a PUBLIC key (like a Firebase API key) — safe to hardcode.
// It only works with Row Level Security policies; it cannot bypass them.
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5MTA5NDE2LCJleHAiOjE5MzY3ODk0MTZ9.2Frb9ew253y2YAkcc12lVhtFWrDud2qh2celpYPy8NY'

// Browser: use same-origin API proxy (/api/supabase/*) to avoid mixed-content issues.
// Server: use direct HTTP connection to Supabase via SUPABASE_URL_INTERNAL.
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
          // Set a cookie so middleware can detect auth state
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
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://173.249.36.76:8000'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

/**
 * Supabase admin client using the service role key.
 * Used server-side for operations that bypass RLS.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * Extract the user from a Supabase auth header (Bearer token) or cookie.
 * Returns null if the token is missing or invalid.
 */
export async function getAuthUser(request: Request): Promise<{ id: string; email?: string } | null> {
  let token: string | null = null

  // Try Authorization header first
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    token = authHeader.replace('Bearer ', '')
  }

  // Fallback: extract from cookie (sb-auth-token or sb-*-auth-token)
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || ''
    const match = cookieHeader.match(/sb-[-a-z0-9]*auth-token=([^;]+)/)
    if (match) {
      // The cookie value might be URL-encoded JSON with the access_token
      try {
        const decoded = decodeURIComponent(match[1])
        const parsed = JSON.parse(decoded)
        token = parsed?.access_token || parsed || null
      } catch {
        // Cookie might be the raw token
        token = match[1]
      }
    }
  }

  if (!token) return null

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) return null
  return { id: user.id, email: user.email }
}

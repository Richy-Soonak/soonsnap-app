/**
 * Get authorization headers for API calls from the Supabase session.
 * Reads the access_token from localStorage and returns headers with Bearer token.
 */

// Supabase stores the session under a key like "sb-{host-ref}-auth-token"
// For http://173.249.36.76:8000, the key is "sb-173-auth-token"
function getSessionKey(): string {
  if (typeof window === 'undefined') return ''
  // Try known patterns
  const keys = Object.keys(localStorage)
  const match = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  return match || ''
}

function getAccessToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    const key = getSessionKey()
    if (!key) return ''
    const sessionStr = localStorage.getItem(key)
    if (!sessionStr) return ''
    try {
      const session = JSON.parse(sessionStr)
      return session?.access_token || ''
    } catch {
      return sessionStr.length > 20 ? sessionStr : ''
    }
  } catch {
    return ''
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export function getJsonAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  }
}

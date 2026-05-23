'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="w-full max-w-md">
      <div className="lg:hidden flex items-center gap-2 mb-8">
        <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
          <rect x="0" y="12" width="24" height="24" rx="4" fill="#2A2B2D" />
          <rect x="3" y="6" width="24" height="24" rx="4" fill="#43C4CC" />
          <rect x="6" y="0" width="24" height="24" rx="4" fill="#FDCA57" />
          <text x="18" y="17" textAnchor="middle" fill="#0F0F1A" fontSize="14" fontWeight="700" fontFamily="sans-serif">S</text>
        </svg>
        <span className="text-xl font-bold">SoonSnap</span>
      </div>

      <h2 className="text-2xl font-bold">Create your account</h2>
      <p className="text-[#999] mt-2 mb-8">One account for all SOONAK apps</p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#999] mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[#F8F9FC] placeholder-[#555] transition-colors focus:border-teal"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#999] mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[#F8F9FC] placeholder-[#555] transition-colors focus:border-teal"
            placeholder="Min 6 characters"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#999] mb-1.5">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[#F8F9FC] placeholder-[#555] transition-colors focus:border-teal"
            placeholder="Repeat your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-void transition-colors hover:bg-gold/90 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#666]">
        Already have an account?{' '}
        <Link href="/login" className="text-teal hover:text-gold transition-colors">Sign in</Link>
      </p>
    </div>
  )
}

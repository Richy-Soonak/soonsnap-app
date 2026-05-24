'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Coins, CreditCard, Star, Check, Zap, Crown } from 'lucide-react'
import type { Tier } from '@/types'
import { getAuthHeaders, getJsonAuthHeaders } from '@/lib/auth-helpers'

interface CreditsState {
  balance: number
  totalPurchased: number
  totalUsed: number
  todayRenders: number
  dailyLimit: number
  tier: Tier
}

const PRICE_10 = process.env.NEXT_PUBLIC_STRIPE_CREDITS_10_PRICE_ID
const PRICE_50 = process.env.NEXT_PUBLIC_STRIPE_CREDITS_50_PRICE_ID
const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID

export default function CreditsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-card rounded-lg mb-2" />
            <div className="h-4 w-64 bg-card rounded-lg mb-10" />
            <div className="h-48 bg-card rounded-2xl mb-6" />
            <div className="h-64 bg-card rounded-2xl" />
          </div>
        </div>
      }
    >
      <CreditsContent />
    </Suspense>
  )
}

function CreditsContent() {
  const searchParams = useSearchParams()
  const [credits, setCredits] = useState<CreditsState>({
    balance: 0,
    totalPurchased: 0,
    totalUsed: 0,
    todayRenders: 0,
    dailyLimit: 2,
    tier: 'free',
  })
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/credits', { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setCredits({
          balance: data.balance ?? 0,
          totalPurchased: data.totalPurchased ?? 0,
          totalUsed: data.totalUsed ?? 0,
          todayRenders: data.todayRenders ?? 0,
          dailyLimit: data.dailyLimit ?? 2,
          tier: data.tier ?? 'free',
        })
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Check URL params for success/cancel messages
    if (searchParams.get('success') === '1') {
      setMessage('Payment successful! Your credits have been updated.')
    } else if (searchParams.get('canceled') === '1') {
      setMessage('Payment was canceled. No charges were made.')
    }

    fetchCredits()
  }, [searchParams, fetchCredits])

  async function handleBuy(priceId: string | undefined, label: string) {
    if (!priceId) {
      setError('Payment configuration missing. Please try again later.')
      return
    }
    setError(null)
    setPurchasing(label)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ priceId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to start checkout')
        setPurchasing(null)
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Failed to connect to payment provider')
    } finally {
      setPurchasing(null)
    }
  }

  async function handlePortal() {
    setError(null)
    setPurchasing('portal')
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
      })
      if (!res.ok) {
        setError('Failed to open subscription management')
        setPurchasing(null)
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Failed to connect to payment provider')
    } finally {
      setPurchasing(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-card rounded-lg mb-2" />
          <div className="h-4 w-64 bg-card rounded-lg mb-10" />
          <div className="h-48 bg-card rounded-2xl mb-6" />
          <div className="h-64 bg-card rounded-2xl" />
        </div>
      </div>
    )
  }

  const isPro = credits.tier === 'pro'

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins size={24} className="text-gold" />
            Credits
          </h1>
          <p className="text-[#999] text-sm mt-1">
            Purchase and manage your render credits
          </p>
        </div>
        {isPro && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold border border-gold/30">
            <Crown size={12} />
            Pro
          </span>
        )}
      </div>

      {/* Success/Cancel Message */}
      {message && (
        <div className="rounded-xl bg-teal/10 border border-teal/20 text-teal px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-sm">{message}</span>
          <button onClick={() => setMessage(null)} className="text-teal/60 hover:text-teal text-lg">
            ×
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 text-lg">
            ×
          </button>
        </div>
      )}

      {/* Balance Card */}
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[#999] mb-1">Credit Balance</p>
            <p className="text-4xl font-bold">{credits.balance}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-void/50 px-4 py-3">
              <p className="text-xs text-[#666]">Renders Today</p>
              <p className="text-sm font-semibold">
                {credits.todayRenders}/{credits.dailyLimit}
              </p>
            </div>
            <div className="rounded-xl bg-void/50 px-4 py-3">
              <p className="text-xs text-[#666]">Total Used</p>
              <p className="text-sm font-semibold">{credits.totalUsed}</p>
            </div>
            <div className="rounded-xl bg-void/50 px-4 py-3">
              <p className="text-xs text-[#666]">Total Purchased</p>
              <p className="text-sm font-semibold">{credits.totalPurchased}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Packs */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <CreditCard size={18} className="text-teal" />
        Credit Packs
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* 10 Credits */}
        <div className="rounded-2xl border border-border bg-card p-6 relative">
          <div className="mb-4">
            <p className="text-xl font-bold">10 Credits</p>
            <p className="text-sm text-[#999] mt-1">Perfect for trying out SoonSnap</p>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-bold text-gold">$4.99</p>
            <button
              onClick={() => handleBuy(PRICE_10, 'pack10')}
              disabled={purchasing !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {purchasing === 'pack10' ? (
                <>
                  <Zap size={14} className="animate-pulse" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard size={14} />
                  Buy Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* 50 Credits */}
        <div className="rounded-2xl border border-gold/30 bg-card p-6 relative">
          {/* Best Value Badge */}
          <div className="absolute -top-2.5 right-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-0.5 text-xs font-bold text-void">
              <Star size={10} />
              Best Value
            </span>
          </div>
          <div className="mb-4">
            <p className="text-xl font-bold">50 Credits</p>
            <p className="text-sm text-[#999] mt-1">Great for regular content creators</p>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-gold">$19.99</p>
              <p className="text-xs text-[#666]">Just $0.40 per credit</p>
            </div>
            <button
              onClick={() => handleBuy(PRICE_50, 'pack50')}
              disabled={purchasing !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {purchasing === 'pack50' ? (
                <>
                  <Zap size={14} className="animate-pulse" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard size={14} />
                  Buy Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pro Subscription */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Crown size={18} className="text-gold" />
        Pro Subscription
      </h2>
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-card to-gold/5 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              SoonSnap Pro
              <span className="text-gold">⚡</span>
            </h3>
            <p className="text-sm text-[#999] mt-1">Unlimited rendering power for professionals</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gold">$9.99<span className="text-sm font-normal text-[#999]">/mo</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {[
            'Unlimited renders',
            'All video styles',
            '60 second duration',
            'Priority processing',
            'No watermark',
            'API access',
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-2 text-sm">
              <Check size={14} className="text-gold flex-shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        {isPro ? (
          <button
            onClick={handlePortal}
            disabled={purchasing === 'portal'}
            className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
          >
            {purchasing === 'portal' ? (
              <>
                <Zap size={14} className="animate-pulse" />
                Opening...
              </>
            ) : (
              <>
                <CreditCard size={14} />
                Manage Subscription
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => handleBuy(PRICE_PRO, 'pro')}
            disabled={purchasing !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {purchasing === 'pro' ? (
              <>
                <Zap size={14} className="animate-pulse" />
                Processing...
              </>
            ) : (
              <>
                <Crown size={14} />
                Subscribe
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

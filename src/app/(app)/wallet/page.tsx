'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAuthHeaders, getJsonAuthHeaders } from '@/lib/auth-helpers'
import { Wallet, RefreshCw, Shield, Crown, Link, Unlink } from 'lucide-react'
import type { Tier } from '@/types'

interface WalletState {
  connected: boolean
  walletAddress: string | null
  tier: Tier
  soonakBalance: number
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    walletAddress: null,
    tier: 'free',
    soonakBalance: 0,
  })
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet/status', { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setWallet({
          connected: data.connected ?? false,
          walletAddress: data.walletAddress ?? null,
          tier: data.tier ?? 'free',
          soonakBalance: data.soonakBalance ?? 0,
        })
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function connectPhantom() {
    setError(null)
    setConnecting(true)

    try {
      const provider = (window as unknown as { solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }> } }).solana

      if (!provider?.isPhantom) {
        setError('Phantom wallet not detected. Please install the Phantom browser extension.')
        setConnecting(false)
        return
      }

      const response = await provider.connect()
      const publicKey = response.publicKey.toString()

      const res = await fetch('/api/wallet/connect', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ walletAddress: publicKey }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to connect wallet')
        setConnecting(false)
        return
      }

      const data = await res.json()
      setWallet({
        connected: true,
        walletAddress: publicKey,
        tier: data.tier ?? 'free',
        soonakBalance: data.balance ?? 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect() {
    try {
      const provider = (window as unknown as { solana?: { disconnect: () => Promise<void> } }).solana
      if (provider?.disconnect) {
        await provider.disconnect()
      }
    } catch {
      // ignore
    }
    setWallet({
      connected: false,
      walletAddress: null,
      tier: 'free',
      soonakBalance: 0,
    })
  }

  function refreshBalance() {
    setRefreshing(true)
    fetchStatus()
  }

  function truncateAddress(addr: string) {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`
  }

  function getTierBadge() {
    if (wallet.tier === 'pro') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold border border-gold/30">
          <Crown size={12} />
          Pro — Unlimited
        </span>
      )
    }
    if (wallet.tier === 'holder') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold border border-gold/30">
          <Shield size={12} />
          Holder — 200+ $SOONAK
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2a2a3e] px-3 py-1 text-xs font-medium text-[#999]">
        Free tier
      </span>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-card rounded-lg mb-2" />
          <div className="h-4 w-64 bg-card rounded-lg mb-10" />
          <div className="h-64 bg-card rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet size={24} className="text-gold" />
            Wallet
          </h1>
          <p className="text-[#999] text-sm mt-1">
            Connect your Solana wallet to unlock the Holder tier
          </p>
        </div>
        <div>{getTierBadge()}</div>
      </div>

      {/* Connection Card */}
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        {!wallet.connected ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
              <Link size={28} className="text-gold" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Connect Phantom Wallet</h3>
            <p className="text-[#999] text-sm mb-6 max-w-md mx-auto">
              Link your Solana wallet to verify your $SOONAK holdings and unlock
              the Holder tier with increased limits.
            </p>
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 mb-4 max-w-md mx-auto">
                {error}
              </div>
            )}
            <button
              onClick={connectPhantom}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-void transition-colors hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet size={16} />
                  Connect Phantom Wallet
                </>
              )}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Link size={18} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-[#999]">Connected Wallet</p>
                  <p className="font-mono text-sm font-medium">
                    {truncateAddress(wallet.walletAddress!)}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Connected
              </span>
            </div>

            {/* Wallet Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-void/50 p-4">
                <p className="text-xs text-[#666] mb-1">Tier</p>
                <p className="font-semibold capitalize flex items-center gap-2">
                  {wallet.tier === 'pro' && <Crown size={14} className="text-gold" />}
                  {wallet.tier === 'holder' && <Shield size={14} className="text-gold" />}
                  {wallet.tier === 'holder' ? 'Holder' : wallet.tier === 'pro' ? 'Pro' : 'Free'}
                </p>
              </div>
              <div className="rounded-xl bg-void/50 p-4">
                <p className="text-xs text-[#666] mb-1">$SOONAK Balance</p>
                <p className="font-semibold">{wallet.soonakBalance.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-void/50 p-4">
                <p className="text-xs text-[#666] mb-1">Full Address</p>
                <p className="font-mono text-xs text-[#999] break-all">
                  {wallet.walletAddress}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={refreshBalance}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-teal/50 disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                Refresh Balance
              </button>
              <button
                onClick={disconnect}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
              >
                <Unlink size={14} />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tier Badge Section */}
      {wallet.connected && (wallet.tier === 'holder' || wallet.tier === 'pro') && (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5 mb-6">
          <div className="flex items-center gap-3">
            {wallet.tier === 'pro' ? (
              <Crown size={20} className="text-gold" />
            ) : (
              <Shield size={20} className="text-gold" />
            )}
            <div>
              <p className="font-semibold text-gold">
                {wallet.tier === 'pro' ? 'Pro — Unlimited' : 'Holder — 200+ $SOONAK'}
              </p>
              <p className="text-xs text-[#999]">
                {wallet.tier === 'pro'
                  ? 'You have unlimited renders, all styles, and priority processing.'
                  : 'You have increased daily limits and access to premium styles.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tier Comparison */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield size={18} className="text-teal" />
          Tier Comparison
        </h2>
        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            {/* Header */}
            <div className="grid grid-cols-4 gap-3 mb-3 pb-3 border-b border-border">
              <div className="text-sm text-[#666] font-medium">Feature</div>
              <div className="text-sm text-center font-medium">Free</div>
              <div className="text-sm text-center font-medium text-gold">Holder</div>
              <div className="text-sm text-center font-medium text-gold">Pro</div>
            </div>
            {/* Rows */}
            {[
              { feature: 'Daily Renders', free: '2', holder: '10', pro: '∞' },
              { feature: 'Max Duration', free: '15s', holder: '30s', pro: '60s' },
              { feature: 'Video Styles', free: '3 basic', holder: '8 styles', pro: 'All styles' },
              { feature: 'Priority Queue', free: '—', holder: '—', pro: '✓' },
              { feature: 'Watermark', free: 'Yes', holder: 'No', pro: 'No' },
              { feature: 'API Access', free: '—', holder: '—', pro: '✓' },
              { feature: 'Cost', free: '$0', holder: '200+ $SOONAK', pro: '$9.99/mo' },
            ].map((row) => (
              <div
                key={row.feature}
                className="grid grid-cols-4 gap-3 py-2.5 border-b border-border/50 last:border-0"
              >
                <div className="text-sm text-[#ccc]">{row.feature}</div>
                <div className="text-sm text-center text-[#999]">{row.free}</div>
                <div className="text-sm text-center text-gold/80">{row.holder}</div>
                <div className="text-sm text-center text-gold font-medium">{row.pro}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

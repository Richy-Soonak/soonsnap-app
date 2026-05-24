'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getAuthHeaders, getJsonAuthHeaders } from '@/lib/auth-helpers'
import { User, Lock, CreditCard, Trash2, Shield, Loader2, Check, Crown, Zap } from 'lucide-react'
import type { Tier } from '@/types'

interface ProfileData {
  email: string
  displayName: string
  tier: Tier
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData>({
    email: '',
    displayName: '',
    tier: 'free',
  })
  const [loading, setLoading] = useState(true)

  // Profile state
  const [editName, setEditName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Portal state
  const [openingPortal, setOpeningPortal] = useState(false)

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // General messages
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    try {
      // Get user from supabase auth
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const displayName =
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          ''

        setProfile({
          email: user.email ?? '',
          displayName,
          tier: 'free',
        })
        setEditName(displayName)
      }

      // Fetch tier from API
      try {
        const res = await fetch('/api/credits', { headers: getAuthHeaders() })
        if (res.ok) {
          const data = await res.json()
          setProfile(prev => ({
            ...prev,
            tier: data.tier ?? 'free',
          }))
        }
      } catch {
        // tier fetch is non-critical
      }
    } catch {
      setError('Failed to load profile data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // ─── Save display name ──────────────────────────────────────────
  async function handleSaveName() {
    setSavingName(true)
    setNameSaved(false)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { display_name: editName },
      })
      if (updateError) throw updateError

      setProfile(prev => ({ ...prev, displayName: editName }))
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2500)
    } catch {
      setError('Failed to update display name.')
    } finally {
      setSavingName(false)
    }
  }

  // ─── Change password ────────────────────────────────────────────
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)
    setError(null)

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }

    setChangingPassword(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) throw updateError

      setPasswordMsg({ type: 'success', text: 'Password updated successfully.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update password.',
      })
    } finally {
      setChangingPassword(false)
    }
  }

  // ─── Stripe portal ──────────────────────────────────────────────
  async function handleOpenPortal() {
    setOpeningPortal(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
      })
      if (!res.ok) {
        setError('Failed to open billing portal.')
        setOpeningPortal(false)
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Failed to connect to payment provider.')
    } finally {
      setOpeningPortal(false)
    }
  }

  // ─── Delete account ─────────────────────────────────────────────
  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: getJsonAuthHeaders(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete account.')
      }
      // Sign out locally and redirect
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account.')
      setDeleting(false)
      setShowDeleteModal(false)
      setDeleteConfirm('')
    }
  }

  // ─── Loading skeleton ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-36 bg-card rounded-lg" />
          <div className="h-4 w-56 bg-card rounded-lg" />
          <div className="h-48 bg-card rounded-2xl" />
          <div className="h-48 bg-card rounded-2xl" />
          <div className="h-36 bg-card rounded-2xl" />
        </div>
      </div>
    )
  }

  // ─── Tier badge helper ──────────────────────────────────────────
  function getTierBadge() {
    if (profile.tier === 'pro') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold border border-gold/30">
          <Crown size={12} />
          Pro
        </span>
      )
    }
    if (profile.tier === 'holder') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold border border-gold/30">
          <Shield size={12} />
          Holder
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2a2a3e] px-3 py-1 text-xs font-medium text-[#999]">
        Free
      </span>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User size={24} className="text-gold" />
          Settings
        </h1>
        <p className="text-[#999] text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Global error */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 text-lg">
            ×
          </button>
        </div>
      )}

      {/* ─── Section 1: Profile ────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <User size={18} className="text-teal" />
          Profile
        </h2>

        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* Avatar placeholder */}
          <div className="w-16 h-16 rounded-full bg-void border border-border flex items-center justify-center flex-shrink-0">
            <User size={28} className="text-[#555]" />
          </div>

          <div className="flex-1 w-full space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className="block text-xs text-[#666] mb-1.5">Email</label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="w-full rounded-xl border border-border bg-void/50 px-4 py-2.5 text-sm text-[#666] cursor-not-allowed focus:outline-none"
              />
            </div>

            {/* Display name (editable) */}
            <div>
              <label className="block text-xs text-[#666] mb-1.5">Display Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Enter your name"
                  className="flex-1 rounded-xl border border-border bg-void/50 px-4 py-2.5 text-sm focus:outline-none focus:border-teal/50 transition-colors"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || editName === profile.displayName}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal/10 border border-teal/30 px-4 py-2.5 text-sm font-medium text-teal transition-colors hover:bg-teal/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingName ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : nameSaved ? (
                    <Check size={14} />
                  ) : (
                    <Check size={14} />
                  )}
                  {savingName ? 'Saving' : nameSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 2: Password ───────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <Lock size={18} className="text-teal" />
          Change Password
        </h2>

        {passwordMsg && (
          <div
            className={`rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between ${
              passwordMsg.type === 'success'
                ? 'bg-teal/10 border border-teal/20 text-teal'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            <span>{passwordMsg.text}</span>
            <button onClick={() => setPasswordMsg(null)} className="opacity-60 hover:opacity-100 text-lg">
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs text-[#666] mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full rounded-xl border border-border bg-void/50 px-4 py-2.5 text-sm focus:outline-none focus:border-teal/50 transition-colors"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#666] mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full rounded-xl border border-border bg-void/50 px-4 py-2.5 text-sm focus:outline-none focus:border-teal/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[#666] mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full rounded-xl border border-border bg-void/50 px-4 py-2.5 text-sm focus:outline-none focus:border-teal/50 transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {changingPassword ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Lock size={14} />
                Update Password
              </>
            )}
          </button>
        </form>
      </section>

      {/* ─── Section 3: Subscription ───────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <CreditCard size={18} className="text-teal" />
          Subscription
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-void border border-border flex items-center justify-center">
              {profile.tier === 'pro' ? (
                <Crown size={22} className="text-gold" />
              ) : profile.tier === 'holder' ? (
                <Shield size={22} className="text-gold" />
              ) : (
                <CreditCard size={22} className="text-[#555]" />
              )}
            </div>
            <div>
              <p className="text-sm text-[#666]">Current Plan</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-semibold capitalize">
                  {profile.tier === 'holder' ? 'Holder' : profile.tier === 'pro' ? 'Pro' : 'Free'}
                </span>
                {getTierBadge()}
              </div>
            </div>
          </div>

          <div>
            {profile.tier === 'pro' ? (
              <button
                onClick={handleOpenPortal}
                disabled={openingPortal}
                className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
              >
                {openingPortal ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                    <CreditCard size={14} />
                    Manage Billing
                  </>
                )}
              </button>
            ) : (
              <Link
                href="/credits"
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-gold/90"
              >
                <Zap size={14} />
                Upgrade Plan
              </Link>
            )}
          </div>
        </div>

        {profile.tier !== 'pro' && (
          <div className="mt-4 rounded-xl bg-gold/5 border border-gold/20 px-4 py-3">
            <p className="text-xs text-gold/80">
              Upgrade to <strong>Pro</strong> for unlimited renders, all video styles, priority processing, and no watermarks.
            </p>
          </div>
        )}
      </section>

      {/* ─── Section 4: Danger Zone ────────────────────────────── */}
      <section className="rounded-2xl border border-red-500/20 bg-card p-6">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-red-400">
          <Trash2 size={18} />
          Danger Zone
        </h2>
        <p className="text-sm text-[#666] mb-5">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          <Trash2 size={14} />
          Delete Account
        </button>
      </section>

      {/* ─── Delete Confirmation Modal ──────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold">Delete Account</h3>
                <p className="text-xs text-[#666]">This action is irreversible</p>
              </div>
            </div>

            <p className="text-sm text-[#999] mb-5">
              This will permanently delete your account, all projects, videos, and credits. To confirm, type{' '}
              <strong className="text-red-400 font-mono">DELETE</strong> below.
            </p>

            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="w-full rounded-xl border border-border bg-void/50 px-4 py-2.5 text-sm mb-5 focus:outline-none focus:border-red-500/50 transition-colors"
            />

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirm('')
                }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-card/80"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

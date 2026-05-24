'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/auth-helpers'
import { Plus, Film, Clock, Zap, Crown, Shield } from 'lucide-react'
import type { Project, RenderCounts, Tier } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [counts] = useState<RenderCounts>({ today: 0, limit: 2, resets_at: '' })
  const [tier, setTier] = useState<Tier>('free')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Load projects
    const { data: projectData } = await supabase
      .from('soonsnap_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    setProjects(projectData ?? [])

    // Fetch wallet status for tier
    try {
      const res = await fetch('/api/wallet/status', { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        if (data.tier) {
          setTier(data.tier)
        }
      }
    } catch {
      // keep default free tier
    }

    setLoading(false)
  }

  const tierLabel = tier === 'holder' ? 'SOONAK Holder' : tier === 'pro' ? 'Pro' : 'Free'

  function renderTierBadge() {
    if (tier === 'pro') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold border border-gold/30 ml-2">
          <Crown size={11} />
          Pro ⚡
        </span>
      )
    }
    if (tier === 'holder') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold border border-gold/30 ml-2">
          <Shield size={11} />
          Holder 👑
        </span>
      )
    }
    return null
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-[#999] text-sm mt-1 flex items-center">
            <span>{tierLabel} tier · {counts.today}/{counts.limit} renders today</span>
            {renderTierBadge()}
          </p>
        </div>
        <button
          onClick={() => router.push('/editor')}
          className="flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-gold/90"
        >
          <Plus size={18} />
          New Video
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-gold/10 p-2"><Film size={18} className="text-gold" /></div>
            <span className="text-sm text-[#999]">Total Videos</span>
          </div>
          <span className="text-2xl font-bold">{projects.length}</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-teal/10 p-2"><Clock size={18} className="text-teal" /></div>
            <span className="text-sm text-[#999]">Renders Today</span>
          </div>
          <span className="text-2xl font-bold">{counts.today}<span className="text-sm text-[#666]">/{counts.limit}</span></span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-gold/10 p-2"><Zap size={18} className="text-gold" /></div>
            <span className="text-sm text-[#999]">Tier</span>
          </div>
          <span className="text-2xl font-bold capitalize flex items-center gap-2">
            {tierLabel}
            {renderTierBadge()}
          </span>
        </div>
      </div>

      {/* Projects */}
      <h2 className="text-lg font-semibold mb-4">Recent Projects</h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border bg-card h-48" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Film size={40} className="mx-auto text-[#444] mb-4" />
          <h3 className="text-lg font-medium mb-2">No videos yet</h3>
          <p className="text-[#999] text-sm mb-6">Paste a URL to create your first video</p>
          <button
            onClick={() => router.push('/editor')}
            className="rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-gold/90"
          >
            Create Your First Video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => router.push(`/editor?project=${project.id}`)}
              className="rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-teal/50 hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  project.status === 'complete' ? 'bg-green-500' :
                  project.status === 'failed' ? 'bg-red-500' :
                  'bg-gold animate-pulse'
                }`} />
                <span className="text-xs text-[#999] capitalize">{project.status}</span>
              </div>
              <h3 className="font-medium truncate">{project.title || project.url}</h3>
              <p className="text-xs text-[#666] truncate mt-1">{project.url}</p>
              <p className="text-xs text-[#555] mt-3">
                {new Date(project.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

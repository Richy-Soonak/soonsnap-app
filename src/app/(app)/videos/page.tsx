'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Film, Search, Plus, Loader2, Clock } from 'lucide-react'
import type { Project } from '@/types'

/* ─── helpers ─── */

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`

  return new Date(dateStr).toLocaleDateString()
}

function isProcessing(status: string): boolean {
  return ['capturing', 'composing', 'rendering'].includes(status)
}

/* ─── version count map ─── */

type VersionCountMap = Record<string, number>

/* ─── skeleton card ─── */

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card overflow-hidden">
      <div className="aspect-video bg-[#1a1a1a]" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-[#1a1a1a]" />
        <div className="flex items-center justify-between">
          <div className="h-3 w-16 rounded bg-[#1a1a1a]" />
          <div className="h-3 w-10 rounded bg-[#1a1a1a]" />
        </div>
      </div>
    </div>
  )
}

/* ─── video card ─── */

function VideoCard({
  project,
  versionCount,
}: {
  project: Project
  versionCount: number
}) {
  const router = useRouter()
  const title = project.title || extractDomain(project.url)
  const processing = isProcessing(project.status)

  const statusStyles: Record<string, string> = {
    complete:
      'bg-green-500/15 text-green-400 border border-green-500/30',
    failed: 'bg-red-500/15 text-red-400 border border-red-500/30',
    capturing:
      'bg-gold/15 text-gold border border-gold/30',
    composing:
      'bg-gold/15 text-gold border border-gold/30',
    rendering:
      'bg-gold/15 text-gold border border-gold/30',
  }

  return (
    <button
      onClick={() => router.push(`/project/${project.id}`)}
      className="group rounded-2xl border border-border bg-card overflow-hidden text-left transition-all hover:border-teal/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[#0a0a0a] overflow-hidden">
        <img
          src={`/api/thumbnail/${project.id}?v=1`}
          alt={title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          onError={(e) => {
            // Replace with gradient placeholder on error
            const target = e.currentTarget
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent && !parent.querySelector('.fallback-letter')) {
              const fallback = document.createElement('div')
              fallback.className =
                'fallback-letter w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/20 via-[#1a1a1a] to-teal/10'
              fallback.innerHTML = `<span class="text-4xl font-bold text-gold/40 select-none">${title.charAt(0).toUpperCase()}</span>`
              parent.appendChild(fallback)
            }
          }}
        />

        {/* Status badge — top right */}
        <div className="absolute top-2 right-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
              statusStyles[project.status] ?? 'bg-[#222] text-[#999] border border-border'
            }`}
          >
            {processing && <Loader2 size={10} className="animate-spin" />}
            {project.status === 'complete'
              ? 'Complete'
              : project.status === 'failed'
                ? 'Failed'
                : 'Processing'}
          </span>
        </div>

        {/* Version badge — bottom left */}
        {versionCount > 0 && (
          <div className="absolute bottom-2 left-2">
            <span className="rounded-md bg-black/70 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-bold text-gold">
              v{versionCount}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="font-medium text-sm truncate mb-1.5 group-hover:text-teal transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-[#666]">
          <Clock size={11} />
          <span>{relativeTime(project.created_at)}</span>
        </div>
      </div>
    </button>
  )
}

/* ─── page ─── */

export default function VideosPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [versionCounts, setVersionCounts] = useState<VersionCountMap>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Fetch all projects for this user
    const { data: projectData } = await supabase
      .from('soonsnap_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    const projectList = (projectData ?? []) as Project[]
    setProjects(projectList)

    // Fetch version counts for all projects
    if (projectList.length > 0) {
      const projectIds = projectList.map((p) => p.id)

      const { data: versionData } = await supabase
        .from('soonsnap_versions')
        .select('project_id, version_num')
        .in('project_id', projectIds)

      if (versionData) {
        const counts: VersionCountMap = {}
        for (const v of versionData) {
          const pid = v.project_id as string
          counts[pid] = (counts[pid] ?? 0) + 1
        }
        setVersionCounts(counts)
      }
    }

    setLoading(false)
  }

  /* ── filtered projects ── */

  const filtered = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter((p) => {
      const title = (p.title || '').toLowerCase()
      const url = (p.url || '').toLowerCase()
      return title.includes(q) || url.includes(q)
    })
  }, [projects, search])

  /* ── render ── */

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Videos</h1>
          <p className="text-[#999] text-sm mt-1">
            {projects.length} video{projects.length !== 1 ? 's' : ''}
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

      {/* Search bar */}
      {projects.length > 0 && (
        <div className="relative mb-6">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by title or URL…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-teal/50 transition-colors"
          />
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state — no projects at all */}
      {!loading && projects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mb-5">
            <Film size={28} className="text-gold" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No videos yet</h3>
          <p className="text-[#999] text-sm mb-8 max-w-sm mx-auto">
            Turn any website into a stunning video in seconds. Paste a URL to
            get started.
          </p>
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-void transition-colors hover:bg-gold/90"
          >
            <Plus size={18} />
            Create Your First Video
          </Link>
        </div>
      )}

      {/* Search returned no results */}
      {!loading && projects.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Search size={32} className="mx-auto text-[#444] mb-3" />
          <h3 className="text-lg font-medium mb-1">No matches</h3>
          <p className="text-[#999] text-sm">
            No videos found for &ldquo;{search}&rdquo;. Try a different search term.
          </p>
        </div>
      )}

      {/* Video grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((project) => (
            <VideoCard
              key={project.id}
              project={project}
              versionCount={versionCounts[project.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

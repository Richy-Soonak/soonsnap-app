'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Film, ArrowLeft, Calendar, Clock, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Project, Version } from '@/types'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projectId) loadProject()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function loadProject() {
    const { data: proj } = await supabase
      .from('soonsnap_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (proj) {
      setProject(proj)

      const { data: vers } = await supabase
        .from('soonsnap_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('version_num', { ascending: false })

      setVersions(vers || [])
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-gold" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-medium mb-2">Project not found</h2>
        <Link href="/dashboard" className="text-teal hover:text-gold transition-colors text-sm">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const statusColor =
    project.status === 'complete' ? 'text-green-400' :
    project.status === 'failed' ? 'text-red-400' :
    'text-gold'

  const latestVersion = versions.find((v) => v.status === 'complete' && v.video_url)

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[#999] hover:text-gold transition-colors mb-6">
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.title || project.url}</h1>
          <p className="text-sm text-[#999] mt-1 truncate max-w-lg">{project.url}</p>
        </div>
        <span className={`text-sm font-medium capitalize ${statusColor} flex items-center gap-1.5`}>
          {['capturing', 'composing', 'rendering'].includes(project.status) && (
            <Loader2 size={14} className="animate-spin" />
          )}
          {project.status}
        </span>
      </div>

      {/* Video player */}
      {latestVersion?.video_url && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden mb-8">
          <div className="aspect-video bg-black">
            <video
              src={latestVersion.video_url}
              controls
              className="w-full h-full"
            />
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm text-[#999]">
              Version {latestVersion.version_num} · {latestVersion.prompt}
            </span>
            <a
              href={latestVersion.video_url}
              download
              className="rounded-xl bg-teal/10 border border-teal/30 px-4 py-2 text-sm text-teal hover:bg-teal/20 transition-colors"
            >
              Download MP4
            </a>
          </div>
        </div>
      )}

      {/* Project info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-card p-4">
          <Calendar size={16} className="text-[#555] mb-2" />
          <p className="text-xs text-[#999]">Created</p>
          <p className="text-sm font-medium">{new Date(project.created_at).toLocaleDateString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Film size={16} className="text-[#555] mb-2" />
          <p className="text-xs text-[#999]">Versions</p>
          <p className="text-sm font-medium">{versions.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Clock size={16} className="text-[#555] mb-2" />
          <p className="text-xs text-[#999]">Latest</p>
          <p className="text-sm font-medium">{latestVersion ? `v${latestVersion.version_num}` : '—'}</p>
        </div>
      </div>

      {/* Version history */}
      <h2 className="text-lg font-semibold mb-4">Version History</h2>
      {versions.length === 0 ? (
        <p className="text-[#666] text-sm">No versions yet</p>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
            >
              <div>
                <span className="font-medium">v{v.version_num}</span>
                <span className="text-sm text-[#999] ml-3">{v.prompt}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${
                  v.status === 'complete' ? 'text-green-400' :
                  v.status === 'failed' ? 'text-red-400' :
                  'text-gold'
                }`}>
                  {v.status}
                </span>
                <span className="text-xs text-[#666]">
                  {new Date(v.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

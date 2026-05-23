'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Film,
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
  Play,
  Download,
  RefreshCw,
  Layers,
  ChevronRight,
  Link as LinkIcon,
  Palette,
  Sparkles,
  MessageSquare,
  XCircle,
  CheckCircle2,
  Columns2,
} from 'lucide-react'
import Link from 'next/link'
import type { Project, Version } from '@/types'

/* ─── constants ─── */

const STYLES = [
  { id: 'cinematic', label: 'Cinematic', desc: 'Dramatic reveals, smooth camera moves' },
  { id: 'social', label: 'Social Ad', desc: 'Punchy, fast cuts, bold text' },
  { id: 'tutorial', label: 'Tutorial', desc: 'Step-by-step, clear annotations' },
  { id: 'minimal', label: 'Minimal', desc: 'Clean, elegant, whitespace-forward' },
]

const DURATIONS = [
  { id: '15', label: '15s' },
  { id: '30', label: '30s' },
  { id: '60', label: '60s' },
]

type PipelineStep = 'idle' | 'queued' | 'capturing' | 'composing' | 'rendering' | 'complete' | 'failed'

/* ─── page ─── */

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // core data
  const [project, setProject] = useState<Project | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)

  // version switching
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)

  // comparison mode
  const [compareMode, setCompareMode] = useState(false)
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null)

  // re-render panel
  const [showRerender, setShowRerender] = useState(false)
  const [style, setStyle] = useState('cinematic')
  const [duration, setDuration] = useState('15')
  const [prompt, setPrompt] = useState('')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [renderStep, setRenderStep] = useState<PipelineStep>('idle')
  const [renderProgress, setRenderProgress] = useState(0)
  const [renderError, setRenderError] = useState('')

  // ─── helpers ───

  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? null
  const compareVersion = versions.find((v) => v.id === compareVersionId) ?? null

  const videoUrlFor = (v: Version | null) => {
    if (!v) return ''
    if (v.video_url) return v.video_url
    return `/api/video/${projectId}?v=${v.version_num}`
  }

  const thumbnailUrlFor = (v: Version) => {
    if (v.thumbnail_url) return v.thumbnail_url
    return `/api/thumbnail/${projectId}?v=${v.version_num}`
  }

  // ─── data loading ───

  useEffect(() => {
    if (projectId) loadProject()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
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

      const versionList = vers || []
      setVersions(versionList)

      // default active = latest complete version
      const latestComplete = versionList.find((v: Version) => v.status === 'complete')
      if (latestComplete) {
        setActiveVersionId(latestComplete.id)
        setPrompt(latestComplete.prompt || '')
        if (latestComplete.enhanced_prompt) setEnhancedPrompt(latestComplete.enhancedPrompt)
      }

      // pre-set compare to previous version if available
      if (versionList.length >= 2) {
        const prev = versionList.find(
          (v: Version) => v.status === 'complete' && latestComplete && v.id !== latestComplete.id,
        )
        if (prev) setCompareVersionId(prev.id)
      }
    }
    setLoading(false)
  }

  // ─── job polling (re-render) ───

  const pollJob = useCallback(async (jid: string) => {
    try {
      const res = await fetch(`/api/jobs/${jid}`)
      const data = await res.json()
      if (!data.ok) return

      const { status, progress: prog, result } = data.job
      setRenderProgress(prog || 0)

      if (status === 'queued') setRenderStep('queued')
      else if (status === 'running') {
        if (prog < 30) setRenderStep('capturing')
        else if (prog < 50) setRenderStep('composing')
        else setRenderStep('rendering')
      } else if (status === 'complete') {
        setRenderStep('complete')
        setRenderProgress(100)
        if (pollRef.current) clearInterval(pollRef.current)
        // reload to get new version
        loadProject()
      } else if (status === 'failed') {
        setRenderStep('failed')
        setRenderError(data.job.error || 'Render failed')
        if (pollRef.current) clearInterval(pollRef.current)
      }
    } catch {
      /* swallow */
    }
  }, [])

  function startPolling(jid: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => pollJob(jid), 2000)
    pollJob(jid)
  }

  // ─── re-render ───

  const isProcessing = ['queued', 'capturing', 'composing', 'rendering'].includes(renderStep)

  async function handleRerender() {
    setRenderError('')
    setRenderStep('queued')
    setRenderProgress(0)

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          url: project!.url,
          style,
          duration: Number(duration),
          prompt: enhancedPrompt || prompt || `${style} style, ${duration}s`,
          enhancedPrompt,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to enqueue')
      startPolling(data.jobId)
    } catch (err: any) {
      setRenderError(err.message || 'Something went wrong')
      setRenderStep('failed')
    }
  }

  async function handleEnhance() {
    if (!prompt.trim()) return
    setIsEnhancing(true)
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, duration, siteTitle: project?.title }),
      })
      const data = await res.json()
      if (data.ok && data.enhancedPrompt) {
        setEnhancedPrompt(data.enhancedPrompt)
      } else {
        setRenderError(data.error || 'Enhancement failed')
      }
    } catch (err: any) {
      setRenderError(err.message)
    } finally {
      setIsEnhancing(false)
    }
  }

  // ─── loading / empty ───

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

  const completeVersions = versions.filter((v) => v.status === 'complete')

  /* ─── render ─── */

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[#999] hover:text-gold transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.title || project.url}</h1>
          <p className="text-sm text-[#999] mt-1 truncate max-w-lg">{project.url}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Compare button */}
          {completeVersions.length >= 2 && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 ${
                compareMode
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-border text-[#999] hover:border-[#444] hover:text-white'
              }`}
            >
              <Columns2 size={16} />
              {compareMode ? 'Exit Compare' : 'Compare'}
            </button>
          )}
          <span className={`text-sm font-medium capitalize ${statusColor} flex items-center gap-1.5`}>
            {['capturing', 'composing', 'rendering'].includes(project.status) && (
              <Loader2 size={14} className="animate-spin" />
            )}
            {project.status}
          </span>
        </div>
      </div>

      {/* ── Video Player(s) ── */}

      {!compareMode ? (
        /* Single player */
        activeVersion && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden mb-4">
            <div className="aspect-video bg-black">
              <video
                key={activeVersion.id}
                src={videoUrlFor(activeVersion)}
                controls
                className="w-full h-full"
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm text-[#999]">
                <span className="text-gold font-medium">v{activeVersion.version_num}</span>
                {' · '}
                {activeVersion.prompt}
              </span>
              <a
                href={videoUrlFor(activeVersion)}
                download
                className="rounded-xl bg-teal/10 border border-teal/30 px-4 py-2 text-sm text-teal hover:bg-teal/20 transition-colors flex items-center gap-2"
              >
                <Download size={14} />
                Download MP4
              </a>
            </div>
          </div>
        )
      ) : (
        /* Side-by-side comparison */
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Current version */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <span className="text-xs font-medium text-gold">Current</span>
              {activeVersion && (
                <span className="text-xs text-[#666]">v{activeVersion.version_num}</span>
              )}
            </div>
            <div className="aspect-video bg-black">
              {activeVersion && (
                <video
                  key={`current-${activeVersion.id}`}
                  src={videoUrlFor(activeVersion)}
                  controls
                  className="w-full h-full"
                />
              )}
            </div>
          </div>

          {/* Previous version */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <span className="text-xs font-medium text-[#999]">Previous</span>
              {compareVersion && (
                <span className="text-xs text-[#666]">v{compareVersion.version_num}</span>
              )}
              {/* Dropdown to pick which version to compare */}
              <select
                value={compareVersionId ?? ''}
                onChange={(e) => setCompareVersionId(e.target.value || null)}
                className="ml-auto text-xs bg-void border border-border rounded-lg px-2 py-1 text-[#999]"
              >
                {completeVersions
                  .filter((v) => v.id !== activeVersionId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version_num}
                    </option>
                  ))}
              </select>
            </div>
            <div className="aspect-video bg-black">
              {compareVersion && (
                <video
                  key={`compare-${compareVersion.id}`}
                  src={videoUrlFor(compareVersion)}
                  controls
                  className="w-full h-full"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Visual Timeline Strip ── */}

      {versions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-[#555]" />
            <h3 className="text-sm font-medium text-[#999]">Version Timeline</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {/* Render versions in ascending order (v1 → latest) */}
            {[...versions].reverse().map((v) => {
              const isActive = v.id === activeVersionId
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    if (v.status === 'complete') setActiveVersionId(v.id)
                  }}
                  className={`flex-shrink-0 rounded-xl border overflow-hidden transition-all text-left ${
                    isActive
                      ? 'border-gold ring-1 ring-gold/30 scale-[1.02]'
                      : v.status === 'complete'
                        ? 'border-border hover:border-[#444]'
                        : 'border-border opacity-60 cursor-default'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-36 h-20 bg-void">
                    {v.status === 'complete' ? (
                      <img
                        src={thumbnailUrlFor(v)}
                        alt={`v${v.version_num} thumbnail`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {v.status === 'rendering' || v.status === 'pending' ? (
                          <Loader2 size={20} className="animate-spin text-gold" />
                        ) : (
                          <XCircle size={20} className="text-red-400" />
                        )}
                      </div>
                    )}
                    {/* Play icon overlay on active */}
                    {isActive && v.status === 'complete' && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Play size={20} className="text-white" fill="white" />
                      </div>
                    )}
                    {/* Status indicator dot */}
                    <div className="absolute top-1.5 right-1.5">
                      <span
                        className={`block w-2.5 h-2.5 rounded-full ${
                          v.status === 'complete'
                            ? 'bg-green-400'
                            : v.status === 'failed'
                              ? 'bg-red-400'
                              : 'bg-gold animate-pulse'
                        }`}
                      />
                    </div>
                  </div>
                  {/* Badge + info */}
                  <div className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-bold ${
                          isActive ? 'text-gold' : 'text-[#999]'
                        }`}
                      >
                        v{v.version_num}
                      </span>
                      <span className="text-[10px] text-[#555]">
                        {v.duration ? `${v.duration}s` : ''}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#555] truncate w-32 mt-0.5">
                      {v.prompt || '—'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Project Info Cards ── */}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
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
          <p className="text-sm font-medium">
            {completeVersions.length > 0 ? `v${completeVersions[0].version_num}` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Download size={16} className="text-[#555] mb-2" />
          <p className="text-xs text-[#999]">Status</p>
          <p className={`text-sm font-medium capitalize ${statusColor}`}>{project.status}</p>
        </div>
      </div>

      {/* ── Re-render Panel ── */}

      <div className="rounded-2xl border border-border bg-card mb-8 overflow-hidden">
        <button
          onClick={() => setShowRerender(!showRerender)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <RefreshCw size={18} className="text-gold" />
            <div className="text-left">
              <h3 className="text-sm font-semibold">Re-render</h3>
              <p className="text-xs text-[#666]">Create a new version with different settings</p>
            </div>
          </div>
          <ChevronRight
            size={18}
            className={`text-[#555] transition-transform ${showRerender ? 'rotate-90' : ''}`}
          />
        </button>

        {showRerender && (
          <div className="px-5 pb-5 border-t border-border pt-5">
            {/* URL (read-only, shows project URL) */}
            <label className="block text-sm font-medium text-[#999] mb-2">Website URL</label>
            <div className="relative mb-5">
              <LinkIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                value={project.url}
                readOnly
                className="w-full rounded-xl border border-border bg-void pl-11 pr-4 py-3 text-[#F8F9FC] placeholder-[#555] opacity-60 cursor-not-allowed"
              />
            </div>

            {/* Style selector */}
            <label className="block text-sm font-medium text-[#999] mb-2">Video Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  disabled={isProcessing}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    style === s.id
                      ? 'border-gold bg-gold/10'
                      : 'border-border hover:border-[#444]'
                  } disabled:opacity-50`}
                >
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-[#666] mt-0.5">{s.desc}</span>
                </button>
              ))}
            </div>

            {/* Duration */}
            <label className="block text-sm font-medium text-[#999] mb-2">Duration</label>
            <div className="flex gap-3 mb-5">
              {DURATIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDuration(d.id)}
                  disabled={isProcessing}
                  className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition-all ${
                    duration === d.id
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border text-[#999] hover:border-[#444]'
                  } disabled:opacity-50`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Prompt */}
            <label className="block text-sm font-medium text-[#999] mb-2">
              <MessageSquare size={14} className="inline mr-1 -mt-0.5" />
              Custom Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value)
                setEnhancedPrompt('')
              }}
              disabled={isProcessing}
              rows={3}
              placeholder="Describe the video you want... e.g. 'Show the pricing section with bold transitions'"
              className="w-full rounded-xl border border-border bg-void px-4 py-3 text-sm text-[#F8F9FC] placeholder-[#555] resize-none focus:border-teal disabled:opacity-50 mb-3"
            />

            {/* Enhanced prompt preview */}
            {enhancedPrompt && (
              <div className="mb-3 rounded-xl border border-teal/30 bg-teal/5 p-3">
                <p className="text-xs text-teal mb-1 font-medium">✨ Enhanced prompt:</p>
                <p className="text-sm text-[#ccc]">{enhancedPrompt}</p>
              </div>
            )}

            {/* Enhance + Re-render buttons */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={handleEnhance}
                disabled={isProcessing || isEnhancing || !prompt.trim()}
                className="rounded-xl border border-teal/30 bg-teal/10 px-4 py-2 text-sm text-teal hover:bg-teal/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isEnhancing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                Enhance Prompt
              </button>
            </div>

            {/* Error */}
            {renderError && (
              <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
                <XCircle size={18} className="inline mr-2 -mt-0.5" />
                {renderError}
              </div>
            )}

            {/* Progress bar during rendering */}
            {isProcessing && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#999]">
                    {renderStep === 'queued' && 'Queued...'}
                    {renderStep === 'capturing' && 'Capturing website...'}
                    {renderStep === 'composing' && 'AI composing video...'}
                    {renderStep === 'rendering' && 'Rendering MP4...'}
                  </span>
                  <span className="text-xs text-gold">{renderProgress}%</span>
                </div>
                <div className="w-full h-2 bg-void rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all duration-500"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
                {/* Pipeline step icons */}
                <div className="flex items-center gap-4 mt-4">
                  <StepIcon
                    done={renderProgress > 30}
                    active={renderStep === 'queued' || renderStep === 'capturing'}
                    failed={false}
                    icon={<Palette size={16} />}
                    label="Capture"
                  />
                  <div className="flex-1 h-px bg-border" />
                  <StepIcon
                    done={renderProgress > 50}
                    active={renderStep === 'composing'}
                    failed={false}
                    icon={<Sparkles size={16} />}
                    label="Compose"
                  />
                  <div className="flex-1 h-px bg-border" />
                  <StepIcon
                    done={renderStep === 'complete'}
                    active={renderStep === 'rendering'}
                    failed={false}
                    icon={<Film size={16} />}
                    label="Render"
                  />
                </div>
              </div>
            )}

            {/* Re-render trigger */}
            <button
              onClick={handleRerender}
              disabled={isProcessing}
              className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-void transition-colors hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Rendering… {renderProgress}%
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Re-render with current settings
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Version History List ── */}

      <h2 className="text-lg font-semibold mb-4">Version History</h2>
      {versions.length === 0 ? (
        <p className="text-[#666] text-sm">No versions yet</p>
      ) : (
        <div className="space-y-3 mb-12">
          {versions.map((v) => (
            <div
              key={v.id}
              onClick={() => {
                if (v.status === 'complete') setActiveVersionId(v.id)
              }}
              className={`rounded-xl border bg-card p-4 flex items-center justify-between transition-all ${
                v.id === activeVersionId
                  ? 'border-gold cursor-pointer'
                  : v.status === 'complete'
                    ? 'border-border hover:border-[#444] cursor-pointer'
                    : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Mini thumbnail */}
                <div className="w-16 h-9 rounded-lg overflow-hidden bg-void flex-shrink-0">
                  {v.status === 'complete' ? (
                    <img
                      src={thumbnailUrlFor(v)}
                      alt={`v${v.version_num}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {v.status === 'rendering' || v.status === 'pending' ? (
                        <Loader2 size={14} className="animate-spin text-gold" />
                      ) : (
                        <XCircle size={14} className="text-red-400" />
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <span className="font-medium">v{v.version_num}</span>
                  <span className="text-sm text-[#999] ml-3">{v.prompt}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs ${
                    v.status === 'complete'
                      ? 'text-green-400'
                      : v.status === 'failed'
                        ? 'text-red-400'
                        : 'text-gold'
                  }`}
                >
                  {v.status}
                </span>
                <span className="text-xs text-[#666]">
                  {new Date(v.created_at).toLocaleString()}
                </span>
                {v.id === activeVersionId && (
                  <Play size={14} className="text-gold" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── step icon helper ─── */

function StepIcon({
  done,
  active,
  failed,
  icon,
  label,
}: {
  done: boolean
  active: boolean
  failed: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`rounded-full p-2 transition-colors ${
          done
            ? 'bg-green-500/20 text-green-400'
            : active
              ? 'bg-gold/20 text-gold animate-pulse'
              : failed
                ? 'bg-red-500/20 text-red-400'
                : 'bg-border text-[#555]'
        }`}
      >
        {done ? <CheckCircle2 size={16} /> : icon}
      </div>
      <span
        className={`text-xs ${
          done ? 'text-green-400' : active ? 'text-gold' : 'text-[#555]'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

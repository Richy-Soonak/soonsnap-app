'use client'

/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getAuthHeaders, getJsonAuthHeaders } from '@/lib/auth-helpers'
import {
  Link as LinkIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Film,
  Palette,
  Sparkles,
  MessageSquare,
  RotateCcw,
  TrendingUp,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Suspense } from 'react'

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

const STEP_LABELS: Record<PipelineStep, string> = {
  idle: 'Ready',
  queued: 'Queued — waiting for worker...',
  capturing: 'Capturing website...',
  composing: 'AI composing video...',
  rendering: 'Rendering MP4...',
  complete: 'Complete!',
  failed: 'Failed',
}

// Stage time estimates in seconds
const STAGE_ESTIMATES: Record<string, [number, number]> = {
  queued: [5, 15],
  capturing: [60, 120],
  composing: [120, 300],
  rendering: [120, 200],
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-gold" /></div>}>
      <EditorContent />
    </Suspense>
  )
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function EditorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedRef = useRef<NodeJS.Timeout | null>(null)

  const [url, setUrl] = useState('')
  const [style, setStyle] = useState('cinematic')
  const [duration, setDuration] = useState('15')
  const [step, setStep] = useState<PipelineStep>('idle')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [queuedAt, setQueuedAt] = useState<number>(0)

  // Prompt editing
  const [prompt, setPrompt] = useState('')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [showPromptEditor, setShowPromptEditor] = useState(false)

  // Load existing project if ?project= provided
  useEffect(() => {
    const pid = searchParams.get('project')
    if (pid) loadProject(pid)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [searchParams])

  // Elapsed timer
  useEffect(() => {
    const isProcessing = ['queued', 'capturing', 'composing', 'rendering'].includes(step)
    if (isProcessing && queuedAt > 0) {
      elapsedRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - queuedAt) / 1000))
      }, 1000)
    }
    if (step === 'complete' || step === 'failed' || step === 'idle') {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current) }
  }, [step, queuedAt])

  async function loadProject(pid: string) {
    const { data } = await supabase
      .from('soonsnap_projects')
      .select('*')
      .eq('id', pid)
      .single()

    if (data) {
      setProjectId(data.id)
      setUrl(data.url)
      setProjectTitle(data.title || data.url)
      setShowPromptEditor(true)

      if (data.status === 'complete') {
        const { data: versions } = await supabase
          .from('soonsnap_versions')
          .select('*')
          .eq('project_id', data.id)
          .order('version_num', { ascending: false })

        if (versions && versions.length > 0) {
          const latest = versions[0]
          if (latest.video_url) {
            setVideoUrl(latest.video_url)
            setStep('complete')
          }
          if (latest.prompt) setPrompt(latest.prompt)
          if (latest.enhanced_prompt) setEnhancedPrompt(latest.enhanced_prompt)
        }
      } else if (data.status === 'failed') {
        setStep('failed')
      }
    }
  }

  const pollJob = useCallback(async (jid: string) => {
    try {
      const res = await fetch(`/api/jobs/${jid}`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (!data.ok) return

      const { status, progress: prog, result, statusMessage: msg, error: jobError } = data.job

      setProgress(prog || 0)
      if (msg) setStatusMessage(msg)

      // Map job progress to pipeline steps
      if (status === 'queued') setStep('queued')
      else if (status === 'running') {
        if (prog < 30) setStep('capturing')
        else if (prog < 50) setStep('composing')
        else setStep('rendering')
      } else if (status === 'complete') {
        setStep('complete')
        setProgress(100)
        if (result?.videoUrl) setVideoUrl(result.videoUrl)
        if (pollRef.current) clearInterval(pollRef.current)
      } else if (status === 'failed') {
        setStep('failed')
        setError(jobError || 'Render failed. Please try again.')
        if (pollRef.current) clearInterval(pollRef.current)
      }
    } catch {}
  }, [])

  function startPolling(jid: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => pollJob(jid), 2000)
    pollJob(jid) // initial check
  }

  function isValidUrl(str: string): boolean {
    try {
      const u = new URL(str)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch { return false }
  }

  async function handleGenerate() {
    setError('')
    const trimmed = url.trim()
    if (!trimmed) { setError('Please enter a URL'); return }
    const finalUrl = trimmed.startsWith('http') ? trimmed : 'https://' + trimmed
    if (!isValidUrl(finalUrl)) { setError('Please enter a valid URL'); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setStep('queued')
    setProgress(0)
    setStatusMessage('Queued — waiting for worker...')
    setQueuedAt(Date.now())
    setElapsed(0)

    let pid = projectId

    // Create project if new
    if (!pid) {
      const { data: project, error: dbError } = await supabase
        .from('soonsnap_projects')
        .insert({
          user_id: user.id,
          url: finalUrl,
          title: new URL(finalUrl).hostname,
          status: 'queued',
        })
        .select()
        .single()

      if (dbError || !project) {
        setError('Failed to create project')
        setStep('failed')
        return
      }
      pid = project.id
      setProjectId(project.id)
      setProjectTitle(project.title)
      setShowPromptEditor(true)
    }

    // Enqueue render job
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({
          projectId: pid,
          url: finalUrl,
          style,
          duration: Number(duration),
          prompt: enhancedPrompt || prompt || `${style} style, ${duration}s`,
          enhancedPrompt,
        }),
      })
      const data = await res.json()

      if (!data.ok) {
        // Handle 402 insufficient credits specifically
        if (res.status === 402) {
          setError(`Insufficient credits. You have ${data.balance ?? 0} credits remaining. Purchase more to continue.`)
          setStep('failed')
          return
        }
        throw new Error(data.error || 'Failed to enqueue')
      }

      setJobId(data.jobId)
      startPolling(data.jobId)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setStep('failed')
    }
  }

  async function handleEnhance() {
    if (!prompt.trim()) return
    setIsEnhancing(true)
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({
          prompt,
          style,
          duration,
          siteTitle: projectTitle,
        }),
      })
      const data = await res.json()
      if (data.ok && data.enhancedPrompt) {
        setEnhancedPrompt(data.enhancedPrompt)
      } else {
        setError(data.error || 'Enhancement failed')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsEnhancing(false)
    }
  }

  const isProcessing = ['queued', 'capturing', 'composing', 'rendering'].includes(step)

  // Compute estimated remaining time
  function getEstimatedRemaining(): string | null {
    if (!isProcessing || queuedAt === 0) return null
    const [minSec, maxSec] = STAGE_ESTIMATES[step] || [60, 180]
    // Rough: use midpoint minus half the elapsed
    const mid = (minSec + maxSec) / 2
    const remaining = Math.max(minSec / 2, mid - elapsed * 0.5)
    const min = Math.ceil(remaining / 60)
    if (min < 1) return '<1 min remaining'
    return `~${min} min remaining`
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Create Video</h1>
      <p className="text-[#999] text-sm mb-8">Paste a URL, pick a style, get a video</p>

      {/* URL Input + Style + Duration */}
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <label className="block text-sm font-medium text-[#999] mb-2">Website URL</label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <LinkIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={isProcessing}
              className="w-full rounded-xl border border-border bg-void pl-11 pr-4 py-3 text-[#F8F9FC] placeholder-[#555] transition-colors focus:border-teal disabled:opacity-50"
            />
          </div>
        </div>

        {/* Style selector */}
        <div className="mt-5">
          <label className="block text-sm font-medium text-[#999] mb-2">Video Style</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                disabled={isProcessing}
                className={`rounded-xl border p-3 text-left transition-all ${
                  style === s.id ? 'border-gold bg-gold/10' : 'border-border hover:border-[#444]'
                } disabled:opacity-50`}
              >
                <span className="text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-[#666] mt-0.5">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="mt-5">
          <label className="block text-sm font-medium text-[#999] mb-2">Duration</label>
          <div className="flex gap-3">
            {DURATIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDuration(d.id)}
                disabled={isProcessing}
                className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition-all ${
                  duration === d.id ? 'border-gold bg-gold/10 text-gold' : 'border-border text-[#999] hover:border-[#444]'
                } disabled:opacity-50`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Editor (visible when project loaded or after first generate) */}
        {showPromptEditor && (
          <div className="mt-5 pt-5 border-t border-border">
            <label className="block text-sm font-medium text-[#999] mb-2">
              <MessageSquare size={14} className="inline mr-1 -mt-0.5" />
              Custom Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setEnhancedPrompt('') }}
              disabled={isProcessing}
              rows={3}
              placeholder="Describe the video you want... e.g. 'Show the pricing section with bold transitions'"
              className="w-full rounded-xl border border-border bg-void px-4 py-3 text-sm text-[#F8F9FC] placeholder-[#555] resize-none focus:border-teal disabled:opacity-50"
            />

            {/* Enhanced prompt preview */}
            {enhancedPrompt && (
              <div className="mt-2 rounded-xl border border-teal/30 bg-teal/5 p-3">
                <p className="text-xs text-teal mb-1 font-medium">✨ Enhanced prompt:</p>
                <p className="text-sm text-[#ccc]">{enhancedPrompt}</p>
              </div>
            )}

            <div className="flex gap-3 mt-3">
              <button
                onClick={handleEnhance}
                disabled={isProcessing || isEnhancing || !prompt.trim()}
                className="rounded-xl border border-teal/30 bg-teal/10 px-4 py-2 text-sm text-teal hover:bg-teal/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isEnhancing ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                Enhance Prompt
              </button>
            </div>
          </div>
        )}

        {/* Generate / Re-render button */}
        <button
          onClick={handleGenerate}
          disabled={isProcessing || !url.trim()}
          className="mt-6 w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-void transition-colors hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {statusMessage || STEP_LABELS[step]} {progress > 0 && `(${progress}%)`}
            </>
          ) : step === 'complete' ? (
            <>
              <RotateCcw size={18} />
              Re-render with current settings
            </>
          ) : (
            <>
              <Film size={18} />
              Generate Video
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          <XCircle size={18} className="inline mr-2 -mt-0.5" />
          {error}
        </div>
      )}

      {/* Pipeline progress */}
      {isProcessing && (
        <div className="rounded-2xl border border-border bg-card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[#999]">Pipeline Status</h3>
            <div className="flex items-center gap-2 text-xs text-[#666]">
              <Clock size={12} />
              <span>{formatElapsed(elapsed)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-void rounded-full mb-2 overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Status message from worker */}
          <p className="text-xs text-gold mb-3">
            {statusMessage || STEP_LABELS[step]}
          </p>

          {/* Estimated remaining */}
          {getEstimatedRemaining() && (
            <p className="text-xs text-[#555] mb-4">
              ⏱ {getEstimatedRemaining()}
            </p>
          )}

          {/* Queue warning */}
          {step === 'queued' && elapsed > 10 && (
            <div className="flex items-center gap-2 text-xs text-yellow-500/80 mb-4 animate-pulse">
              <AlertTriangle size={12} />
              Worker busy — your job is next in queue
            </div>
          )}

          {/* Step icons */}
          <div className="flex items-center gap-4">
            <StepIcon done={progress > 30} active={step === 'queued' || step === 'capturing'} failed={step === 'failed' && progress <= 30} icon={<Palette size={18} />} label="Capture" />
            <div className="flex-1 h-px bg-border" />
            <StepIcon done={progress > 50} active={step === 'composing'} failed={step === 'failed' && progress > 30 && progress <= 50} icon={<Sparkles size={18} />} label="Compose" />
            <div className="flex-1 h-px bg-border" />
            <StepIcon done={step === 'complete'} active={step === 'rendering'} failed={step === 'failed' && progress > 50} icon={<Film size={18} />} label="Render" />
          </div>
        </div>
      )}

      {/* Video player */}
      {step === 'complete' && videoUrl && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="aspect-video bg-black relative">
            <video src={videoUrl} controls className="w-full h-full" autoPlay />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium">{projectTitle}</h3>
              <p className="text-xs text-[#666]">{style} · {duration}s · {formatElapsed(elapsed)}</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/download/${projectId}?v=1`, { headers: getAuthHeaders() })
                  if (!res.ok) throw new Error('Download failed')
                  const blob = await res.blob()
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `${projectTitle || 'soonsnap'}.mp4`
                  a.click()
                  URL.revokeObjectURL(a.href)
                } catch { setError('Download failed') }
              }}
              className="rounded-xl bg-teal/10 border border-teal/30 px-4 py-2 text-sm text-teal hover:bg-teal/20 transition-colors"
            >
              Download MP4
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StepIcon({ done, active, failed, icon, label }: {
  done: boolean; active: boolean; failed: boolean; icon: React.ReactNode; label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`rounded-full p-2 transition-colors ${
        done ? 'bg-green-500/20 text-green-400' :
        active ? 'bg-gold/20 text-gold animate-pulse' :
        failed ? 'bg-red-500/20 text-red-400' :
        'bg-border text-[#555]'
      }`}>
        {done ? <CheckCircle2 size={18} /> : icon}
      </div>
      <span className={`text-xs ${
        done ? 'text-green-400' : active ? 'text-gold' : 'text-[#555]'
      }`}>{label}</span>
    </div>
  )
}

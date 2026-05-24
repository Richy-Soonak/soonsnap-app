/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enqueueJob } from '@/lib/job-queue'

const supabase = createClient(
  process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://173.249.36.76:8000',
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const {
      projectId,
      url,
      style = 'cinematic',
      duration = 15,
      prompt,
      enhancedPrompt,
    } = await req.json()

    if (!projectId) {
      return NextResponse.json({ ok: false, error: 'Missing projectId' }, { status: 400 })
    }

    // Verify project exists
    const { data: project, error: pErr } = await supabase
      .from('soonsnap_projects')
      .select('id, url, status')
      .eq('id', projectId)
      .single()

    if (pErr || !project) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 })
    }

    // Update project status
    await supabase
      .from('soonsnap_projects')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', projectId)

    // Enqueue the job — worker handles capture → compose → render
    const job = await enqueueJob(projectId, 'full_pipeline', {
      url: url || project.url,
      style,
      duration: Number(duration),
      prompt,
      enhancedPrompt,
    })

    console.log(`[render] Enqueued job ${job.id.slice(0, 8)} for project ${projectId.slice(0, 8)}`)

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: 'queued',
    })
  } catch (err: any) {
    console.error('Render enqueue error:', err.message)
    return NextResponse.json({
      ok: false,
      error: err.message || 'Failed to enqueue render job',
    }, { status: 500 })
  }
}

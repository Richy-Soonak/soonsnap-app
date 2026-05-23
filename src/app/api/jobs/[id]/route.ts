/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/job-queue'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = await getJob(id)

  if (!job) {
    return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    job: {
      id: job.id,
      projectId: job.project_id,
      versionId: job.version_id,
      type: job.job_type,
      status: job.status,
      progress: job.progress,
      result: job.result_payload,
      error: job.error_message,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
    },
  })
}

/* eslint-disable */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy-initialized clients — call getClient() after env vars are loaded
let _db: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_db) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_KEY!
    if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set')
    _db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _db
}

/** Convenience getter — the service-role Supabase client */
export const db = {
  get instance() { return getClient() },
  from: (table: string) => getClient().from(table),
  auth: new Proxy({} as any, {
    get: (_, prop) => (getClient().auth as any)[prop],
  }),
}

// -------- Types --------

export type JobStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface Job {
  id: string
  project_id: string
  version_id: string | null
  job_type: string
  status: JobStatus
  progress: number
  input_payload: Record<string, any>
  result_payload: Record<string, any> | null
  error_message: string | null
  attempts: number
  max_attempts: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

// -------- Operations --------

/** Enqueue a new job */
export async function enqueueJob(
  projectId: string,
  jobType: string,
  inputPayload: Record<string, any>,
): Promise<Job> {
  const { data, error } = await db.from('soonsnap_jobs').insert({
    project_id: projectId,
    job_type: jobType,
    status: 'queued',
    input_payload: inputPayload,
    max_attempts: 3,
  }).select().single()

  if (error) throw new Error(`Failed to enqueue job: ${error.message}`)
  return data
}

/** Claim the next queued job (atomically mark as running) */
export async function claimNextJob(): Promise<Job | null> {
  // Get oldest queued job
  const { data: jobs, error: fetchErr } = await db.from('soonsnap_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)

  if (fetchErr || !jobs || jobs.length === 0) return null

  const job = jobs[0]

  // Claim it (CAS pattern)
  const { data: claimed, error: claimErr } = await db.from('soonsnap_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      attempts: job.attempts + 1,
    })
    .eq('id', job.id)
    .eq('status', 'queued') // Only claim if still queued
    .select()
    .single()

  if (claimErr || !claimed) {
    // Another worker grabbed it first — return null to try again next poll
    return null
  }

  return claimed
}

/** Update job progress */
export async function updateJobProgress(jobId: string, progress: number, status?: JobStatus): Promise<void> {
  const update: Record<string, any> = { progress }
  if (status) update.status = status
  await db.from('soonsnap_jobs').update(update).eq('id', jobId)
}

/** Mark job complete */
export async function completeJob(jobId: string, result: Record<string, any>): Promise<void> {
  await db.from('soonsnap_jobs').update({
    status: 'complete',
    progress: 100,
    result_payload: result,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId)
}

/** Mark job failed */
export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await db.from('soonsnap_jobs').update({
    status: 'failed',
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId)
}

/** Get a single job by ID */
export async function getJob(jobId: string): Promise<Job | null> {
  const { data, error } = await db.from('soonsnap_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error) return null
  return data
}

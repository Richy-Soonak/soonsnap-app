/* eslint-disable */
/**
 * SoonSnap Render Worker
 * 
 * Polls soonsnap_jobs for queued work and executes the pipeline:
 *   capture → compose (NIM AI) → render (hyperframes) → thumbnail (ffmpeg)
 * 
 * Run: npx tsx src/workers/render-worker.ts
 */

// MUST load env before any other imports — tsx/esbuild hoists ES imports
// but require() executes synchronously in order
const _path = require('path')
require('dotenv').config({ path: _path.resolve(process.cwd(), '.env.local') })

import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  db,
  claimNextJob,
  updateJobProgress,
  completeJob,
  failJob,
  Job,
} from '../lib/job-queue'

const CAPTURES_DIR = process.env.CAPTURES_DIR || '/tmp/soonsnap-captures'
const VIDEOS_DIR = process.env.VIDEOS_DIR || '/tmp/soonsnap-videos'
const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR || '/tmp/soonsnap-thumbnails'
const POLL_INTERVAL_MS = 3000

// Ensure dirs exist
mkdirSync(CAPTURES_DIR, { recursive: true })
mkdirSync(VIDEOS_DIR, { recursive: true })
mkdirSync(THUMBNAILS_DIR, { recursive: true })

async function runCapture(projectId: string, url: string): Promise<string> {
  const projectDir = join(CAPTURES_DIR, projectId)
  mkdirSync(projectDir, { recursive: true })

  console.log(`[capture] Starting for ${url} → ${projectDir}`)
  
  // hyperframes outputs progress to stderr — capture it but don't treat as error
  try {
    const result = execSync(
      `hyperframes capture "${url}" -o "${projectDir}" --json --max-screenshots 6 --timeout 60000`,
      { timeout: 180000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    console.log(`[capture] stdout: ${result?.slice(0, 200)}`)
  } catch (err: any) {
    // execSync throws on non-zero exit or stderr output, even if capture succeeded
    // Check if files were actually created
    if (!existsSync(join(projectDir, 'extracted', 'tokens.json'))) {
      throw err
    }
    console.log(`[capture] Completed with warnings`)
  }
  
  const tokensPath = join(projectDir, 'extracted', 'tokens.json')
  if (!existsSync(tokensPath)) {
    throw new Error('Capture completed but tokens.json not found')
  }
  
  console.log(`[capture] Complete for ${url}`)
  return projectDir
}

async function runCompose(
  projectDir: string,
  style: string,
  duration: number,
  prompt: string,
  tokens: any
): Promise<string> {
  const nvidiaKey = process.env.NVIDIA_API_KEY
  if (!nvidiaKey) throw new Error('NVIDIA_API_KEY not set')

  console.log(`[compose] Generating ${style} composition for ${duration}s`)

  const systemPrompt = `You are an expert HTML5 video composition generator. Create a ${duration}-second animated promotional video as a single self-contained HTML file.

RULES:
- Root element: <div data-composition-id="root" data-width="1920" data-height="1080" data-start="0" data-duration="${duration}">
- Use GSAP via <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
- Register: window.__timelines = {}; window.__timelines["root"] = tl;
- gsap.timeline({ paused: true }) only
- All animated elements need class="clip" + data-start + data-duration
- NO repeat: -1, async, setTimeout, Date.now
- Colors from site: ${JSON.stringify(tokens.colors?.slice(0, 8) || ['#111', '#fff'])}
- Fonts: ${JSON.stringify(tokens.fonts?.slice(0, 3) || ['sans-serif'])}
- Style: ${style}. ${prompt || 'Create a compelling promotional video.'}
- End with CTA showing the site URL
- Output ONLY the HTML code, no explanations`

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${nvidiaKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nvidia/llama-3.1-nemotron-nano-8b-v1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the HTML video composition now.' }
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`NIM API error ${response.status}: ${errText.slice(0, 200)}`)
  }

  const json = await response.json()
  let html = json.choices?.[0]?.message?.content || ''

  // Strip thinking preamble
  const doctypeIdx = html.indexOf('<!DOCTYPE')
  if (doctypeIdx > 0) html = html.slice(doctypeIdx)
  const htmlIdx = html.indexOf('<html')
  if (htmlIdx > 0 && doctypeIdx < 0) html = html.slice(htmlIdx)

  if (!html.includes('data-composition-id')) {
    html = html.replace(/<body>/, `<body>\n<div data-composition-id="root" data-width="1920" data-height="1080" data-start="0" data-duration="${duration}">`)
    html = html.replace(/<\/body>/, '</div>\n</body>')
  }

  const indexPath = join(projectDir, 'index.html')
  writeFileSync(indexPath, html)
  console.log(`[compose] HTML written (${html.length} chars)`)
  return indexPath
}

async function runRender(projectDir: string, outputPath: string): Promise<string> {
  console.log(`[render] hyperframes → ${outputPath}`)

  execSync(
    `hyperframes render "${projectDir}" -o "${outputPath}" --timeout 300000`,
    { timeout: 360000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  )

  if (!existsSync(outputPath)) {
    throw new Error(`Render completed but output not found: ${outputPath}`)
  }

  console.log(`[render] Complete`)
  return outputPath
}

async function runThumbnail(videoPath: string, thumbnailPath: string): Promise<string> {
  console.log(`[thumbnail] Extracting frame`)
  
  try {
    execSync(
      `ffmpeg -y -i "${videoPath}" -ss 00:00:01 -frames:v 1 -q:v 2 "${thumbnailPath}"`,
      { timeout: 30000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
  } catch {
    console.warn(`[thumbnail] Failed, continuing without`)
    return ''
  }

  return existsSync(thumbnailPath) ? thumbnailPath : ''
}

async function processJob(job: Job): Promise<void> {
  const { input_payload: payload, project_id: projectId } = job

  try {
    if (job.job_type === 'full_pipeline') {
      await updateJobProgress(job.id, 5, 'running')
      const projectDir = await runCapture(projectId, payload.url)

      await updateJobProgress(job.id, 30)
      
      const tokensPath = join(projectDir, 'extracted', 'tokens.json')
      const tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'))

      await updateJobProgress(job.id, 35)
      await runCompose(projectDir, payload.style, payload.duration, payload.prompt, tokens)

      await updateJobProgress(job.id, 50)

      const { data: versions } = await db
        .from('soonsnap_versions')
        .select('version_num')
        .eq('project_id', projectId)
        .order('version_num', { ascending: false })
        .limit(1)

      const nextVersion = (versions?.[0]?.version_num || 0) + 1
      const videoFileName = `${projectId}_v${nextVersion}.mp4`
      const videoPath = join(VIDEOS_DIR, videoFileName)
      
      await runRender(projectDir, videoPath)
      await updateJobProgress(job.id, 85)

      const thumbFileName = `${projectId}_v${nextVersion}.jpg`
      const thumbPath = join(THUMBNAILS_DIR, thumbFileName)
      await runThumbnail(videoPath, thumbPath)

      // Create version record
      const { data: version } = await db
        .from('soonsnap_versions')
        .insert({
          project_id: projectId,
          version_num: nextVersion,
          prompt: payload.prompt || `${payload.style} style, ${payload.duration}s`,
          enhanced_prompt: payload.enhancedPrompt,
          video_url: `/api/video/${projectId}?v=${nextVersion}`,
          thumbnail_url: thumbPath ? `/api/thumbnail/${projectId}?v=${nextVersion}` : null,
          file_path: videoPath,
          duration: payload.duration,
          status: 'complete',
          render_params: payload,
          active: true,
        })
        .select()
        .single()

      // Deactivate previous versions
      if (version) {
        await db
          .from('soonsnap_versions')
          .update({ active: false })
          .eq('project_id', projectId)
          .neq('id', version.id)

        await db
          .from('soonsnap_projects')
          .update({
            status: 'complete',
            active_version_id: version.id,
            thumbnail_url: thumbPath ? `/api/thumbnail/${projectId}?v=${nextVersion}` : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
      }

      await completeJob(job.id, {
        videoUrl: `/api/video/${projectId}?v=${nextVersion}`,
        versionId: version?.id,
        versionNum: nextVersion,
      })

      console.log(`[job ${job.id.slice(0, 8)}] COMPLETE — v${nextVersion}`)
    }
  } catch (err: any) {
    console.error(`[job ${job.id.slice(0, 8)}] FAILED: ${err.message}`)
    
    await db
      .from('soonsnap_projects')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', projectId)

    if (job.attempts < job.max_attempts) {
      await db
        .from('soonsnap_jobs')
        .update({ status: 'queued', error_message: err.message })
        .eq('id', job.id)
      console.log(`[job ${job.id.slice(0, 8)}] Re-queued (attempt ${job.attempts}/${job.max_attempts})`)
    } else {
      await failJob(job.id, err.message)
    }
  }
}

async function main() {
  console.log('🚀 SoonSnap Render Worker started')
  console.log(`   Captures: ${CAPTURES_DIR}`)
  console.log(`   Videos:   ${VIDEOS_DIR}`)
  console.log(`   Thumbs:   ${THUMBNAILS_DIR}`)
  console.log(`   Polling every ${POLL_INTERVAL_MS}ms\n`)

  while (true) {
    try {
      const job = await claimNextJob()
      if (job) {
        console.log(`\n[claim] Job ${job.id.slice(0, 8)} — ${job.job_type} for project ${job.project_id.slice(0, 8)}`)
        await processJob(job)
      }
    } catch (err: any) {
      console.error(`[worker] Error in main loop: ${err.message}`)
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch(err => {
  console.error('Worker crashed:', err)
  process.exit(1)
})

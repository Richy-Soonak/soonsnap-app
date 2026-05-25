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
  tokens: any,
  userTier: string = 'free'
): Promise<string> {
  // API key resolved below from app_config or env

  // Fetch LLM config from app_config (dynamic — can be changed from admin panel)
  const configKey = userTier === 'paid' ? 'soonsnap_llm_paid' : 'soonsnap_llm_free'
  let modelConfig = {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'nvidia/llama-3.1-nemotron-nano-8b-v1',
    max_tokens: 4096,
    temperature: 0.7,
    api_key: '',
  }
  try {
    const supabaseUrl = process.env.SUPABASE_URL_INTERNAL || 'http://localhost:8000'
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const configRes = await fetch(`${supabaseUrl}/rest/v1/app_config?key=eq.${configKey}&select=value`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })
    if (configRes.ok) {
      const configRows = await configRes.json() as any[]
      if (configRows?.[0]?.value) {
        modelConfig = { ...modelConfig, ...configRows[0].value }
      }
    }
  } catch (e: any) {
    console.log(`[compose] Warning: could not fetch app_config, using defaults: ${e.message}`)
  }

  // Resolve API key: config override > env var
  const apiKey = modelConfig.api_key || process.env.NVIDIA_API_KEY
  if (!apiKey) throw new Error('No API key available (neither app_config nor NVIDIA_API_KEY env)')

  console.log(`[compose] Generating ${style} composition for ${duration}s (model: ${modelConfig.model}, url: ${modelConfig.url}, tokens: ${modelConfig.max_tokens})`)

  const systemPrompt = `You are an expert HTML5 video composition generator for the HyperFrames framework.

TASK: Create a ${duration}-second animated promotional video as a SINGLE self-contained HTML file.

## MANDATORY HTML STRUCTURE

\`\`\`html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="root" data-start="0" data-duration="${duration}" data-width="1920" data-height="1080">

      <!-- SCENES: each is a positioned div with class="clip" -->
      <div id="scene1" class="clip" data-start="0" data-duration="5" data-track-index="1"
           style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#111;">
        <h1 style="font-size:80px; color:white;">Headline Text</h1>
      </div>

      <div id="scene2" class="clip" data-start="5" data-duration="5" data-track-index="1"
           style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#222;">
        <h1 style="font-size:80px; color:white;">Second Scene</h1>
      </div>

    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      // Animate scenes: fade in each scene
      tl.from("#scene1", { opacity: 0, duration: 0.8 }, 0);
      tl.from("#scene1 h1", { y: 60, duration: 0.8, ease: "power3.out" }, 0.2);
      tl.from("#scene2", { opacity: 0, duration: 0.8 }, 5);
      tl.from("#scene2 h1", { y: 60, duration: 0.8, ease: "power3.out" }, 5.2);
      window.__timelines["root"] = tl;
    </script>
  </body>
</html>
\`\`\`

## STRICT RULES

1. **Root element**: Must have \`data-composition-id="root"\`, \`data-width="1920"\`, \`data-height="1080"\`, \`data-duration="${duration}"\`
2. **Every visible timed element** MUST have \`class="clip"\` + \`data-start\` + \`data-duration\` + \`data-track-index\`
3. **GSAP only** — use \`gsap.timeline({ paused: true })\`. Register as \`window.__timelines["root"] = tl;\`
4. **Allowed GSAP methods**: \`tl.set()\`, \`tl.to()\`, \`tl.from()\`, \`tl.fromTo()\`
5. **Allowed GSAP properties**: opacity, x, y, scale, scaleX, scaleY, rotation, width, height, visibility
6. **Position parameter** (3rd arg) sets absolute time: \`tl.to(el, { opacity: 1, duration: 0.5 }, 1.5)\`
7. **All CSS must be inline or in a single <style> block** — no external stylesheets
8. **Each scene div** must be \`position: absolute; top:0; left:0; width:100%; height:100%;\`
9. **NO**: new Timeline(), new Clip(), async, setTimeout, Date.now, Math.random, fetch, external CSS files, repeat: -1
10. **NO**: markdown code fences, explanations, or commentary — output ONLY raw HTML

## DESIGN BRIEF

- Site colors: ${JSON.stringify(tokens.colors?.slice(0, 8) || ['#111', '#fff'])}
- Site fonts: ${JSON.stringify(tokens.fonts?.slice(0, 3) || ['sans-serif'])}
- Video style: ${style}
- Duration: ${duration} seconds
- ${prompt || 'Create a compelling promotional video showcasing the website.'}
- End with a CTA scene showing the site URL or brand name
- Use 3-5 scenes, each 3-5 seconds, with smooth GSAP transitions (fade, slide, scale)
- Make it visually striking with large text, bold colors, and dynamic animations

OUTPUT ONLY THE COMPLETE HTML FILE. NO MARKDOWN. NO EXPLANATIONS.`

  const response = await fetch(modelConfig.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the HTML video composition now.' }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.max_tokens,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`NIM API error ${response.status}: ${errText.slice(0, 200)}`)
  }

  const json = await response.json()
  let html = json.choices?.[0]?.message?.content || ''

  // Strip markdown code fences and thinking preamble
  html = html.replace(/```html?\n?/gi, '').replace(/```\n?/g, '')
  const doctypeIdx = html.indexOf('<!DOCTYPE')
  if (doctypeIdx > 0) html = html.slice(doctypeIdx)
  const doctypeIdx2 = html.indexOf('<!doctype')
  if (doctypeIdx2 > 0) html = html.slice(doctypeIdx2)
  const htmlIdx = html.indexOf('<html')
  if (htmlIdx > 0 && doctypeIdx < 0 && doctypeIdx2 < 0) html = html.slice(htmlIdx)
  // Remove any trailing text after </html>
  const closeHtml = html.lastIndexOf('</html>')
  if (closeHtml > 0) html = html.slice(0, closeHtml + 7)

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

  // Look up user tier for LLM config selection
  let userTier = 'free'
  try {
    const { data: project } = await db
      .from('soonsnap_projects')
      .select('user_id')
      .eq('id', projectId)
      .single()
    if (project?.user_id) {
      const { data: wallet } = await db
        .from('soonsnap_wallets')
        .select('tier')
        .eq('user_id', project.user_id)
        .single()
      if (wallet?.tier) userTier = wallet.tier
    }
  } catch {}

  try {
    if (job.job_type === 'full_pipeline') {
      await updateJobProgress(job.id, 5, 'running')
      const projectDir = await runCapture(projectId, payload.url)

      await updateJobProgress(job.id, 30)
      
      const tokensPath = join(projectDir, 'extracted', 'tokens.json')
      const tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'))

      await updateJobProgress(job.id, 35)
      await runCompose(projectDir, payload.style, payload.duration, payload.prompt, tokens, userTier)

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

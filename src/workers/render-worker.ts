/* eslint-disable */
/**
 * SoonSnap Render Worker
 * 
 * Polls soonsnap_jobs for queued work and executes the pipeline:
 *   capture → compose (AI + HyperFrames) → render → thumbnail
 * 
 * Compose uses the HyperFrames skill's reference prompt with validation.
 * Falls back to template-based composition if AI fails.
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

// ─── HTML Validation (from HyperFrames skill) ───────────────────────────
function validateComposition(html: string): { valid: boolean; reason?: string } {
  // 1. No markdown code fences (quick reject — models love to add these)
  if (html.includes('```')) return { valid: false, reason: 'Markdown code fences in output' }

  // 2. No import/require statements
  if (/import\s.*from|require\s*\(/.test(html)) return { valid: false, reason: 'Import/require statements in HTML' }

  // 3. Must NOT use 'new' keyword with GSAP
  if (/new\s+(gsap|Timeline|Clip)/.test(html)) return { valid: false, reason: 'Fake constructor: new gsap/Timeline/Clip' }

  // 4. Must register timeline properly
  if (!html.includes('window.__timelines')) return { valid: false, reason: 'Missing window.__timelines registration' }

  // 5. Must use real GSAP API — check for gsap.timeline({ paused: true })
  if (!html.includes('gsap.timeline')) return { valid: false, reason: 'Missing gsap.timeline() call' }

  // 6. Must have clip elements with data-start (actual scene divs, not scripts)
  const clipCount = (html.match(/class="clip"/g) || []).length
  if (clipCount < 1) return { valid: false, reason: `No clip elements found (need class="clip" with data-start)` }

  // 7. Clips must contain visible HTML content (h1-h6, p, img, span, div with text) — NOT just script tags
  const clipBlocks = html.match(/class="clip"[^>]*>[\s\S]*?<\/div>/g) || []
  let hasVisualContent = false
  for (const block of clipBlocks) {
    if (/<(h[1-6]|p|img|span|button|a)\b/.test(block)) {
      hasVisualContent = true
      break
    }
  }
  if (!hasVisualContent) return { valid: false, reason: 'Clips have no visible HTML content (h1-h6, p, img, etc.)' }

  // 8. GSAP methods must be real (tl.set, tl.to, tl.from, tl.fromTo only)
  const gsapMethods = html.match(/tl\.(\w+)/g) || []
  const fakeMethods = gsapMethods.filter(m => {
    const method = m.replace('tl.', '')
    return !['set', 'to', 'from', 'fromTo', 'call', 'add'].includes(method)
  })
  if (fakeMethods.length > 3) return { valid: false, reason: `Hallucinated timeline methods: ${fakeMethods.slice(0, 5).join(', ')}` }

  // 9. Root must have required data attributes
  if (!html.includes('data-width=') || !html.includes('data-height=') || !html.includes('data-start="0"')) {
    return { valid: false, reason: 'Root missing required data attributes' }
  }

  return { valid: true }
}

// ─── Template Fallback (from composition-basic.html) ─────────────────────
function templateCompose(
  projectDir: string,
  style: string,
  duration: number,
  tokens: any,
): string {
  const colors = tokens.colors || ['#111111', '#ffffff', '#3D79FB']
  const fonts = tokens.fonts || ['sans-serif']
  const headings = tokens.headings || ['Your Brand']
  const fontFamily = Array.isArray(fonts) ? fonts[0] : 'sans-serif'

  // Pick colors by role
  const bgDark = colors.find((c: string) => { const h = parseInt(c.slice(1), 16); return h < 0x333333 }) || colors[0]
  const bgLight = colors.find((c: string) => { const h = parseInt(c.slice(1), 16); return h > 0xCCCCCC }) || '#ffffff'
  const accent = colors.find((c: string) => { const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16); return b > r && b > g }) || colors[2] || '#3D79FB'

  const headline = Array.isArray(headings) ? headings[0] : 'Your Brand'
  const subtitle = Array.isArray(headings) && headings.length > 1 ? headings.slice(0, 3).join(' · ') : 'Built Different'
  const sceneDur = Math.floor(duration / 3)

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #000; }
      .scene {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        visibility: hidden;
      }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="root" data-start="0" data-duration="${duration}" data-width="1920" data-height="1080">

      <div id="scene1" class="clip scene" data-start="0" data-duration="${sceneDur}" data-track-index="1"
           style="background:${bgDark}">
        <h1 style="font-size:90px; color:${bgLight}; font-family:${fontFamily}; text-align:center;">
          ${headline}
        </h1>
      </div>

      <div id="scene2" class="clip scene" data-start="${sceneDur}" data-duration="${sceneDur}" data-track-index="1"
           style="background:${accent}">
        <h1 style="font-size:64px; color:${bgLight}; font-family:${fontFamily}; text-align:center;">
          ${subtitle}
        </h1>
      </div>

      <div id="scene3" class="clip scene" data-start="${sceneDur * 2}" data-duration="${duration - sceneDur * 2}" data-track-index="1"
           style="background:${bgDark}">
        <div style="text-align:center;">
          <h1 style="font-size:72px; color:${accent}; font-family:${fontFamily};">
            Visit Now
          </h1>
        </div>
      </div>

    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.set("#scene1", { visibility: "visible" }, 0);
      tl.from("#scene1", { opacity: 0, scale: 0.8, duration: 0.8 }, 0);
      tl.from("#scene1 h1", { y: 80, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.3);
      tl.set("#scene1", { visibility: "hidden" }, ${sceneDur});
      tl.set("#scene2", { visibility: "visible" }, ${sceneDur});
      tl.from("#scene2", { opacity: 0, duration: 0.6 }, ${sceneDur});
      tl.from("#scene2 h1", { y: 60, opacity: 0, duration: 0.8, ease: "power3.out" }, ${sceneDur + 0.3});
      tl.set("#scene2", { visibility: "hidden" }, ${sceneDur * 2});
      tl.set("#scene3", { visibility: "visible" }, ${sceneDur * 2});
      tl.from("#scene3", { opacity: 0, scale: 1.2, duration: 0.6 }, ${sceneDur * 2});
      tl.from("#scene3 h1", { y: -40, opacity: 0, duration: 0.8, ease: "power3.out" }, ${sceneDur * 2 + 0.3});
      window.__timelines["root"] = tl;
    </script>
  </body>
</html>`

  const indexPath = join(projectDir, 'index.html')
  writeFileSync(indexPath, html)
  console.log(`[compose] Template fallback written (${html.length} chars)`)
  return indexPath
}

// ─── Capture ─────────────────────────────────────────────────────────────
async function runCapture(projectId: string, url: string): Promise<string> {
  const projectDir = join(CAPTURES_DIR, projectId)
  mkdirSync(projectDir, { recursive: true })

  console.log(`[capture] Starting for ${url} → ${projectDir}`)
  
  try {
    const result = execSync(
      `hyperframes capture "${url}" -o "${projectDir}" --json --max-screenshots 6 --timeout 60000`,
      { timeout: 180000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    console.log(`[capture] stdout: ${result?.slice(0, 200)}`)
  } catch (err: any) {
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

// ─── AI Compose (with validation + retry + fallback) ─────────────────────
async function runCompose(
  projectDir: string,
  style: string,
  duration: number,
  prompt: string,
  tokens: any,
  userTier: string = 'free'
): Promise<string> {
  // Fetch LLM config from app_config
  const configKey = userTier === 'paid' ? 'soonsnap_llm_paid' : 'soonsnap_llm_free'
  let modelConfig = {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-v4-flash:free',
    max_tokens: 16384,
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
    console.log(`[compose] Warning: could not fetch app_config: ${e.message}`)
  }

  // Resolve API key: config override > env var
  const apiKey = modelConfig.api_key || process.env.NVIDIA_API_KEY || ''
  if (!apiKey) throw new Error('No API key available')

  // Extract site data from tokens
  const siteColors = tokens.colors?.slice(0, 8) || ['#111111', '#ffffff', '#3D79FB']
  const siteFonts = tokens.fonts?.slice(0, 3) || ['sans-serif']
  const siteHeadings = tokens.headings?.slice(0, 5) || []
  const headline = siteHeadings[0] || 'Your Brand'
  const subtitle = siteHeadings.slice(1, 3).join(' · ') || 'Built Different'

  // Build the reference-grade prompt from the HyperFrames skill
  const systemPrompt = `You are an expert HTML5 video composition generator for the HyperFrames framework.

TASK: Create a ${duration}-second animated promotional video as a SINGLE self-contained HTML file.

## MANDATORY HTML STRUCTURE

You MUST follow this EXACT structure. Every attribute is required:

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

    <!-- Scene clips go here -->

  </div>

  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    // GSAP tweens go here — ONLY .set(), .to(), .from(), .fromTo()
    window.__timelines["root"] = tl;
  </script>
</body>
</html>

## SCENE CLIP RULES

Each scene MUST be a div with ALL of these attributes:
- class="clip" (required)
- data-start="N" — when the scene begins (seconds)
- data-duration="N" — how long the scene lasts (seconds)
- data-track-index="1" — all scenes on the same track
- style="position:absolute; top:0; left:0; width:100%; height:100%; visibility:hidden; ..."
- Use tl.set("#id", { visibility: "visible" }, startTime) to show each scene
- Use tl.set("#id", { visibility: "hidden" }, startTime + duration) to hide after

## GSAP RULES (CRITICAL — VIOLATION = WHITE SCREEN)

The ONLY valid GSAP methods are:
- gsap.timeline({ paused: true }) — create timeline (MUST be paused)
- tl.set(target, vars, timePosition) — set initial/kill state
- tl.to(target, vars, timePosition) — animate TO values
- tl.from(target, vars, timePosition) — animate FROM values
- tl.fromTo(target, fromVars, toVars, timePosition) — animate FROM/TO

The ONLY valid GSAP properties: opacity, x, y, scale, rotation, visibility, autoAlpha, width, height, backgroundColor, color, fontSize, textShadow, boxShadow, ease, duration, stagger

ILLEGAL — DO NOT USE ANY OF THESE:
- new Timeline() or new Clip() — these DO NOT EXIST
- gsap.utils.sizeTo() or gsap.utils.anything() — hallucinated API
- import { tl } from 'gsap/tl' — not a real module
- tc.repeat(Infinity, ...) — not a real method
- Any method not in the allowed list above

## ANIMATION PATTERN

For each scene:
1. tl.set("#sceneId", { visibility: "visible" }, startTime) — make visible
2. tl.from("#sceneId", { opacity: 0, ... }, startTime) — entrance
3. tl.from("#sceneId h1", { y: 80, opacity: 0, ... }, startTime + 0.3) — content entrance
4. tl.set("#sceneId", { visibility: "hidden" }, startTime + duration) — kill visibility

## SITE DATA

URL: ${prompt || 'promotional website'}
Style: ${style}
Colors: ${JSON.stringify(siteColors)}
Fonts: ${JSON.stringify(siteFonts)}
Headline: ${headline}
Subtitle: ${subtitle}

## OUTPUT RULES

- Output ONLY raw HTML — no markdown, no code fences, no explanations
- No new keyword anywhere in the output
- No import or require statements
- No async, await, setTimeout, or Date.now()
- Total data-duration of root must equal ${duration}
- Use 3-5 scenes with smooth transitions
- End with a CTA scene showing the brand name
- Make it visually striking with large text, bold colors, dynamic GSAP animations

OUTPUT ONLY THE COMPLETE HTML FILE. NO MARKDOWN. NO EXPLANATIONS.`

  console.log(`[compose] AI generating ${style} composition (${duration}s, model: ${modelConfig.model})`)

  // Attempt AI composition (up to 2 tries)
  let html = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(modelConfig.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://soonsnap-app.vercel.app',
          'X-Title': 'SoonSnap',
        },
        body: JSON.stringify({
          model: modelConfig.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate the HTML video composition now. ${duration} seconds, ${style} style. Use these colors: ${JSON.stringify(siteColors)}. Headline: "${headline}". Subtitle: "${subtitle}". Output ONLY the raw HTML file.` }
          ],
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.max_tokens,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.log(`[compose] API error on attempt ${attempt}: ${response.status} ${errText.slice(0, 200)}`)
        continue
      }

      const json = await response.json()
      html = json.choices?.[0]?.message?.content || ''

      if (!html) {
        console.log(`[compose] Empty response on attempt ${attempt}`)
        continue
      }

      // Post-processing: strip code fences, thinking preamble
      html = html.replace(/```html?\n?/gi, '').replace(/```\n?/g, '')
      const doctypeIdx = html.toLowerCase().indexOf('<!doctype')
      if (doctypeIdx > 0) html = html.slice(doctypeIdx)
      const htmlIdx = html.indexOf('<html')
      if (htmlIdx > 0 && doctypeIdx < 0) html = html.slice(htmlIdx)
      const closeHtml = html.lastIndexOf('</html>')
      if (closeHtml > 0) html = html.slice(0, closeHtml + 7)

      // Validate before accepting
      const validation = validateComposition(html)
      if (validation.valid) {
        console.log(`[compose] AI output validated on attempt ${attempt} (${html.length} chars)`)
        break
      } else {
        console.log(`[compose] Validation failed on attempt ${attempt}: ${validation.reason}`)
        html = '' // Reset for retry
      }
    } catch (e: any) {
      console.log(`[compose] Error on attempt ${attempt}: ${e.message}`)
    }
  }

  // If AI failed, fall back to template
  if (!html) {
    console.log(`[compose] AI composition failed — using template fallback`)
    return templateCompose(projectDir, style, duration, tokens)
  }

  const indexPath = join(projectDir, 'index.html')
  writeFileSync(indexPath, html)
  console.log(`[compose] HTML written (${html.length} chars)`)
  return indexPath
}

// ─── Render ──────────────────────────────────────────────────────────────
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

// ─── Thumbnail ───────────────────────────────────────────────────────────
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

// ─── Job Processor ───────────────────────────────────────────────────────
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

      const agentUrl = process.env.SOONSNAP_AGENT_URL || 'http://localhost:3200'
      console.log(`[agent] Sending to ${agentUrl}/render`)

      const { data: versions } = await db
        .from('soonsnap_versions')
        .select('version_num')
        .eq('project_id', projectId)
        .order('version_num', { ascending: false })
        .limit(1)

      const nextVersion = (versions?.[0]?.version_num || 0) + 1
      const videoFileName = `${projectId}_v${nextVersion}.mp4`
      const videoPath = join(VIDEOS_DIR, videoFileName)

      // Agent render can take 5-10 minutes — set long timeout
      const agentController = new AbortController()
      const agentTimeout = setTimeout(() => agentController.abort(), 660000) // 11 min

      const agentRes = await fetch(`${agentUrl}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          projectId,
          url: payload.url,
          style: payload.style || 'cinematic',
          duration: payload.duration || 10,
          prompt: payload.prompt || '',
          captureDir: projectDir,
          tier: userTier,
        }),
        signal: agentController.signal,
      })

      clearTimeout(agentTimeout)

      if (!agentRes.ok) {
        const errText = await agentRes.text()
        throw new Error(`Agent returned ${agentRes.status}: ${errText.slice(0, 300)}`)
      }

      const agentResult = await agentRes.json() as any
      if (!agentResult.success) {
        throw new Error(`Agent render failed: ${agentResult.error || 'unknown'}`)
      }

      // Move video from agent output to our videos dir
      const agentVideo = agentResult.videoPath
      if (agentVideo && agentVideo !== videoPath) {
        execSync(`cp "${agentVideo}" "${videoPath}"`)
      }

      const agentThumb = agentResult.thumbnailPath
      const thumbFileName = `${projectId}_v${nextVersion}.jpg`
      const thumbPath = join(THUMBNAILS_DIR, thumbFileName)
      if (agentThumb) {
        execSync(`cp "${agentThumb}" "${thumbPath}"`)
      }

      console.log(`[agent] Render complete — ${agentResult.size} bytes`)

      await updateJobProgress(job.id, 85)

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

// ─── Main Loop ───────────────────────────────────────────────────────────
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

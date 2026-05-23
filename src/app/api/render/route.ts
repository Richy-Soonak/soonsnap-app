/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// Allow up to 5 minutes for AI compose + render
export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CAPTURES_DIR = '/tmp/soonsnap-captures'
const VIDEOS_DIR = '/tmp/soonsnap-videos'
const NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NIM_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1'

async function generateComposition(
  tokens: any,
  style: string,
  duration: string,
  title: string
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) throw new Error('NVIDIA_API_KEY not configured')

  const prompt = `You are a video composition expert. Generate a HyperFrames HTML video composition based on the following website design tokens.

STYLE: ${style}
DURATION: ${duration} seconds
TITLE: ${title}

DESIGN TOKENS:
${JSON.stringify(tokens, null, 2)}

Generate a complete HyperFrames HTML composition file. Use these rules:
- Wrap everything in a single <html> with embedded <style> and <body>
- Use CSS animations (keyframes, transitions) for all motion
- Match the website's color palette from the tokens
- Include the headings text from the tokens as animated text overlays
- Use a 1920x1080 (16:9) aspect ratio
- Include animated sections that reveal sequentially
- Add a subtle background gradient using the site's colors
- End with a call-to-action frame
- Total animation duration should be approximately ${duration} seconds

Output ONLY the raw HTML, no markdown fences or explanation.`

  const response = await fetch(NIM_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`NIM API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  let html = data.choices?.[0]?.message?.content || ''

  // Strip markdown fences if present
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim()

  if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
    html = `<!DOCTYPE html>
<html>
<head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1920px; height: 1080px; overflow: hidden; background: #0F0F1A; color: #F8F9FC; font-family: system-ui, sans-serif; }
</style></head>
<body>
${html}
</body></html>`
  }

  return html
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, style = 'cinematic', duration = '30', tokens, title } = await req.json()

    if (!projectId) {
      return NextResponse.json({ ok: false, error: 'Missing projectId' }, { status: 400 })
    }

    mkdirSync(VIDEOS_DIR, { recursive: true })

    // Update project
    await supabase
      .from('soonsnap_projects')
      .update({ status: 'composing', updated_at: new Date().toISOString() })
      .eq('id', projectId)

    // Get capture data from disk if tokens not provided
    let captureTokens = tokens
    let captureTitle = title
    const projectDir = join(CAPTURES_DIR, projectId)

    if (!captureTokens && existsSync(join(projectDir, 'extracted', 'tokens.json'))) {
      captureTokens = JSON.parse(readFileSync(join(projectDir, 'extracted', 'tokens.json'), 'utf-8'))
    }
    if (!captureTitle) {
      captureTitle = captureTokens?.title || 'Untitled'
    }

    if (!captureTokens) {
      return NextResponse.json({ ok: false, error: 'No design tokens found — run capture first' }, { status: 400 })
    }

    // Generate composition HTML via AI
    const compositionHtml = await generateComposition(captureTokens, style, duration, captureTitle)

    // Write composition to capture dir
    writeFileSync(join(projectDir, 'index.html'), compositionHtml)

    // Update project status
    await supabase
      .from('soonsnap_projects')
      .update({ status: 'rendering', updated_at: new Date().toISOString() })
      .eq('id', projectId)

    // Render with HyperFrames
    const outputPath = join(VIDEOS_DIR, `${projectId}.mp4`)
    execSync(
      `hyperframes render "${projectDir}" -o "${outputPath}" --timeout 120000`,
      { timeout: 180000, encoding: 'utf-8' }
    )

    // Verify output
    if (!existsSync(outputPath)) {
      throw new Error('Render completed but output file not found')
    }

    // Create version in DB
    const { data: existingVersions } = await supabase
      .from('soonsnap_versions')
      .select('version_num')
      .eq('project_id', projectId)
      .order('version_num', { ascending: false })
      .limit(1)

    const nextVersion = (existingVersions?.[0]?.version_num || 0) + 1

    await supabase.from('soonsnap_versions').insert({
      project_id: projectId,
      version_num: nextVersion,
      prompt: `${style} style, ${duration}s`,
      video_url: `/api/video/${projectId}`,
      status: 'complete',
    })

    // Update project
    await supabase
      .from('soonsnap_projects')
      .update({ status: 'complete', updated_at: new Date().toISOString() })
      .eq('id', projectId)

    // Log the render
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('soonsnap_render_log').insert({
        user_id: user.id,
      }).then(() => {
        // Ignore duplicate key errors (already rendered today)
      })
    }

    return NextResponse.json({
      ok: true,
      videoUrl: `/api/video/${projectId}`,
    })
  } catch (err: any) {
    console.error('Render error:', err.message)

    try {
      const body = await req.json()
      if (body.projectId) {
        await supabase
          .from('soonsnap_projects')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', body.projectId)
      }
    } catch {}

    return NextResponse.json({
      ok: false,
      error: err.message || 'Render failed',
    }, { status: 500 })
  }
}

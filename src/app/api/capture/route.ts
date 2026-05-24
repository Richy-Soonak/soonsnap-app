/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// Allow up to 3 minutes for capture
export const maxDuration = 180

const supabase = createClient(
  process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://173.249.36.76:8000',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CAPTURES_DIR = '/tmp/soonsnap-captures'

export async function POST(req: NextRequest) {
  try {
    const { url, projectId } = await req.json()

    if (!url || !projectId) {
      return NextResponse.json({ ok: false, error: 'Missing url or projectId' }, { status: 400 })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid URL' }, { status: 400 })
    }

    // Update project status
    await supabase
      .from('soonsnap_projects')
      .update({ status: 'capturing' })
      .eq('id', projectId)

    // Create capture directory
    const projectDir = join(CAPTURES_DIR, projectId)
    mkdirSync(projectDir, { recursive: true })

    // Run HyperFrames capture (can take 1-2 mins for heavy sites)
    const result = execSync(
      `hyperframes capture "${url}" -o "${projectDir}" --json --max-screenshots 6 --timeout 60000`,
      { timeout: 180000, encoding: 'utf-8' }
    )

    let captureResult: any = {}
    try {
      captureResult = JSON.parse(result)
    } catch {
      // If not JSON, still check if files exist
    }

    // Read extracted tokens
    let tokens = null
    let designStyles = null
    let title = captureResult.title || new URL(url).hostname

    const tokensPath = join(projectDir, 'extracted', 'tokens.json')
    const stylesPath = join(projectDir, 'extracted', 'design-styles.json')

    if (existsSync(tokensPath)) {
      tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'))
      title = tokens.title || title
    }
    if (existsSync(stylesPath)) {
      designStyles = JSON.parse(readFileSync(stylesPath, 'utf-8'))
    }

    // Update project
    await supabase
      .from('soonsnap_projects')
      .update({ status: 'composing', title, updated_at: new Date().toISOString() })
      .eq('id', projectId)

    return NextResponse.json({
      ok: true,
      title,
      tokens,
      designStyles,
      screenshots: captureResult.screenshots || 0,
    })
  } catch (err: any) {
    console.error('Capture error:', err.message)

    // Try to update project status
    try {
      const { projectId } = await req.json()
      if (projectId) {
        await supabase
          .from('soonsnap_projects')
          .update({ status: 'failed' })
          .eq('id', projectId)
      }
    } catch {}

    return NextResponse.json({
      ok: false,
      error: err.message || 'Capture failed',
    }, { status: 500 })
  }
}

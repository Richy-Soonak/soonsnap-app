import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/project?id=<uuid> — fetch project with versions
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const { data: project, error: projErr } = await supabase
    .from('soonsnap_projects')
    .select('*')
    .eq('id', id)
    .single()

  if (projErr || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data: versions } = await supabase
    .from('soonsnap_versions')
    .select('*')
    .eq('project_id', id)
    .order('version_num', { ascending: false })

  return NextResponse.json({ project, versions: versions || [] })
}

// POST /api/project — create a new project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, userId } = body as { url?: string; userId?: string }

    if (!url || !userId) {
      return NextResponse.json({ error: 'url and userId are required' }, { status: 400 })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Extract title from URL
    let title = ''
    try {
      title = new URL(url).hostname.replace('www.', '')
    } catch {
      title = url
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('soonsnap_projects')
      .insert({
        user_id: userId,
        url,
        title,
        status: 'capturing',
      })
      .select()
      .single()

    if (error) {
      console.error('Create project error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, project: data })
  } catch (error: unknown) {
    console.error('Project create error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

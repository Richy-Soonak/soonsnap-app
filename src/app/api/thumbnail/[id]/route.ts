/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'

const SERVER_URL = process.env.SUPABASE_URL_INTERNAL?.replace(':8000', '') || 'http://173.249.36.76'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const version = searchParams.get('v') || '1'

  const thumbUrl = `${SERVER_URL}/soonsnap/thumbnails/${id}_v${version}.jpg`
  const response = await fetch(thumbUrl)

  if (!response.ok) {
    return NextResponse.json({ ok: false, error: 'Thumbnail not found' }, { status: 404 })
  }

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

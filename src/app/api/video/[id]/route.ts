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

  const videoUrl = `${SERVER_URL}/soonsnap/videos/${id}_v${version}.mp4`

  // Forward range headers for video seeking
  const headers: Record<string, string> = {
    'Accept': 'video/mp4',
  }
  const range = req.headers.get('range')
  if (range) headers['Range'] = range

  const response = await fetch(videoUrl, { headers })

  if (!response.ok) {
    return NextResponse.json({ ok: false, error: 'Video not found' }, { status: 404 })
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
  }

  // Forward relevant headers from origin
  const contentRange = response.headers.get('content-range')
  const contentLength = response.headers.get('content-length')
  if (contentRange) responseHeaders['Content-Range'] = contentRange
  if (contentLength) responseHeaders['Content-Length'] = contentLength

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  })
}

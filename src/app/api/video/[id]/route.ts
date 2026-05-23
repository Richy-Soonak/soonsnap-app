import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const VIDEOS_DIR = '/tmp/soonsnap-videos'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  // Sanitize ID (prevent path traversal)
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const videoPath = join(VIDEOS_DIR, `${id}.mp4`)

  if (!existsSync(videoPath)) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const stat = statSync(videoPath)
  const fileSize = stat.size

  // Handle range requests for video seeking
  const range = req.headers.get('range')

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunkSize = end - start + 1

    const buffer = readFileSync(videoPath)
    const chunk = buffer.slice(start, end + 1)

    return new NextResponse(chunk, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  // Full file response
  const buffer = readFileSync(videoPath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Length': fileSize.toString(),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
